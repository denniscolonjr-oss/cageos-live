"use client";

/**
 * PhotoUpload — reusable photo upload component.
 *
 * Workflow:
 * 1. User picks a file from device camera or photo library
 * 2. Browser-side: compress to max 1200px / ~200KB JPEG
 * 3. Upload to Supabase Storage (bucket configured per workspace)
 * 4. Return the public URL via onUploaded callback
 *
 * Designed for assets and flags. The bucket and path strategy keeps photos
 * scoped per workspace so RLS policies on the storage bucket can enforce
 * isolation.
 */

import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { getSupabaseClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/Toast";

interface Props {
  /** Workspace ID — used as the top-level folder for organization. */
  workspaceId: string;
  /** Subpath within the workspace folder, e.g. "assets/MMG-0000023" or "flags/fl-12345". */
  pathPrefix: string;
  /** Called after successful upload with the resulting public URL. */
  onUploaded: (url: string) => void;
  /** Button label when no photo is set. */
  label?: string;
  /** Compact mode for inline use (just an icon button). */
  compact?: boolean;
  disabled?: boolean;
}

export default function PhotoUpload({
  workspaceId, pathPrefix, onUploaded, label = "+ Add photo", compact, disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast("Pick an image file (JPG, PNG, HEIC).", { variant: "error" });
      return;
    }
    setUploading(true);

    try {
      // Compress: max 1200px on long edge, target ~200KB
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: "image/jpeg",
      });

      // Upload to Supabase Storage. Path: workspaceId/pathPrefix/timestamp.jpg
      const client = getSupabaseClient();
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
      const path = `${workspaceId}/${pathPrefix}/${filename}`;

      const { error: upErr } = await client.storage
        .from("photos")
        .upload(path, compressed, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (upErr) {
        console.error("Upload failed:", upErr);
        toast("Upload failed", { variant: "error", detail: upErr.message });
        setUploading(false);
        return;
      }

      // Get public URL (the bucket itself enforces RLS for read access)
      const { data: urlData } = client.storage.from("photos").getPublicUrl(path);
      onUploaded(urlData.publicUrl);
      toast("Photo uploaded");
    } catch (err) {
      console.error("Compression or upload error:", err);
      toast("Photo failed", { variant: "error" });
    } finally {
      setUploading(false);
    }
  }

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          disabled={disabled || uploading}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          title="Add photo"
          style={{
            padding: "5px 10px", borderRadius: 5,
            background: "transparent", border: "1px solid var(--b1)",
            color: uploading ? "var(--t3)" : "var(--t1)",
            cursor: uploading ? "wait" : "pointer",
            fontFamily: "'DM Mono',monospace", fontSize: 10,
            minHeight: 32,
          }}>
          {uploading ? "Uploading..." : "📷 Photo"}
        </button>
      </>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        disabled={disabled || uploading}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        style={{
          padding: "10px 16px", borderRadius: 7,
          background: uploading ? "var(--s3)" : "transparent",
          border: "1px solid var(--b1)",
          color: uploading ? "var(--t3)" : "var(--t1)",
          cursor: uploading ? "wait" : "pointer",
          fontFamily: "'DM Sans',sans-serif", fontSize: 13,
          minHeight: 40,
        }}>
        {uploading ? "Uploading..." : label}
      </button>
    </>
  );
}
