"use client";

/**
 * PasscodesCard
 *
 * Settings-page card for managing per-role join passcodes. Owner-only;
 * non-Owners don't even see this card rendered (gated by canManagePasscodes).
 *
 * One active passcode per (workspace, role) at a time. Generating a new code
 * for a role automatically deactivates the prior one — old codes stop working
 * immediately.
 */

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import { useAuth } from "@/lib/supabase/AuthContext";
import {
  listPasscodes, generateNewPasscode, disablePasscode,
  type WorkspacePasscode,
} from "@/lib/supabase/membership";
import { canManagePasscodes, roleLabel } from "@/lib/supabase/permissions";
import type { WorkspaceRole } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";

const ROLES: Exclude<WorkspaceRole, "owner">[] = ["manager", "crew", "viewer"];

export default function PasscodesCard() {
  const { activeWorkspaceId, currentRole } = useAuth();
  const [passcodes, setPasscodes] = useState<WorkspacePasscode[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    const codes = await listPasscodes(activeWorkspaceId);
    setPasscodes(codes);
    setLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!activeWorkspaceId || !canManagePasscodes(currentRole)) return null;

  const activeByRole = new Map<string, WorkspacePasscode>();
  passcodes.filter(p => p.active).forEach(p => activeByRole.set(p.role, p));

  return (
    <Card>
      <div style={{ padding: 20 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Join codes
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 16, lineHeight: 1.55 }}>
          Shareable codes new users can enter at signup to join this workspace at the assigned role.
          Useful for onboarding lots of people at once (volunteers, contractors). Rotate any code to revoke it instantly.
          Owner-only.
        </div>

        {loading ? (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>Loading...</div>
        ) : (
          <div>
            {ROLES.map(role => {
              const active = activeByRole.get(role);
              return (
                <PasscodeRow
                  key={role}
                  role={role}
                  passcode={active}
                  onGenerate={async () => {
                    const r = await generateNewPasscode({ workspaceId: activeWorkspaceId, role });
                    if (r.ok) {
                      toast(`New ${roleLabel(role)} passcode: ${r.passcode.code}`);
                      refresh();
                    } else toast(`Failed: ${r.error}`, { variant: "error" });
                  }}
                  onDisable={async () => {
                    if (!active) return;
                    if (!confirm(`Disable the ${roleLabel(role)} passcode? Anyone trying to use it will be rejected.`)) return;
                    const r = await disablePasscode(active.id);
                    if (r.ok) { toast("Passcode disabled"); refresh(); }
                    else toast(`Failed: ${r.error}`, { variant: "error" });
                  }}
                  onCopy={() => {
                    if (!active) return;
                    navigator.clipboard.writeText(active.code);
                    toast("Code copied");
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

function PasscodeRow({
  role, passcode, onGenerate, onDisable, onCopy,
}: {
  role: Exclude<WorkspaceRole, "owner">;
  passcode: WorkspacePasscode | undefined;
  onGenerate: () => void;
  onDisable: () => void;
  onCopy: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 0", borderBottom: "1px solid var(--b1)",
    }}>
      <div style={{ flex: "0 0 90px" }}>
        <div style={{ fontSize: 13, color: "var(--t1)", fontWeight: 600 }}>{roleLabel(role)}</div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {passcode ? (
          <>
            <button
              onClick={onCopy}
              title="Click to copy"
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: 16, fontWeight: 700,
                color: "var(--acc)", letterSpacing: "0.1em",
                background: "transparent", border: "none",
                cursor: "pointer", padding: 0,
              }}>
              {passcode.code}
            </button>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
              Used {passcode.useCount} time{passcode.useCount === 1 ? "" : "s"}
              {passcode.expiresAt ? ` · expires ${new Date(passcode.expiresAt).toLocaleDateString()}` : ""}
            </div>
          </>
        ) : (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
            No active code
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {passcode && (
          <button onClick={onDisable} style={{
            padding: "5px 10px", borderRadius: 5,
            background: "transparent", border: "1px solid var(--b2)",
            color: "var(--t3)", cursor: "pointer",
            fontFamily: "'DM Mono',monospace", fontSize: 10,
          }}>
            Disable
          </button>
        )}
        <button onClick={onGenerate} style={{
          padding: "5px 10px", borderRadius: 5,
          background: passcode ? "var(--s3)" : "var(--acc)",
          color: passcode ? "var(--t1)" : "var(--bg)",
          border: passcode ? "1px solid var(--b1)" : "none",
          cursor: "pointer",
          fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 600,
        }}>
          {passcode ? "Rotate" : "Generate"}
        </button>
      </div>
    </div>
  );
}
