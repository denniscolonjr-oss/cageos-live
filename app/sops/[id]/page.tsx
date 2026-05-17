"use client";

/**
 * /sops/[id] — Single SOP detail (iter-27a)
 *
 * Surfaces the full SOP content with rendered markdown, version history,
 * comments thread, and action buttons.
 *
 * Sections:
 *   - Header: title, category chips, action buttons
 *   - Meta strip: created by, created at, last edited by/at
 *   - Rendered markdown body
 *   - Version history (collapsible): list of past versions with View + Revert
 *   - Comments thread (parentType: "sop")
 *
 * Permissions:
 *   - Edit/Delete: Manager+ on any SOP; Crew only on SOPs they created
 *   - Revert: same as Edit (revert is just another update)
 *   - View: everyone signed in
 *
 * Markdown rendering: a light, line-level parser that handles headings,
 * lists, and paragraphs at the block level, with inline support for bold,
 * italic, code, and links. Same syntax/scope as the comments renderer so
 * users only learn it once. No HTML escape risk since we render to React
 * elements (never dangerouslySetInnerHTML).
 */

import { use, useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopNav from "@/components/shared/TopNav";
import Card from "@/components/ui/Card";
import EditSOPModal from "@/components/forms/EditSOPModal";
import AttachmentsList from "@/components/shared/AttachmentsList";
import CommentsThread from "@/components/shared/CommentsThread";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { getEntitiesForSOP } from "@/lib/sopMatching";
import { toast } from "@/components/ui/Toast";
import type { SOP, SOPVersion } from "@/lib/hooks/workspaceTypes";

export default function SOPDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const auth = useAuth();
  const isMobile = useIsMobile();
  const { hydrated, data } = useWorkspace();

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

  const sop = data.sops.find(s => s.id === id);

  if (!sop) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: "var(--t1)" }}>
            SOP not found
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
            This SOP doesn&apos;t exist or has been deleted.
          </div>
          <Link href="/sops" style={{
            marginTop: 8, padding: "10px 18px",
            background: "var(--acc)", color: "var(--bg)",
            borderRadius: 6, textDecoration: "none",
            fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
          }}>← Back to SOPs</Link>
        </div>
      </div>
    );
  }

  return <SOPDetailBody sop={sop} isMobile={isMobile} />;
}

