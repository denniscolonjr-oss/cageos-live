"use client";

/**
 * /inbox — Mentions of me
 *
 * Lists every comment in the workspace where the current user is @mentioned.
 * Each row deep-links to the parent entity (asset/kit/etc) where the comment
 * lives. Unread mentions show with a yellow dot indicator and bolder body;
 * clicking a row marks the mention read before navigating.
 *
 * Future expansion (tracked, not in this push):
 *   - Filter tabs: All, Unread, Tasks assigned to me, Mentions I've sent
 *   - Bulk mark-all-read action
 *   - Filter by parent type
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/shared/TopNav";
import Card from "@/components/ui/Card";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import type { Note } from "@/lib/data";

type FilterMode = "all" | "unread";

export default function InboxPage() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const auth = useAuth();
  const {
    data, hydrated, myInboxNotes, markNoteRead,
  } = useWorkspace();

  const [filter, setFilter] = useState<FilterMode>("all");

  /**
   * Signout guard — same pattern as asset/kit detail pages. Without this the
   * page renders empty data after signout. Routing to /login is cleaner.
   */
  const signedOut = auth.supabaseEnabled && !auth.loading && !auth.session;
  if (signedOut) {
    router.replace("/login");
    return null;
  }

  if (!hydrated || auth.loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          Loading workspace...
        </div>
      </div>
    );
  }

  const myUserId = auth.user?.id ?? "";
  const filteredNotes = filter === "unread"
    ? myInboxNotes.filter(n => !n.readBy.includes(myUserId))
    : myInboxNotes;
  const unreadCount = myInboxNotes.filter(n => !n.readBy.includes(myUserId)).length;

  /**
   * Build the URL for an inbox row's parent entity. Mirrors the logic in
   * the send-mention API's buildDeepLink — extend this switch as new
   * detail routes get added (shoot, checkout, user).
   */
  function urlForParent(parentType: Note["parentType"], parentId: string): string {
    switch (parentType) {
      case "asset":    return `/asset/${encodeURIComponent(parentId)}`;
      case "kit":      return `/kit/${encodeURIComponent(parentId)}`;
      case "checkout": return `/checkouts/${encodeURIComponent(parentId)}`;
      default:         return "/dashboard";
    }
  }

  /**
   * Resolve a parent label (e.g. "Sigma 85mm f/1.4") from its type + id.
   * Falls back to the parent id if the entity has been deleted/renamed.
   */
  function labelForParent(n: Note): string {
    if (n.parentType === "asset") {
      const a = data.assets.find(x => x.id === n.parentId);
      return a?.name ?? `Asset ${n.parentId}`;
    }
    if (n.parentType === "kit") {
      const k = data.kits.find(x => x.id === n.parentId);
      return k?.name ?? `Kit ${n.parentId}`;
    }
    if (n.parentType === "checkout") {
      const c = data.checkouts.find(x => x.id === n.parentId);
      if (!c) return `Checkout ${n.parentId}`;
      // Compose a useful label from kit names + user, since checkouts don't
      // have a single .name field. "Cinema Kit A · Brittany R" reads better
      // than the bare id.
      const kitsLabel = c.kits?.length ? c.kits.join(" · ") : `${c.kits?.length ?? 0} kits`;
      return `${kitsLabel} (${c.user})`;
    }
    return n.parentId;
  }

  function handleRowClick(n: Note) {
    // Mark read first, then navigate. The read state is best-effort — if the
    // navigation lands and the page renders before the save completes, the
    // dot will linger briefly but resolve on next reload.
    markNoteRead(n.id);
    router.push(urlForParent(n.parentType, n.parentId));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <TopNav />
      <div style={{ flex: 1, padding: isMobile ? "20px 14px" : "32px 28px", background: "var(--bg)" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>
              Inbox
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
              Comments where you&apos;ve been @mentioned
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{
            display: "flex", gap: 6, marginBottom: 14,
            borderBottom: "1px solid var(--b1)",
          }}>
            <FilterTab
              label="All"
              count={myInboxNotes.length}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            <FilterTab
              label="Unread"
              count={unreadCount}
              active={filter === "unread"}
              onClick={() => setFilter("unread")}
              highlight={unreadCount > 0}
            />
          </div>

          {filteredNotes.length === 0 ? (
            <Card>
              <div style={{
                padding: "48px 24px", textAlign: "center",
                color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 12,
              }}>
                {filter === "unread"
                  ? "No unread mentions. You're all caught up."
                  : "No mentions yet. When someone @mentions you in a comment, it'll appear here."
                }
              </div>
            </Card>
          ) : (
            <Card>
              <div>
                {filteredNotes.map((n, i) => {
                  const isUnread = !n.readBy.includes(myUserId);
                  const isLast = i === filteredNotes.length - 1;
                  return (
                    <InboxRow
                      key={n.id}
                      note={n}
                      label={labelForParent(n)}
                      isUnread={isUnread}
                      isLast={isLast}
                      onClick={() => handleRowClick(n)}
                    />
                  );
                })}
              </div>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Filter tab
// ──────────────────────────────────────────────────────────────────────────

function FilterTab({
  label, count, active, onClick, highlight,
}: {
  label: string; count: number; active: boolean; onClick: () => void; highlight?: boolean;
}) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: "none",
      padding: "8px 14px 10px", cursor: "pointer",
      fontFamily: "'DM Sans',sans-serif", fontSize: 13,
      fontWeight: active ? 600 : 400,
      color: active ? "var(--t1)" : "var(--t3)",
      borderBottom: `2px solid ${active ? "var(--acc)" : "transparent"}`,
      marginBottom: "-1px",
      display: "flex", alignItems: "center", gap: 6,
    }}>
      {label}
      {count > 0 && (
        <span style={{
          fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700,
          padding: "1px 6px", borderRadius: 9,
          background: highlight ? "var(--acc)" : "var(--s3)",
          color: highlight ? "var(--bg)" : "var(--t2)",
          minWidth: 16, textAlign: "center",
        }}>{count}</span>
      )}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Inbox row
// ──────────────────────────────────────────────────────────────────────────

function InboxRow({
  note, label, isUnread, isLast, onClick,
}: {
  note: Note; label: string; isUnread: boolean; isLast: boolean; onClick: () => void;
}) {
  const ts = formatRelative(note.createdAt);
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left",
      background: "transparent", border: "none",
      borderBottom: isLast ? "none" : "1px solid var(--b1)",
      padding: "14px 18px", cursor: "pointer",
      transition: "background 0.12s",
    }}
    onMouseEnter={e => e.currentTarget.style.background = "var(--s2)"}
    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {/* Unread dot */}
        <div style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          marginTop: 8,
          background: isUnread ? "var(--acc)" : "transparent",
        }} />

        {/* Avatar */}
        <div title={note.authorName} style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "var(--s3)", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Syne',sans-serif", fontSize: 10, fontWeight: 700,
          color: note.authorColor,
        }}>{note.authorInitials}</div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap",
            marginBottom: 3,
          }}>
            <span style={{
              fontSize: 13,
              fontWeight: isUnread ? 700 : 500,
              color: "var(--t1)",
            }}>{note.authorName}</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
              on {parentTypeLabel(note.parentType)} · {ts}
            </span>
            {note.isTask && (
              <span style={{
                fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
                padding: "1px 6px", borderRadius: 3, letterSpacing: "0.05em",
                background: note.resolvedAt ? "rgba(109,238,159,0.1)" : "rgba(251,194,92,0.1)",
                color: note.resolvedAt ? "var(--green)" : "var(--amber)",
                border: `1px solid ${note.resolvedAt ? "var(--green)" : "var(--amber)"}`,
                textTransform: "uppercase",
              }}>
                {note.resolvedAt ? "RESOLVED" : "TASK"}
              </span>
            )}
          </div>
          <div style={{
            fontSize: 12, color: "var(--t2)",
            fontFamily: "'DM Mono',monospace",
            marginBottom: 4,
          }}>
            {label}
          </div>
          <div style={{
            fontSize: 13, lineHeight: 1.5, color: "var(--t1)",
            fontFamily: "'DM Sans',sans-serif",
            // Truncate long mention bodies in the list view — full text shows
            // when you click through to the parent entity.
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {note.body}
          </div>
        </div>
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function parentTypeLabel(t: Note["parentType"]): string {
  switch (t) {
    case "asset":    return "an asset";
    case "kit":      return "a kit";
    case "shoot":    return "a shoot";
    case "checkout": return "a checkout";
    case "user":     return "a message";
  }
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
