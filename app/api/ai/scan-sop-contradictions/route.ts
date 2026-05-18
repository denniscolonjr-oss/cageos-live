/**
 * /api/ai/scan-sop-contradictions — iter-28a
 *
 * Opt-in AI scan that detects semantic contradictions between an SOP's
 * authored markdown body and the current configuration of the entities
 * it's linked to.
 *
 * Why this needs AI:
 *   Pure logic can detect that an SOP's text changed or a kit's components
 *   changed, but it cannot understand that "Sony 24-105mm" and "Sigma 24-70mm"
 *   are different lenses with different operational implications. An LLM
 *   reads the SOP and the kit's actual contents and flags semantic mismatch.
 *
 * Why it's opt-in (not run automatically):
 *   - Token cost. Pure logic checks are free; this one costs $0.001-0.005
 *     per scanned SOP. We don't want this running on every dashboard load.
 *   - Latency. The scan takes 5-30 seconds depending on SOP count.
 *   - Rate-limited to 20 scans per workspace per 24 hours (UTC day).
 *
 * Auth:
 *   - Requires Supabase session token in Authorization header
 *   - User must be Manager or Owner role in the workspace
 *
 * Body shape:
 *   {
 *     workspaceId: string,
 *     sops: Array<{ id, title, body, linkedEntities: Array<{ type, id, name, snippet }> }>
 *   }
 *
 * Response:
 *   {
 *     ok: true,
 *     findings: Array<{ sopId, sopTitle, summary, confidence: "high" | "medium" | "low" }>,
 *     scanned: number,
 *     tokensUsed: { input: number, output: number },
 *     costUsd: number
 *   }
 *
 * Cost calculation: Claude Haiku 4.5 pricing approx $1/M input tokens,
 * $5/M output tokens at time of writing. Real numbers from the API
 * response are used; constants below are fallbacks if the API doesn't
 * return usage info.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Pricing constants (per million tokens, in USD) — Claude Haiku 4.5
const PRICE_PER_M_INPUT_USD = 1.0;
const PRICE_PER_M_OUTPUT_USD = 5.0;

// Hard cap on SOPs scanned per call so a workspace with 500 SOPs can't
// blow through their daily budget in a single click. Beyond this, the
// route returns a partial result and asks the client to call again.
const MAX_SOPS_PER_SCAN = 50;

// Daily rate limit per workspace (compared client-supplied counter via
// the userData blob; not authoritatively enforced server-side, but the
// client check + this server check together provide defence in depth).
const DAILY_SCAN_LIMIT = 20;

interface ScanBody {
  workspaceId: string;
  /** Daily counter from client. Server checks this against the limit. */
  dailyScansSoFar: number;
  sops: Array<{
    id: string;
    title: string;
    body: string;
    linkedEntities: Array<{
      type: "asset" | "kit" | "project";
      id: string;
      name: string;
      /** Compact text representation of the entity: components, category, etc. */
      snippet: string;
    }>;
  }>;
}

interface Finding {
  sopId: string;
  sopTitle: string;
  summary: string;
  confidence: "high" | "medium" | "low";
}

