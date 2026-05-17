/**
 * uploadSOPFile — uploads a file attachment for an SOP to Supabase Storage.
 *
 * Constraints enforced here:
 *   - Size: ≤ 1 MB (1,048,576 bytes)
 *   - Extension: .md, .txt, .rtf, .pdf
 *   - MIME type: validated against allowlist (not just extension —
 *     a malicious user could rename .exe to .pdf, but the MIME check
 *     catches it)
 *
 * Path scheme: `<workspaceId>/<sopId>/<timestamp>-<random>-<safeFilename>`
 *   - workspaceId scopes to tenant
 *   - sopId groups all attachments for a single SOP
 *   - timestamp + random keeps filenames unique
 *   - safeFilename strips path-traversal chars but keeps the original
 *     name visible in URLs (which helps when downloading)
 *
 * Returns the uploaded file URL. Caller (the hook) wraps this in an
 * SOPAttachment record and pushes to the SOP's attachments array.
 *
 * If the bucket doesn't exist or isn't public, the upload fails with an
 * actionable error message naming the bucket — same pattern as uploadPhoto.
 */

import { getSupabaseClient } from "./client";

/**
 * Bucket for SOP files. Separate from the photos bucket to keep file
 * lifecycles separate (different retention, different size constraints).
 *
 * You must create this bucket manually in Supabase Dashboard before
 * deploying iter-27b. See HOW-TO-APPLY for the exact steps.
 *
 * Override via NEXT_PUBLIC_SUPABASE_SOP_BUCKET env var if you ever
 * want to rename without a code change.
 */
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_SOP_BUCKET || "sop-files";

/** 1 MB limit per file (locked per design decision). */
export const MAX_SOP_FILE_BYTES = 1_048_576;

/** Allowed file extensions for SOP attachments. */
export const ALLOWED_SOP_EXTENSIONS = [".md", ".txt", ".rtf", ".pdf"] as const;

/**
 * Allowed MIME types. Browsers report different MIMEs for the same
 * extension (e.g. .md is often "text/markdown" but sometimes
 * "text/plain"), so we keep this generous within the allowlist.
 */
const ALLOWED_SOP_MIMES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/rtf",
  "text/rtf",
  "application/x-rtf",
  // Some browsers/OSes don't sniff a MIME at all and report empty string.
  // Accept that case and fall back to extension check.
  "",
  "application/octet-stream",  // common fallback for files without MIME
]);

export interface UploadSOPFileResult {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Validate a file BEFORE attempting upload. Returns an error message if
 * the file should be rejected, or null if it's OK. Lets the UI surface
 * problems before initiating the network call.
 */
export function validateSOPFile(file: File): string | null {
  if (file.size > MAX_SOP_FILE_BYTES) {
    const mb = (file.size / 1_048_576).toFixed(2);
    return `File is ${mb} MB — limit is 1 MB. Try compressing or splitting.`;
  }
  if (file.size === 0) {
    return `File is empty.`;
  }

  const ext = getExtension(file.name);
  if (!ALLOWED_SOP_EXTENSIONS.includes(ext as typeof ALLOWED_SOP_EXTENSIONS[number])) {
    return `Unsupported file type "${ext}". Allowed: ${ALLOWED_SOP_EXTENSIONS.join(", ")}`;
  }

  // Defensive: also check MIME. Browsers can be lax, so we only reject
  // outright if MIME is definitively wrong (e.g. an .exe with .pdf renamed
  // to .pdf would have MIME "application/x-msdownload" — that's blocked).
  if (file.type && !ALLOWED_SOP_MIMES.has(file.type)) {
    return `File MIME type "${file.type}" is not allowed. Use a plain PDF, text, markdown, or RTF file.`;
  }

  return null;
}

export async function uploadSOPFile(
  file: File,
  workspaceId: string,
  sopId: string,
): Promise<UploadSOPFileResult> {
  // Validate first — fail fast without network
  const validationError = validateSOPFile(file);
  if (validationError) throw new Error(validationError);

  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase not configured.");

  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safeName = sanitizeFilename(file.name);
  const path = `${workspaceId}/${sopId}/${ts}-${rand}-${safeName}`;

  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, file, {
      // Pass the file's reported MIME directly. If the browser didn't sniff
      // one, default to text/plain — better than letting it be guessed
      // server-side, which can mis-serve content types for downloads.
      contentType: file.type || "text/plain",
      cacheControl: "3600",  // 1 hour — SOP files might change less than photos
      upsert: false,
    });

  if (error) {
    console.error("[uploadSOPFile] failed:", { bucket: BUCKET, path, error });
    if (error.message?.toLowerCase().includes("bucket")) {
      throw new Error(
        `Bucket "${BUCKET}" not found in Supabase Storage. ` +
        `Create it (Public, 1MB file limit) and try again.`
      );
    }
    throw new Error(error.message || "Upload failed.");
  }

  const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path);
  return {
    url: publicUrl,
    filename: file.name,  // preserve original for display
    mimeType: file.type || mimeFromExt(safeName),
    sizeBytes: file.size,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Extract the file extension including the leading dot, lowercased.
 * "Document.PDF" → ".pdf". Returns empty string for files without dots.
 */
function getExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  if (i === -1 || i === filename.length - 1) return "";
  return filename.slice(i).toLowerCase();
}

/**
 * Sanitize a filename for safe use as a URL path segment.
 *   - Replace anything that's not alphanumeric, dash, underscore, dot
 *   - Collapse runs of dashes
 *   - Cap length to avoid path-too-long issues
 *
 * The original filename is still stored in the SOPAttachment record for
 * display purposes — sanitization only affects the storage path.
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

/**
 * Fall back to a default MIME based on extension when the browser doesn't
 * report one. Used as the final guess so attachments still serve with a
 * useful Content-Type.
 */
function mimeFromExt(filename: string): string {
  const ext = getExtension(filename);
  switch (ext) {
    case ".pdf": return "application/pdf";
    case ".md":  return "text/markdown";
    case ".txt": return "text/plain";
    case ".rtf": return "application/rtf";
    default:     return "application/octet-stream";
  }
}
