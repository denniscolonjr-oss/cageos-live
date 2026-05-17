"use client";

/**
 * AddSOPModal (iter-27a)
 *
 * Create a new SOP. Title (required), categories (optional multi-select),
 * body markdown (optional but recommended). Categories sourced from the
 * union of asset categories + existing SOP categories.
 *
 * Submitted via useWorkspace().addSOP. Author is the current user's profile
 * initials, looked up via auth.user.email → data.profiles.
 *
 * Markdown formatting hint is shown inline so users know the syntax. The
 * preview is left for iter-27b or later — V1 keeps the form simple.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import Modal from "@/components/ui/Modal";
import AttachmentPicker from "@/components/shared/AttachmentPicker";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";
import type { SOPAttachment } from "@/lib/hooks/workspaceTypes";

export default function AddSOPModal({ open, onClose }: {
  open: boolean;
  onClose: () => void;
}) {
  const auth = useAuth();
  const { data, addSOP } = useWorkspace();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<SOPAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  /*
   * Draft SOP id for storage path scoping. Generated once per modal open,
   * shared with AttachmentPicker so uploaded files land at
   *   sop-files/<workspaceId>/<draftSopId>/<file>
   * On submit, we pass this same id into addSOP so the storage path and
   * the SOP record's id stay aligned. If the user cancels, the uploaded
   * files orphan (cleanup is a future iteration).
   */
  const [draftSopId, setDraftSopId] = useState<string>("");

  // Reset form whenever the modal opens
  useEffect(() => {
    if (open) {
      setTitle("");
      setBody("");
      setSelectedCategories([]);
      setAttachments([]);
      setSubmitting(false);
      setDraftSopId(`sop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      // Focus title input on open
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open]);

  /**
   * Category vocabulary: union of asset categories + categories already
   * used by SOPs. Same as the library list dropdown for consistency.
   */
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const a of data.assets) if (a.category) set.add(a.category);
    for (const s of data.sops) for (const c of s.categories) set.add(c);
    return Array.from(set).sort();
  }, [data.assets, data.sops]);

  /**
   * Find current user's profile initials. Falls back to "—" if not found
   * (shouldn't happen in real workspaces — every signed-in user has a
   * profile — but defensive against edge cases).
   */
  const authorInitials = useMemo(() => {
    if (!auth.user) return "—";
    const profile = data.profiles.find(p => p.email === auth.user?.email);
    return profile?.initials ?? "—";
  }, [auth.user, data.profiles]);

  function toggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast("Title required", { variant: "error" });
      titleRef.current?.focus();
      return;
    }
    setSubmitting(true);
    const id = addSOP({
      id: draftSopId,
      title: trimmed,
      body: body,
      categories: selectedCategories,
      authorInitials,
      attachments,
    });
    setSubmitting(false);
    if (!id) {
      toast("Couldn't create SOP", { variant: "error", detail: "Permission denied or workspace not ready." });
      return;
    }
    const attachNote = attachments.length > 0
      ? ` with ${attachments.length} attachment${attachments.length === 1 ? "" : "s"}`
      : "";
    toast(`Created: ${trimmed}${attachNote}`);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New SOP" maxWidth={680}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Title */}
        <div>
          <label style={{
            display: "block",
            fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
            color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 6,
          }}>
            Title
          </label>
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g., FR7 PTZ setup procedure"
            onKeyDown={e => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "var(--s2)",
              border: "1px solid var(--b1)",
              borderRadius: 6,
              color: "var(--t1)",
              fontFamily: "'DM Sans',sans-serif", fontSize: 14,
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Categories */}
        <div>
          <label style={{
            display: "block",
            fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
            color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 6,
          }}>
            Categories <span style={{ textTransform: "none", color: "var(--t3)", fontWeight: 400 }}>(optional, select any that apply)</span>
          </label>
          {allCategories.length === 0 ? (
            <div style={{
              padding: "10px 12px",
              background: "var(--s2)",
              border: "1px dashed var(--b1)",
              borderRadius: 6,
              fontFamily: "'DM Mono',monospace", fontSize: 11,
              color: "var(--t3)",
            }}>
              No categories yet. Categories appear here once your asset list has any, or after the first SOP is tagged.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {allCategories.map(cat => {
                const active = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    style={{
                      padding: "5px 11px", borderRadius: 4,
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
          )}
        </div>

        {/* Body */}
        <div>
          <label style={{
            display: "block",
            fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
            color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 6,
          }}>
            Body <span style={{ textTransform: "none", color: "var(--t3)", fontWeight: 400 }}>(markdown supported)</span>
          </label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={"Write the procedure. Examples of supported formatting:\n\n## Section heading\n- Bulleted item\n- Another item\n\n**bold** *italic* `inline code`\n[link label](https://example.com)"}
            rows={14}
            style={{
              width: "100%",
              padding: "12px 14px",
              background: "var(--s2)",
              border: "1px solid var(--b1)",
              borderRadius: 6,
              color: "var(--t1)",
              fontFamily: "'DM Mono',monospace", fontSize: 12,
              lineHeight: 1.6,
              outline: "none",
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
          <div style={{
            fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)",
            marginTop: 6, letterSpacing: "0.04em",
          }}>
            Supports: # headings (one or two #), - lists, **bold**, *italic*, `code`, [links](url). Press Cmd+Enter to save.
          </div>
        </div>

        {/* Attachments (iter-27b) */}
        <div>
          <label style={{
            display: "block",
            fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
            color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 6,
          }}>
            Attachments <span style={{ textTransform: "none", color: "var(--t3)", fontWeight: 400 }}>(optional)</span>
          </label>
          {draftSopId && (
            <AttachmentPicker
              sopId={draftSopId}
              uploaderInitials={authorInitials}
              onAttachmentsChange={setAttachments}
            />
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px", borderRadius: 6,
              background: "transparent",
              border: "1px solid var(--b2)",
              color: "var(--t1)",
              fontFamily: "'DM Sans',sans-serif", fontSize: 13,
              cursor: "pointer", minHeight: 40,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            style={{
              padding: "10px 18px", borderRadius: 6,
              background: title.trim() && !submitting ? "var(--acc)" : "var(--s3)",
              color: title.trim() && !submitting ? "var(--bg)" : "var(--t3)",
              border: "none",
              cursor: title.trim() && !submitting ? "pointer" : "not-allowed",
              fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
              minHeight: 40,
            }}
          >
            {submitting ? "Creating..." : "Create SOP"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
