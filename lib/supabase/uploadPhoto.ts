/**
 * uploadPhoto — uploads a Blob to Supabase Storage.
 *
 * Path scheme: `<workspaceId>/<pathPrefix>/<timestamp>-<random>.jpg`
 *   - workspaceId scopes to a tenant
 *   - pathPrefix groups by domain ("checkouts", "flags", "assets")
 *   - timestamp + random suffix ensures filename uniqueness without
 *     needing a uuid library
 *
 * Returns a public URL. The storage bucket "asset-photos" is assumed to
 * exist and have public-read policies (set up in iter-13ish for asset
 * photo upload). New paths under it inherit those policies automatically.
 *
 * Errors thrown bubble up to the caller — typically CameraCapture, which
 * surfaces them in the error overlay.
 */

import { getSupabaseClient } from "./client";

const BUCKET = "asset-photos";

export async function uploadPhoto(
  blob: Blob,
  workspaceId: string,
  pathPrefix: string,
): Promise<string> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase not configured.");

  const ts = Date.now();
  // Math.random base36 gives ~6 chars of entropy — plenty for collision avoidance
  // since we're already scoping by timestamp.
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${workspaceId}/${pathPrefix}/${ts}-${rand}.jpg`;

  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: "image/jpeg",
      cacheControl: "31536000",  // 1 year — photos never change once uploaded
      upsert: false,
    });

  if (error) {
    // Surface a clean message to the user without leaking internals.
    console.error("[uploadPhoto] failed:", error);
    throw new Error(error.message || "Upload failed.");
  }

  // getPublicUrl synchronously returns a URL based on the bucket's public
  // settings + the path. If the bucket isn't public, this URL won't load.
  const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}
