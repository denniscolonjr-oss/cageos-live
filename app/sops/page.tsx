"use client";

/**
 * /sops — Standard Operating Procedure library (iter-27a).
 *
 * Flat list of all SOPs in the workspace, filtered + searchable.
 *
 * Search model (B+C from design discussion):
 *   - Search box: substring match across title, body, and category names
 *   - Category filter: multi-select dropdown. An SOP matches if ANY of its
 *     categories matches ANY selected filter category.
 *   - Author filter: dropdown of profiles. Matches createdBy.
 *
 * Category source: union of (a) unique asset categories and (b) categories
 * already in use by SOPs. This means archived gear doesn't orphan SOP
 * categorization but the dropdown always reflects "categories currently in
 * use somewhere in the workspace."
 *
 * Permissions:
 *   - Anyone signed in can view the list
 *   - Crew+ sees the "+ New SOP" button
 *   - Viewer doesn't see the create button
 */

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopNav from "@/components/shared/TopNav";
import Card from "@/components/ui/Card";
import AddSOPModal from "@/components/forms/AddSOPModal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import type { SOP } from "@/lib/hooks/workspaceTypes";

export default function SOPsPage() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const auth = useAuth();
  const { hydrated } = useWorkspace();

  const signedOut = auth.supabaseEnabled && !auth.loading && !auth.session;
  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

  if (!hydrated || auth.loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          Loading workspace...
        </div>
      </div>
    );
  }
  if (signedOut) return null;

  return <SOPsListBody isMobile={isMobile} />;
}