function SOPDetailBody({ sop, isMobile }: { sop: SOP; isMobile: boolean }) {
  const router = useRouter();
  const auth = useAuth();
  const { data, updateSOP, deleteSOP } = useWorkspace();

  const [editOpen, setEditOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<SOPVersion | null>(null);

  // Current user's initials, for permission checks + revert attribution
  const userInitials = useMemo(() => {
    if (!auth.user) return "—";
    const profile = data.profiles.find(p => p.email === auth.user?.email);
    return profile?.initials ?? "—";
  }, [auth.user, data.profiles]);

  // Permission: Manager+ can edit any; Crew can edit only their own
  const canEdit = auth.currentRole === "owner"
    || auth.currentRole === "manager"
    || (auth.currentRole === "crew" && sop.createdBy === userInitials);

  const canDelete = canEdit;  // same rule

  function handleDelete() {
    if (!confirm(`Delete "${sop.title}"?\n\nVersion history is included. Comments stay archived but become orphaned. You can Undo right after.`)) return;
    const undo = deleteSOP(sop.id, userInitials);
    if (!undo) {
      toast("Couldn't delete SOP", { variant: "error" });
      return;
    }
    toast(`Deleted: ${sop.title}`, {
      action: { label: "Undo", onClick: () => { undo(); toast("SOP restored"); } },
    });
    router.push("/sops");
  }

  function handleRevert(version: SOPVersion) {
    if (!confirm(`Revert "${sop.title}" to the version saved on ${formatDateTime(version.savedAt)}?\n\nThe current version will be saved to history.`)) return;
    const ok = updateSOP(sop.id, {
      title: version.title,
      body: version.body,
      categories: version.categories,
    }, userInitials, /* reverting */ true);
    if (!ok) {
      toast("Couldn't revert", { variant: "error" });
      return;
    }
    setViewingVersion(null);
    toast("Reverted to earlier version");
  }

  const creator = data.profiles.find(p => p.initials === sop.createdBy);
  const lastEditor = data.profiles.find(p => p.initials === sop.lastEditedBy);
  const wasEdited = sop.lastEditedAt !== sop.createdAt;

  /**
   * Entities this SOP is currently linked to (iter-27c). Resolved against
   * current workspace data so deleted entities are naturally excluded
   * (their ids stay in the link arrays but the lookup misses them).
   * The detail page renders three lists below — assets, kits, projects.
   */
  const linkedEntities = useMemo(
    () => getEntitiesForSOP(sop, { assets: data.assets, kits: data.kits, projects: data.projects }),
    [sop, data.assets, data.kits, data.projects]
  );
  const totalLinks = linkedEntities.assets.length + linkedEntities.kits.length + linkedEntities.projects.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
      <TopNav />
      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: isMobile ? "16px 14px" : "28px 28px" }}>

          {/* Back link */}
          <Link href="/sops" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: "'DM Mono',monospace", fontSize: 11,
            color: "var(--t3)", textDecoration: "none",
            marginBottom: 12,
          }}>
            ← All SOPs
          </Link>

          {/* Header */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em", marginBottom: 8 }}>
              {sop.title}
            </div>

            {/* Categories + meta */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 10 }}>
              {sop.categories.length > 0 ? (
                sop.categories.map(cat => (
                  <span key={cat} style={{
                    fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700,
                    padding: "3px 9px", borderRadius: 3, letterSpacing: "0.05em",
                    background: "var(--s2)", color: "var(--t2)",
                    border: "1px solid var(--b1)",
                    textTransform: "uppercase",
                  }}>
                    {cat}
                  </span>
                ))
              ) : (
                <span style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 10,
                  color: "var(--t3)", letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}>
                  uncategorized
                </span>
              )}
            </div>

            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", lineHeight: 1.7 }}>
              Created by {creator?.name ?? sop.createdBy} on {formatDateTime(sop.createdAt)}
              {wasEdited && (
                <> · Last edited by {lastEditor?.name ?? sop.lastEditedBy} on {formatDateTime(sop.lastEditedAt)}</>
              )}
              {sop.versions.length > 0 && (
                <> · <button
                  onClick={() => setShowHistory(s => !s)}
                  style={{
                    background: "transparent", border: "none",
                    color: "var(--acc)", cursor: "pointer",
                    fontFamily: "inherit", fontSize: "inherit",
                    padding: 0, textDecoration: "underline",
                  }}
                >{sop.versions.length} earlier version{sop.versions.length === 1 ? "" : "s"}</button></>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {(canEdit || canDelete) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              {canEdit && (
                <button onClick={() => setEditOpen(true)} style={{
                  background: "var(--acc)", color: "var(--bg)",
                  border: "none", borderRadius: 6,
                  padding: "10px 16px",
                  fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13,
                  cursor: "pointer", minHeight: 40,
                }}>
                  Edit
                </button>
              )}
              {canDelete && (
                <button onClick={handleDelete} style={{
                  background: "transparent", color: "var(--red)",
                  border: "1px solid var(--red)", borderRadius: 6,
                  padding: "10px 16px",
                  fontFamily: "'DM Sans',sans-serif", fontSize: 13,
                  cursor: "pointer", minHeight: 40,
                }}>
                  Delete
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ padding: "20px 24px" }}>
              {sop.body.trim() === "" ? (
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", fontStyle: "italic" }}>
                  (empty)
                </div>
              ) : (
                <MarkdownBlock body={sop.body} />
              )}
            </div>
          </Card>

          {/* Attachments (iter-27b) */}
          {sop.attachments.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ padding: "14px 18px" }}>
                <div style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 9,
                  color: "var(--t3)", letterSpacing: "0.1em",
                  textTransform: "uppercase", marginBottom: 10,
                }}>
                  Attachments ({sop.attachments.length})
                </div>
                <AttachmentsList
                  sopId={sop.id}
                  attachments={sop.attachments}
                  canEdit={canEdit}
                  actorInitials={userInitials}
                  profiles={data.profiles}
                />
              </div>
            </Card>
          )}

          {/* Version history */}
          {showHistory && sop.versions.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ padding: "14px 18px" }}>
                <div style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 9,
                  color: "var(--t3)", letterSpacing: "0.1em",
                  textTransform: "uppercase", marginBottom: 10,
                }}>
                  Earlier versions ({sop.versions.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* Newest first */}
                  {[...sop.versions].reverse().map((version, idx) => {
                    const versionEditor = data.profiles.find(p => p.initials === version.savedBy);
                    const versionNumber = sop.versions.length - idx;
                    return (
                      <div key={version.id} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px",
                        background: "var(--s2)", border: "1px solid var(--b1)",
                        borderRadius: 6,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>
                            v{versionNumber} — {version.title}
                          </div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                            saved {formatDateTime(version.savedAt)} by {versionEditor?.name ?? version.savedBy}
                          </div>
                        </div>
                        <button onClick={() => setViewingVersion(version)} style={{
                          padding: "5px 11px", borderRadius: 4,
                          background: "transparent", border: "1px solid var(--b1)",
                          color: "var(--t1)", fontFamily: "'DM Mono',monospace", fontSize: 10,
                          cursor: "pointer", minHeight: 28,
                        }}>
                          View
                        </button>
                        {canEdit && (
                          <button onClick={() => handleRevert(version)} style={{
                            padding: "5px 11px", borderRadius: 4,
                            background: "transparent", border: "1px solid var(--acc)",
                            color: "var(--acc)", fontFamily: "'DM Mono',monospace", fontSize: 10,
                            cursor: "pointer", minHeight: 28,
                          }}>
                            Revert
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* Linked to (iter-27c) — which entities reference this SOP */}
          {totalLinks > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ padding: "14px 18px" }}>
                <div style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 9,
                  color: "var(--t3)", letterSpacing: "0.1em",
                  textTransform: "uppercase", marginBottom: 10,
                }}>
                  Linked to ({totalLinks})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {linkedEntities.assets.length > 0 && (
                    <LinkedGroup
                      label="Assets"
                      items={linkedEntities.assets.map(a => ({
                        id: a.id,
                        name: a.name,
                        href: `/asset/${encodeURIComponent(a.barcode)}`,
                        secondary: a.barcode,
                      }))}
                    />
                  )}
                  {linkedEntities.kits.length > 0 && (
                    <LinkedGroup
                      label="Kits"
                      items={linkedEntities.kits.map(k => ({
                        id: k.id,
                        name: k.name,
                        href: `/kit/${encodeURIComponent(k.barcode)}`,
                        secondary: `${k.componentIds.length} component${k.componentIds.length === 1 ? "" : "s"}`,
                      }))}
                    />
                  )}
                  {linkedEntities.projects.length > 0 && (
                    <LinkedGroup
                      label="Projects"
                      items={linkedEntities.projects.map(p => ({
                        id: p.id,
                        name: p.title,
                        href: `/projects/${encodeURIComponent(p.id)}`,
                        secondary: p.client,
                      }))}
                    />
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Comments */}
          <Card>
            <div style={{ padding: "14px 18px 18px" }}>
              <CommentsThread
                parentType="sop"
                parentId={sop.id}
                parentLabel={sop.title}
              />
            </div>
          </Card>

        </div>
      </div>

      <EditSOPModal open={editOpen} onClose={() => setEditOpen(false)} sop={sop} />

      {/* Version viewer modal */}
      {viewingVersion && (
        <VersionViewerModal
          version={viewingVersion}
          versionNumber={sop.versions.findIndex(v => v.id === viewingVersion.id) + 1}
          onClose={() => setViewingVersion(null)}
          onRevert={canEdit ? () => handleRevert(viewingVersion) : undefined}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Version viewer
// ──────────────────────────────────────────────────────────────────────────

function VersionViewerModal({ version, versionNumber, onClose, onRevert }: {
  version: SOPVersion;
  versionNumber: number;
  onClose: () => void;
  onRevert?: () => void;
}) {
  /*
   * Read-only view of a past version's content. Uses the same mousedown/
   * mouseup pattern as the Modal component to avoid the accidental-dismiss
   * bug fixed in iter-26.
   */
  const [mouseDownOnOverlay, setMouseDownOnOverlay] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function handleMouseDown(e: React.MouseEvent) {
    setMouseDownOnOverlay(e.target === e.currentTarget);
  }
  function handleMouseUp(e: React.MouseEvent) {
    if (e.target === e.currentTarget && mouseDownOnOverlay) {
      onClose();
    }
    setMouseDownOnOverlay(false);
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, backdropFilter: "blur(4px)",
      }}
    >
      <div style={{
        background: "var(--s1)",
        border: "1px solid var(--b1)",
        borderRadius: 12,
        maxWidth: 720, width: "100%", maxHeight: "85vh",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--b1)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>
              v{versionNumber} — {version.title}
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
              saved {formatDateTime(version.savedAt)} by {version.savedBy}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none",
            color: "var(--t2)", fontSize: 22, cursor: "pointer",
            padding: 4, minHeight: 36, minWidth: 36,
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {version.categories.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {version.categories.map(cat => (
                <span key={cat} style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700,
                  padding: "3px 9px", borderRadius: 3, letterSpacing: "0.05em",
                  background: "var(--s2)", color: "var(--t2)",
                  border: "1px solid var(--b1)",
                  textTransform: "uppercase",
                }}>
                  {cat}
                </span>
              ))}
            </div>
          )}
          <MarkdownBlock body={version.body} />
        </div>

        {/* Revert action */}
        {onRevert && (
          <div style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--b1)",
            display: "flex", justifyContent: "flex-end", gap: 8,
            flexShrink: 0,
          }}>
            <button onClick={onClose} style={{
              padding: "9px 14px", borderRadius: 6,
              background: "transparent", border: "1px solid var(--b2)",
              color: "var(--t1)", cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif", fontSize: 12,
              minHeight: 36,
            }}>
              Close
            </button>
            <button onClick={onRevert} style={{
              padding: "9px 14px", borderRadius: 6,
              background: "var(--acc)", color: "var(--bg)",
              border: "none", cursor: "pointer",
              fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700,
              minHeight: 36,
            }}>
              Revert to this version
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Markdown rendering
// ──────────────────────────────────────────────────────────────────────────

/**
 * Render markdown body to React elements. Block-level: handles headings,
 * lists, paragraphs. Inline: bold, italic, code, links. No HTML output;
 * no dangerouslySetInnerHTML — every node is a real React element.
 *
 * Block syntax supported:
 *   # H1
 *   ## H2
 *   ### H3
 *   - bullet line
 *   * bullet line (alternate)
 *   1. numbered line (renders as bullets — keep parser simple)
 *   (blank line) → paragraph break
 *
 * Inline syntax supported (within each block):
 *   **bold**
 *   *italic*
 *   `code`
 *   [label](url)  (only http(s):// and mailto: schemes; others render as text)
 */
function MarkdownBlock({ body }: { body: string }) {
  const blocks = useMemo(() => parseBlocks(body), [body]);

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "var(--t1)", lineHeight: 1.7 }}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "h1":
            return (
              <h1 key={i} style={{
                fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700,
                color: "var(--t1)", marginTop: i === 0 ? 0 : 22, marginBottom: 10,
                letterSpacing: "-0.01em",
              }}>
                {renderInline(block.text)}
              </h1>
            );
          case "h2":
            return (
              <h2 key={i} style={{
                fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700,
                color: "var(--t1)", marginTop: i === 0 ? 0 : 18, marginBottom: 8,
              }}>
                {renderInline(block.text)}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} style={{
                fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700,
                color: "var(--t1)", marginTop: i === 0 ? 0 : 14, marginBottom: 6,
              }}>
                {renderInline(block.text)}
              </h3>
            );
          case "list":
            return (
              <ul key={i} style={{ paddingLeft: 22, marginTop: 6, marginBottom: 12 }}>
                {block.items.map((item, j) => (
                  <li key={j} style={{ marginBottom: 4 }}>
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            );
          case "para":
            return (
              <p key={i} style={{ marginTop: 0, marginBottom: 12, whiteSpace: "pre-wrap" }}>
                {renderInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}

type Block =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "para"; text: string };

function parseBlocks(body: string): Block[] {
  const lines = body.split("\n");
  const blocks: Block[] = [];
  let paraLines: string[] = [];
  let listItems: string[] = [];

  function flushPara() {
    if (paraLines.length > 0) {
      blocks.push({ kind: "para", text: paraLines.join("\n") });
      paraLines = [];
    }
  }
  function flushList() {
    if (listItems.length > 0) {
      blocks.push({ kind: "list", items: listItems });
      listItems = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Blank line: flush current accumulators
    if (trimmed === "") {
      flushPara();
      flushList();
      continue;
    }

    // Headings (must be checked before lists since # is only at line start)
    if (trimmed.startsWith("### ")) {
      flushPara(); flushList();
      blocks.push({ kind: "h3", text: trimmed.slice(4) });
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushPara(); flushList();
      blocks.push({ kind: "h2", text: trimmed.slice(3) });
      continue;
    }
    if (trimmed.startsWith("# ")) {
      flushPara(); flushList();
      blocks.push({ kind: "h1", text: trimmed.slice(2) });
      continue;
    }

    // List items: -, *, or 1. style
    const bulletMatch = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (bulletMatch) {
      flushPara();
      listItems.push(bulletMatch[3]);
      continue;
    }

    // Otherwise paragraph
    flushList();
    paraLines.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

/**
 * Inline tokenizer: walks the text and emits React nodes for matched
 * patterns, plain text for the rest. Operates greedily on each match
 * position; bold (**) is tried before italic (*) to avoid mis-tokenizing
 * "**bold**" as two italic markers.
 */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Try each pattern at the start of `remaining`
    const matched = tryMatch(remaining, key);
    if (matched) {
      nodes.push(matched.node);
      remaining = remaining.slice(matched.consumed);
      key++;
      continue;
    }

    // No pattern matched at this position. Consume one character and keep
    // going. We coalesce consecutive plain chars into the last text node
    // to keep the React tree smaller.
    const last = nodes[nodes.length - 1];
    if (typeof last === "string") {
      nodes[nodes.length - 1] = last + remaining[0];
    } else {
      nodes.push(remaining[0]);
    }
    remaining = remaining.slice(1);
  }

  return nodes;
}

function tryMatch(s: string, key: number): { node: React.ReactNode; consumed: number } | null {
  // Bold: **text**
  let m = /^\*\*([^*\n]+?)\*\*/.exec(s);
  if (m) return { node: <strong key={key}>{m[1]}</strong>, consumed: m[0].length };

  // Italic: *text*
  m = /^\*([^*\n]+?)\*/.exec(s);
  if (m) return { node: <em key={key}>{m[1]}</em>, consumed: m[0].length };

  // Inline code: `text`
  m = /^`([^`\n]+?)`/.exec(s);
  if (m) return {
    node: (
      <code key={key} style={{
        fontFamily: "'DM Mono',monospace",
        fontSize: "0.9em",
        background: "var(--s2)",
        padding: "1px 5px",
        borderRadius: 3,
        border: "1px solid var(--b1)",
      }}>{m[1]}</code>
    ),
    consumed: m[0].length,
  };

  // Link: [label](url) — allowlisted schemes only
  m = /^\[([^\]\n]+?)\]\(([^)\s]+?)\)/.exec(s);
  if (m) {
    const url = m[2];
    const safe = /^(https?:\/\/|mailto:)/i.test(url);
    if (!safe) {
      // Render as plain text — user can't slip in javascript:alert(...) etc.
      return { node: m[0], consumed: m[0].length };
    }
    return {
      node: (
        <a key={key} href={url} target="_blank" rel="noopener noreferrer" style={{
          color: "var(--acc)", textDecoration: "underline",
        }}>{m[1]}</a>
      ),
      consumed: m[0].length,
    };
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

/**
 * Display a group of linked entities (assets / kits / projects) on the
 * SOP detail page's "Linked to" section. Each item has a name, secondary
 * line, and link to the entity's detail page.
 */
function LinkedGroup({ label, items }: {
  label: string;
  items: { id: string; name: string; href: string; secondary: string }[];
}) {
  return (
    <div>
      <div style={{
        fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
        color: "var(--t3)", letterSpacing: "0.05em",
        textTransform: "uppercase", marginBottom: 5,
      }}>
        {label} ({items.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map(item => (
          <Link key={item.id} href={item.href} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "7px 11px",
            background: "var(--s2)", border: "1px solid var(--b1)",
            borderRadius: 5, textDecoration: "none",
            transition: "background 0.12s",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.name}
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 1 }}>
                {item.secondary}
              </div>
            </div>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
