"use client";

/**
 * AttachmentPicker — file selection + upload UI for SOP modals (iter-27b).
 *
 * Behavior: upload-on-select. When the user picks files, uploads start
 * immediately. Per-file states are visible:
 *
 *   - uploading: spinner + filename + size
 *   - uploaded:  green check + filename + remove button
 *   - failed:    red error message + retry button
 *
 * The parent component receives the list of SUCCESSFUL uploads via the
 * onAttachmentsChange callback. Failed uploads stay visible in this
 * picker for retry but aren't part of the submitted attachments.
 *
 * For NEW SOPs (in AddSOPModal): the parent collects successful uploads
 * locally and passes them to addSOP() on save. The hook then writes them
 * into the SOP's attachments array atomically with creation.
 *
 * For EDITS (in EditSOPModal): same flow — uploads happen here but the
 * parent calls addSOPAttachment() for each successful upload after the
 * Save action confirms.
 *
 * Storage path uses the SOP id. For NEW SOPs that don't have an id yet,
 * we generate a draft id at picker mount time. The draft id matches the
 * id the parent will use when calling addSOP. This keeps storage paths
 * scoped to the SOP even before it exists in the DB.
 */

import { useState, useRef } from "react";
import { uploadSOPFile, validateSOPFile, MAX_SOP_FILE_BYTES, ALLOWED_SOP_EXTENSIONS } from "@/lib/supabase/uploadSOPFile";
import { useAuth } from "@/lib/supabase/AuthContext";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";
import type { SOPAttachment } from "@/lib/hooks/workspaceTypes";

interface UploadState {
  id: string;              // unique per upload attempt
  filename: string;
  sizeBytes: number;
  status: "uploading" | "uploaded" | "failed";
  attachment?: SOPAttachment;  // present when status === "uploaded"
  error?: string;          // present when status === "failed"
  file?: File;             // kept around for retry
}

export default function AttachmentPicker({
  sopId,
  existing,
  uploaderInitials,
  onAttachmentsChange,
}: {
  /** Storage path scope. Use a draft id for new SOPs (e.g. crypto.randomUUID()). */
  sopId: string;
  /** Existing attachments (when editing). Shown alongside new uploads. */
  existing?: SOPAttachment[];
  /** Initials of the user uploading. Stamped onto each attachment. */
  uploaderInitials: string;
  /** Called with the list of successfully-uploaded NEW attachments. */
  onAttachmentsChange: (attachments: SOPAttachment[]) => void;
}) {
  const auth = useAuth();
  const workspaceId = auth.activeWorkspaceId;

  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [existingShown, setExistingShown] = useState<SOPAttachment[]>(existing ?? []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function emitChange(latest: UploadState[]) {
    // Only successful uploads count toward the attachments list
    const successful = latest
      .filter(u => u.status === "uploaded" && u.attachment)
      .map(u => u.attachment!);
    onAttachmentsChange(successful);
  }

  async function handleFiles(files: FileList) {
    if (!workspaceId) {
      toast("No active workspace", { variant: "error" });
      return;
    }

    const newUploads: UploadState[] = [];
    for (const file of Array.from(files)) {
      const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      newUploads.push({
        id,
        filename: file.name,
        sizeBytes: file.size,
        status: "uploading",
        file,
      });
    }

    // Optimistically add as uploading
    const startingState = [...uploads, ...newUploads];
    setUploads(startingState);

    // Kick off uploads in parallel. As each finishes, update its row.
    await Promise.all(newUploads.map(async upload => {
      try {
        const result = await uploadSOPFile(upload.file!, workspaceId, sopId);
        const attachment: SOPAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          filename: result.filename,
          url: result.url,
          mimeType: result.mimeType,
          sizeBytes: result.sizeBytes,
          uploadedBy: uploaderInitials,
          uploadedAt: new Date().toISOString(),
        };
        // Functional update so we operate on the current state, not a stale closure
        setUploads(prev => {
          const next = prev.map(u =>
            u.id === upload.id
              ? { ...u, status: "uploaded" as const, attachment, file: undefined }
              : u
          );
          emitChange(next);
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        setUploads(prev => {
          const next = prev.map(u =>
            u.id === upload.id
              ? { ...u, status: "failed" as const, error: msg }
              : u
          );
          emitChange(next);
          return next;
        });
      }
    }));
  }

  function handleSelectClick() {
    fileInputRef.current?.click();
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    handleFiles(files);
    // Reset so the same file can be re-selected later
    e.target.value = "";
  }

  function handleRetry(upload: UploadState) {
    if (!upload.file) return;
    // Remove failed entry; new attempt creates a fresh entry
    const next = uploads.filter(u => u.id !== upload.id);
    setUploads(next);
    const dt = new DataTransfer();
    dt.items.add(upload.file);
    handleFiles(dt.files);
  }

  function handleCancel(uploadId: string) {
    setUploads(prev => {
      const next = prev.filter(u => u.id !== uploadId);
      emitChange(next);
      return next;
    });
  }

  // Drag-and-drop
  const [isDragging, setIsDragging] = useState(false);
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  function handleDragLeave() {
    setIsDragging(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleSelectClick}
        style={{
          padding: "16px 14px",
          background: isDragging ? "color-mix(in srgb, var(--acc) 8%, var(--s2))" : "var(--s2)",
          border: `1px dashed ${isDragging ? "var(--acc)" : "var(--b1)"}`,
          borderRadius: 6,
          cursor: "pointer",
          textAlign: "center",
          transition: "background 0.12s, border-color 0.12s",
        }}
      >
        <div style={{
          fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--t1)",
          marginBottom: 4,
        }}>
          {isDragging ? "Drop files to upload" : "Drop files or click to select"}
        </div>
        <div style={{
          fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)",
        }}>
          {ALLOWED_SOP_EXTENSIONS.join(", ")} · max {formatBytes(MAX_SOP_FILE_BYTES)}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_SOP_EXTENSIONS.join(",")}
          multiple
          onChange={handleFileInput}
          style={{ display: "none" }}
        />
      </div>

      {/* Existing attachments (in Edit mode) */}
      {existingShown.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {existingShown.map(a => (
            <div key={a.id} style={{
              padding: "8px 12px",
              background: "var(--s2)",
              border: "1px solid var(--b1)",
              borderRadius: 5,
              display: "flex", alignItems: "center", gap: 8,
              fontFamily: "'DM Mono',monospace", fontSize: 11,
              color: "var(--t2)",
            }}>
              <span style={{ color: "var(--green)" }}>●</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.filename}
              </span>
              <span style={{ color: "var(--t3)" }}>{formatBytes(a.sizeBytes)}</span>
              <span style={{ color: "var(--t3)" }}>existing</span>
            </div>
          ))}
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)", marginTop: 2 }}>
            Existing attachments can be removed from the SOP detail page.
          </div>
        </div>
      )}

      {/* New uploads */}
      {uploads.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {uploads.map(u => <UploadRow key={u.id} upload={u} onRetry={() => handleRetry(u)} onCancel={() => handleCancel(u.id)} />)}
        </div>
      )}
    </div>
  );
}

