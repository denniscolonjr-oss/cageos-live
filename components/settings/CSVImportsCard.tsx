"use client";

/**
 * CSVImportsCard — Settings → Imports view (iter-28c).
 *
 * Lists every past CSV upload, newest first. Each row shows filename,
 * date, uploader, and row counts (created / overwritten / skipped). A
 * delete button on each row runs the safety-aware batch delete: assets
 * currently in active kits or checkouts are preserved (untagged from
 * the import); assets safe to remove are deleted.
 *
 * Manager+ only — the delete mutator in the hook enforces this, but
 * the UI also gates the button.
 *
 * Confirmation flow:
 *   1. User clicks Delete on an import row
 *   2. Modal opens with a summary: "N assets in this import. X can be
 *      deleted safely. Y are in active use and will be preserved."
 *   3. User confirms or cancels
 *   4. On confirm, deleteCSVImport runs and a toast surfaces the result
 */

import { useState, useMemo } from "react";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";

export default function CSVImportsCard() {
  const auth = useAuth();
  const { data, deleteCSVImport } = useWorkspace();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const canManage = auth.currentRole === "owner" || auth.currentRole === "manager";

  const actorInitials = useMemo(() => {
    if (!auth.user) return "—";
    const profile = data.profiles.find(p => p.email === auth.user?.email);
    return profile?.initials ?? "—";
  }, [auth.user, data.profiles]);

  // Sort newest first
  const imports = useMemo(() => {
    return [...(data.csvImports ?? [])].sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }, [data.csvImports]);

  /**
   * For the confirm modal: pre-compute how many assets from this import
   * are safe to delete vs preserved-in-use. Same logic as the hook —
   * any asset that's part of a kit (and thus potentially in an active
   * checkout or assigned project) is preserved.
   */
  function previewDelete(importId: string) {
    const importRecord = imports.find(i => i.id === importId);
    if (!importRecord) return { deletable: 0, preserved: 0 };
    const inUseIds = new Set(data.assets.filter(a => a.kitId).map(a => a.id));
    let deletable = 0, preserved = 0;
    for (const id of importRecord.importedAssetIds) {
      if (inUseIds.has(id)) preserved++;
      else deletable++;
    }
    return { deletable, preserved };
  }

  function handleConfirmDelete() {
    if (!confirmingId) return;
    const result = deleteCSVImport(confirmingId, actorInitials);
    if (!result) {
      toast("Couldn't delete import", { variant: "error", detail: "Permission denied." });
      return;
    }
    setConfirmingId(null);
    if (result.preserved > 0) {
      toast(`Deleted ${result.deleted} asset${result.deleted === 1 ? "" : "s"}`, {
        detail: `${result.preserved} preserved (in active use).`,
      });
    } else {
      toast(`Deleted ${result.deleted} asset${result.deleted === 1 ? "" : "s"}`);
    }
  }

  const confirmingImport = confirmingId ? imports.find(i => i.id === confirmingId) : null;
  const confirmingSummary = confirmingId ? previewDelete(confirmingId) : null;

  return (
    <>
      <Card>
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600 }}>CSV Imports</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
              {imports.length} total
            </div>
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14 }}>
            History of every CSV asset upload. Roll back an import to remove the assets it created. Assets currently in kits or checkouts are preserved.
          </div>

          {imports.length === 0 ? (
            <div style={{
              padding: "16px 14px",
              background: "var(--s2)",
              border: "1px dashed var(--b1)",
              borderRadius: 6,
              fontFamily: "'DM Mono',monospace", fontSize: 11,
              color: "var(--t3)",
              textAlign: "center",
            }}>
              No CSV imports yet. Use the &quot;Import CSV&quot; button on the assets page to start.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {imports.map(imp => {
                const uploader = data.profiles.find(p => p.initials === imp.uploadedBy);
                return (
                  <div key={imp.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px",
                    background: "var(--s2)", border: "1px solid var(--b1)",
                    borderRadius: 5,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: "var(--t1)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {imp.filename}
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                        {formatDateTime(imp.uploadedAt)} · by {uploader?.name ?? imp.uploadedBy}
                      </div>
                      <div style={{
                        display: "flex", flexWrap: "wrap", gap: 8,
                        fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t2)",
                        marginTop: 4,
                      }}>
                        <span><strong style={{ color: "var(--t1)" }}>{imp.rowsImported}</strong> created</span>
                        {imp.rowsOverwritten > 0 && <span><strong style={{ color: "var(--t1)" }}>{imp.rowsOverwritten}</strong> overwritten</span>}
                        {imp.rowsSkipped > 0 && <span><strong style={{ color: "var(--t1)" }}>{imp.rowsSkipped}</strong> skipped</span>}
                      </div>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => setConfirmingId(imp.id)}
                        style={{
                          padding: "5px 11px", borderRadius: 4,
                          background: "transparent",
                          color: "var(--red)",
                          border: "1px solid var(--red)",
                          fontFamily: "'DM Mono',monospace", fontSize: 10,
                          cursor: "pointer", minHeight: 27,
                          flexShrink: 0,
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Confirm delete modal */}
      {confirmingImport && confirmingSummary && (
        <Modal
          open={!!confirmingId}
          onClose={() => setConfirmingId(null)}
          title="Delete CSV import?"
          maxWidth={520}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{
              fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--t1)", lineHeight: 1.6,
            }}>
              You&apos;re about to delete the assets created by <strong>{confirmingImport.filename}</strong>.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              <SummaryStat label="Will delete" value={confirmingSummary.deletable} tint="red" />
              <SummaryStat label="Will preserve" value={confirmingSummary.preserved} tint="amber" />
            </div>

            {confirmingSummary.preserved > 0 && (
              <div style={{
                padding: "10px 12px",
                background: "color-mix(in srgb, var(--amber, #f59e0b) 6%, var(--s2))",
                border: "1px solid color-mix(in srgb, var(--amber, #f59e0b) 30%, var(--b1))",
                borderRadius: 6,
                fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t2)", lineHeight: 1.5,
              }}>
                <strong style={{ color: "var(--t1)" }}>{confirmingSummary.preserved} asset{confirmingSummary.preserved === 1 ? "" : "s"}</strong> from this import {confirmingSummary.preserved === 1 ? "is" : "are"} currently in active kits, checkouts, or projects. {confirmingSummary.preserved === 1 ? "It" : "They"} will stay in the workspace — just untagged from this import — so existing kits and checkouts aren&apos;t broken.
              </div>
            )}

            {confirmingSummary.deletable === 0 && confirmingSummary.preserved === 0 && (
              <div style={{
                padding: "10px 12px",
                background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 6,
                fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)",
              }}>
                This import has no assets to delete (already manually removed). Confirming will clear the import record itself.
              </div>
            )}

            <div style={{
              fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)",
              letterSpacing: "0.04em", lineHeight: 1.5,
            }}>
              This action cannot be undone. Audit log will record the deletion.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
              <button
                onClick={() => setConfirmingId(null)}
                style={{
                  padding: "10px 16px", borderRadius: 6,
                  background: "transparent", border: "1px solid var(--b2)",
                  color: "var(--t1)", cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif", fontSize: 13,
                  minHeight: 40,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{
                  padding: "10px 18px", borderRadius: 6,
                  background: "var(--red)", color: "var(--bg)",
                  border: "none", cursor: "pointer",
                  fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                  minHeight: 40,
                }}
              >
                Delete import
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function SummaryStat({ label, value, tint }: { label: string; value: number; tint: "red" | "amber" }) {
  const color = tint === "red" ? "var(--red)" : "var(--amber, #f59e0b)";
  return (
    <div style={{
      padding: "10px 12px", background: "var(--s2)",
      border: "1px solid var(--b1)", borderRadius: 6, textAlign: "center",
    }}>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color, letterSpacing: "-0.01em" }}>
        {value}
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700, color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}
