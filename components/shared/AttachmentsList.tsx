"use client";

/**
 * AttachmentsList — render an SOP's file attachments with previews
 * and remove buttons (iter-27b).
 *
 * Used on the SOP detail page (/sops/[id]). Read-only mode if the
 * current user can't edit the SOP.
 *
 * Per-file behavior:
 *   - PDF: filename click opens in new tab; "Preview" button toggles
 *     inline iframe at 600px height
 *   - .md / .txt: filename click opens in new tab (browser renders text)
 *   - .rtf: filename click triggers download (browsers don't render RTF)
 *   - All: filesize shown in KB/MB; uploaded-by name and time
 *
 * Permission rules for removing: same as for editing the parent SOP
 * (Manager+ on any; Crew only on own). Enforced both here (button shown)
 * and in the hook (mutator rejects unauthorized calls).
 */

import { useState } from "react";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";
import type { SOPAttachment } from "@/lib/hooks/workspaceTypes";

export default function AttachmentsList({
  sopId,
  attachments,
  canEdit,
  actorInitials,
  profiles,
}: {
  sopId: string;
  attachments: SOPAttachment[];
  canEdit: boolean;
  actorInitials: string;
  profiles: { initials: string; name: string }[];
}) {
  const { removeSOPAttachment } = useWorkspace();
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  function handleRemove(attachment: SOPAttachment) {
    if (!confirm(`Remove "${attachment.filename}" from this SOP?\n\nThe file stays in storage but is no longer linked to the SOP.`)) return;
    const ok = removeSOPAttachment(sopId, attachment.id, actorInitials);
    if (!ok) {
      toast("Couldn't remove", { variant: "error", detail: "Permission denied." });
      return;
    }
    if (previewingId === attachment.id) setPreviewingId(null);
    toast(`Removed: ${attachment.filename}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {attachments.map(a => {
        const uploader = profiles.find(p => p.initials === a.uploadedBy);
        const isPDF = a.mimeType === "application/pdf" || a.filename.toLowerCase().endsWith(".pdf");
        const isRTF = a.mimeType.includes("rtf") || a.filename.toLowerCase().endsWith(".rtf");
        const isPreviewing = previewingId === a.id;

        return (
          <div key={a.id}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              background: "var(--s2)", border: "1px solid var(--b1)",
              borderRadius: 6,
            }}>
              {/* File icon */}
              <div style={{
                width: 32, height: 32, borderRadius: 4,
                background: "var(--s3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
                color: "var(--t2)", letterSpacing: "0.04em",
                flexShrink: 0,
              }}>
                {getFileTag(a)}
              </div>

              {/* File info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  // For RTF, force download with the download attribute since
                  // browsers won't render it inline anyway.
                  download={isRTF ? a.filename : undefined}
                  style={{
                    fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600,
                    color: "var(--t1)", textDecoration: "none",
                    display: "block",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                >
                  {a.filename}
                </a>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                  {formatBytes(a.sizeBytes)}
                  {" · "}
                  Added by {uploader?.name ?? a.uploadedBy} on {formatDate(a.uploadedAt)}
                </div>
              </div>

              {/* PDF preview toggle */}
              {isPDF && (
                <button
                  onClick={() => setPreviewingId(isPreviewing ? null : a.id)}
                  style={{
                    padding: "5px 11px", borderRadius: 4,
                    background: isPreviewing ? "var(--acc)" : "transparent",
                    color: isPreviewing ? "var(--bg)" : "var(--t1)",
                    border: `1px solid ${isPreviewing ? "var(--acc)" : "var(--b1)"}`,
                    fontFamily: "'DM Mono',monospace", fontSize: 10,
                    cursor: "pointer", minHeight: 28,
                    flexShrink: 0,
                  }}
                >
                  {isPreviewing ? "Hide" : "Preview"}
                </button>
              )}

              {/* Remove (Manager+ on any, Crew on own SOPs) */}
              {canEdit && (
                <button
                  onClick={() => handleRemove(a)}
                  title="Remove attachment"
                  style={{
                    padding: "5px 9px", borderRadius: 4,
                    background: "transparent",
                    color: "var(--red)",
                    border: "1px solid var(--red)",
                    fontFamily: "'DM Mono',monospace", fontSize: 10,
                    cursor: "pointer", minHeight: 28,
                    flexShrink: 0,
                  }}
                >
                  Remove
                </button>
              )}
            </div>

            {/* Inline PDF preview */}
            {isPDF && isPreviewing && (
              <div style={{
                marginTop: 8,
                border: "1px solid var(--b1)",
                borderRadius: 6,
                overflow: "hidden",
                background: "var(--s2)",
              }}>
                <iframe
                  src={a.url}
                  style={{
                    width: "100%",
                    height: 600,
                    border: "none",
                    display: "block",
                  }}
                  title={`Preview of ${a.filename}`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function getFileTag(a: SOPAttachment): string {
  const name = a.filename.toLowerCase();
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".md")) return "MD";
  if (name.endsWith(".rtf")) return "RTF";
  if (name.endsWith(".txt")) return "TXT";
  return "FILE";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}
