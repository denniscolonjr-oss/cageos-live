/**
 * /api/send-welcome
 *
 * Sends a welcome email to a newly-joined member after they complete their
 * FirstTimeProfile setup. Called from completeMyProfile() in useWorkspace.
 *
 * Auth: requires the caller to be authenticated. The "to" address must match
 * the authenticated user's own email — you can't send a welcome email to
 * someone else (would be a spam vector).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface SendWelcomeBody {
  to: string;
  workspaceName: string;
  memberName: string;
  role: "owner" | "manager" | "crew" | "viewer";
}

const FROM_ADDRESS = "CageOS <noreply@cageos.app>";
const REPLY_TO = "hello@cageos.app";

export async function POST(req: Request) {
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

  let body: SendWelcomeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.to || !body.workspaceName) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  // Anti-spam: only allow sending welcome to your own email
  if (body.to.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return NextResponse.json({ ok: false, error: "to_must_be_self" }, { status: 403 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ ok: false, error: "resend_not_configured" }, { status: 500 });
  }

  const subject = `Welcome to ${body.workspaceName} on CageOS`;
  const html = renderWelcomeHtml(body);
  const text = renderWelcomeText(body);

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
    console.error("[send-welcome] Resend error:", resp.status, errText);
    return NextResponse.json({ ok: false, error: "send_failed", detail: errText }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

function renderWelcomeHtml(b: SendWelcomeBody): string {
  const roleLabel = b.role.charAt(0).toUpperCase() + b.role.slice(1);
  const roleBlurb = (() => {
    switch (b.role) {
      case "owner": return "As Owner, you have full control: inventory, settings, member management, and billing.";
      case "manager": return "As Manager, you have full control over inventory and settings. You can invite Crew and Viewers.";
      case "crew": return "As Crew, you can check gear in and out, flag service issues, and view the audit log.";
      case "viewer": return "As Viewer, you have read-only access across the workspace.";
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
          Welcome to ${escapeHtml(b.workspaceName)}, ${escapeHtml(b.memberName)}
        </h1>
        <p style="margin:0 0 20px;font-size:15px;color:#cdc8bc;line-height:1.6;">
          You've joined as <strong style="color:#fafaf6;">${roleLabel}</strong>. ${roleBlurb}
        </p>
        <p style="margin:0 0 20px;font-size:15px;color:#cdc8bc;line-height:1.6;">
          A few things to try:
        </p>
        <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#cdc8bc;line-height:1.7;">
          <li>Browse the <strong style="color:#fafaf6;">All assets</strong> tab to see what's available</li>
          <li>Visit the <strong style="color:#fafaf6;">Kiosk</strong> to check gear in or out</li>
          <li>Check <strong style="color:#fafaf6;">Projects</strong> for upcoming productions</li>
          <li>Click your initials in the top-right to switch workspaces or sign out</li>
        </ul>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr><td style="background:#ecff70;border-radius:7px;">
            <a href="https://cageos.app/dashboard" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#0e0e0e;text-decoration:none;font-family:Georgia,serif;">
              Open dashboard
            </a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:12px;color:#9c9789;line-height:1.6;">
          Questions? Reply to this email and the team will see it.
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

function renderWelcomeText(b: SendWelcomeBody): string {
  const roleLabel = b.role.charAt(0).toUpperCase() + b.role.slice(1);
  return `Welcome to ${b.workspaceName}, ${b.memberName}

You've joined as ${roleLabel}.

A few things to try:
- Browse the All assets tab to see what's available
- Visit the Kiosk to check gear in or out
- Check Projects for upcoming productions
- Click your initials in the top-right to switch workspaces or sign out

Open the dashboard:
https://cageos.app/dashboard

Questions? Reply to this email and the team will see it.

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