function SOPsListBody({ isMobile }: { isMobile: boolean }) {
  const auth = useAuth();
  const { data } = useWorkspace();

  const canCreate = auth.currentRole === "owner"
    || auth.currentRole === "manager"
    || auth.currentRole === "crew";

  // ── Filters ──
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);

  /**
   * Category vocabulary: union of asset categories and SOP categories.
   * This is the dropdown source. Sorted alphabetically.
   */
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const a of data.assets) if (a.category) set.add(a.category);
    for (const s of data.sops) for (const c of s.categories) set.add(c);
    return Array.from(set).sort();
  }, [data.assets, data.sops]);

  /**
   * Author vocabulary: every distinct createdBy value across SOPs, mapped
   * back to the profile if found. Dropdown shows profile name + initials;
   * sorted by name. Includes a leading "Anyone" option (value "").
   */
  const authors = useMemo(() => {
    const initials = new Set<string>();
    for (const s of data.sops) initials.add(s.createdBy);
    return Array.from(initials).map(init => {
      const profile = data.profiles.find(p => p.initials === init);
      return { initials: init, name: profile?.name ?? init };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [data.sops, data.profiles]);

  /**
   * Filtered + searched SOPs. Cheap O(n*m) filter — SOP volume is expected
   * to remain in the low hundreds per workspace; no indexing needed yet.
   */
  const filteredSOPs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return data.sops.filter(sop => {
      // Search across title + body + categories
      if (q) {
        const haystack = [
          sop.title,
          sop.body,
          ...sop.categories,
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      // Category filter: SOP must have at least one of the selected categories
      if (selectedCategories.length > 0) {
        const hasMatch = sop.categories.some(c => selectedCategories.includes(c));
        if (!hasMatch) return false;
      }
      // Author filter
      if (selectedAuthor && sop.createdBy !== selectedAuthor) return false;
      return true;
    }).sort((a, b) =>
      // Most recently edited first — keeps active docs at the top
      new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime()
    );
  }, [data.sops, searchQuery, selectedCategories, selectedAuthor]);

  function toggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  function clearFilters() {
    setSearchQuery("");
    setSelectedCategories([]);
    setSelectedAuthor("");
  }

  const hasActiveFilters = searchQuery !== "" || selectedCategories.length > 0 || selectedAuthor !== "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
      <TopNav />
      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "16px 12px" : "28px 24px" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>
                Standard Operating Procedures
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
                {data.sops.length} document{data.sops.length === 1 ? "" : "s"}
              </div>
            </div>
            {canCreate && (
              <button onClick={() => setAddOpen(true)} style={{
                background: "var(--acc)", color: "var(--bg)",
                border: "none", borderRadius: 6,
                padding: "10px 18px",
                fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13,
                cursor: "pointer", minHeight: 40,
              }}>
                + New SOP
              </button>
            )}
          </div>

          {/* Search + filters */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Search input */}
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search SOPs by title, body, or category..."
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--s2)",
                  border: "1px solid var(--b1)",
                  borderRadius: 6,
                  color: "var(--t1)",
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />

              {/* Filter rows */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>

                {/* Categories — chips, multi-select */}
                {allCategories.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 200 }}>
                    <div style={{
                      fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
                      color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase",
                    }}>
                      Categories
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {allCategories.map(cat => {
                        const active = selectedCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            onClick={() => toggleCategory(cat)}
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

                {/* Author — select dropdown */}
                {authors.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 140 }}>
                    <div style={{
                      fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
                      color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase",
                    }}>
                      Author
                    </div>
                    <select
                      value={selectedAuthor}
                      onChange={e => setSelectedAuthor(e.target.value)}
                      style={{
                        padding: "5px 8px", borderRadius: 4,
                        background: "var(--s2)", border: "1px solid var(--b1)",
                        color: "var(--t1)", fontFamily: "'DM Mono',monospace", fontSize: 11,
                        cursor: "pointer", minHeight: 27,
                      }}
                    >
                      <option value="">Anyone</option>
                      {authors.map(a => (
                        <option key={a.initials} value={a.initials}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Clear filters */}
                {hasActiveFilters && (
                  <button onClick={clearFilters} style={{
                    alignSelf: "flex-end",
                    padding: "5px 10px", borderRadius: 4,
                    background: "transparent",
                    border: "1px solid var(--b1)",
                    color: "var(--t3)",
                    fontFamily: "'DM Mono',monospace", fontSize: 10,
                    cursor: "pointer", minHeight: 27,
                  }}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* Results */}
          {data.sops.length === 0 ? (
            <EmptyState canCreate={canCreate} onCreate={() => setAddOpen(true)} />
          ) : filteredSOPs.length === 0 ? (
            <Card>
              <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
                No SOPs match your filters.
              </div>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredSOPs.map(sop => (
                <SOPListRow key={sop.id} sop={sop} profileLookup={data.profiles} />
              ))}
            </div>
          )}

        </div>
      </div>

      <AddSOPModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function SOPListRow({ sop, profileLookup }: {
  sop: SOP;
  profileLookup: { initials: string; name: string; color: string }[];
}) {
  const editor = profileLookup.find(p => p.initials === sop.lastEditedBy);
  const lastEdited = new Date(sop.lastEditedAt);

  // First non-empty line of body, truncated, as a preview
  const preview = sop.body
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => l.replace(/^#+\s*/, "")) // strip leading heading hashes
    .find(Boolean)
    ?? "";

  return (
    <Link href={`/sops/${encodeURIComponent(sop.id)}`} style={{ textDecoration: "none" }}>
      <Card style={{ cursor: "pointer" }}>
        <div style={{ padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: "var(--t1)", minWidth: 0, flex: 1 }}>
              {sop.title}
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", flexShrink: 0 }}>
              {formatRelative(lastEdited)}
            </div>
          </div>

          {preview && (
            <div style={{
              fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t2)",
              marginBottom: 10, lineHeight: 1.5,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}>
              {preview}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {sop.categories.map(cat => (
              <span key={cat} style={{
                fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
                padding: "2px 7px", borderRadius: 3, letterSpacing: "0.05em",
                background: "var(--s2)", color: "var(--t2)",
                border: "1px solid var(--b1)",
                textTransform: "uppercase",
              }}>
                {cat}
              </span>
            ))}
            {sop.categories.length === 0 && (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                uncategorized
              </span>
            )}
            <div style={{ flex: 1 }} />
            {editor && (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                by {editor.name}
              </span>
            )}
            {sop.versions.length > 0 && (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                · v{sop.versions.length + 1}
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function EmptyState({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <Card>
      <div style={{ padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 600, color: "var(--t1)", marginBottom: 8 }}>
          No SOPs yet
        </div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--t2)", marginBottom: 20, maxWidth: 460, margin: "0 auto 20px" }}>
          Capture institutional knowledge — setup procedures, safety checklists, gear-specific instructions. SOPs can be tagged by category and referenced anywhere in the workspace.
        </div>
        {canCreate && (
          <button onClick={onCreate} style={{
            background: "var(--acc)", color: "var(--bg)",
            border: "none", borderRadius: 6,
            padding: "10px 20px",
            fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13,
            cursor: "pointer", minHeight: 40,
          }}>
            + Create your first SOP
          </button>
        )}
      </div>
    </Card>
  );
}

function formatRelative(then: Date): string {
  const now = Date.now();
  const diffSec = Math.floor((now - then.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
