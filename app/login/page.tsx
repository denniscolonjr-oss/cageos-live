"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/AuthContext";

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell title="Loading..."><div /></AuthShell>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, supabaseEnabled, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicMode, setMagicMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // If already logged in, bounce to dashboard (or wherever they came from)
  useEffect(() => {
    if (!authLoading && session) {
      const next = searchParams.get("next") ?? "/dashboard";
      router.replace(next);
    }
  }, [authLoading, session, router, searchParams]);

  async function handlePasswordLogin() {
    if (!email || !password) {
      setError("Email and password required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const client = getSupabaseClient();
    const { error: err } = await client.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    // Auth state listener in AuthContext will trigger the redirect via the effect above.
  }

  async function handleMagicLink() {
    if (!email) {
      setError("Email required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setInfo(null);
    const client = getSupabaseClient();
    const { error: err } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInfo(`Magic link sent. Check ${email} for a sign-in link.`);
  }

  if (!supabaseEnabled) {
    return (
      <AuthShell title="Authentication unavailable">
        <p style={{ color: "var(--t2)", fontSize: 13, lineHeight: 1.6 }}>
          Supabase is not configured for this deployment. Set the environment
          variables on Vercel and redeploy.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome back">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="email"
          autoFocus
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@studio.com"
          style={inputStyle}
        />
        {!magicMode && (
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handlePasswordLogin(); }}
            placeholder="Password"
            style={inputStyle}
          />
        )}

        {error && (
          <div style={errorStyle}>{error}</div>
        )}
        {info && (
          <div style={infoStyle}>{info}</div>
        )}

        {!magicMode ? (
          <button onClick={handlePasswordLogin} disabled={submitting} style={primaryButton(submitting)}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        ) : (
          <button onClick={handleMagicLink} disabled={submitting} style={primaryButton(submitting)}>
            {submitting ? "Sending..." : "Send magic link"}
          </button>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
          <button
            onClick={() => { setMagicMode(!magicMode); setError(null); setInfo(null); }}
            style={linkButton}
          >
            {magicMode ? "← Use password" : "Email me a magic link"}
          </button>
          <Link href="/forgot-password" style={linkText}>Forgot password?</Link>
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--b1)", fontSize: 12, color: "var(--t2)", textAlign: "center" }}>
          New to CageOS? <Link href="/signup" style={{ ...linkText, marginLeft: 4 }}>Create an account</Link>
        </div>
      </div>
    </AuthShell>
  );
}

// Shared shell + styles ----------------------------------------------------

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 20 }}>
      <Link href="/" style={{ textDecoration: "none", marginBottom: 18 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: -1, color: "var(--t1)" }}>
          Cage<span style={{ color: "var(--acc)" }}>OS</span>
        </div>
      </Link>
      <div style={{ width: "100%", maxWidth: 380, background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: 12, padding: "26px 24px" }}>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 18, color: "var(--t1)" }}>
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--s2)", border: "1px solid var(--b1)",
  borderRadius: 7, padding: "11px 12px",
  color: "var(--t1)", outline: "none",
  fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
  colorScheme: "dark",
};

const linkButton: React.CSSProperties = {
  background: "none", border: "none", color: "var(--t2)",
  fontSize: 12, cursor: "pointer", padding: 0,
  fontFamily: "'DM Sans',sans-serif", textAlign: "left",
};

const linkText: React.CSSProperties = {
  color: "var(--acc)", textDecoration: "none", fontSize: 12,
  fontFamily: "'DM Sans',sans-serif",
};

const errorStyle: React.CSSProperties = {
  background: "rgba(255,79,79,0.08)", border: "1px solid rgba(255,79,79,0.25)",
  borderRadius: 6, padding: "9px 12px", fontSize: 12, color: "var(--red)",
  fontFamily: "'DM Mono',monospace", lineHeight: 1.5,
};

const infoStyle: React.CSSProperties = {
  background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)",
  borderRadius: 6, padding: "9px 12px", fontSize: 12, color: "var(--green)",
  fontFamily: "'DM Mono',monospace", lineHeight: 1.5,
};

function primaryButton(disabled: boolean): React.CSSProperties {
  return {
    width: "100%", padding: "12px 16px", borderRadius: 7,
    background: disabled ? "var(--s3)" : "var(--acc)",
    border: "none",
    color: disabled ? "var(--t3)" : "var(--bg)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, minHeight: 44,
    marginTop: 4,
  };
}
