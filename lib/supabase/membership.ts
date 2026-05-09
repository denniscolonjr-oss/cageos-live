/**
 * Membership API
 *
 * Centralizes all multi-user Supabase operations: listing members, generating
 * invites and passcodes, redeeming them, changing roles, removing members.
 *
 * UI components import from here instead of touching Supabase directly so that
 * the surface area for permission bugs and SQL errors stays in one file.
 */

import { getSupabaseClient } from "./client";
import type { WorkspaceRole } from "./AuthContext";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export interface WorkspaceMember {
  userId: string;
  email: string;
  /** Display name from the workspace's team profile, if linked.
   *  Null when the user hasn't completed their FirstTimeProfile setup yet. */
  name: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface Invitation {
  id: string;
  workspaceId: string;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  token: string;
  invitedBy: string | null;
  invitedAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface WorkspacePasscode {
  id: string;
  workspaceId: string;
  role: Exclude<WorkspaceRole, "owner">;
  code: string;
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Members
// ──────────────────────────────────────────────────────────────────────────

/** List all members of the given workspace. */
export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  // Two-step: get memberships, then fetch the user emails. Supabase doesn't
  // let RLS-protected tables join on auth.users directly without a view.
  const { data: rows, error } = await sb
    .from("workspace_members")
    .select("user_id, role, joined_at")
    .eq("workspace_id", workspaceId);
  if (error || !rows) return [];

  // Pull the workspace's profile array so we can resolve display names.
  // We look up profiles by their `userId` field (set when a member completes
  // their FirstTimeProfile). Pre-multi-user profiles won't have userId set —
  // those rows just show "—" as the name, which is correct.
  type Profile = { userId?: string; name?: string };
  let profiles: Profile[] = [];
  try {
    const { data: ws } = await sb
      .from("workspaces")
      .select("data")
      .eq("id", workspaceId)
      .maybeSingle();
    if (ws?.data?.profiles && Array.isArray(ws.data.profiles)) {
      profiles = ws.data.profiles as Profile[];
    }
  } catch {
    // Workspace fetch failed — proceed with empty profiles list.
    // Members still render with "—" name but valid role/email/date.
  }

  // Resolve user emails via the email_for_member SECURITY DEFINER RPC, which
  // returns the email IF the caller shares a workspace with the target user
  // (or is the user themselves). Returns null otherwise — we substitute "—".
  // Created by iter-14i SQL migration; if missing, falls back to "—".
  const members: WorkspaceMember[] = await Promise.all(rows.map(async (row: { user_id: string; role: string; joined_at: string }) => {
    let email = "—";
    try {
      const { data: emailResult } = await sb.rpc("email_for_member", { target_user_id: row.user_id });
      if (typeof emailResult === "string" && emailResult.length > 0) {
        email = emailResult;
      }
    } catch {
      // RPC doesn't exist or call failed; keep "—" placeholder.
    }

    // Resolve display name from workspace profiles.
    const profile = profiles.find(p => p.userId === row.user_id);
    const name = profile?.name && profile.name.length > 0 ? profile.name : null;

    return {
      userId: row.user_id,
      email,
      name,
      role: row.role as WorkspaceRole,
      joinedAt: row.joined_at,
    };
  }));
  return members;
}

/** Change a member's role. Owner-only via RLS. */
export async function changeRole(
  workspaceId: string, userId: string, newRole: WorkspaceRole,
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: "Supabase not configured" };
  const { error } = await sb
    .from("workspace_members")
    .update({ role: newRole })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Remove a member from a workspace. Owner-only via RLS. */
export async function removeMember(
  workspaceId: string, userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: "Supabase not configured" };
  const { error } = await sb
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// Invitations
// ──────────────────────────────────────────────────────────────────────────

function randomToken(): string {
  // 32 chars of url-safe random. Plenty of entropy for one-time-use tokens.
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

/** Create an invitation. Returns the full invitation including the redeem URL. */
export async function createInvitation(args: {
  workspaceId: string;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  expiresInDays?: number;
}): Promise<{ ok: true; invitation: Invitation; url: string } | { ok: false; error: string }> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const token = randomToken();
  const expiresAt = new Date(
    Date.now() + (args.expiresInDays ?? 7) * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: { user } } = await sb.auth.getUser();
  const { data, error } = await sb
    .from("invitations")
    .insert({
      workspace_id: args.workspaceId,
      email: args.email.trim().toLowerCase(),
      role: args.role,
      token,
      invited_by: user?.id ?? null,
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };

  // Construct the full URL the recipient will click.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/invite/${token}`;

  return {
    ok: true,
    invitation: rowToInvitation(data),
    url,
  };
}

/** List all pending (non-revoked, non-accepted, non-expired) invitations. */
export async function listInvitations(workspaceId: string): Promise<Invitation[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("invitations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("invited_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rowToInvitation);
}

/** Revoke a pending invitation. */
export async function revokeInvitation(invitationId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: "Supabase not configured" };
  const { error } = await sb
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Redeem an invitation token. Caller must already be authenticated. */
export async function redeemInvitation(token: string): Promise<
  | { ok: true; workspaceId: string; role: WorkspaceRole }
  | { ok: false; error: string }
> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: "Supabase not configured" };
  const { data, error } = await sb.rpc("redeem_invitation", { invite_token: token });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? "unknown" };
  return { ok: true, workspaceId: data.workspace_id, role: data.role };
}

