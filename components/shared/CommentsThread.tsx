"use client";

/**
 * CommentsThread
 *
 * Renders all comments attached to a parent entity (asset/kit/shoot/checkout)
 * plus the input to add a new one.
 *
 * Layout (per iter-17 design D + E):
 *   - List of existing comments, oldest-first, compact rows
 *   - Each row: avatar + name + timestamp + body + (resolve/edit/delete on hover)
 *   - Input at the bottom for new comment, with @mention autocomplete
 *   - "This is a task" toggle next to submit
 *
 * Read access: any role (including Viewer)
 * Write access: Crew+ (Viewer can read but not post)
 *
 * Usage:
 *   <CommentsThread parentType="asset" parentId={asset.id} />
 */

import { useState, useRef, useMemo } from "react";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import type { Note, NoteParentType } from "@/lib/data";

interface CommentsThreadProps {
  parentType: NoteParentType;
  parentId: string;
  /** Optional: extra context shown in mention notification emails (e.g. asset name) */
  parentLabel?: string;
}

export default function CommentsThread({ parentType, parentId, parentLabel }: CommentsThreadProps) {
  const { data, notesForParent, addNote } = useWorkspace();
  const { currentRole, user } = useAuth();
  // Comments require Crew+ (matches kiosk-checkout permission semantics).
  // Owner/Manager/Crew can post; Viewer is read-only.
  const canPost = currentRole === "owner" || currentRole === "manager" || currentRole === "crew";

  const notes = notesForParent(parentType, parentId);

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{
        fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "var(--t1)",
        marginBottom: 12, letterSpacing: "0.02em",
      }}>
        Comments {notes.length > 0 && (
          <span style={{ color: "var(--t3)", fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
            {notes.length}
          </span>
        )}
      </div>

      {notes.length === 0 && !canPost && (
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
          No comments yet.
        </div>
      )}

      {/* Comment list */}
      {notes.length > 0 && (
        <div style={{ marginBottom: canPost ? 16 : 0 }}>
          {notes.map(n => (
            <CommentRow key={n.id} note={n} currentUserId={user?.id ?? null} />
          ))}
        </div>
      )}

      {/* New comment input — only for Crew+ */}
      {canPost && (
        <NewCommentInput
          parentType={parentType}
          parentId={parentId}
          parentLabel={parentLabel}
          profiles={data.profiles}
          onSubmit={(args) => addNote(args)}
        />
      )}

      {!canPost && currentRole === "viewer" && (
        <div style={{
          fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)",
          marginTop: 8, fontStyle: "italic",
        }}>
          Viewer access — read-only
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Comment row
// ──────────────────────────────────────────────────────────────────────────

function CommentRow({ note, currentUserId }: { note: Note; currentUserId: string | null }) {
  const { editNote, deleteNote, resolveNote } = useWorkspace();
  const { currentRole } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(note.body);

  const isAuthor = note.authorUserId === currentUserId;
  const isManager = currentRole === "owner" || currentRole === "manager";
  const canEdit = isAuthor;
  const canDelete = isAuthor || isManager;

  function handleSaveEdit() {
    if (editBody.trim() && editBody.trim() !== note.body) {
      editNote(note.id, editBody.trim());
    }
    setEditing(false);
  }

  return (
    <div style={{
      padding: "10px 0", borderBottom: "1px solid var(--b1)",
      display: "flex", gap: 10, alignItems: "flex-start",
    }}>
      {/* Avatar */}
      <div title={note.authorName} style={{
        width: 26, height: 26, borderRadius: "50%",
        background: "var(--s3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Syne',sans-serif", fontSize: 10, fontWeight: 700,
        color: note.authorColor, flexShrink: 0,
      }}>{note.authorInitials}</div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap",
          marginBottom: 3,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t1)" }}>
            {note.authorName}
          </span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
            {formatRelative(note.createdAt)}
            {note.editedAt && <span style={{ marginLeft: 5, fontStyle: "italic" }}>(edited)</span>}
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
              {note.resolvedAt ? `RESOLVED${note.resolvedBy ? ` by ${note.resolvedBy}` : ""}` : "TASK"}
            </span>
          )}
        </div>

        {editing ? (
          <div>
            <textarea
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              autoFocus
              rows={3}
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 5,
                background: "var(--s2)", border: "1px solid var(--b2)",
                color: "var(--t1)", fontSize: 13,
                fontFamily: "'DM Sans',sans-serif", resize: "vertical",
                outline: "none", boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button onClick={handleSaveEdit} style={{
                padding: "5px 11px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: "var(--acc)", color: "var(--bg)", border: "none", cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif",
              }}>Save</button>
              <button onClick={() => { setEditing(false); setEditBody(note.body); }} style={{
                padding: "5px 11px", borderRadius: 4, fontSize: 11,
                background: "transparent", color: "var(--t2)",
                border: "1px solid var(--b2)", cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif",
              }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{
            fontSize: 13, color: note.resolvedAt ? "var(--t3)" : "var(--t1)",
            lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
            textDecoration: note.resolvedAt ? "line-through" : "none",
            fontFamily: "'DM Sans',sans-serif",
          }}>
            {renderBodyWithMentions(note.body)}
          </div>
        )}

        {/* Action row — only show if we have actionable buttons */}
        {!editing && (canEdit || canDelete || note.isTask) && (
          <div style={{ marginTop: 5, display: "flex", gap: 12 }}>
            {note.isTask && (
              <button onClick={() => resolveNote(note.id)} style={actionButtonStyle}>
                {note.resolvedAt ? "Reopen" : "Mark resolved"}
              </button>
            )}
            {canEdit && (
              <button onClick={() => setEditing(true)} style={actionButtonStyle}>
                Edit
              </button>
            )}
            {canDelete && (
              <button onClick={() => {
                if (confirm("Delete this comment? This can't be undone.")) {
                  deleteNote(note.id);
                }
              }} style={actionButtonStyle}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const actionButtonStyle: React.CSSProperties = {
  background: "transparent", border: "none",
  color: "var(--t3)", cursor: "pointer",
  fontFamily: "'DM Mono',monospace", fontSize: 10,
  padding: 0,
};

// ──────────────────────────────────────────────────────────────────────────
// New comment input
// ──────────────────────────────────────────────────────────────────────────

function NewCommentInput({
  parentType, parentId, parentLabel, profiles, onSubmit,
}: {
  parentType: NoteParentType;
  parentId: string;
  parentLabel?: string;
  profiles: { name: string; initials: string; color: string }[];
  onSubmit: (args: { parentType: NoteParentType; parentId: string; body: string; isTask: boolean }) => string | null;
}) {
  const [body, setBody] = useState("");
  const [isTask, setIsTask] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mentionDropdown, setMentionDropdown] = useState<{ filter: string; cursorPos: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filtered mention candidates — only profiles with set initials
  const mentionCandidates = useMemo(() => {
    if (!mentionDropdown) return [];
    const filter = mentionDropdown.filter.toLowerCase();
    return profiles
      .filter(p => p.initials && (p.initials.toLowerCase().startsWith(filter) || p.name.toLowerCase().includes(filter)))
      .slice(0, 6);
  }, [mentionDropdown, profiles]);

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setBody(val);
    // Detect @mention trigger: an @ followed by 0-4 alphanumerics, immediately
    // before the cursor. If matched, open the autocomplete dropdown.
    const cursor = e.target.selectionStart ?? val.length;
    const beforeCursor = val.slice(0, cursor);
    const match = beforeCursor.match(/@([A-Za-z0-9]{0,4})$/);
    if (match) {
      setMentionDropdown({ filter: match[1], cursorPos: cursor });
    } else {
      setMentionDropdown(null);
    }
  }

  function applyMention(initials: string) {
    if (!mentionDropdown || !textareaRef.current) return;
    const cursor = mentionDropdown.cursorPos;
    const before = body.slice(0, cursor);
    const after = body.slice(cursor);
    // Replace the partial @xx token with full @INITIALS + trailing space
    const replaced = before.replace(/@[A-Za-z0-9]{0,4}$/, `@${initials.toUpperCase()} `);
    const newBody = replaced + after;
    setBody(newBody);
    setMentionDropdown(null);
    // Restore focus and put cursor right after the inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = replaced.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    const noteId = onSubmit({ parentType, parentId, body: trimmed, isTask });
    setSubmitting(false);
    if (noteId) {
      // Send mention notification emails for any @mentioned profiles
      const mentioned = trimmed.match(/@([A-Z0-9]{1,4})\b/g) ?? [];
      if (mentioned.length > 0) {
        // Fire-and-forget — don't block on email send
        void sendMentionEmails({
          mentionedInitials: mentioned.map(m => m.slice(1).toUpperCase()),
          parentType,
          parentId,
          parentLabel: parentLabel ?? "an item",
          excerpt: trimmed.slice(0, 200),
        });
      }
      setBody("");
      setIsTask(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={textareaRef}
        value={body}
        onChange={handleBodyChange}
        onKeyDown={e => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Add a comment... use @initials to mention someone"
        rows={3}
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 6,
          background: "var(--s2)", border: "1px solid var(--b2)",
          color: "var(--t1)", fontSize: 13,
          fontFamily: "'DM Sans',sans-serif", resize: "vertical",
          outline: "none", boxSizing: "border-box",
        }}
      />

      {/* Mention autocomplete dropdown */}
      {mentionDropdown && mentionCandidates.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + -28px)", left: 12,
          background: "var(--s1)", border: "1px solid var(--b2)", borderRadius: 6,
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)", zIndex: 10,
          minWidth: 200, padding: 4,
        }}>
          {mentionCandidates.map(p => (
            <button
              key={p.initials}
              onClick={() => applyMention(p.initials)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "6px 8px", borderRadius: 4, border: "none",
                background: "transparent", cursor: "pointer", textAlign: "left",
                color: "var(--t1)", fontFamily: "'DM Sans',sans-serif", fontSize: 12,
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--s2)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{
                width: 22, height: 22, borderRadius: "50%", background: "var(--s3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Syne',sans-serif", fontSize: 9, fontWeight: 700,
                color: p.color, flexShrink: 0,
              }}>{p.initials}</div>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{
        marginTop: 8, display: "flex", gap: 12, alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap",
      }}>
        <label style={{
          display: "flex", alignItems: "center", gap: 6,
          cursor: "pointer", fontFamily: "'DM Mono',monospace",
          fontSize: 11, color: "var(--t2)",
        }}>
          <input
            type="checkbox" checked={isTask}
            onChange={e => setIsTask(e.target.checked)}
            style={{ accentColor: "var(--acc)", cursor: "pointer" }}
          />
          Mark as task (resolvable)
        </label>
        <button
          onClick={handleSubmit}
          disabled={!body.trim() || submitting}
          style={{
            padding: "7px 14px", borderRadius: 5, fontSize: 12, fontWeight: 700,
            background: !body.trim() || submitting ? "var(--s3)" : "var(--acc)",
            border: "none",
            color: !body.trim() || submitting ? "var(--t3)" : "var(--bg)",
            cursor: !body.trim() || submitting ? "not-allowed" : "pointer",
            fontFamily: "'Syne',sans-serif", letterSpacing: "0.02em",
          }}
        >
          {submitting ? "Posting..." : "Post comment"}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

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

/**
 * Render comment body with @mentions highlighted.
 * Splits on @TOKEN and wraps mentions in styled spans. Doesn't try to do
 * full markdown rendering — that can come later if needed.
 */
function renderBodyWithMentions(body: string): React.ReactNode {
  const parts = body.split(/(@[A-Z0-9]{1,4}\b)/g);
  return parts.map((p, i) =>
    p.match(/^@[A-Z0-9]+$/) ? (
      <span key={i} style={{
        color: "var(--acc)", fontWeight: 600,
        background: "rgba(236,255,112,0.08)",
        padding: "1px 4px", borderRadius: 3,
      }}>{p}</span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

/**
 * Send mention notification emails via /api/send-mention. Fire-and-forget.
 */
async function sendMentionEmails(args: {
  mentionedInitials: string[];
  parentType: NoteParentType;
  parentId: string;
  parentLabel: string;
  excerpt: string;
}) {
  try {
    const { getSupabaseClient } = await import("@/lib/supabase/client");
    const sb = getSupabaseClient();
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) return;
    await fetch("/api/send-mention", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(args),
    });
  } catch (e) {
    console.warn("[sendMentionEmails] failed:", e);
  }
}