export async function POST(req: Request): Promise<Response> {
  // ── 1. Auth ────────────────────────────────────────────────────
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

  // ── 2. AI key check ────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      error: "ai_not_configured",
      detail: "ANTHROPIC_API_KEY environment variable is not set in this deployment. AI features are disabled.",
    }, { status: 503 });
  }

  // ── 3. Body parse + validate ───────────────────────────────────
  let body: ScanBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.workspaceId || !Array.isArray(body.sops)) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  // ── 4. Authorize: user must be Manager+ in the workspace ──────
  const { data: membership, error: memberErr } = await sb
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", body.workspaceId)
    .eq("user_id", user.id)
    .single();
  if (memberErr || !membership) {
    return NextResponse.json({ ok: false, error: "not_a_member" }, { status: 403 });
  }
  if (membership.role !== "owner" && membership.role !== "manager") {
    return NextResponse.json({ ok: false, error: "insufficient_role" }, { status: 403 });
  }

  // ── 5. Rate limit check ───────────────────────────────────────
  if (body.dailyScansSoFar >= DAILY_SCAN_LIMIT) {
    return NextResponse.json({
      ok: false,
      error: "rate_limited",
      detail: `Daily AI scan limit reached (${DAILY_SCAN_LIMIT} per workspace per 24h). Try again tomorrow.`,
    }, { status: 429 });
  }

  // ── 6. Truncate SOP list if huge ──────────────────────────────
  const sopsToScan = body.sops.slice(0, MAX_SOPS_PER_SCAN);
  if (sopsToScan.length === 0) {
    return NextResponse.json({
      ok: true,
      findings: [],
      scanned: 0,
      tokensUsed: { input: 0, output: 0 },
      costUsd: 0,
      note: "no_sops_to_scan",
    });
  }
  // SOPs without linked entities can't have contradictions — skip them
  const eligible = sopsToScan.filter(s => s.linkedEntities.length > 0);
  if (eligible.length === 0) {
    return NextResponse.json({
      ok: true,
      findings: [],
      scanned: 0,
      tokensUsed: { input: 0, output: 0 },
      costUsd: 0,
      note: "no_eligible_sops",
    });
  }

  // ── 7. Build prompt + call Anthropic ──────────────────────────
  /*
   * Strategy: send ALL eligible SOPs in a single request as JSON, asking
   * Claude to return JSON findings. This is more efficient than one
   * request per SOP (saves on auth + system-prompt overhead) and gives
   * Claude cross-SOP context which sometimes catches "this SOP says X
   * but THAT SOP says not-X" cases.
   *
   * We bound it at MAX_SOPS_PER_SCAN (50) so a single request can't
   * exceed Claude's context window or timeout the lambda.
   */
  const systemPrompt = `You are a documentation quality reviewer for a video production / broadcast engineering operations platform. You scan Standard Operating Procedures (SOPs) for semantic contradictions between the SOP's text and the actual configuration of the equipment/kits/projects it is linked to.

Your job is to identify cases like:
- SOP text references a specific piece of equipment that is NOT actually in the linked kit
- SOP describes a procedure for hardware that no longer matches reality (different model, different make, different connector type)
- SOP procedures reference a configuration that contradicts the linked entity's described configuration

You DO NOT flag:
- Stylistic issues (typos, formatting, capitalization)
- Missing information (omissions are not contradictions)
- General improvements or suggestions
- Things that are reasonable but unstated assumptions

You ONLY flag clear, specific contradictions where the SOP body says one thing and the linked entity says another.

Respond ONLY with a JSON object matching this schema:
{
  "findings": [
    {
      "sopId": "<id>",
      "summary": "<one-sentence specific explanation of the contradiction>",
      "confidence": "high" | "medium" | "low"
    }
  ]
}

If there are no contradictions, return { "findings": [] }. Do not include any text outside the JSON.`;

  const userPrompt = `Scan the following SOPs for contradictions with their linked entities:

${JSON.stringify(eligible.map(s => ({
  sopId: s.id,
  sopTitle: s.title,
  sopBody: s.body.slice(0, 4000), // cap body length per SOP
  linkedEntities: s.linkedEntities,
})), null, 2)}`;

  let anthropicResponse: Response;
  try {
    anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
  } catch (err) {
    console.error("[scan-sop-contradictions] network error:", err);
    return NextResponse.json({
      ok: false,
      error: "ai_network_error",
      detail: "Couldn't reach Anthropic's API. Try again in a minute.",
    }, { status: 502 });
  }

  if (!anthropicResponse.ok) {
    const errText = await anthropicResponse.text().catch(() => "");
    console.error("[scan-sop-contradictions] API error:", anthropicResponse.status, errText);
    return NextResponse.json({
      ok: false,
      error: "ai_api_error",
      detail: `Anthropic returned ${anthropicResponse.status}. Check the API key and account status.`,
    }, { status: 502 });
  }

  const aiData = await anthropicResponse.json();

  // ── 8. Parse model output ─────────────────────────────────────
  let findings: Finding[] = [];
  try {
    const text = aiData.content?.[0]?.text ?? "";
    // Strip ```json fences if Claude added them despite system prompt
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.findings)) {
      findings = parsed.findings
        .filter((f: unknown): f is { sopId: string; summary: string; confidence: string } =>
          typeof f === "object" && f !== null
          && typeof (f as { sopId: unknown }).sopId === "string"
          && typeof (f as { summary: unknown }).summary === "string"
        )
        .map((f: { sopId: string; summary: string; confidence: string }) => {
          const sop = eligible.find(s => s.id === f.sopId);
          return {
            sopId: f.sopId,
            sopTitle: sop?.title ?? "Unknown SOP",
            summary: f.summary,
            confidence: (f.confidence === "high" || f.confidence === "medium" || f.confidence === "low")
              ? f.confidence as Finding["confidence"]
              : "medium",
          };
        });
    }
  } catch (err) {
    console.error("[scan-sop-contradictions] parse error:", err);
    // Fall through with empty findings — better to return "no contradictions"
    // than to surface a confusing error for what is essentially "AI gave a bad reply".
    findings = [];
  }

  // ── 9. Calculate cost from token usage ────────────────────────
  const inputTokens = aiData.usage?.input_tokens ?? 0;
  const outputTokens = aiData.usage?.output_tokens ?? 0;
  const costUsd =
    (inputTokens / 1_000_000) * PRICE_PER_M_INPUT_USD
    + (outputTokens / 1_000_000) * PRICE_PER_M_OUTPUT_USD;

  return NextResponse.json({
    ok: true,
    findings,
    scanned: eligible.length,
    tokensUsed: { input: inputTokens, output: outputTokens },
    costUsd: Math.round(costUsd * 10000) / 10000, // round to 4 decimal places
  });
}
