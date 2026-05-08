"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/AuthContext";
import { AuthShell } from "../login/page";

/**
 * Signup page.
 *
 * Optional "Have a join code?" toggle lets a user sign up and immediately join
 * an existing workspace as the role attached to that passcode. We stash the
 * code in localStorage during signup; AuthContext picks it up and redeems it
 * after the session is live (handles the email-confirmation-required case
 * where session activation is delayed until the user clicks the verify link).
 *
 * Honors `?next=<path>` so the invite-link flow can hand control back to
 * `/invite/[token]` after the new account is created. Wrapped in Suspense
 * because Next 15 requires it for any page reading useSearchParams.
 */
export default function SignupPage() {
  return (
    <Suspense fallback={<AuthShell title="Loading..."><div /></AuthShell>}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, supabaseEnabled, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // If `next` is set (e.g. /invite/<token>), bounce there once authenticated.
  // Otherwise default to /onboarding for fresh accounts.
  const next = searchParams.get("next");

  useEffect(() => {
    if (!authLoading && session) {
      router.replace(next ?? "/onboarding");
    }
  }, [authLoading, session, router, next]);

  async function handleSignup() {
    if (!email || !password) {
      setError("Email and password required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const client = getSupabaseClient();

    // Stash the passcode for AuthContext to pick up after session activates.
    if (showPasscode && passcode.trim()) {
      try {
        localStorage.setItem("cageos:pendingPasscode", passcode.trim().toUpperCase());
      } catch {
        // localStorage might be blocked; passcode entry on next signin still works
      }
    }

    const { data, error: err } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSubmitting(false);

    if (err) {
      setError(err.message);
      return;
    }

    if (data.user && !data.session) {
      setInfo(`Check ${email} for a confirmation link to finish creating your account.${showPasscode && passcode.trim() ? " Your join code will be applied automatically when you sign in." : ""}`);
      return;
    }

    // Otherwise, session is live — useEffect above will redirect to onboarding.
  }

  if (!supabaseEnabled) {
    return (
      <AuthShell title="Authentication unavailable">
        <p style={{ color: "var(--t2)", fontSize: 13, lineHeight: 1.6 }}>
          Supabase is not configured for this deployment.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="email"
          autoFocus
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@studio.com"
          style={{
            width: "100%", background: "var(--s2)", border: "1px solid var(--b1)",
            borderRadius: 7, padding: "11px 12px",
            color: "var(--t1)", outline: "none",
            fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
            colorScheme: "dark",
          }}
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSignup(); }}
          placeholder="Password (min 8 chars)"
          style={{
            width: "100%", background: "var(--s2)", border: "1px solid var(--b1)",
            borderRadius: 7, padding: "11px 12px",
            color: "var(--t1)", outline: "none",
            fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
            colorScheme: "dark",
          }}
        />

        {!showPasscode ? (
          <button
            onClick={() => setShowPasscode(true)}
            style={{
              background: "transparent", border: "none",
              color: "var(--t2)", textDecoration: "underline",
              fontFamily: "'DM Mono',monospace", fontSize: 11,
              cursor: "pointer", padding: "4px 0",
              textAlign: "left",
            }}>
            Have a join code? Enter it →
          </button>
        ) : (
          <div>
            <input
              value={passcode}
              onChange={e => setPasscode(e.target.value.toUpperCase())}
              placeholder="Join code (e.g. ABC234)"
              maxLength={12}
              style={{
                width: "100%", background: "var(--s2)", border: "1px solid var(--acc)",
                borderRadius: 7, padding: "11px 12px",
                color: "var(--t1)", outline: "none",
                fontFamily: "'DM Mono',monospace", fontSize: 14, minHeight: 44,
                letterSpacing: "0.1em",
                colorScheme: "dark",
              }}
            />
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 4, lineHeight: 1.5 }}>
              Joining a workspace? Paste the code your admin shared. We&apos;ll add you at the right role automatically.
            </div>
          </div>
        )}

        {error && (
          <div style={{
            background: "rgba(255,122,122,0.08)", border: "1px solid rgba(255,122,122,0.25)",
            borderRadius: 6, padding: "9px 12px", fontSize: 12, color: "var(--red)",
            fontFamily: "'DM Mono',monospace", lineHeight: 1.5,
          }}>{error}</div>
        )}
        {info && (
          <div style={{
            background: "rgba(109,238,159,0.06)", border: "1px solid rgba(109,238,159,0.2)",
            borderRadius: 6, padding: "9px 12px", fontSize: 12, color: "var(--green)",
            fontFamily: "'DM Mono',monospace", lineHeight: 1.5,
          }}>{info}</div>
        )}

        <button onClick={handleSignup} disabled={submitting} style={{
          width: "100%", padding: "12px 16px", borderRadius: 7,
          background: submitting ? "var(--s3)" : "var(--acc)",
          border: "none",
          color: submitting ? "var(--t3)" : "var(--bg)",
          cursor: submitting ? "not-allowed" : "pointer",
          fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, minHeight: 44,
          marginTop: 4,
        }}>
          {submitting ? "Creating..." : "Create account"}
        </button>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--b1)", fontSize: 12, color: "var(--t2)", textAlign: "center" }}>
          Already have an account? <Link href="/login" style={{ color: "var(--acc)", marginLeft: 4 }}>Sign in</Link>
        </div>
      </div>
    </AuthShell>
  );
}
