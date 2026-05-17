"use client";

/**
 * LinkSOPModal — pick an SOP from the library to link to an entity
 * (asset / kit / project). iter-27c.
 *
 * Manager+ only. Crew never sees this modal because the parent's "Link an
 * SOP" button is hidden for them. If a Crew user somehow triggers it
 * anyway (e.g. via a stale UI state), the linkSOP mutator rejects them.
 *
 * UI: list of SOPs in the workspace, with search box + category filter
 * chips, similar to /sops library page but condensed. SOPs already linked
 * to this entity are shown disabled with an "Already linked" tag.
 *
 * Clicking a row links and closes. Multiple links require re-opening the
 * modal — keeps the per-action mental model simple. If we find users
 * batch-linking 5+ SOPs to one entity, we can add multi-select later.
 */

import { useState, useMemo } from "react";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";
import type { SOP } from "@/lib/hooks/workspaceTypes";

export type LinkTargetType = "asset" | "kit" | "project";

export default function LinkSOPModal({
  open,
  onClose,
  targetType,
  targetId,
  targetName,
}: {
  open: boolean;
  onClose: () => void;
  targetType: LinkTargetType;
  targetId: string;
  targetName: string;  // display label for the destination
}) {
  const auth = useAuth();
  const { data, linkSOP } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Resolve current user's initials for the audit trail
  const actorInitials = useMemo(() => {
    if (!auth.user) return "—";
    const profile = data.profiles.find(p => p.email === auth.user?.email);
    return profile?.initials ?? "—";
  }, [auth.user, data.profiles]);

  /**
   * Category vocabulary: union of asset categories + SOP categories.
   * Same source as the /sops library page for visual consistency.
   */
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const a of data.assets) if (a.category) set.add(a.category);
    for (const s of data.sops) for (const c of s.categories) set.add(c);
    return Array.from(set).sort();
  }, [data.assets, data.sops]);

  // Helper: which array on each SOP holds the relevant link ids
  const fieldName = targetType === "asset" ? "linkedAssetIds"
                  : targetType === "kit"   ? "linkedKitIds"
                  : "linkedProjectIds";

  /**
   * Filtered SOPs for the picker:
   *   - Search across title, body, categories
   *   - Category filter chips (OR semantics — match any selected)
   * Sorted by most recent edit. Already-linked SOPs surface but disabled.
   */
  const filteredSOPs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.sops.filter(sop => {
      if (q) {
        const haystack = [sop.title, sop.body, ...sop.categories].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (selectedCategories.length > 0) {
        if (!sop.categories.some(c => selectedCategories.includes(c))) return false;
      }
      return true;
    }).sort((a, b) =>
      new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime()
    );
  }, [data.sops, searchQuery, selectedCategories]);

  function toggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  function handleLink(sop: SOP) {
    const ok = linkSOP(sop.id, targetType, targetId, actorInitials);
    if (!ok) {
      toast("Couldn't link SOP", { variant: "error", detail: "Permission denied." });
      return;
    }
    toast(`Linked: ${sop.title}`, { detail: `to ${targetName}` });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Link SOP to ${targetName}`} maxWidth={680}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Search */}
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search SOPs by title, body, or category..."
          style={{
            width: "100%", padding: "10px 12px",
            background: "var(--s2)", border: "1px solid var(--b1)",
            borderRadius: 6, color: "var(--t1)",
            fontFamily: "'DM Sans',sans-serif", fontSize: 13,
            outline: "none", boxSizing: "border-box",
          }}
          autoFocus
        />

        {/* Category chips */}
        {allCategories.length > 0 && (
          <div>
            <div style={{
              fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
              color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase",
              marginBottom: 6,
            }}>
              Filter by category
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {allCategories.map(cat => {
                const active = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    type="button"
                    style={{
                      padding: "4px 10px", borderRadius: 4,
                      background: active ? "var(--acc)" : "var(--s2)",
                      color: active ? "var(--bg)" : "var(--t2)",
                      border: `1px solid ${active ? "var(--acc)" : "var(--b1)"}`,
                      fontFamily: "'DM Mono',monospace", fontSize: 11,
                      fontWeight: active ? 700 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Results */}
        {data.sops.length === 0 ? (
          <div style={{
            padding: 24, textAlign: "center",
            background: "var(--s2)", borderRadius: 6,
            fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)",
          }}>
            No SOPs in this workspace yet. Create one from <strong style={{ color: "var(--t1)" }}>SOPs</strong> in the sidebar.
          </div>
        ) : filteredSOPs.length === 0 ? (
          <div style={{
            padding: 24, textAlign: "center",
            background: "var(--s2)", borderRadius: 6,
            fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)",
          }}>
            No SOPs match your filters.
          </div>
        ) : (
          <div style={{
            display: "flex", flexDirection: "column", gap: 6,
            maxHeight: 380, overflowY: "auto",
          }}>
            {filteredSOPs.map(sop => {
              const alreadyLinked = sop[fieldName].includes(targetId);
              return (
                <SOPRow
                  key={sop.id}
                  sop={sop}
                  alreadyLinked={alreadyLinked}
                  onLink={() => handleLink(sop)}
                />
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

function SOPRow({ sop, alreadyLinked, onLink }: {
  sop: SOP;
  alreadyLinked: boolean;
  onLink: () => void;
}) {
  return (
    <button
      onClick={alreadyLinked ? undefined : onLink}
      disabled={alreadyLinked}
      type="button"
      style={{
        display: "block",
        width: "100%", textAlign: "left",
        padding: "10px 14px",
        background: "var(--s2)",
        border: "1px solid var(--b1)",
        borderRadius: 6,
        cursor: alreadyLinked ? "default" : "pointer",
        opacity: alreadyLinked ? 0.55 : 1,
        transition: "background 0.12s, border-color 0.12s",
      }}
      onMouseEnter={alreadyLinked ? undefined : (e) => {
        e.currentTarget.style.background = "color-mix(in srgb, var(--acc) 6%, var(--s2))";
        e.currentTarget.style.borderColor = "var(--acc)";
      }}
      onMouseLeave={alreadyLinked ? undefined : (e) => {
        e.currentTarget.style.background = "var(--s2)";
        e.currentTarget.style.borderColor = "var(--b1)";
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, color: "var(--t1)", minWidth: 0, flex: 1 }}>
          {sop.title}
        </div>
        {alreadyLinked && (
          <span style={{
            fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
            padding: "2px 7px", borderRadius: 3, letterSpacing: "0.05em",
            background: "var(--s3)", color: "var(--t3)",
            textTransform: "uppercase",
            flexShrink: 0,
          }}>
            Already linked
          </span>
        )}
      </div>
      {sop.categories.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
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
        </div>
      )}
    </button>
  );
}
