"use client";

/**
 * /invite/[token]
 *
 * Lands here when someone clicks an invitation link. Three states:
 * - Not signed in → prompt to sign in or sign up first (preserving the token)
 * - Signed in but invitation invalid → friendly error
 * - Signed in + valid → call redeem_invitation RPC, redirect to dashboard
 */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import { useAuth } from "@/lib/supabase/AuthContext";
import { redeemInvitation } from "@/lib/supabase/membership";

type Status =
  | { kind: "loading" }
  | { kind: "needs_signin" }
  | { kind: "redeeming" }
  | { kind: "success"; workspaceId: string; role: string }
  | { kind: "error"; reason: string };

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { session, loading: authLoading, refreshWorkspaces, setActiveWorkspaceId } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setStatus({ kind: "needs_signin" });
      return;
    }
    let cancelled = false;
    (async () => {
      setStatus({ kind: "redeeming" });
      const result = await redeemInvitation(token);
      if (cancelled) return;
      if (!result.ok) {
        setStatus({ kind: "error", reason: result.error });
        return;
      }
      setStatus({ kind: "success", workspaceId: result.workspaceId, role: result.role });
      // Refresh workspace memberships and switch to the new workspace
      await refreshWorkspaces();
      setActiveWorkspaceId(result.workspaceId);
      // Brief pause so user sees "success" before redirect
      setTimeout(() => router.push("/dashboard"), 1200);
    })();
    return () => { cancelled = true; };
  }, [authLoading, session, token, router, refreshWorkspaces, setActiveWorkspaceId]);

  // Build sign-in URL that preserves return path back to this invite.
  // We also stash the token in localStorage as a backup, because Supabase's
  // email-confirmation flow strips query params on the redirect callback —
  // the auth callback page reads the stashed token to send the user back here.
  const signInRedirect = `/login?next=${encodeURIComponent(`/invite/${token}`)}`;
  const signUpRedirect = `/signup?next=${encodeURIComponent(`/invite/${token}`)}`;

  function stashTokenForCallback() {
    try { localStorage.setItem("cageos:pendingInvite", token); } catch { /* ignore */ }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TopNav />
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 24, gap: 16,
      }}>
        {(status.kind === "loading" || status.kind === "redeeming") && (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "var(--t2)" }}>
            {status.kind === "loading" ? "Loading..." : "Joining workspace..."}
          </div>
        )}

        {status.kind === "needs_signin" && (
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 800, color: "var(--t1)", marginBottom: 10 }}>
              You&apos;re invited to a CageOS workspace
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 22 }}>
              Sign in to your CageOS account to accept this invitation, or create one if this is your first time.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <Link href={signInRedirect} onClick={stashTokenForCallback} style={{
                padding: "11px 22px", borderRadius: 7,
                background: "var(--acc)", color: "var(--bg)",
                fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                textDecoration: "none",
              }}>
                Sign in
              </Link>
              <Link href={signUpRedirect} onClick={stashTokenForCallback} style={{
                padding: "11px 22px", borderRadius: 7,
                background: "transparent", color: "var(--t1)",
                border: "1px solid var(--b2)",
                fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600,
                textDecoration: "none",
              }}>
                Create account
              </Link>
            </div>
          </div>
        )}

        {status.kind === "success" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: "var(--acc)", marginBottom: 6 }}>
              Welcome aboard!
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "var(--t2)" }}>
              Joined as {status.role}. Loading dashboard...
            </div>
          </div>
        )}

        {status.kind === "error" && (
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: "var(--t1)", marginBottom: 10 }}>
              {status.reason === "expired" && "This invitation has expired"}
              {status.reason === "already_accepted" && "This invitation has already been used"}
              {status.reason === "revoked" && "This invitation was revoked"}
              {status.reason === "email_mismatch" && "Wrong account"}
              {status.reason === "invalid_token" && "Invitation not found"}
              {!["expired", "already_accepted", "revoked", "email_mismatch", "invalid_token"].includes(status.reason) && "Couldn't accept invitation"}
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 22 }}>
              {status.reason === "expired" && "Ask your workspace admin to send a new one."}
              {status.reason === "already_accepted" && "If you didn't accept this, ask your admin to send a fresh invitation."}
              {status.reason === "revoked" && "The workspace admin canceled this invitation. Ask them to send a new one if you should still join."}
              {status.reason === "email_mismatch" && "This invitation was sent to a different email than the one you signed in with. Sign out and try again with the correct address."}
              {status.reason === "invalid_token" && "This link is malformed or doesn't match any active invitation."}
              {!["expired", "already_accepted", "revoked", "email_mismatch", "invalid_token"].includes(status.reason) && status.reason}
            </div>
            <Link href="/dashboard" style={{
              padding: "11px 22px", borderRadius: 7,
              background: "var(--acc)", color: "var(--bg)",
              fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
              textDecoration: "none",
            }}>
              Go to dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
