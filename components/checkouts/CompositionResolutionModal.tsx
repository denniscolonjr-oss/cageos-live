"use client";

/**
 * CompositionResolutionModal — iter-28e.
 *
 * Appears at return time when a kit has been mutated during this
 * checkout. Asks the crew to pick one of three paths:
 *
 *   1. REVERT — restore the kit definition to what it was at checkout
 *      time. Added assets revert to general inventory. Removed assets
 *      (if any) snap back into the kit definition.
 *
 *   2. KEEP — the live composition becomes the kit's new definition.
 *      Future checkouts of this kit use the new component list.
 *
 *   3. SAVE AS NEW — original kit unchanged. A new kit is created with
 *      the live composition. User types a name. Inherits location from
 *      the original kit; fresh auto-generated barcode.
 *
 * If multiple kits in this checkout have drift, the crew handles one
 * kit per modal opening. Caller is responsible for iterating.
 */

import { useState, useMemo, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";
import type { ActiveCheckout } from "@/lib/hooks/workspaceTypes";

export default function CompositionResolutionModal({
  open, onClose, onResolved, checkoutId, kitId,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after the user successfully picks a path. */
  onResolved: (newKitId?: string) => void;
  checkoutId: string;
  kitId: string;
}) {
  const auth = useAuth();
  const { data, resolveCheckoutComposition } = useWorkspace();
  const [path, setPath] = useState<"revert" | "keep" | "save_as_new">("revert");
  const [newKitName, setNewKitName] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  // Build diff summary
  const diff = useMemo(() => {
    const snapshot = checkout?.kitCompositionSnapshots?.[kitId] ?? [];
    const live = checkout?.kitCompositionLive?.[kitId] ?? snapshot;
    const added = live.filter(id => !snapshot.includes(id));
    const removed = snapshot.filter(id => !live.includes(id));
    return {
      added: added.map(id => data.assets.find(a => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a),
      removed: removed.map(id => data.assets.find(a => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a),
    };
  }, [checkout, kitId, data.assets]);

  const handleSubmit = useCallback(() => {
    if (path === "save_as_new" && !newKitName.trim()) {
      toast("Name required", { variant: "error", detail: "Enter a name for the new kit." });
      return;
    }
    setSubmitting(true);
    const res = resolveCheckoutComposition({
      checkoutId, kitId, path,
      newKitName: path === "save_as_new" ? newKitName.trim() : undefined,
      actorInitials,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast("Couldn't resolve", { variant: "error", detail: res.reason });
      return;
    }
    toast(
      path === "revert" ? "Reverted to original composition"
      : path === "keep" ? "Kept new composition"
      : `Created new kit: ${newKitName.trim()}`
    );
    onResolved(res.newKitId);
  }, [path, newKitName, resolveCheckoutComposition, checkoutId, kitId, actorInitials, onResolved]);

  if (!checkout || !kit) return null;
  if (diff.added.length === 0 && diff.removed.length === 0) {
    // No drift — nothing to resolve. Parent shouldn't open this modal.
    return null;
  }

  return (
    <Modal open={open} onClose={() => !submitting && onClose()} title={`Resolve "${kit.name}" composition`} maxWidth={620}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>
          This kit&apos;s composition was changed during checkout. Choose how to resolve before returning.
        </div>

        {/* Diff display */}
        <div style={{
          padding: "12px 14px", background: "var(--s2)",
          border: "1px solid var(--b1)", borderRadius: 6,
        }}>
          {diff.added.length > 0 && (
            <div style={{ marginBottom: diff.removed.length > 0 ? 10 : 0 }}>
              <div style={{
                fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
                color: "var(--green, #16a34a)", letterSpacing: "0.1em", textTransform: "uppercase",
                marginBottom: 4,
              }}>
                Added ({diff.added.length})
              </div>
              {diff.added.map(a => (
                <div key={a.id} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t1)", paddingLeft: 8 }}>
                  + {a.name} <span style={{ color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 10 }}>({a.barcode})</span>
                </div>
              ))}
            </div>
          )}
          {diff.removed.length > 0 && (
            <div>
              <div style={{
                fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
                color: "var(--amber, #f59e0b)", letterSpacing: "0.1em", textTransform: "uppercase",
                marginBottom: 4,
              }}>
                Removed ({diff.removed.length})
              </div>
              {diff.removed.map(a => (
                <div key={a.id} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t1)", paddingLeft: 8 }}>
                  − {a.name} <span style={{ color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 10 }}>({a.barcode})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Path picker */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <PathOption
            value="revert"
            selected={path === "revert"}
            onSelect={() => setPath("revert")}
            title="Revert to original"
            description="Restore the kit definition to what it was at checkout time. Added items go back to general inventory."
          />
          <PathOption
            value="keep"
            selected={path === "keep"}
            onSelect={() => setPath("keep")}
            title="Keep new composition"
            description="The new component list becomes this kit's definition going forward."
          />
          <PathOption
            value="save_as_new"
            selected={path === "save_as_new"}
            onSelect={() => setPath("save_as_new")}
            title="Save as a new kit"
            description={`Original kit unchanged. Creates a new kit (same location as "${kit.name}") with the new composition.`}
          />
        </div>

        {path === "save_as_new" && (
          <div>
            <label style={{
              display: "block", marginBottom: 6,
              fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)",
            }}>
              New kit name
            </label>
            <input
              type="text"
              value={newKitName}
              onChange={e => setNewKitName(e.target.value)}
              placeholder={`e.g. "${kit.name} - Interview Variant"`}
              autoFocus
              style={{
                width: "100%", padding: "10px 12px",
                background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 6,
                color: "var(--t1)", fontFamily: "'DM Sans',sans-serif", fontSize: 13,
                outline: "none",
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "10px 16px", borderRadius: 6,
              background: "transparent", border: "1px solid var(--b2)",
              color: submitting ? "var(--t3)" : "var(--t1)",
              cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 40,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || (path === "save_as_new" && !newKitName.trim())}
            style={{
              padding: "10px 18px", borderRadius: 6,
              background: (path === "save_as_new" && !newKitName.trim()) || submitting ? "var(--s3)" : "var(--acc)",
              color: (path === "save_as_new" && !newKitName.trim()) || submitting ? "var(--t3)" : "var(--bg)",
              border: "none",
              cursor: ((path === "save_as_new" && !newKitName.trim()) || submitting) ? "not-allowed" : "pointer",
              fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, minHeight: 40,
            }}
          >
            {submitting ? "Applying..." : "Apply"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PathOption({ value, selected, onSelect, title, description }: {
  value: string;
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: "12px 14px",
        background: selected ? "color-mix(in srgb, var(--acc) 6%, var(--s2))" : "var(--s2)",
        border: `1px solid ${selected ? "var(--acc)" : "var(--b1)"}`,
        borderRadius: 6,
        cursor: "pointer",
        display: "flex", gap: 12, alignItems: "flex-start",
        transition: "border-color 0.12s, background 0.12s",
      }}
    >
      <div style={{
        flexShrink: 0, width: 14, height: 14, borderRadius: 7,
        border: `2px solid ${selected ? "var(--acc)" : "var(--t3)"}`,
        position: "relative",
        marginTop: 2,
      }}>
        {selected && (
          <div style={{
            position: "absolute", top: 2, left: 2,
            width: 6, height: 6, borderRadius: 3,
            background: "var(--acc)",
          }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: "var(--t1)", marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
      <input type="radio" value={value} checked={selected} onChange={onSelect} style={{ display: "none" }} />
    </div>
  );
}
