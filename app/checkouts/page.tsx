"use client";

/**
 * /checkouts — Active checkouts list
 *
 * The operational "what's out right now" view. Surfaces every active and
 * recently-returned checkout in a sortable, filterable list. Designed for
 * a shop manager to glance at first thing in the morning and answer:
 *   - What's overdue?
 *   - What's due today?
 *   - Who has what?
 *
 * Each row links to /checkouts/[id] for the full detail view (photos,
 * condition rating, contact info, comments, action buttons).
 *
 * Filter tabs:
 *   - All active: status === "active" || status === "overdue"
 *   - Overdue:    dueBackISO < now AND status === "active"
 *   - Due today:  dueBackISO is today (any time)
 *   - Returned:   status === "returned" (most recent 50)
 *
 * Default sort: dueBackISO ascending (most overdue/urgent first).
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/shared/TopNav";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import type { ActiveCheckout } from "@/lib/hooks/workspaceTypes";

type FilterMode = "active" | "overdue" | "today" | "returned";

export default function CheckoutsListPage() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const auth = useAuth();
  const { data, hydrated } = useWorkspace();
  const [filter, setFilter] = useState<FilterMode>("active");

  // Signed-out redirect (same pattern as asset/kit/inbox)
  const signedOut = auth.supabaseEnabled && !auth.loading && !auth.session;
  if (signedOut) {
    router.replace("/login");
    return null;
  }

  if (!hydrated || auth.loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          Loading workspace...
        </div>
      </div>
    );
  }

  return (
    <CheckoutsListPageBody
      isMobile={isMobile}
      filter={filter}
      setFilter={setFilter}
      router={router}
    />
  );
}

function CheckoutsListPageBody({
  isMobile, filter, setFilter, router,
}: {
  isMobile: boolean;
  filter: FilterMode;
  setFilter: (m: FilterMode) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const { data } = useWorkspace();

  /**
   * Bucketing. Computed once per render with useMemo. The dataset is small
   * (typically <100 checkouts even for medium-sized teams) so we don't need
   * indexed lookups — straight filter/sort is fast enough.
   */
  const buckets = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    // Only ActiveCheckout entries have the ISO timestamp fields we need.
    // Legacy CheckoutRecord (demo data) doesn't, so we filter those out
    // of the time-based buckets.
    const activeCheckouts = (data.checkouts as ActiveCheckout[])
      .filter(c => c.status === "active" || c.status === "overdue");

    const overdue = activeCheckouts.filter(c => {
      if (!c.dueBackISO) return false;
      return new Date(c.dueBackISO).getTime() < now;
    });
    const dueToday = activeCheckouts.filter(c => {
      if (!c.dueBackISO) return false;
      const due = new Date(c.dueBackISO).getTime();
      return due >= todayStart.getTime() && due <= todayEnd.getTime();
    });
    const returned = (data.checkouts as ActiveCheckout[])
      .filter(c => c.status === "returned")
      // Newest returns first for the returned tab.
      .sort((a, b) => {
        const aT = a.returnedAtISO ? new Date(a.returnedAtISO).getTime() : 0;
        const bT = b.returnedAtISO ? new Date(b.returnedAtISO).getTime() : 0;
        return bT - aT;
      })
      .slice(0, 50);

    return { active: activeCheckouts, overdue, dueToday, returned };
  }, [data.checkouts]);

  const visible = useMemo(() => {
    const list = (() => {
      switch (filter) {
        case "active":   return buckets.active;
        case "overdue":  return buckets.overdue;
        case "today":    return buckets.dueToday;
        case "returned": return buckets.returned;
      }
    })();
    if (filter === "returned") return list;  // already sorted newest-first
    // Sort by dueBack ascending (closest to due / most overdue first).
    return [...list].sort((a, b) => {
      const aT = a.dueBackISO ? new Date(a.dueBackISO).getTime() : 0;
      const bT = b.dueBackISO ? new Date(b.dueBackISO).getTime() : 0;
      return aT - bT;
    });
  }, [buckets, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
      <TopNav />
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "20px 14px" : "32px 28px", background: "var(--bg)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>

          {/* Page header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>
              Active checkouts
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
              What&apos;s out, who has it, when it&apos;s due back
            </div>
          </div>

          {/* Stat strip */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: 10, marginBottom: 18,
          }}>
            <StatTile label="Active" value={buckets.active.length} color="var(--amber)" />
            <StatTile label="Overdue" value={buckets.overdue.length} color="var(--red)" highlight={buckets.overdue.length > 0} />
            <StatTile label="Due today" value={buckets.dueToday.length} color="var(--acc)" />
            <StatTile label="Returned" value={buckets.returned.length} color="var(--green)" suffix=" (last 50)" />
          </div>

          {/* Filter tabs */}
          <div style={{
            display: "flex", gap: 4, marginBottom: 14,
            borderBottom: "1px solid var(--b1)",
            overflowX: "auto",
            scrollbarWidth: "none",
          }}>
            <FilterTab label="All active" count={buckets.active.length} active={filter === "active"} onClick={() => setFilter("active")} />
            <FilterTab label="Overdue" count={buckets.overdue.length} active={filter === "overdue"} onClick={() => setFilter("overdue")} highlight={buckets.overdue.length > 0} />
            <FilterTab label="Due today" count={buckets.dueToday.length} active={filter === "today"} onClick={() => setFilter("today")} />
            <FilterTab label="Returned" count={buckets.returned.length} active={filter === "returned"} onClick={() => setFilter("returned")} />
          </div>

          {/* List */}
          {visible.length === 0 ? (
            <Card>
              <div style={{
                padding: "48px 24px", textAlign: "center",
                color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 12,
              }}>
                {filter === "active" && "Nothing checked out right now."}
                {filter === "overdue" && "No overdue checkouts. Everything's on time."}
                {filter === "today" && "Nothing due back today."}
                {filter === "returned" && "No recent returns."}
              </div>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visible.map(c => (
                <CheckoutRow
                  key={c.id}
                  checkout={c}
                  onClick={() => router.push(`/checkouts/${encodeURIComponent(c.id)}`)}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Stat tile
// ──────────────────────────────────────────────────────────────────────────

function StatTile({ label, value, color, highlight, suffix }: {
  label: string; value: number; color: string; highlight?: boolean; suffix?: string;
}) {
  return (
    <div style={{
      background: "var(--s1)",
      border: `1px solid ${highlight ? color : "var(--b1)"}`,
      borderTop: `2px solid ${color}`,
      borderRadius: 7, padding: "10px 14px",
    }}>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: "var(--t1)" }}>
        {value}{suffix && <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: "'DM Mono',monospace", marginLeft: 4 }}>{suffix}</span>}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Filter tab
// ──────────────────────────────────────────────────────────────────────────

function FilterTab({ label, count, active, onClick, highlight }: {
  label: string; count: number; active: boolean; onClick: () => void; highlight?: boolean;
}) {
  return (
    <button onClick={onClick} style={{
      background: "transparent", border: "none",
      padding: "9px 14px 11px", cursor: "pointer",
      fontFamily: "'DM Sans',sans-serif", fontSize: 13,
      fontWeight: active ? 600 : 400,
      color: active ? "var(--t1)" : "var(--t3)",
      borderBottom: `2px solid ${active ? "var(--acc)" : "transparent"}`,
      marginBottom: "-1px",
      display: "flex", alignItems: "center", gap: 7,
      whiteSpace: "nowrap",
    }}>
      {label}
      {count > 0 && (
        <span style={{
          fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700,
          padding: "1px 7px", borderRadius: 9,
          background: highlight ? "var(--red)" : "var(--s3)",
          color: highlight ? "var(--bg)" : "var(--t2)",
          minWidth: 18, textAlign: "center",
        }}>{count}</span>
      )}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Checkout row
// ──────────────────────────────────────────────────────────────────────────

function CheckoutRow({ checkout, onClick }: { checkout: ActiveCheckout; onClick: () => void }) {
  const now = Date.now();
  const due = checkout.dueBackISO ? new Date(checkout.dueBackISO).getTime() : 0;
  const isOverdue = due > 0 && due < now && checkout.status !== "returned";
  const isReturned = checkout.status === "returned";

  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left",
      background: "var(--s1)",
      border: `1px solid ${isOverdue ? "var(--red)" : "var(--b1)"}`,
      borderLeft: `3px solid ${isOverdue ? "var(--red)" : isReturned ? "var(--green)" : "var(--amber)"}`,
      borderRadius: 8,
      padding: "14px 16px",
      cursor: "pointer",
      transition: "background 0.12s, transform 0.12s",
    }}
    onMouseEnter={e => { e.currentTarget.style.background = "var(--s2)"; }}
    onMouseLeave={e => { e.currentTarget.style.background = "var(--s1)"; }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "var(--s3)", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700,
          color: checkout.color,
        }}>{checkout.initials}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>
              {checkout.user}
            </span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
              · {(checkout as { project?: string; shoot?: string }).project ?? (checkout as { shoot?: string }).shoot ?? ""}
            </span>
            {isOverdue && (
              <Badge variant="red" style={{ fontSize: 9 }}>OVERDUE</Badge>
            )}
            {isReturned && (
              <Badge variant="green" style={{ fontSize: 9 }}>RETURNED</Badge>
            )}
            {checkout.isGuest && (
              <Badge variant="purple" style={{ fontSize: 9 }}>GUEST</Badge>
            )}
          </div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--t2)", marginBottom: 5 }}>
            {checkout.kits.join(" · ")}
          </div>
          <div style={{ display: "flex", gap: 12, fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", flexWrap: "wrap" }}>
            <span>Out {checkout.checkedOutAtLabel}</span>
            <span>·</span>
            <span style={{ color: isOverdue ? "var(--red)" : "var(--t3)" }}>
              {isReturned ? "Returned" : `Due ${checkout.dueBackLabel}`}
            </span>
            {(checkout.intakePhotoUrls && checkout.intakePhotoUrls.length > 0) && (
              <>
                <span>·</span>
                <span style={{ color: "var(--acc)" }}>📷 {checkout.intakePhotoUrls.length} photo{checkout.intakePhotoUrls.length === 1 ? "" : "s"}</span>
              </>
            )}
          </div>
        </div>

        <div style={{ flexShrink: 0, alignSelf: "center", fontFamily: "'DM Mono',monospace", fontSize: 14, color: "var(--t3)" }}>
          →
        </div>
      </div>
    </button>
  );
}
