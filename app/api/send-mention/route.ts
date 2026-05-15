/**
 * /api/send-mention
 *
 * Sends a mention notification email when someone @mentions a teammate in
 * a comment. Called fire-and-forget from CommentsThread after a successful
 * note post.
 *
 * Auth: requires authenticated Supabase session. The caller must be a
 * member of the workspace they're commenting on (enforced indirectly via
 * RLS — they can only post comments where they're a member).
 *
 * Body shape:
 *   {
 *     mentionedInitials: string[],   // e.g. ["KL", "BR"]
 *     parentType: "asset" | "kit" | "shoot" | "project" | "checkout" | "user",
 *     parentId: string,
 *     parentLabel: string,            // human-readable, e.g. "Sigma 85mm f/1.4"
 *     excerpt: string                 // first ~200 chars of the comment body
 *   }
 *
 * Behavior:
 *   - Resolves each initial to an email address by looking up the workspace's
 *     profiles (via the Supabase REST API)
 *   - Sends one email per resolved recipient (multiple Resend API calls if
 *     several mentioned)
 *   - Returns { ok: true, sent: N } where N = successful sends
 *
 * Failures are logged but don't fail the API call — the comment was already
 * saved client-side; email is best-effort.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface SendMentionBody {
  mentionedInitials: string[];
  parentType: "asset" | "kit" | "shoot" | "project" | "checkout" | "user";
  parentId: string;
  parentLabel: string;
  excerpt: string;
}

const FROM_ADDRESS = "CageOS <noreply@cageos.app>";
const REPLY_TO = "hello@cageos.app";

export async function POST(req: Request) {
  // 1. Auth check
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }
  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await sb.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });
  }

  // 2. Parse body
  let body: SendMentionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.mentionedInitials?.length || !body.parentType || !body.parentLabel) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  // 3. Find the workspace this user is currently in. We don't pass workspaceId
  // through the body (UI doesn't track it for comments), so we look up all
  // workspaces this user is a member of and find the one whose profiles
  // contain the mentioned initials. This is a heuristic — works fine while
  // initials are unique per workspace.
  const { data: memberships } = await sb
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id);

  if (!memberships?.length) {
    return NextResponse.json({ ok: true, sent: 0, note: "no_workspaces" });
  }

  // 4. Pull the workspaces' profile data, find ones with matching initials,
  // collect their email addresses (via auth.users via the email_for_user RPC
  // or via a profiles->userId lookup chain).
  const workspaceIds = memberships.map(m => m.workspace_id);
  const { data: workspaces } = await sb
    .from("workspaces")
    .select("id, name, data")
    .in("id", workspaceIds);

  if (!workspaces?.length) {
    return NextResponse.json({ ok: true, sent: 0, note: "no_workspace_data" });
  }

  // Get author display name from profiles
  let authorName = user.email?.split("@")[0] ?? "A teammate";
  let workspaceName = "your workspace";

  // Find candidate (userId, profileName) pairs for mentioned initials,
  // de-duplicated across workspaces (a user could be in many).
  const initialsSet = new Set(body.mentionedInitials.map(i => i.toUpperCase()));
  const recipientUserIds = new Set<string>();

  for (const ws of workspaces) {
    const profiles = (ws.data as { profiles?: Array<{ userId?: string; initials?: string; name?: string }> })?.profiles ?? [];
    // Identify the author within this workspace if present
    const authorProfile = profiles.find(p => p.userId === user.id);
    if (authorProfile?.name) {
      authorName = authorProfile.name;
      workspaceName = ws.name || workspaceName;
    }
    // Find recipients
    for (const p of profiles) {
      if (p.initials && p.userId && initialsSet.has(p.initials.toUpperCase())) {
        if (p.userId !== user.id) {
          recipientUserIds.add(p.userId);
        }
      }
    }
  }

  if (recipientUserIds.size === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: "no_recipients_resolved" });
  }

  // 5. Look up email addresses for the recipient userIds. We use the
  // emails_for_users RPC if it exists (multi-user from iter-14i added one),
  // otherwise we fall back to skipping. Either way, never expose emails
  // beyond the dispatch loop.
  const recipientIds = Array.from(recipientUserIds);
  const emailMap = new Map<string, string>();
  try {
    const { data: emailRows, error: rpcErr } = await sb.rpc("emails_for_users", {
      user_ids: recipientIds,
    });
    if (!rpcErr && Array.isArray(emailRows)) {
      for (const row of emailRows as Array<{ user_id: string; email: string }>) {
        if (row.email) emailMap.set(row.user_id, row.email);
      }
    } else if (rpcErr) {
      console.warn("[send-mention] emails_for_users RPC failed:", rpcErr.message);
    }
  } catch (e) {
    console.warn("[send-mention] emails RPC threw:", e);
  }

  if (emailMap.size === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: "no_emails_resolved" });
  }

  // 6. Send each email. Resend in parallel to keep this snappy. Track
  // successes/failures per recipient.
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ ok: false, error: "resend_not_configured" }, { status: 500 });
  }

  const subject = `${authorName} mentioned you on ${body.parentLabel}`;
  const sendResults = await Promise.all(
    Array.from(emailMap.entries()).map(async ([_userId, email]) => {
      const html = renderMentionHtml({
        authorName,
        workspaceName,
        parentType: body.parentType,
        parentId: body.parentId,
        parentLabel: body.parentLabel,
        excerpt: body.excerpt,
      });
      const text = renderMentionText({
        authorName,
        workspaceName,
        parentType: body.parentType,
        parentId: body.parentId,
        parentLabel: body.parentLabel,
        excerpt: body.excerpt,
      });
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: [email],
          reply_to: REPLY_TO,
          subject,
          html,
          text,
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.warn("[send-mention] Resend error:", resp.status, errText);
        return false;
      }
      return true;
    })
  );

  const sent = sendResults.filter(Boolean).length;
  return NextResponse.json({ ok: true, sent, attempted: emailMap.size });
}

// ──────────────────────────────────────────────────────────────────────────
// Email templates
// ──────────────────────────────────────────────────────────────────────────

interface MentionTemplateArgs {
  authorName: string;
  workspaceName: string;
  parentType: string;
  parentId: string;
  parentLabel: string;
  excerpt: string;
}

/**
 * Build the deep-link URL for the email "Open in CageOS" button.
 *
 * Without this, all mention emails just routed to /dashboard — which is
 * useless for clients managing thousands of assets. The recipient should
 * land on the EXACT entity that was commented on.
 *
 * URL patterns mirror what the app's router uses:
 *   - asset → /asset/<barcode>
 *   - kit   → /kit/<barcode>
 *   - shoot → /dashboard (shoots are modals, no dedicated route)
 *   - checkout → /dashboard (live in the active checkouts card)
 *   - user (DM) → /dashboard (no profile detail route yet)
 *
 * As we add detail routes for shoots/users/checkouts in future iterations,
 * extend this switch.
 *
 * encodeURIComponent guards against weird characters in barcodes/IDs.
 */
