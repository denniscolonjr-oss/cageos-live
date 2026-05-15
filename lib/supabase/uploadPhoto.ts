/**
 * uploadPhoto — uploads a Blob to Supabase Storage.
 *
 * Path scheme: `<workspaceId>/<pathPrefix>/<timestamp>-<random>.jpg`
 *   - workspaceId scopes to a tenant
 *   - pathPrefix groups by domain ("checkouts", "flags", "assets")
 *   - timestamp + random suffix ensures filename uniqueness without
 *     needing a uuid library
 *
 * Returns a public URL. The bucket name resolves from
 *   process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET
 * if set, otherwise defaults to "asset-photos". This lets you override
 * the bucket without code changes by setting the env var in Vercel.
 *
 * If the bucket doesn't exist or isn't public, the upload will fail with
 * a "Bucket not found" or "row violates" RLS error. The error surfaced
 * to the user explicitly names the bucket it tried so you can verify
 * the configuration in Supabase Dashboard → Storage.
 */

import { getSupabaseClient } from "./client";

/**
 * Bucket name resolution. Reads from NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET
 * env var (settable in Vercel without code change) and falls back to
 * "photos" — the actual bucket name in our Supabase project.
 *
 * If you ever rename the Supabase bucket, either update this default or
 * set the env var to override without code changes.
 */
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "photos";

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
    // Surface a helpful message that names the bucket being attempted —
    // makes "Bucket not found" actionable without digging through logs.
    console.error("[uploadPhoto] failed:", { bucket: BUCKET, path, error });
    if (error.message?.toLowerCase().includes("bucket")) {
      throw new Error(
        `Bucket "${BUCKET}" not found in Supabase Storage. ` +
        `Create it and mark it Public, or set ` +
        `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET in Vercel env vars.`
      );
    }
    throw new Error(error.message || "Upload failed.");
  }

  // getPublicUrl synchronously returns a URL based on the bucket's public
  // settings + the path. If the bucket isn't public, this URL won't load.
  const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path);
  return publicUrl;
}

