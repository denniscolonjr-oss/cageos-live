/**
 * GET /api/calendar/[workspaceId]/[type]
 *
 * Unauthenticated iCal feed endpoint. Calendar apps subscribe to a URL like:
 *
 *   https://cageos.app/api/calendar/<workspaceId>/projects.ics?token=<token>
 *   https://cageos.app/api/calendar/<workspaceId>/checkouts.ics?token=<token>
 *
 * The token is workspace-scoped (one per workspace, stored on the
 * `workspaces.calendar_token` column). Whoever has the URL gets read-only
 * access to the feed. Owners can rotate the token to invalidate sharing.
 *
 * Type segment:
 *   - "projects" or "projects.ics" → projects feed
 *   - "checkouts" or "checkouts.ics" → active+overdue checkouts feed
 *
 * Auth model:
 *   - Validates token query param against the workspace's stored token
 *   - Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS (the token IS the auth)
 *   - If token missing/wrong, returns 401
 *
 * Caching:
 *   - Cache-Control: no-store
 *   - Real-time feed; every fetch hits this route
 *   - User chose this over max-age=900 so calendar updates are live
 *
 * Stability:
 *   - Wrapped in try/catch — never returns 500 with a stack trace. On
 *     any error returns a valid (empty) iCal feed so calendar apps don't
 *     break the user's subscription.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildProjectsICal, buildCheckoutsICal } from "@/lib/calendar/ical";
import type { WorkspaceData, ActiveCheckout } from "@/lib/hooks/workspaceTypes";

export const runtime = "nodejs";  // not edge — needs service role key
export const dynamic = "force-dynamic";  // no caching at the route layer

interface RouteParams {
  workspaceId: string;
  type: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { workspaceId, type: typeRaw } = await params;

    // Strip optional .ics suffix. Calendar apps prefer URLs ending in .ics
    // for autodiscovery but the route handles either form.
    const type = typeRaw.replace(/\.ics$/i, "");

    if (type !== "projects" && type !== "checkouts") {
      return emptyFeed(404, "Unknown feed type");
    }

    // Token from query string. Calendar apps don't support custom headers,
    // so the query string is the only viable auth carrier here.
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return emptyFeed(401, "Missing token");
    }

    // Server-side Supabase client using service role key. This bypasses RLS
    // entirely — we do our own authz via the token check below. The service
    // role key is read from server env; never exposed to the client bundle.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[calendar] SUPABASE_SERVICE_ROLE_KEY not configured");
      return emptyFeed(500, "Calendar export not configured on server");
    }

    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Fetch workspace + verify token in a single query. We select only the
    // fields we need (data, name, calendar_token) to keep the response small.
    const { data: workspace, error } = await sb
      .from("workspaces")
      .select("id, name, data, calendar_token")
      .eq("id", workspaceId)
      .maybeSingle();

    if (error) {
      console.error("[calendar] DB error:", error);
      return emptyFeed(500, "Database error");
    }
    if (!workspace) {
      return emptyFeed(404, "Workspace not found");
    }

    // Token check — constant-time comparison to avoid timing attacks.
    // Realistically the surface is small enough that timing attacks aren't
    // a serious risk here, but the comparison is cheap so we may as well.
    if (!workspace.calendar_token || !constantTimeEqual(token, workspace.calendar_token)) {
      return emptyFeed(401, "Invalid token");
    }

    // Parse the workspace data JSON. Defensive — if the data is malformed,
    // we serve an empty feed rather than crash.
    const data = workspace.data as Partial<WorkspaceData> & { shoots?: unknown[] };
    const workspaceName = workspace.name || "CageOS";

    // Apply the same migration shim used at app load — old workspaces may
    // still have `shoots: [...]` and ActiveCheckouts with `shoot`/`shootId`.
    const projects = (data.projects ?? (data.shoots as WorkspaceData["projects"]) ?? []);

    /*
     * WorkspaceData.checkouts is the union `(CheckoutRecord | ActiveCheckout)[]`
     * because legacy demo data uses CheckoutRecord. The iCal builder only
     * accepts ActiveCheckout, so we narrow here using a type guard. Real
     * customer data shouldn't contain CheckoutRecord — that's demo-seed
     * only — but the type system doesn't know that.
     *
     * The guard checks for `checkedOutAtISO` since CheckoutRecord lacks it.
     */
    const allCheckouts = data.checkouts ?? [];
    const checkouts = allCheckouts.filter(
      (c): c is ActiveCheckout => "checkedOutAtISO" in c && typeof (c as ActiveCheckout).checkedOutAtISO === "string"
    );

    let body: string;
    if (type === "projects") {
      body = buildProjectsICal({ workspaceName, projects });
    } else {
      body = buildCheckoutsICal({ workspaceName, checkouts });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        // text/calendar is the correct MIME per RFC 5545.
        "Content-Type": "text/calendar; charset=utf-8",
        // User's choice: no-store so calendar apps see real-time updates.
        // Tradeoff: every poll hits this route. Calendar apps poll at most
        // hourly so the load is manageable.
        "Cache-Control": "no-store",
        // Standard CORS for calendar apps that fetch from a browser context.
        // Calendar.app, Fantastical, etc. fetch server-side and don't need
        // this, but it doesn't hurt.
        "Access-Control-Allow-Origin": "*",
        // Suggest filename for browsers that download instead of subscribing
        "Content-Disposition": `inline; filename="${type}.ics"`,
      },
    });

  } catch (err) {
    console.error("[calendar] unhandled error:", err);
    return emptyFeed(500, "Internal error");
  }
}

/**
 * Return a minimal valid iCal feed with an error-comment event.
 *
 * Why not return JSON or HTML? Calendar apps unsubscribe / show errors when
 * a feed returns non-iCal content. By returning a valid (empty) feed even
 * on auth failure, we preserve the subscription — the user just sees no
 * events. They can investigate via the dashboard.
 *
 * Status codes are still set correctly for monitoring/logs.
 */
function emptyFeed(status: number, reason: string): NextResponse {
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CageOS//Error//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALDESC:${reason}`,
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Constant-time string comparison. Returns true iff a and b are byte-equal.
 * Reduces timing-attack surface for token validation.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
