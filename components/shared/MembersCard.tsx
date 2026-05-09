"use client";

/**
 * MembersCard
 *
 * Settings-page card showing all current workspace members + pending
 * invitations. Owners can change roles, remove members, generate invite
 * links, and revoke pending invitations. Non-Owners see read-only.
 */

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useAuth } from "@/lib/supabase/AuthContext";
import {
  listMembers, listInvitations, createInvitation, revokeInvitation,
  changeRole, removeMember,
  type WorkspaceMember, type Invitation,
} from "@/lib/supabase/membership";
import { canChangeRoles, canInvite, canRemoveMembers, roleLabel, roleDescription } from "@/lib/supabase/permissions";
import type { WorkspaceRole } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";

export default function MembersCard() {
  const { activeWorkspaceId, currentRole, user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    const [m, i] = await Promise.all([
      listMembers(activeWorkspaceId),
      listInvitations(activeWorkspaceId),
    ]);
    setMembers(m);
    setInvites(i.filter(inv => !inv.acceptedAt && !inv.revokedAt && new Date(inv.expiresAt) > new Date()));
    setLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!activeWorkspaceId) return null;

  const canManageRoles = canChangeRoles(currentRole);
  const canSendInvites = canInvite(currentRole);
  const canRemove = canRemoveMembers(currentRole);

  return (
    <Card>
      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 12 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600 }}>Members</div>
          {canSendInvites && (
            <button
              onClick={() => setShowInvite(true)}
              style={{
                padding: "8px 14px", borderRadius: 6,
                background: "var(--acc)", color: "var(--bg)",
                border: "none", cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700,
                minHeight: 36,
              }}>
              + Invite
            </button>
          )}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 16, lineHeight: 1.55 }}>
          People with access to this workspace. {canSendInvites
            ? "Invite teammates by generating a link or share a passcode from the Passcodes section below."
            : "Contact your workspace Owner to invite new members."}
        </div>

        {loading ? (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>Loading...</div>
        ) : (
          <>
            {/* Active members */}
            <div style={{ marginBottom: invites.length > 0 ? 18 : 0 }}>
              {members.length === 0 ? (
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>No members yet.</div>
              ) : (
                members.map(m => (
                  <MemberRow
                    key={m.userId}
                    member={m}
                    isSelf={m.userId === user?.id}
                    canManageRoles={canManageRoles}
                    canRemove={canRemove}
                    onChangeRole={async (newRole) => {
                      const r = await changeRole(activeWorkspaceId, m.userId, newRole);
                      if (r.ok) { toast(`Role updated`); refresh(); }
                      else toast(`Failed: ${r.error}`, { variant: "error" });
                    }}
                    onRemove={async () => {
                      if (!confirm(`Remove ${m.email} from this workspace? They will lose access immediately.`)) return;
                      const r = await removeMember(activeWorkspaceId, m.userId);
                      if (r.ok) { toast(`Removed ${m.email}`); refresh(); }
                      else toast(`Failed: ${r.error}`, { variant: "error" });
                    }}
                  />
                ))
              )}
            </div>

            {/* Pending invites */}
            {invites.length > 0 && (
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  Pending invitations
                </div>
                {invites.map(inv => (
                  <InviteRow
                    key={inv.id}
                    invite={inv}
                    canRevoke={canSendInvites}
                    onCopyLink={() => {
                      const origin = typeof window !== "undefined" ? window.location.origin : "";
                      const url = `${origin}/invite/${inv.token}`;
                      navigator.clipboard.writeText(url);
                      toast("Invite link copied to clipboard");
                    }}
                    onRevoke={async () => {
                      if (!confirm(`Revoke invitation to ${inv.email}? The link will stop working immediately.`)) return;
                      const r = await revokeInvitation(inv.id);
                      if (r.ok) { toast(`Invitation revoked`); refresh(); }
                      else toast(`Failed: ${r.error}`, { variant: "error" });
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showInvite && (
        <InviteModal
          workspaceId={activeWorkspaceId}
          onClose={() => setShowInvite(false)}
          onCreated={() => { setShowInvite(false); refresh(); }}
        />
      )}
    </Card>
  );
}

function MemberRow({
  member, isSelf, canManageRoles, canRemove, onChangeRole, onRemove,
}: {
  member: WorkspaceMember;
  isSelf: boolean;
  canManageRoles: boolean;
  canRemove: boolean;
  onChangeRole: (r: WorkspaceRole) => void;
  onRemove: () => void;
}) {
  const [editingRole, setEditingRole] = useState(false);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 0", borderBottom: "1px solid var(--b1)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Primary line: name if we have one, else email, else placeholder.
            Secondary line: email (if name is shown) and join date. */}
        <div style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500 }}>
          {member.name ?? (member.email !== "—" ? member.email : "Unnamed member")}
          {isSelf && <span style={{ color: "var(--t3)", fontWeight: 400, marginLeft: 6 }}>(you)</span>}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
          {/* Show email on second line ONLY when name is available — else email already on top line */}
          {member.name && member.email !== "—" && <span>{member.email} · </span>}
          Joined {new Date(member.joinedAt).toLocaleDateString()}
        </div>
      </div>

      {editingRole && canManageRoles && !isSelf ? (
        <select
          autoFocus
          defaultValue={member.role}
          onBlur={() => setEditingRole(false)}
          onChange={(e) => { onChangeRole(e.target.value as WorkspaceRole); setEditingRole(false); }}
          style={{
            background: "var(--s2)", border: "1px solid var(--b2)",
            borderRadius: 5, padding: "5px 8px", color: "var(--t1)",
            fontFamily: "'DM Sans',sans-serif", fontSize: 11,
          }}>
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="crew">Crew</option>
          <option value="viewer">Viewer</option>
        </select>
      ) : (
        <button
          onClick={() => canManageRoles && !isSelf && setEditingRole(true)}
          disabled={!canManageRoles || isSelf}
          title={isSelf ? "You can't change your own role" : canManageRoles ? "Click to change role" : ""}
          style={{
            padding: "4px 10px", borderRadius: 5,
            background: "rgba(236,255,112,0.08)",
            border: "1px solid var(--acc)",
            color: "var(--acc)",
            cursor: canManageRoles && !isSelf ? "pointer" : "default",
            fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 600,
            letterSpacing: "0.05em", textTransform: "uppercase",
          }}>
          {roleLabel(member.role)}
        </button>
      )}

      {canRemove && !isSelf && (
        <button
          onClick={onRemove}
          title="Remove from workspace"
          style={{
            padding: "5px 10px", borderRadius: 5,
            background: "transparent", border: "1px solid var(--b2)",
            color: "var(--t3)", cursor: "pointer",
            fontFamily: "'DM Mono',monospace", fontSize: 10,
          }}>
          Remove
        </button>
      )}
    </div>
  );
}

function InviteRow({
  invite, canRevoke, onCopyLink, onRevoke,
}: {
  invite: Invitation;
  canRevoke: boolean;
  onCopyLink: () => void;
  onRevoke: () => void;
}) {
  const expiresIn = Math.max(0, Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", borderRadius: 6,
      background: "var(--s2)", marginBottom: 6,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "var(--t1)" }}>{invite.email}</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 1 }}>
          {roleLabel(invite.role)} · expires in {expiresIn}d
        </div>
      </div>
      <button onClick={onCopyLink} style={{
        padding: "5px 10px", borderRadius: 5,
        background: "var(--s3)", border: "1px solid var(--b1)",
        color: "var(--t1)", cursor: "pointer",
        fontFamily: "'DM Mono',monospace", fontSize: 10,
      }}>
        Copy link
      </button>
      {canRevoke && (
        <button onClick={onRevoke} style={{
          padding: "5px 10px", borderRadius: 5,
          background: "transparent", border: "1px solid var(--b1)",
          color: "var(--t3)", cursor: "pointer",
          fontFamily: "'DM Mono',monospace", fontSize: 10,
        }}>
          Revoke
        </button>
      )}
    </div>
  );
}