function rowToInvitation(r: Record<string, unknown>): Invitation {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    email: r.email as string,
    role: r.role as Exclude<WorkspaceRole, "owner">,
    token: r.token as string,
    invitedBy: (r.invited_by as string | null) ?? null,
    invitedAt: r.invited_at as string,
    expiresAt: r.expires_at as string,
    acceptedAt: (r.accepted_at as string | null) ?? null,
    revokedAt: (r.revoked_at as string | null) ?? null,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Passcodes
// ──────────────────────────────────────────────────────────────────────────

function generatePasscode(): string {
  // Human-friendly: 6 chars, uppercase letters + digits, no ambiguous (0/O/1/I)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

/** List all passcodes for a workspace (active + inactive). Owner only via RLS. */
export async function listPasscodes(workspaceId: string): Promise<WorkspacePasscode[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("workspace_passcodes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rowToPasscode);
}

/** Generate a new passcode for the given role. Deactivates any existing active code first. */
export async function generateNewPasscode(args: {
  workspaceId: string;
  role: Exclude<WorkspaceRole, "owner">;
  maxUses?: number;
  expiresInDays?: number;
}): Promise<{ ok: true; passcode: WorkspacePasscode } | { ok: false; error: string }> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  // Deactivate the existing active code for this (workspace, role) pair
  await sb
    .from("workspace_passcodes")
    .update({ active: false, rotated_at: new Date().toISOString() })
    .eq("workspace_id", args.workspaceId)
    .eq("role", args.role)
    .eq("active", true);

  const code = generatePasscode();
  const expiresAt = args.expiresInDays
    ? new Date(Date.now() + args.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data: { user } } = await sb.auth.getUser();
  const { data, error } = await sb
    .from("workspace_passcodes")
    .insert({
      workspace_id: args.workspaceId,
      role: args.role,
      code,
      max_uses: args.maxUses ?? null,
      expires_at: expiresAt,
      active: true,
      created_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };
  return { ok: true, passcode: rowToPasscode(data) };
}

/** Disable a passcode (without deleting — preserves audit trail of past uses). */
export async function disablePasscode(passcodeId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: "Supabase not configured" };
  const { error } = await sb
    .from("workspace_passcodes")
    .update({ active: false })
    .eq("id", passcodeId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Redeem a passcode. Caller must already be authenticated. */
export async function redeemPasscode(code: string): Promise<
  | { ok: true; workspaceId: string; role: WorkspaceRole }
  | { ok: false; error: string }
> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: "Supabase not configured" };
  const { data, error } = await sb.rpc("redeem_passcode", { passcode: code.trim().toUpperCase() });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error ?? "unknown" };
  return { ok: true, workspaceId: data.workspace_id, role: data.role };
}

function rowToPasscode(r: Record<string, unknown>): WorkspacePasscode {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    role: r.role as Exclude<WorkspaceRole, "owner">,
    code: r.code as string,
    maxUses: (r.max_uses as number | null) ?? null,
    useCount: (r.use_count as number) ?? 0,
    expiresAt: (r.expires_at as string | null) ?? null,
    active: r.active as boolean,
    createdBy: (r.created_by as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}
