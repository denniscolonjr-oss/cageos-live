"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Magic link / email confirmation / password reset callback.
 *
 * Supabase appends auth tokens to the URL hash. The browser client picks them up
 * automatically when getSession() is called. We just need to wait for the session
 * to materialize, then route the user appropriately.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    const client = getSupabaseClient();
    const { data: { subscription } } = client.auth.onAuthStateChange(async (event: string, session: import("@supabase/supabase-js").Session | null) => {
      if (event === "SIGNED_IN" && session) {
        // Honor a pending invite token if one was stashed before signup.
        // /invite/[token] sets this when the user clicks "Sign up" from the
        // invite page so we know to send them BACK to the invite after their
        // account is confirmed.
        let pendingInvite: string | null = null;
        try { pendingInvite = localStorage.getItem("cageos:pendingInvite"); }
        catch { /* ignore */ }
        if (pendingInvite) {
          try { localStorage.removeItem("cageos:pendingInvite"); } catch { /* ignore */ }
          router.replace(`/invite/${pendingInvite}`);
          return;
        }

        // Check if user has any workspaces yet
        const { data: memberships } = await client
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", session.user.id)
          .limit(1);

        if (memberships && memberships.length > 0) {
          router.replace("/dashboard");
        } else {
          router.replace("/onboarding");
        }
      } else if (event === "PASSWORD_RECOVERY") {
        router.replace("/onboarding?reset=1");
      }
    });

    // Fallback if event doesn't fire within 5s
    const fallback = window.setTimeout(() => {
      setStatus("Still working... if this hangs, try going back to sign in.");
    }, 5000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(fallback);
    };
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: -1, color: "var(--t1)", marginBottom: 14 }}>
          Cage<span style={{ color: "var(--acc)" }}>OS</span>
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "var(--t2)" }}>
          {status}
        </div>
      </div>
    </div>
  );
}