function buildDeepLink(parentType: string, parentId: string): string {
  const base = "https://cageos.app";
  switch (parentType) {
    case "asset":
      return `${base}/asset/${encodeURIComponent(parentId)}`;
    case "kit":
      return `${base}/kit/${encodeURIComponent(parentId)}`;
    case "checkout":
      // Added iter-21 — checkouts now have their own detail page.
      return `${base}/checkouts/${encodeURIComponent(parentId)}`;
    case "project":
    case "shoot":
      // Both route to /projects (the placeholder list / future calendar in iter-24).
      // Project detail routes don't exist yet; for now we land users on the list.
      return `${base}/projects`;
    case "user":
    default:
      return `${base}/dashboard`;
  }
}

function renderMentionHtml(b: MentionTemplateArgs): string {
  const deepLink = buildDeepLink(b.parentType, b.parentId);
  // Customize the CTA based on parent type. "Open this asset" reads cleaner
  // than the generic "Open in CageOS" when we know what the recipient will
  // actually land on.
  const ctaLabel = (() => {
    switch (b.parentType) {
      case "asset": return "Open this asset";
      case "kit": return "Open this kit";
      case "project":
      case "shoot": return "Open the project";
      case "checkout": return "Open the checkout";
      default: return "Open in CageOS";
    }
  })();
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e0e0e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#fafaf6;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e0e;padding:40px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#181818;border:1px solid #424242;border-radius:10px;overflow:hidden;">
      <tr><td style="padding:32px 36px 24px;">
        <div style="font-family:Georgia,serif;font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#fafaf6;">
          Cage<span style="color:#ecff70;">OS</span>
        </div>
      </td></tr>
      <tr><td style="padding:0 36px 8px;">
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#fafaf6;line-height:1.3;">
          ${escapeHtml(b.authorName)} mentioned you
        </h1>
        <p style="margin:0 0 20px;font-size:14px;color:#cdc8bc;line-height:1.6;">
          On <strong style="color:#fafaf6;">${escapeHtml(b.parentLabel)}</strong> in ${escapeHtml(b.workspaceName)}:
        </p>
        <div style="margin:0 0 24px;padding:14px 16px;background:#0e0e0e;border-left:3px solid #ecff70;border-radius:4px;font-size:14px;color:#cdc8bc;line-height:1.6;white-space:pre-wrap;">${escapeHtml(b.excerpt)}</div>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr><td style="background:#ecff70;border-radius:7px;">
            <a href="${escapeHtml(deepLink)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#0e0e0e;text-decoration:none;font-family:Georgia,serif;">
              ${ctaLabel}
            </a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:12px;color:#9c9789;line-height:1.6;">
          You're getting this because someone @mentioned you in a comment.
        </p>
      </td></tr>
      <tr><td style="padding:24px 36px 28px;border-top:1px solid #2e2e2e;">
        <p style="margin:0;font-size:11px;color:#9c9789;line-height:1.5;">
          CageOS · <a href="https://cageos.app" style="color:#9c9789;text-decoration:underline;">cageos.app</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function renderMentionText(b: MentionTemplateArgs): string {
  const deepLink = buildDeepLink(b.parentType, b.parentId);
  return `${b.authorName} mentioned you

On ${b.parentLabel} in ${b.workspaceName}:

"${b.excerpt}"

Open the ${b.parentType}:
${deepLink}

You're getting this because someone @mentioned you in a comment.

—
CageOS
cageos.app
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
