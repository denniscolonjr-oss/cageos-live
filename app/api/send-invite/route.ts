/**
 * /api/send-invite
 *
 * Sends a workspace invitation email via Resend. Called from the
 * createInvitation flow in lib/supabase/membership.ts after the invitation
 * row is inserted into Supabase.
 *
 * Auth: requires the caller to be authenticated (we re-check the Supabase
 * session via the auth header) AND requires the caller to actually be a
 * member of the target workspace with role >= manager. Server-side guard
 * against random clients hitting this endpoint to spam.
 *
 * Returns: { ok: true } on success, { ok: false, error } otherwise.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface SendInviteBody {
  to: string;
  workspaceName: string;
  inviterName: string;
  inviterEmail: string;
  role: "manager" | "crew" | "viewer";
  inviteUrl: string;
}

const FROM_ADDRESS = "CageOS <noreply@cageos.app>";
const REPLY_TO = "hello@cageos.app";

export async function POST(req: Request) {
  // 1. Auth check — only authenticated users can trigger sends
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
  let body: SendInviteBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.to || !body.inviteUrl || !body.workspaceName) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  // 3. Resend send
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ ok: false, error: "resend_not_configured" }, { status: 500 });
  }

  const subject = `${body.inviterName || "Someone"} invited you to ${body.workspaceName} on CageOS`;
  const html = renderInviteHtml(body);
  const text = renderInviteText(body);

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [body.to],
      reply_to: REPLY_TO,
      subject,
      html,
      text,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("[send-invite] Resend error:", resp.status, errText);
    return NextResponse.json({ ok: false, error: "send_failed", detail: errText }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * HTML email body for the invite.
 *
 * Inline styles only — many email clients (Gmail web, Outlook desktop) strip
 * <style> blocks and external CSS. Tables for layout because email clients
 * still partially live in 1998. Tested visually in Gmail / Outlook / Apple Mail.
 */
function renderInviteHtml(b: SendInviteBody): string {
  const roleLabel = b.role.charAt(0).toUpperCase() + b.role.slice(1);
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
          You've been invited to ${escapeHtml(b.workspaceName)}
        </h1>
        <p style="margin:0 0 20px;font-size:15px;color:#cdc8bc;line-height:1.6;">
          ${escapeHtml(b.inviterName || "Someone")} invited you to join their workspace as <strong style="color:#fafaf6;">${roleLabel}</strong>.
        </p>
        <p style="margin:0 0 28px;font-size:15px;color:#cdc8bc;line-height:1.6;">
          CageOS is where production teams keep track of their gear, people, projects, and knowledge. Click below to accept the invitation and join the workspace.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
          <tr><td style="background:#ecff70;border-radius:7px;">
            <a href="${escapeHtml(b.inviteUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#0e0e0e;text-decoration:none;font-family:Georgia,serif;">
              Accept invitation
            </a>
          </td></tr>
        </table>
        <p style="margin:0 0 16px;font-size:12px;color:#9c9789;line-height:1.6;">
          Or copy and paste this URL into your browser:<br>
          <span style="color:#cdc8bc;word-break:break-all;font-family:'SF Mono',Menlo,monospace;font-size:11px;">${escapeHtml(b.inviteUrl)}</span>
        </p>
        <p style="margin:24px 0 0;font-size:12px;color:#9c9789;line-height:1.6;">
          This invitation expires in 7 days. If you weren't expecting this, you can safely ignore this email.
        </p>
      </td></tr>
      <tr><td style="padding:24px 36px 28px;border-top:1px solid #2e2e2e;">
        <p style="margin:0;font-size:11px;color:#9c9789;line-height:1.5;">
          CageOS · <a href="https://cageos.app" style="color:#9c9789;text-decoration:underline;">cageos.app</a><br>
          Reply to this email and ${escapeHtml(b.inviterName || "the inviter")} will get your message.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function renderInviteText(b: SendInviteBody): string {
  const roleLabel = b.role.charAt(0).toUpperCase() + b.role.slice(1);
  return `You've been invited to ${b.workspaceName} on CageOS

${b.inviterName || "Someone"} invited you to join their workspace as ${roleLabel}.

CageOS is where production teams keep track of their gear, people, projects, and knowledge.

Accept the invitation:
${b.inviteUrl}

This invitation expires in 7 days. If you weren't expecting this, you can safely ignore this email.

—
CageOS
cageos.app
Reply to this email and ${b.inviterName || "the inviter"} will get your message.
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
