"use client";
import { useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/AuthContext";
import { AuthShell } from "../login/page";

export default function ForgotPasswordPage() {
  const { supabaseEnabled } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleReset() {
    if (!email) {
      setError("Email required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setInfo(null);
    const client = getSupabaseClient();
    const { error: err } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?action=recovery`,
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInfo(`If an account exists for ${email}, a reset link has been sent.`);
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
    <AuthShell title="Reset your password">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>
          Enter the email associated with your account. We&apos;ll send you a link to reset your password.
        </p>
        <input
          type="email"
          autoFocus
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleReset(); }}
          placeholder="you@studio.com"
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

        <button onClick={handleReset} disabled={submitting} style={{
          width: "100%", padding: "12px 16px", borderRadius: 7,
          background: submitting ? "var(--s3)" : "var(--acc)",
          border: "none",
          color: submitting ? "var(--t3)" : "var(--bg)",
          cursor: submitting ? "not-allowed" : "pointer",
          fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, minHeight: 44,
          marginTop: 4,
        }}>
          {submitting ? "Sending..." : "Send reset link"}
        </button>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--b1)", fontSize: 12, color: "var(--t2)", textAlign: "center" }}>
          Remembered it? <Link href="/login" style={{ color: "var(--acc)", marginLeft: 4 }}>Back to sign in</Link>
        </div>
      </div>
    </AuthShell>
  );
}