function InviteModal({
  workspaceId, onClose, onCreated,
}: {
  workspaceId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<WorkspaceRole, "owner">>("crew");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) { toast("Enter an email", { variant: "error" }); return; }
    setSubmitting(true);
    const result = await createInvitation({ workspaceId, email: email.trim(), role });
    setSubmitting(false);
    if (!result.ok) {
      toast(`Failed: ${result.error}`, { variant: "error" });
      return;
    }
    setGeneratedUrl(result.url);
  }

  function handleClose() {
    if (generatedUrl) onCreated();
    else onClose();
  }

  return (
    <div onClick={handleClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: 10,
        maxWidth: 480, width: "100%", padding: 24,
      }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 6, color: "var(--t1)" }}>
          {generatedUrl ? "Invitation created" : "Invite a teammate"}
        </div>

        {generatedUrl ? (
          <>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14, lineHeight: 1.55 }}>
              Send this link to <strong style={{ color: "var(--t1)" }}>{email}</strong> via email, Slack, text — whatever you use. They&apos;ll be added as <strong style={{ color: "var(--t1)" }}>{roleLabel(role)}</strong> when they accept.
            </div>
            <div style={{
              padding: 12, background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 6,
              fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t1)",
              wordBreak: "break-all", marginBottom: 14,
            }}>
              {generatedUrl}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { navigator.clipboard.writeText(generatedUrl); toast("Link copied"); }}
                style={{
                  padding: "10px 16px", borderRadius: 6,
                  background: "var(--acc)", border: "none", color: "var(--bg)",
                  cursor: "pointer", fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                }}>
                Copy link
              </button>
              <button onClick={onCreated} style={{
                padding: "10px 16px", borderRadius: 6,
                background: "transparent", border: "1px solid var(--b2)",
                color: "var(--t1)", cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif", fontSize: 13,
              }}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 16, lineHeight: 1.55 }}>
              We&apos;ll generate a one-time link you can share. Copy and send via email or chat — they&apos;ll join as the role you pick.
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                Email
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="them@theirorg.com"
                autoFocus
                style={{
                  width: "100%", padding: "10px 12px",
                  background: "var(--s2)", border: "1px solid var(--b2)",
                  borderRadius: 6, color: "var(--t1)",
                  fontFamily: "'DM Sans',sans-serif", fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                Role
              </div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Exclude<WorkspaceRole, "owner">)}
                style={{
                  width: "100%", padding: "10px 12px",
                  background: "var(--s2)", border: "1px solid var(--b2)",
                  borderRadius: 6, color: "var(--t1)",
                  fontFamily: "'DM Sans',sans-serif", fontSize: 13,
                  outline: "none",
                }}>
                <option value="manager">Manager</option>
                <option value="crew">Crew</option>
                <option value="viewer">Viewer</option>
              </select>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 6, lineHeight: 1.5 }}>
                {roleDescription(role)}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{
                padding: "10px 16px", borderRadius: 6,
                background: "transparent", border: "1px solid var(--b2)",
                color: "var(--t1)", cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif", fontSize: 13,
              }}>
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !email.trim()}
                style={{
                  padding: "10px 16px", borderRadius: 6,
                  background: submitting || !email.trim() ? "var(--s3)" : "var(--acc)",
                  border: "none",
                  color: submitting || !email.trim() ? "var(--t3)" : "var(--bg)",
                  cursor: submitting || !email.trim() ? "not-allowed" : "pointer",
                  fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                }}>
                {submitting ? "Generating..." : "Generate invite link"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
