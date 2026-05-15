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

/** Create an invitation. Returns the full invitation including the redeem URL.
 *
 * Also fires off a branded email via the /api/send-invite route. The email
 * send is non-blocking — if it fails (network issue, Resend down, domain not
 * verified yet), the invitation still exists and the link can be manually
 * shared. The returned `emailSent` flag tells the UI whether to display
 * a "We sent the invite to <email>" toast or fall back to "Copy link".
 */
export async function createInvitation(args: {
  workspaceId: string;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  expiresInDays?: number;
}): Promise<
  | { ok: true; invitation: Invitation; url: string; emailSent: boolean; emailError?: string }
  | { ok: false; error: string }
> {
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

  // Fetch workspace name and inviter display name for the email.
  // Both are best-effort — fall back to placeholders if either lookup fails.
  let workspaceName = "your team";
  try {
    const { data: ws } = await sb
      .from("workspaces")
      .select("name, data")
      .eq("id", args.workspaceId)
      .maybeSingle();
    if (ws?.name) workspaceName = ws.name;
    else if (ws?.data?.orgName) workspaceName = ws.data.orgName;
  } catch { /* leave fallback */ }

  let inviterName = "A teammate";
  try {
    if (user) {
      const { data: ws } = await sb
        .from("workspaces")
        .select("data")
        .eq("id", args.workspaceId)
        .maybeSingle();
      const profile = ws?.data?.profiles?.find?.((p: { userId?: string; name?: string }) => p.userId === user.id);
      if (profile?.name) inviterName = profile.name;
      else if (user.email) inviterName = user.email.split("@")[0];
    }
  } catch { /* leave fallback */ }

  // Fire the email send. Non-blocking — we return the invitation either way.
  let emailSent = false;
  let emailError: string | undefined;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.access_token) {
      const resp = await fetch("/api/send-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: args.email.trim().toLowerCase(),
          workspaceName,
          inviterName,
          inviterEmail: user?.email ?? "",
          role: args.role,
          inviteUrl: url,
        }),
      });
      if (resp.ok) {
        emailSent = true;
      } else {
        const errBody = await resp.json().catch(() => ({ error: "unknown" }));
        emailError = errBody.error ?? `http_${resp.status}`;
        console.warn("[createInvitation] email send failed:", emailError);
      }
    }
  } catch (e) {
    emailError = e instanceof Error ? e.message : "unknown";
    console.warn("[createInvitation] email send threw:", e);
  }

  return {
    ok: true,
    invitation: rowToInvitation(data),
    url,
    emailSent,
    emailError,
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

/**
 * Resend an existing pending invitation. Doesn't create a new invitation —
 * just re-fires the email for the same token. Useful when a recipient says
 * "I never got the invite" or it landed in spam and they cleared inbox.
 */
export async function resendInvitation(invitationId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  // Look up the invitation
  const { data: inv, error } = await sb
    .from("invitations")
    .select("*")
    .eq("id", invitationId)
    .maybeSingle();
  if (error || !inv) return { ok: false, error: error?.message ?? "not_found" };
  if (inv.accepted_at) return { ok: false, error: "already_accepted" };
  if (inv.revoked_at) return { ok: false, error: "revoked" };

  // Look up workspace name and inviter name (same logic as createInvitation)
  const { data: { user } } = await sb.auth.getUser();
  let workspaceName = "your team";
  let inviterName = "A teammate";
  try {
    const { data: ws } = await sb
      .from("workspaces")
      .select("name, data")
      .eq("id", inv.workspace_id)
      .maybeSingle();
    if (ws?.name) workspaceName = ws.name;
    else if (ws?.data?.orgName) workspaceName = ws.data.orgName;
    if (user) {
      const profile = ws?.data?.profiles?.find?.((p: { userId?: string; name?: string }) => p.userId === user.id);
      if (profile?.name) inviterName = profile.name;
      else if (user.email) inviterName = user.email.split("@")[0];
    }
  } catch { /* fall through */ }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/invite/${inv.token}`;

  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) return { ok: false, error: "no_session" };

  const resp = await fetch("/api/send-invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      to: inv.email,
      workspaceName,
      inviterName,
      inviterEmail: user?.email ?? "",
      role: inv.role,
      inviteUrl: url,
    }),
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({ error: "unknown" }));
    return { ok: false, error: errBody.error ?? `http_${resp.status}` };
  }
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

/**
 * Send a welcome email to the current user after they complete their profile.
 * Best-effort — if it fails, profile completion still succeeds. Called from
 * completeMyProfile() in useWorkspace.
 */
export async function sendWelcomeEmail(args: {
  workspaceName: string;
  memberName: string;
  role: WorkspaceRole;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: "Supabase not configured" };
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token || !session.user?.email) {
    return { ok: false, error: "no_session" };
  }
  const resp = await fetch("/api/send-welcome", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      to: session.user.email,
      workspaceName: args.workspaceName,
      memberName: args.memberName,
      role: args.role,
    }),
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({ error: "unknown" }));
    return { ok: false, error: errBody.error ?? `http_${resp.status}` };
  }
  return { ok: true };
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

// ──────────────────────────────────────────────────────────────────────────
// Workspace creation + ownership cap
// ──────────────────────────────────────────────────────────────────────────

/**
 * Free-tier limit on the number of workspaces a single user can be Owner of.
 * Currently hardcoded to 1. When pricing tiers ship, this becomes a function
 * of the user's plan (e.g., Pro = 3, Team = 10, Enterprise = unlimited).
 *
 * Membership in OTHER workspaces (as Manager/Crew/Viewer) is unlimited and
 * unaffected by this cap.
 */
export const FREE_TIER_OWNED_WORKSPACE_CAP = 1;

/**
 * Free-tier limit on member count per workspace. Currently 3 (you + 2
 * teammates) which is enough to test the product with a small crew but
 * tight enough to encourage upgrade for real production use.
 *
 * Surfaced on the landing page pricing section. NOT YET ENFORCED in code
 * — that lands when billing ships. For now, this is a single source of
 * truth so the marketing claim matches the eventual enforcement.
 */
export const FREE_TIER_MEMBER_CAP = 3;

/**
 * How many workspaces does the current user own?
 * Used by the workspace switcher to decide whether to show or hide / disable
 * the "Create new workspace" action.
 */
export async function countOwnedWorkspaces(): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb) return 0;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return 0;
  const { count, error } = await sb
    .from("workspace_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "owner");
  if (error) {
    console.warn("[countOwnedWorkspaces]", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Create a new workspace owned by the current user.
 *
 * Two-step DB write:
 * 1. Insert into `workspaces` with name and minimal initial data
 * 2. Insert into `workspace_members` with role='owner' linking the user
 *
 * Both writes must succeed atomically. If the second fails, we delete the
 * orphan workspace row so we don't leave dangling data behind.
 *
 * Honors FREE_TIER_OWNED_WORKSPACE_CAP — returns an error if the user would
 * exceed the cap. UI is expected to gate the create button on this same check
 * before allowing the call, but we re-validate here as defense in depth.
 */
export async function createWorkspace(args: {
  name: string;
}): Promise<
  | { ok: true; workspaceId: string }
  | { ok: false; error: string; reason?: "cap_reached" | "validation" | "db_error" }
> {
  const name = args.name.trim();
  if (!name) {
    return { ok: false, error: "Name is required.", reason: "validation" };
  }
  if (name.length > 80) {
    return { ok: false, error: "Name must be 80 characters or less.", reason: "validation" };
  }

  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: "Supabase not configured", reason: "db_error" };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in", reason: "validation" };

  // Re-check the cap server-side. UI also enforces this, but never trust the client.
  const ownedCount = await countOwnedWorkspaces();
  if (ownedCount >= FREE_TIER_OWNED_WORKSPACE_CAP) {
    return {
      ok: false,
      reason: "cap_reached",
      error: `You can own up to ${FREE_TIER_OWNED_WORKSPACE_CAP} workspace on the current plan.`,
    };
  }

  // Empty workspace data shape — matches what onboarding initializes.
  // We keep this minimal so the workspace is editable from first load.
  // iter-23: shoots → projects rename. Also ensures `notes` (iter-17) and
  // `orgLocation` are present so consumers don't crash on undefined access.
  const initialData = {
    orgName: name,
    orgLocation: "—",
    timezone: "auto",
    barcodePrefix: "",
    filterableFields: [],
    managerMode: false,  // ignored at runtime, derived from role
    assets: [],
    kits: [],
    profiles: [],
    projects: [],
    flags: [],
    checkouts: [],
    events: [],
    notes: [],
  };

  const { data: ws, error: wsErr } = await sb
    .from("workspaces")
    .insert({ name, data: initialData })
    .select("id")
    .single();
  if (wsErr || !ws) {
    return { ok: false, error: wsErr?.message ?? "Workspace insert failed", reason: "db_error" };
  }

  const workspaceId = ws.id as string;

  // Add the creator as owner. If this fails, undo the workspace insert so we
  // don't leave an orphan workspace nobody can access.
  const { error: memErr } = await sb
    .from("workspace_members")
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: "owner",
    });
  if (memErr) {
    await sb.from("workspaces").delete().eq("id", workspaceId);
    return { ok: false, error: `Membership creation failed: ${memErr.message}`, reason: "db_error" };
  }

  return { ok: true, workspaceId };
}

/**
 * deleteWorkspace — permanently delete a workspace.
 *
 * RLS policy (set up around iter-16i) only permits Owners to execute the
 * delete; non-owners get a permission error returned by Supabase. We don't
 * pre-check the role here — the RLS layer is the source of truth, and
 * pre-checking creates a TOCTOU race where the role could change between
 * check and delete.
 *
 * What gets deleted:
 *   - The workspaces row (and via FK cascade: workspace_members, all
 *     workspace-scoped data referenced by FK)
 *   - Storage objects under <workspaceId>/* in the photos bucket are NOT
 *     auto-deleted. Storage cleanup is a future cost optimization — for now
 *     orphaned photos stay until manually purged.
 *
 * Caller responsibility:
 *   - Switch to a different workspace (or onboarding) AFTER the delete
 *     succeeds, since the active workspace will no longer exist.
 *
 * @returns Promise<{ ok: boolean; error?: string }>
 */
export async function deleteWorkspace(workspaceId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: "Supabase not configured." };

  const { error } = await sb
    .from("workspaces")
    .delete()
    .eq("id", workspaceId);

  if (error) {
    console.error("[deleteWorkspace] failed:", error);
    // Surface a friendlier message for the most common failure (non-owner).
    const isPermission = error.message?.toLowerCase().includes("policy")
      || error.message?.toLowerCase().includes("permission")
      || error.code === "42501";
    return {
      ok: false,
      error: isPermission
        ? "Only the workspace owner can delete a workspace."
        : error.message || "Delete failed.",
    };
  }

  return { ok: true };
}
