"use client";

/**
 * EditSOPModal (iter-27a)
 *
 * Edit an existing SOP. Same fields as AddSOPModal, pre-filled.
 *
 * Save creates a new version snapshot (handled by updateSOP in the hook).
 * The pre-edit state is automatically pushed to versions[] so the detail
 * page's history view shows it.
 *
 * Permissions:
 *   - Manager+ can edit any SOP
 *   - Crew can edit only their own (createdBy === their initials).
 *     The hook enforces this; the modal trusts that callers only open it
 *     for editable SOPs.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";
import type { SOP } from "@/lib/hooks/workspaceTypes";

export default function EditSOPModal({ open, onClose, sop }: {
  open: boolean;
  onClose: () => void;
  sop: SOP | null;
}) {
  const auth = useAuth();
  const { data, updateSOP } = useWorkspace();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Re-initialize form when modal opens with a new SOP
  useEffect(() => {
    if (open && sop) {
      setTitle(sop.title);
      setBody(sop.body);
      setSelectedCategories(sop.categories);
      setSubmitting(false);
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open, sop]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const a of data.assets) if (a.category) set.add(a.category);
    for (const s of data.sops) for (const c of s.categories) set.add(c);
    return Array.from(set).sort();
  }, [data.assets, data.sops]);

  const editorInitials = useMemo(() => {
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
    if (!sop) return;
    const trimmed = title.trim();
    if (!trimmed) {
      toast("Title required", { variant: "error" });
      titleRef.current?.focus();
      return;
    }

    // Skip update if nothing actually changed — avoids version-history noise
    const unchanged = trimmed === sop.title
      && body === sop.body
      && arraysEqual(selectedCategories, sop.categories);
    if (unchanged) {
      onClose();
      return;
    }

    setSubmitting(true);
    const ok = updateSOP(sop.id, {
      title: trimmed,
      body,
      categories: selectedCategories,
    }, editorInitials);
    setSubmitting(false);

    if (!ok) {
      toast("Couldn't save changes", { variant: "error", detail: "You may not have permission to edit this SOP." });
      return;
    }
    toast("SOP updated");
    onClose();
  }

  if (!sop) return null;

  return (
    <Modal open={open} onClose={onClose} title="Edit SOP" maxWidth={680}>
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
            Categories
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
              No categories available yet.
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
            Body
          </label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
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
            Saving creates a new version snapshot. Past versions are accessible from the SOP detail page. Press Cmd+Enter to save.
          </div>
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
            {submitting ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i] !== sortedB[i]) return false;
  }
  return true;
}
