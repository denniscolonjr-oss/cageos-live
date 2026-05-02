"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/AuthContext";
import { AuthShell } from "../login/page";

export default function OnboardingPage() {
  const router = useRouter();
  const { session, loading: authLoading, refreshWorkspaces, setActiveWorkspaceId } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [orgLocation, setOrgLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If not logged in, send to login
  useEffect(() => {
    if (!authLoading && !session) {
      router.replace("/login");
    }
  }, [authLoading, session, router]);

  async function handleCreate() {
    if (!orgName.trim()) {
      setError("Workspace name is required.");
      return;
    }
    if (!session) return;

    setSubmitting(true);
    setError(null);
    const client = getSupabaseClient();

    // Step 1: create the workspace
    const { data: workspace, error: wsErr } = await client
      .from("workspaces")
      .insert({
        name: orgName.trim(),
        owner_id: session.user.id,
        data: {
          assets: [], kits: [], checkouts: [], alerts: [], profiles: [], shoots: [],
          events: [], flags: [],
          orgName: orgName.trim(),
          orgLocation: orgLocation.trim() || "—",
          barcodePrefix: "AST",
          filterableFields: ["category", "location"],
          timezone: "auto",
          managerMode: false,
        },
      })
      .select("id")
      .single();

    if (wsErr || !workspace) {
      setSubmitting(false);
      setError(wsErr?.message ?? "Failed to create workspace.");
      return;
    }

    // Step 2: add the user as owner member
    const { error: memErr } = await client
      .from("workspace_members")
      .insert({
        workspace_id: workspace.id,
        user_id: session.user.id,
        role: "owner",
      });

    if (memErr) {
      setSubmitting(false);
      setError(memErr.message);
      return;
    }

    // Activate this workspace and refresh memberships
    setActiveWorkspaceId(workspace.id);
    await refreshWorkspaces();
    router.replace("/dashboard");
  }

  if (authLoading) {
    return (
      <AuthShell title="Loading...">
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "var(--t3)", textAlign: "center" }}>
          Checking your session...
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your workspace">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>
          A workspace is your shop&apos;s private CageOS. You&apos;ll be the owner.
          You can invite team members later.
        </p>

        <div>
          <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5, display: "block" }}>
            Workspace name
          </label>
          <input
            autoFocus
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
            placeholder="MMG Production"
            style={{
              width: "100%", background: "var(--s2)", border: "1px solid var(--b1)",
              borderRadius: 7, padding: "11px 12px",
              color: "var(--t1)", outline: "none",
              fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
              colorScheme: "dark",
            }}
          />
        </div>

        <div>
          <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5, display: "block" }}>
            Location <span style={{ textTransform: "none", color: "var(--t3)" }}>(optional)</span>
          </label>
          <input
            value={orgLocation}
            onChange={e => setOrgLocation(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
            placeholder="Washington, DC"
            style={{
              width: "100%", background: "var(--s2)", border: "1px solid var(--b1)",
              borderRadius: 7, padding: "11px 12px",
              color: "var(--t1)", outline: "none",
              fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
              colorScheme: "dark",
            }}
          />
        </div>

        {error && (
          <div style={{
            background: "rgba(255,79,79,0.08)", border: "1px solid rgba(255,79,79,0.25)",
            borderRadius: 6, padding: "9px 12px", fontSize: 12, color: "var(--red)",
            fontFamily: "'DM Mono',monospace", lineHeight: 1.5,
          }}>{error}</div>
        )}

        <button onClick={handleCreate} disabled={submitting} style={{
          width: "100%", padding: "12px 16px", borderRadius: 7,
          background: submitting ? "var(--s3)" : "var(--acc)",
          border: "none",
          color: submitting ? "var(--t3)" : "var(--bg)",
          cursor: submitting ? "not-allowed" : "pointer",
          fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, minHeight: 44,
          marginTop: 4,
        }}>
          {submitting ? "Creating..." : "Create workspace →"}
        </button>
      </div>
    </AuthShell>
  );
}
