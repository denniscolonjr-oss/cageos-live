"use client";

/**
 * ProceduresSection — surface linked SOPs on an entity detail page
 * (asset / kit / project). iter-27c.
 *
 * Reused by:
 *   - /asset/[barcode]
 *   - /kit/[barcode]
 *   - /projects/[id]
 *   - /kiosk (during checkout — compact variant)
 *
 * Behavior:
 *   - Renders nothing if no SOPs are linked AND the user isn't Manager+
 *     (no "empty state for nobody"). Manager+ always sees the section so
 *     they can add the first link.
 *   - Shows linked SOPs as rows, each clickable to the SOP detail page.
 *   - Manager+ gets a "+ Link an SOP" button that opens LinkSOPModal.
 *   - Manager+ gets an inline "Unlink" button per row.
 *
 * Special case: kits aggregate SOPs from their component assets via
 * getSOPsForKit. We display a small indicator on each row showing whether
 * the SOP is linked to the kit itself or inherited from a component asset.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import LinkSOPModal from "@/components/shared/LinkSOPModal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";
import type { SOP } from "@/lib/hooks/workspaceTypes";
import type { Kit } from "@/lib/data";

export type ProceduresTargetType = "asset" | "kit" | "project";

export default function ProceduresSection({
  targetType,
  targetId,
  targetName,
  sops,
  /** Pass the parent Kit when targetType === "kit" so we can mark
   * inherited-from-component SOPs distinctly. */
  parentKit,
  /** Hide the manage controls and the "(none yet)" empty state — used
   * by the kiosk where we just want to surface, not curate. */
  readOnly,
  /** Header label override. Defaults to "Procedures". The kiosk uses
   * "Procedures for this kit" for clarity. */
  headerLabel,
}: {
  targetType: ProceduresTargetType;
  targetId: string;
  targetName: string;
  sops: SOP[];
  parentKit?: Kit;
  readOnly?: boolean;
  headerLabel?: string;
}) {
  const auth = useAuth();
  const { data, unlinkSOP } = useWorkspace();
  const [linkOpen, setLinkOpen] = useState(false);

  const canManage = !readOnly && (auth.currentRole === "owner" || auth.currentRole === "manager");

  const actorInitials = useMemo(() => {
    if (!auth.user) return "—";
    const profile = data.profiles.find(p => p.email === auth.user?.email);
    return profile?.initials ?? "—";
  }, [auth.user, data.profiles]);

  // Don't render anything if there's nothing to show and the user can't
  // manage. (Manager+ always sees the section to add the first link.)
  if (sops.length === 0 && !canManage) return null;

  function handleUnlink(sop: SOP, fromType: ProceduresTargetType, fromId: string) {
    if (!confirm(`Unlink "${sop.title}" from this ${fromType}?`)) return;
    const ok = unlinkSOP(sop.id, fromType, fromId, actorInitials);
    if (!ok) {
      toast("Couldn't unlink", { variant: "error", detail: "Permission denied." });
      return;
    }
    toast("Unlinked");
  }

  /**
   * For kits, compute each SOP's link source — directly linked, or inherited
   * from a component asset (and which asset). Display in the row so users
   * can trace where the linkage came from.
   *
   * "Inherited" SOPs get a different unlink path: we unlink from the asset,
   * not from the kit. That preserves the asset-level linkage everywhere.
   * For mixed sources (SOP linked to BOTH the kit AND a component), we
   * unlink only the kit and inform the user that asset linkage remains.
   */
  function getKitSOPSources(sop: SOP): {
    directlyLinkedToKit: boolean;
    componentAssetIds: string[];
  } | null {
    if (targetType !== "kit" || !parentKit) return null;
    const directlyLinkedToKit = sop.linkedKitIds.includes(parentKit.id);
    const componentAssetIds = parentKit.componentIds.filter(cid =>
      sop.linkedAssetIds.includes(cid)
    );
    return { directlyLinkedToKit, componentAssetIds };
  }

  return (
    <>
      <div style={{ padding: "14px 18px" }}>
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          marginBottom: 10, gap: 10, flexWrap: "wrap",
        }}>
          <div style={{
            fontFamily: "'DM Mono',monospace", fontSize: 9,
            color: "var(--t3)", letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>
            {headerLabel ?? "Procedures"}{sops.length > 0 && ` (${sops.length})`}
          </div>
          {canManage && (
            <button onClick={() => setLinkOpen(true)} style={{
              padding: "5px 11px", borderRadius: 4,
              background: "transparent", border: "1px solid var(--acc)",
              color: "var(--acc)",
              fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700,
              letterSpacing: "0.05em", textTransform: "uppercase",
              cursor: "pointer", minHeight: 27,
            }}>
              + Link an SOP
            </button>
          )}
        </div>

        {sops.length === 0 ? (
          <div style={{
            fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)",
            padding: "10px 0",
          }}>
            No procedures linked yet. Click <strong style={{ color: "var(--t2)" }}>+ Link an SOP</strong> to attach one.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sops.map(sop => {
              const kitSources = getKitSOPSources(sop);
              const isInheritedOnly = kitSources
                && !kitSources.directlyLinkedToKit
                && kitSources.componentAssetIds.length > 0;
              return (
                <SOPRow
                  key={sop.id}
                  sop={sop}
                  canManage={canManage}
                  openInNewTab={!!readOnly}
                  inheritedNote={isInheritedOnly ? buildInheritedNote(kitSources!.componentAssetIds, data.assets) : null}
                  onUnlinkFromTarget={isInheritedOnly
                    ? undefined  // unlinking from kit when only inherited would be confusing — direct user to the asset
                    : () => handleUnlink(sop, targetType, targetId)
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {canManage && (
        <LinkSOPModal
          open={linkOpen}
          onClose={() => setLinkOpen(false)}
          targetType={targetType}
          targetId={targetId}
          targetName={targetName}
        />
      )}
    </>
  );
}

function SOPRow({ sop, canManage, inheritedNote, onUnlinkFromTarget, openInNewTab }: {
  sop: SOP;
  canManage: boolean;
  inheritedNote: string | null;
  onUnlinkFromTarget?: () => void;
  openInNewTab?: boolean;
}) {
  /*
   * Link behavior depends on context. In standard detail pages we want
   * normal in-app navigation. In the kiosk we open in a new tab so the
   * checkout flow isn't disrupted — kiosks often run on dedicated screens
   * and losing the checkout state mid-flow would be frustrating.
   */
  const linkProps = openInNewTab
    ? { target: "_blank" as const, rel: "noopener noreferrer" as const }
    : {};

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px",
      background: "var(--s2)", border: "1px solid var(--b1)",
      borderRadius: 6,
    }}>
      <Link
        href={`/sops/${encodeURIComponent(sop.id)}`}
        {...linkProps}
        style={{
          flex: 1, minWidth: 0, textDecoration: "none",
        }}
      >
        <div style={{
          fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600,
          color: "var(--t1)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {sop.title}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4, alignItems: "center" }}>
          {sop.categories.map(cat => (
            <span key={cat} style={{
              fontFamily: "'DM Mono',monospace", fontSize: 9,
              padding: "1px 6px", borderRadius: 3, letterSpacing: "0.05em",
              background: "transparent", color: "var(--t3)",
              border: "1px solid var(--b1)",
              textTransform: "uppercase",
            }}>
              {cat}
            </span>
          ))}
          {sop.attachments.length > 0 && (
            <span style={{
              fontFamily: "'DM Mono',monospace", fontSize: 9,
              color: "var(--t3)",
            }}>
              {sop.attachments.length} file{sop.attachments.length === 1 ? "" : "s"}
            </span>
          )}
          {inheritedNote && (
            <span style={{
              fontFamily: "'DM Mono',monospace", fontSize: 9, fontStyle: "italic",
              color: "var(--t3)",
            }}>
              {inheritedNote}
            </span>
          )}
        </div>
      </Link>
      {canManage && onUnlinkFromTarget && (
        <button onClick={onUnlinkFromTarget} title="Unlink" style={{
          padding: "5px 11px", borderRadius: 4,
          background: "transparent",
          color: "var(--red)",
          border: "1px solid var(--red)",
          fontFamily: "'DM Mono',monospace", fontSize: 10,
          cursor: "pointer", minHeight: 27,
          flexShrink: 0,
        }}>
          Unlink
        </button>
      )}
    </div>
  );
}

function buildInheritedNote(assetIds: string[], assets: { id: string; name: string }[]): string {
  if (assetIds.length === 0) return "";
  if (assetIds.length === 1) {
    const a = assets.find(x => x.id === assetIds[0]);
    return `from ${a?.name ?? "a component"}`;
  }
  return `from ${assetIds.length} components`;
}