function UploadRow({ upload, onRetry, onCancel }: {
  upload: UploadState;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const isUploading = upload.status === "uploading";
  const isUploaded = upload.status === "uploaded";
  const isFailed = upload.status === "failed";

  return (
    <div style={{
      padding: "8px 12px",
      background: isFailed ? "color-mix(in srgb, var(--red) 8%, var(--s2))" : "var(--s2)",
      border: `1px solid ${isFailed ? "var(--red)" : "var(--b1)"}`,
      borderRadius: 5,
      display: "flex", alignItems: "center", gap: 8,
      fontFamily: "'DM Mono',monospace", fontSize: 11,
    }}>
      {/* Status indicator */}
      <span style={{
        color: isUploaded ? "var(--green)" : isFailed ? "var(--red)" : "var(--t3)",
        flexShrink: 0,
      }}>
        {isUploading ? "⏳" : isUploaded ? "✓" : "✕"}
      </span>

      {/* Filename + status */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: "var(--t1)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {upload.filename}
        </div>
        {isFailed && (
          <div style={{ color: "var(--red)", fontSize: 10, marginTop: 2 }}>
            {upload.error}
          </div>
        )}
      </div>

      <span style={{ color: "var(--t3)", flexShrink: 0 }}>
        {formatBytes(upload.sizeBytes)}
      </span>

      {/* Actions */}
      {isFailed && (
        <button onClick={onRetry} style={{
          padding: "3px 9px", borderRadius: 3,
          background: "transparent", border: "1px solid var(--b1)",
          color: "var(--t1)", fontFamily: "'DM Mono',monospace", fontSize: 9,
          cursor: "pointer",
        }}>
          Retry
        </button>
      )}
      {(isUploaded || isFailed) && (
        <button onClick={onCancel} title="Remove" style={{
          padding: "3px 7px", borderRadius: 3,
          background: "transparent", border: "1px solid var(--b1)",
          color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 12,
          cursor: "pointer", lineHeight: 1,
        }}>
          ×
        </button>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(2)} MB`;
}
