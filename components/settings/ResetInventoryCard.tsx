"use client";

/**
 * ResetInventoryCard — Settings → Reset Inventory (iter-28d-fix).
 *
 * Destructive button that wipes assets, kits, and CSV import records,
 * auto-returns any active checkouts, and preserves team members,
 * projects, SOPs, audit log, and workspace settings.
 *
 * Different from "Reset Workspace":
 *   - Reset Workspace = wipe EVERYTHING including team members
 *   - Reset Inventory = wipe only gear; keep people, projects, history
 *
 * Owner-only. Confirmation requires typing the org name.
 */

import { useState, useMemo } from "react";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";

export default function ResetInventoryCard() {
  const auth = useAuth();
  const { data, resetInventory } = useWorkspace();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  const canReset = auth.currentRole === "owner";

  const actorInitials = useMemo(() => {
    if (!auth.user) return "—";
    const profile = data.profiles.find(p => p.email === auth.user?.email);
    return profile?.initials ?? "—";
  }, [auth.user, data.profiles]);

  // Pre-compute the impact summary for the confirm modal
  const impact = useMemo(() => {
    const activeCheckouts = data.checkouts.filter(c =>
      "checkedOutAtISO" in c && (c.status === "active" || c.status === "overdue")
    ).length;
    return {
      assets: data.assets.length,
      kits: data.kits.length,
      imports: (data.csvImports ?? []).length,
      activeCheckouts,
    };
  }, [data]);

  function handleConfirm() {
    if (confirmText.trim() !== data.orgName.trim()) {
      toast("Type the org name to confirm", { variant: "error" });
      return;
    }
    setResetting(true);
    const result = resetInventory(actorInitials);
    setResetting(false);
    if (!result) {
      toast("Reset failed", { variant: "error", detail: "Owner role required." });
      return;
    }
    setConfirmOpen(false);
    setConfirmText("");
    toast(`Wiped ${result.assetsRemoved} assets, ${result.kitsRemoved} kits`, {
      detail: result.checkoutsAutoReturned > 0
        ? `${result.checkoutsAutoReturned} checkout${result.checkoutsAutoReturned === 1 ? "" : "s"} auto-returned`
        : undefined,
    });
  }

  return (
    <>
      <Card>
        <div style={{ padding: 20 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
            Reset Inventory
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14, lineHeight: 1.6 }}>
            Permanently delete all assets, kits, and CSV import history. Auto-returns any active checkouts. <strong style={{ color: "var(--t1)" }}>Preserves</strong> team members, projects, SOPs, audit log, and workspace settings.
          </div>

          {!canReset && (
            <div style={{
              padding: "10px 12px", background: "var(--s2)",
              border: "1px dashed var(--b1)", borderRadius: 6,
              fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)",
            }}>
              Owner only.
            </div>
          )}

          {canReset && (
            <button
              onClick={() => setConfirmOpen(true)}
              style={{
                padding: "10px 16px", borderRadius: 6,
                background: "transparent", border: "1px solid var(--red)",
                color: "var(--red)", cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 40,
              }}
            >
              Reset inventory
            </button>
          )}
        </div>
      </Card>

      {confirmOpen && (
        <Modal open={confirmOpen} onClose={() => !resetting && setConfirmOpen(false)} title="Reset inventory?" maxWidth={520}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--t1)", lineHeight: 1.6 }}>
              This will permanently delete all assets and kits from this workspace.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              <Stat label="Assets" value={impact.assets} tint="red" />
              <Stat label="Kits" value={impact.kits} tint="red" />
              <Stat label="CSV imports" value={impact.imports} tint="red" />
              <Stat label="Active checkouts" value={impact.activeCheckouts} tint="amber" />
            </div>

            {impact.activeCheckouts > 0 && (
              <div style={{
                padding: "10px 12px",
                background: "color-mix(in srgb, var(--amber, #f59e0b) 6%, var(--s2))",
                border: "1px solid color-mix(in srgb, var(--amber, #f59e0b) 30%, var(--b1))",
                borderRadius: 6,
                fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t2)", lineHeight: 1.5,
              }}>
                {impact.activeCheckouts} active checkout{impact.activeCheckouts === 1 ? "" : "s"} will be auto-returned at the moment of reset. The audit log captures the forced return.
              </div>
            )}

            <div style={{
              padding: "10px 12px",
              background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 6,
              fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t2)", lineHeight: 1.5,
            }}>
              <strong style={{ color: "var(--t1)" }}>Preserved:</strong> team members, profiles, projects (kit assignments cleared), SOPs (linked-entity arrays cleared), audit log, workspace settings.
            </div>

            <div>
              <label style={{
                display: "block", marginBottom: 6,
                fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)",
              }}>
                Type <strong style={{ color: "var(--t1)" }}>{data.orgName}</strong> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                disabled={resetting}
                placeholder={data.orgName}
                style={{
                  width: "100%", padding: "10px 12px",
                  background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 6,
                  color: "var(--t1)", fontFamily: "'DM Mono',monospace", fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            <div style={{
              fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)",
              letterSpacing: "0.04em", lineHeight: 1.5,
            }}>
              This action cannot be undone.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={resetting}
                style={{
                  padding: "10px 16px", borderRadius: 6,
                  background: "transparent", border: "1px solid var(--b2)",
                  color: resetting ? "var(--t3)" : "var(--t1)",
                  cursor: resetting ? "not-allowed" : "pointer",
                  fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 40,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={resetting || confirmText.trim() !== data.orgName.trim()}
                style={{
                  padding: "10px 18px", borderRadius: 6,
                  background: confirmText.trim() === data.orgName.trim() && !resetting ? "var(--red)" : "var(--s3)",
                  color: confirmText.trim() === data.orgName.trim() && !resetting ? "var(--bg)" : "var(--t3)",
                  border: "none",
                  cursor: confirmText.trim() === data.orgName.trim() && !resetting ? "pointer" : "not-allowed",
                  fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                  minHeight: 40,
                }}
              >
                {resetting ? "Wiping..." : "Reset inventory"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function Stat({ label, value, tint }: { label: string; value: number; tint: "red" | "amber" }) {
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
