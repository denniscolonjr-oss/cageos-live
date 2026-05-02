"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/AuthContext";
import { AuthShell } from "../login/page";

export default function SignupPage() {
  const router = useRouter();
  const { session, supabaseEnabled, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && session) {
      router.replace("/onboarding");
    }
  }, [authLoading, session, router]);

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

    // If email confirmation is required (default), Supabase sends an email and
    // the user needs to click the link before the session activates.
    if (data.user && !data.session) {
      setInfo(`Check ${email} for a confirmation link to finish creating your account.`);
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

        {error && (
          <div style={{
            background: "rgba(255,79,79,0.08)", border: "1px solid rgba(255,79,79,0.25)",
            borderRadius: 6, padding: "9px 12px", fontSize: 12, color: "var(--red)",
            fontFamily: "'DM Mono',monospace", lineHeight: 1.5,
          }}>{error}</div>
        )}
        {info && (
          <div style={{
            background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)",
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
