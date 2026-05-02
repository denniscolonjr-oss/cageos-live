/**
 * Supabase browser client.
 *
 * Created once per browser session, used everywhere we need to talk to Supabase
 * from the client side (auth flows, real-time subscriptions, RLS-protected
 * data queries).
 *
 * Reads project URL and anon key from environment variables. These are public
 * (the anon key is meant to be exposed to browsers — RLS policies enforce
 * security, not key secrecy).
 */

import { createBrowserClient } from "@supabase/ssr";

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseClient() {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local (and Vercel env settings).",
    );
  }

  _client = createBrowserClient(url, key);
  return _client;
}

/** Convenience flag — true when Supabase is configured, false in pure-localStorage mode. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
