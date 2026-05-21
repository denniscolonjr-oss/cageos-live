"use client";

/**
 * KitCompositionEditModal — iter-28e.
 *
 * Lets a crew (or anyone) modify the composition of a kit that is
 * currently checked out. Triggered from the checkout detail page via
 * an "Edit composition" button.
 *
 * Two-column layout:
 *   Left:  what's currently in the kit (the live composition).
 *          "Remove" button per row.
 *   Right: assets available to add.
 *          Filtered: not in any kit, not checked out, not archived,
 *          not critical-flagged.
 *          Search box for filtering. "Add" button per row.
 *
 * Each add/remove makes an immediate state change via the hook mutators.
 * Errors (e.g. asset already in another kit) surface as inline toasts.
 *
 * Composition log appears at the bottom — chronological audit of edits
 * made during THIS checkout, so the crew can see what they've changed
 * before closing the modal.
 */

import { useState, useMemo, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";
import type { ActiveCheckout } from "@/lib/hooks/workspaceTypes";

export default function KitCompositionEditModal({
  open, onClose, checkoutId, kitId,
}: {
  open: boolean;
  onClose: () => void;
  checkoutId: string;
  kitId: string;
}) {
  const auth = useAuth();
  const { data, addAssetToCheckoutKit, removeAssetFromCheckoutKit } = useWorkspace();
  const [searchQ, setSearchQ] = useState("");

  const actorInitials = useMemo(() => {
    if (!auth.user) return "—";
    const profile = data.profiles.find(p => p.email === auth.user?.email);
    return profile?.initials ?? "—";
  }, [auth.user, data.profiles]);

  const checkout = useMemo(() => {
    return data.checkouts.find(c =>
      "checkedOutAtISO" in c && c.id === checkoutId
    ) as ActiveCheckout | undefined;
  }, [data.checkouts, checkoutId]);

  const kit = useMemo(() => data.kits.find(k => k.id === kitId), [data.kits, kitId]);

  // The kit's current LIVE composition during this checkout
  const liveComponentIds = useMemo(() => {
    if (!checkout) return [];
    return checkout.kitCompositionLive?.[kitId]
        ?? checkout.kitCompositionSnapshots?.[kitId]
        ?? kit?.componentIds
        ?? [];
  }, [checkout, kitId, kit]);

  const inKitAssets = useMemo(() => {
    return liveComponentIds
      .map(id => data.assets.find(a => a.id === id))
      .filter((a): a is NonNullable<typeof a> => !!a);
  }, [liveComponentIds, data.assets]);

  /**
   * Assets eligible to be added: not in any kit, not archived,
   * not currently out via another checkout, no critical flag.
   * Plus a name/barcode/make/model substring filter from the search box.
   */
  const addableAssets = useMemo(() => {
    const otherActiveCheckoutAssetIds = new Set<string>();
    for (const c of data.checkouts) {
      if (!("checkedOutAtISO" in c)) continue;
      if (c.id === checkoutId) continue;
      if (c.status !== "active" && c.status !== "overdue") continue;
      for (const id of c.assetIds) otherActiveCheckoutAssetIds.add(id);
    }
    const q = searchQ.trim().toLowerCase();
    return data.assets.filter(a => {
      if (a.archivedAt) return false;
      if (a.kitId) return false;
      if (otherActiveCheckoutAssetIds.has(a.id)) return false;
      if (a.serviceFlag?.severity === "critical") return false;
      if (a.status === "out") return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q)
        || a.barcode.toLowerCase().includes(q)
        || (a.make ?? "").toLowerCase().includes(q)
        || (a.model ?? "").toLowerCase().includes(q)
      );
    }).slice(0, 200); // cap render size
  }, [data.assets, data.checkouts, checkoutId, searchQ]);

  const handleAdd = useCallback((assetId: string) => {
    const res = addAssetToCheckoutKit({ checkoutId, kitId, assetId, actorInitials });
    if (!res.ok) {
      toast("Couldn't add", { variant: "error", detail: res.reason });
      return;
    }
    toast("Added to kit");
  }, [addAssetToCheckoutKit, checkoutId, kitId, actorInitials]);

  const handleRemove = useCallback((assetId: string) => {
    const res = removeAssetFromCheckoutKit({ checkoutId, kitId, assetId, actorInitials });
    if (!res.ok) {
      toast("Couldn't remove", { variant: "error", detail: res.reason });
      return;
    }
    toast("Removed from kit");
  }, [removeAssetFromCheckoutKit, checkoutId, kitId, actorInitials]);

  if (!checkout || !kit) return null;

  // Show the composition log for this specific kit
  const kitLog = (checkout.compositionLog ?? []).filter(e => e.kitId === kitId);

  const snapshotIds = checkout.kitCompositionSnapshots?.[kitId] ?? [];
  const hasDrift = liveComponentIds.length !== snapshotIds.length
    || liveComponentIds.some(id => !snapshotIds.includes(id))
    || snapshotIds.some(id => !liveComponentIds.includes(id));

  return (
    <Modal open={open} onClose={onClose} title={`Edit composition: ${kit.name}`} maxWidth={920}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Drift summary banner */}
        {hasDrift && (
          <div style={{
            padding: "10px 12px",
            background: "color-mix(in srgb, var(--amber, #f59e0b) 6%, var(--s2))",
            border: "1px solid color-mix(in srgb, var(--amber, #f59e0b) 30%, var(--b1))",
            borderRadius: 6,
            fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t2)",
            lineHeight: 1.5,
          }}>
            This kit has been modified during checkout. On return, you&apos;ll choose to revert to the original, keep the new composition, or save as a new kit.
          </div>
        )}

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* LEFT: in kit */}
          <div style={{ border: "1px solid var(--b1)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{
              padding: "8px 12px", background: "var(--s2)",
              borderBottom: "1px solid var(--b1)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{
                fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
                color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase",
              }}>
                In kit ({inKitAssets.length})
              </div>
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              {inKitAssets.length === 0 ? (
                <div style={{
                  padding: 18, textAlign: "center",
                  fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)",
                }}>
                  Kit is empty.
                </div>
              ) : inKitAssets.map(a => (
                <RowInKit key={a.id} asset={a} snapshot={snapshotIds.includes(a.id)} onRemove={() => handleRemove(a.id)} />
              ))}
            </div>
          </div>

          {/* RIGHT: addable */}
          <div style={{ border: "1px solid var(--b1)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{
              padding: "8px 12px", background: "var(--s2)",
              borderBottom: "1px solid var(--b1)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{
                fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
                color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase",
              }}>
                Available to add
              </div>
              <input
                type="text"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search..."
                style={{
                  padding: "4px 8px", borderRadius: 4,
                  background: "var(--s3)", border: "1px solid var(--b1)",
                  color: "var(--t1)", fontFamily: "'DM Mono',monospace", fontSize: 11,
                  width: 140, outline: "none",
                }}
              />
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              {addableAssets.length === 0 ? (
                <div style={{
                  padding: 18, textAlign: "center",
                  fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)",
                }}>
                  {searchQ ? "No matches." : "No assets available to add."}
                </div>
              ) : addableAssets.map(a => (
                <RowAddable key={a.id} asset={a} onAdd={() => handleAdd(a.id)} />
              ))}
            </div>
          </div>
        </div>

        {/* Edit log */}
        {kitLog.length > 0 && (
          <div>
            <div style={{
              fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
              color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase",
              marginBottom: 6,
            }}>
              Edits this checkout ({kitLog.length})
            </div>
            <div style={{
              border: "1px solid var(--b1)", borderRadius: 6,
              maxHeight: 140, overflowY: "auto",
              padding: 8,
            }}>
              {kitLog.map((edit, i) => (
                <div key={i} style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 10,
                  color: "var(--t2)", lineHeight: 1.6,
                  paddingBottom: 3,
                }}>
                  <span style={{ color: edit.action === "add" ? "var(--green, #16a34a)" : "var(--amber, #f59e0b)", fontWeight: 700 }}>
                    {edit.action === "add" ? "+ " : "− "}
                  </span>
                  <span style={{ color: "var(--t1)" }}>{edit.assetName}</span>{" "}
                  <span style={{ color: "var(--t3)" }}>({edit.assetBarcode}) by {edit.by}, {formatRelative(edit.atISO)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 18px", borderRadius: 6,
              background: "var(--acc)", color: "var(--bg)", border: "none",
              cursor: "pointer", fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
              minHeight: 40,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RowInKit({ asset, snapshot, onRemove }: {
  asset: { id: string; name: string; barcode: string; make?: string; model?: string };
  snapshot: boolean;
  onRemove: () => void;
}) {
  return (
    <div style={{
      padding: "8px 10px",
      borderBottom: "1px solid var(--b1)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t1)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {asset.name}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)" }}>
          {asset.barcode}{(asset.make || asset.model) && ` · ${asset.make ?? ""} ${asset.model ?? ""}`.trim()}
        </div>
      </div>
      {!snapshot && (
        <span style={{
          fontFamily: "'DM Mono',monospace", fontSize: 8, fontWeight: 700,
          padding: "2px 5px", borderRadius: 3,
          background: "color-mix(in srgb, var(--green, #16a34a) 12%, transparent)",
          color: "var(--green, #16a34a)",
          letterSpacing: "0.05em", textTransform: "uppercase",
        }}>
          added
        </span>
      )}
      <button
        onClick={onRemove}
        style={{
          padding: "4px 9px", borderRadius: 4,
          background: "transparent", border: "1px solid var(--b1)",
          color: "var(--red)", fontFamily: "'DM Mono',monospace", fontSize: 10,
          cursor: "pointer", minHeight: 26,
          flexShrink: 0,
        }}
      >
        Remove
      </button>
    </div>
  );
}

function RowAddable({ asset, onAdd }: {
  asset: { id: string; name: string; barcode: string; make?: string; model?: string };
  onAdd: () => void;
}) {
  return (
    <div style={{
      padding: "8px 10px",
      borderBottom: "1px solid var(--b1)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t1)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {asset.name}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)" }}>
          {asset.barcode}{(asset.make || asset.model) && ` · ${asset.make ?? ""} ${asset.model ?? ""}`.trim()}
        </div>
      </div>
      <button
        onClick={onAdd}
        style={{
          padding: "4px 11px", borderRadius: 4,
          background: "transparent", border: "1px solid var(--acc)",
          color: "var(--acc)", fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700,
          cursor: "pointer", minHeight: 26,
          flexShrink: 0,
        }}
      >
        Add
      </button>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}
