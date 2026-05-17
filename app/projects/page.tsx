"use client";

/**
 * /projects — Project calendar view (iter-24)
 *
 * Two views switchable via toggle:
 *   - Month: 7-column × 6-row grid with project pills (color-coded by lead)
 *   - Agenda: vertical list grouped by day with full project details
 *
 * Mobile defaults to Agenda (month grid cells get too cramped on phones).
 * Desktop defaults to Month. User can toggle either way.
 *
 * Crew+ can click an empty cell to quick-create a project (title-only,
 * defaults to 9am-5pm on the clicked date). Click an existing project
 * pill to navigate to that project's detail page.
 *
 * Multi-day project pills span across cells within a row with rounded
 * ends. Past projects render at slightly reduced opacity. Today's cell
 * gets a yellow accent ring.
 *
 * NOTE on timezone: calendar math uses the user's LOCAL timezone for
 * cell-to-date mapping. Projects are stored as UTC ISO strings and
 * rendered via formatShootRange() which respects workspace timezone.
 * Mismatch between user local TZ and workspace TZ can cause projects
 * scheduled near midnight to appear on the "wrong" calendar day from
 * the user's perspective. Acceptable for v1; revisit if customers
 * report confusion.
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/shared/TopNav";
import Card from "@/components/ui/Card";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { formatShootRange } from "@/lib/timezone";
import { toast } from "@/components/ui/Toast";
import type { Project } from "@/lib/hooks/workspaceTypes";

type ViewMode = "month" | "agenda";

export default function ProjectsPage() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const auth = useAuth();
  const { hydrated } = useWorkspace();

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

  return <ProjectsPageBody isMobile={isMobile} />;
}

// ──────────────────────────────────────────────────────────────────────────
// Main body — separated to keep hook order stable after the signed-out guard
// ──────────────────────────────────────────────────────────────────────────

function ProjectsPageBody({ isMobile }: { isMobile: boolean }) {
  const auth = useAuth();
  const router = useRouter();
  const { data, addProject } = useWorkspace();

  // Default to agenda on mobile (month grid is too cramped), month on desktop.
  // We store the preference in component state; not persisted across sessions.
  const [view, setView] = useState<ViewMode>(isMobile ? "agenda" : "month");

  // Current month being displayed in the grid. Day = 1 of the chosen month.
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Quick-create popover state. anchored to a specific day cell.
  const [quickCreate, setQuickCreate] = useState<{ date: Date } | null>(null);

  /**
   * canWrite: Crew, Manager, Owner can create/edit projects. Viewer cannot.
   * Demo mode is allowed since the addProject mutator no-ops in demo mode.
   */
  const canWrite = auth.currentRole === "owner"
    || auth.currentRole === "manager"
    || auth.currentRole === "crew";

  /**
   * Project clicks navigate to the detail page (iter-26). Previously this
   * opened ShootDetailModal directly. Now the detail page is the canonical
   * view; users can Edit from there.
   */
  function handleProjectClick(p: Project) {
    router.push(`/projects/${encodeURIComponent(p.id)}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
      <TopNav />
      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "16px 12px" : "28px 24px" }}>

          {/* Header: title + view switcher + month navigation */}
          <PageHeader
            view={view}
            setView={setView}
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            isMobile={isMobile}
            projectCount={data.projects.length}
          />

          {/* Body: month or agenda */}
          {view === "month" ? (
            <MonthView
              currentMonth={currentMonth}
              projects={data.projects}
              profiles={data.profiles}
              timezone={data.timezone}
              isMobile={isMobile}
              canWrite={canWrite}
              onProjectClick={handleProjectClick}
              onEmptyCellClick={(date) => canWrite && setQuickCreate({ date })}
            />
          ) : (
            <AgendaView
              projects={data.projects}
              profiles={data.profiles}
              timezone={data.timezone}
              onProjectClick={handleProjectClick}
            />
          )}

        </div>
      </div>

      {/* Quick-create popover. Renders as fixed-position overlay. */}
      {quickCreate && canWrite && (
        <QuickCreatePopover
          date={quickCreate.date}
          onClose={() => setQuickCreate(null)}
          onCreate={(title) => {
            const start = new Date(quickCreate.date);
            start.setHours(9, 0, 0, 0);
            const end = new Date(quickCreate.date);
            end.setHours(17, 0, 0, 0);
            const newProject: Project = {
              id: `proj-${Date.now()}`,
              title: title.trim() || "Untitled project",
              client: "Internal",
              startsAt: start.toISOString(),
              endsAt: end.toISOString(),
              assignedTeam: [],
              assignedKits: [],
              status: "scheduled",
            };
            addProject(newProject);
            setQuickCreate(null);
            toast(`${newProject.title} scheduled`);
            // Land the user on the detail page to flesh out team/kits/client.
            // Removed the in-popover instruction message because this is now
            // the active flow, not a "see you later" toast.
            router.push(`/projects/${encodeURIComponent(newProject.id)}`);
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Header
// ──────────────────────────────────────────────────────────────────────────

function PageHeader({
  view, setView, currentMonth, setCurrentMonth, isMobile, projectCount,
}: {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  currentMonth: Date;
  setCurrentMonth: (d: Date) => void;
  isMobile: boolean;
  projectCount: number;
}) {
  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: "long", year: "numeric",
  });

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>
          Projects
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
          {projectCount} scheduled
        </div>
      </div>

      {/* Controls row: view switcher (left) + month nav (right, month view only) */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>

        {/* View switcher */}
        <div style={{
          display: "inline-flex", borderRadius: 7,
          border: "1px solid var(--b2)",
          background: "var(--s2)",
          padding: 3,
        }}>
          <ViewSwitcherButton label="Month" active={view === "month"} onClick={() => setView("month")} />
          <ViewSwitcherButton label="Agenda" active={view === "agenda"} onClick={() => setView("agenda")} />
        </div>

        {/* Month navigation — only shows in month view */}
        {view === "month" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <NavButton onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} ariaLabel="Previous month">←</NavButton>
            <button
              onClick={() => {
                const now = new Date();
                setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
              style={{
                padding: "7px 14px", borderRadius: 6,
                background: "transparent",
                border: "1px solid var(--b2)",
                color: "var(--t1)",
                fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 500,
                cursor: "pointer", minHeight: 32,
              }}
            >
              Today
            </button>
            <NavButton onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} ariaLabel="Next month">→</NavButton>
            <div style={{
              fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 600,
              color: "var(--t1)", marginLeft: 10, minWidth: 130, textAlign: "right",
            }}>
              {monthLabel}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ViewSwitcherButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", borderRadius: 5,
      background: active ? "var(--bg)" : "transparent",
      border: "none",
      color: active ? "var(--t1)" : "var(--t3)",
      fontFamily: "'DM Sans',sans-serif", fontSize: 12,
      fontWeight: active ? 600 : 400,
      cursor: "pointer", minHeight: 30,
      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
    }}>{label}</button>
  );
}

function NavButton({ onClick, ariaLabel, children }: { onClick: () => void; ariaLabel: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={ariaLabel} style={{
      width: 32, height: 32, borderRadius: 6,
      background: "transparent",
      border: "1px solid var(--b2)",
      color: "var(--t1)",
      fontFamily: "'DM Mono',monospace", fontSize: 14,
      cursor: "pointer",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>{children}</button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Month view
// ──────────────────────────────────────────────────────────────────────────

function MonthView({
  currentMonth, projects, profiles, timezone, isMobile, canWrite,
  onProjectClick, onEmptyCellClick,
}: {
  currentMonth: Date;
  projects: Project[];
  profiles: { initials: string; name: string; color: string }[];
  timezone: string;
  isMobile: boolean;
  canWrite: boolean;
  onProjectClick: (p: Project) => void;
  onEmptyCellClick: (date: Date) => void;
}) {
  /**
   * Build the 42-cell grid (6 rows × 7 cols) covering the month plus
   * leading days from the previous month and trailing days from the next
   * month to fill the grid.
   */
  const gridCells = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);

  /**
   * Map of profile initials → color, for fast lookup when rendering pills.
   * Default color for unassigned/missing-lead projects: muted gray.
   */
  const profileColorMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.initials, p.color);
    return m;
  }, [profiles]);

  /**
   * Group projects by which row(s) of the grid they touch. For each row,
   * compute the span (start cell index → end cell index) so multi-day
   * pills can render correctly.
   *
   * Cells are zero-indexed within a row (0-6). A project spanning cells
   * 2-5 renders a single pill from column 2 to column 5. If the project
   * also touches the next row, `continuesRight` is true on this row's
   * pill so the right edge stays flat.
   */
  const rowGroups = useMemo(
    () => groupProjectsByRow(projects, gridCells),
    [projects, gridCells]
  );

  /**
   * Vertical slot allocation per row. Within a row, projects need to
   * stack so they don't overlap visually. We greedily assign each pill
   * the lowest free vertical slot.
   *
   * Per-row max slots determines that row's height (clamped to a cap —
   * anything beyond shows a "+N more" indicator in the cells).
   */
  const rowsWithSlots = useMemo(() => allocateSlots(rowGroups), [rowGroups]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Card>
      <div>
        {/* Day-of-week header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          borderBottom: "1px solid var(--b1)",
        }}>
          {dayHeaders.map(d => (
            <div key={d} style={{
              padding: "10px 8px", textAlign: "center",
              fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
              color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase",
            }}>{isMobile ? d[0] : d}</div>
          ))}
        </div>

        {/* 6 rows × 7 cols grid */}
        {rowsWithSlots.map((row, rowIdx) => (
          <MonthRow
            key={rowIdx}
            rowIdx={rowIdx}
            cells={gridCells.slice(rowIdx * 7, rowIdx * 7 + 7)}
            currentMonth={currentMonth}
            todayTime={todayTime}
            pills={row.pills}
            maxSlots={row.maxSlots}
            profileColorMap={profileColorMap}
            isMobile={isMobile}
            canWrite={canWrite}
            timezone={timezone}
            onProjectClick={onProjectClick}
            onEmptyCellClick={onEmptyCellClick}
          />
        ))}
      </div>
    </Card>
  );
}

function MonthRow({
  rowIdx, cells, currentMonth, todayTime, pills, maxSlots,
  profileColorMap, isMobile, canWrite, timezone,
  onProjectClick, onEmptyCellClick,
}: {
  rowIdx: number;
  cells: Date[];
  currentMonth: Date;
  todayTime: number;
  pills: AllocatedPill[];
  maxSlots: number;
  profileColorMap: Map<string, string>;
  isMobile: boolean;
  canWrite: boolean;
  timezone: string;
  onProjectClick: (p: Project) => void;
  onEmptyCellClick: (d: Date) => void;
}) {
  // Each row needs enough vertical space for its pills. Base height plus
  // pill rows. On mobile, cap visible pills more aggressively.
  const VISIBLE_SLOT_CAP = isMobile ? 2 : 4;
  const visibleSlots = Math.min(maxSlots, VISIBLE_SLOT_CAP);
  const PILL_HEIGHT = 20;
  const PILL_GAP = 2;
  const PADDING_TOP = isMobile ? 24 : 28;  // for date number
  const PADDING_BOTTOM = 6;
  const rowMinHeight = PADDING_TOP + visibleSlots * (PILL_HEIGHT + PILL_GAP) + PADDING_BOTTOM;

  return (
    <div style={{
      position: "relative",
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      borderBottom: rowIdx < 5 ? "1px solid var(--b1)" : "none",
      minHeight: rowMinHeight,
    }}>
      {cells.map((cellDate, colIdx) => {
        const cellTime = cellDate.getTime();
        const isToday = cellTime === todayTime;
        const isCurrentMonth = cellDate.getMonth() === currentMonth.getMonth();
        // Compute hidden pill count (pills assigned to a slot beyond cap)
        const hiddenCount = pills.filter(p =>
          colIdx >= p.startCol && colIdx <= p.endCol && p.slot >= VISIBLE_SLOT_CAP
        ).length;

        return (
          <DayCell
            key={colIdx}
            date={cellDate}
            isToday={isToday}
            isCurrentMonth={isCurrentMonth}
            hiddenCount={hiddenCount}
            isMobile={isMobile}
            canWrite={canWrite}
            onEmptyClick={() => onEmptyCellClick(cellDate)}
          />
        );
      })}

      {/* Pill layer — absolutely positioned over the cells */}
      <div style={{
        position: "absolute",
        top: PADDING_TOP, left: 0, right: 0, bottom: PADDING_BOTTOM,
        pointerEvents: "none",  // pass clicks through to cells unless on a pill
      }}>
        {pills.filter(p => p.slot < VISIBLE_SLOT_CAP).map((pill, i) => {
          const startPct = (pill.startCol / 7) * 100;
          const widthPct = ((pill.endCol - pill.startCol + 1) / 7) * 100;
          const color = pill.project.leadInitials
            ? profileColorMap.get(pill.project.leadInitials) ?? "var(--t3)"
            : "var(--t3)";
          const now = Date.now();
          const projectEnd = pill.project.endsAt ? new Date(pill.project.endsAt).getTime() : new Date(pill.project.startsAt).getTime();
          const isPast = projectEnd < now;
          const isActive = pill.project.status === "active";

          return (
            <button
              key={`${pill.project.id}-${i}`}
              onClick={(e) => { e.stopPropagation(); onProjectClick(pill.project); }}
              style={{
                position: "absolute",
                top: pill.slot * (PILL_HEIGHT + PILL_GAP),
                left: `calc(${startPct}% + 3px)`,
                width: `calc(${widthPct}% - 6px)`,
                height: PILL_HEIGHT,
                background: isActive
                  ? color
                  : `color-mix(in srgb, ${color} 22%, var(--s2))`,
                border: `1px solid ${color}`,
                borderRadius: pill.continuesLeft && pill.continuesRight ? "0"
                  : pill.continuesLeft ? "0 4px 4px 0"
                  : pill.continuesRight ? "4px 0 0 4px"
                  : "4px",
                borderLeft: pill.continuesLeft ? "none" : `1px solid ${color}`,
                borderRight: pill.continuesRight ? "none" : `1px solid ${color}`,
                padding: "0 7px",
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 11, fontWeight: 600,
                color: isActive ? "var(--bg)" : "var(--t1)",
                textAlign: "left",
                cursor: "pointer",
                opacity: isPast ? 0.55 : 1,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                pointerEvents: "auto",
                display: "flex", alignItems: "center", gap: 5,
              }}
              title={`${pill.project.title} — ${formatShootRange(pill.project.startsAt, pill.project.endsAt, timezone)}`}
            >
              {/* Only show title on the FIRST segment of a multi-row span */}
              {!pill.continuesLeft && (
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {pill.project.title}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayCell({
  date, isToday, isCurrentMonth, hiddenCount, isMobile, canWrite, onEmptyClick,
}: {
  date: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
  hiddenCount: number;
  isMobile: boolean;
  canWrite: boolean;
  onEmptyClick: () => void;
}) {
  return (
    <div
      onClick={canWrite ? onEmptyClick : undefined}
      style={{
        position: "relative",
        borderRight: date.getDay() < 6 ? "1px solid var(--b1)" : "none",
        padding: isMobile ? "5px 6px" : "6px 8px",
        cursor: canWrite ? "pointer" : "default",
        background: isCurrentMonth ? "transparent" : "color-mix(in srgb, var(--s2) 30%, transparent)",
        transition: "background 0.12s",
      }}
      onMouseEnter={canWrite ? (e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--acc) 4%, transparent)"; } : undefined}
      onMouseLeave={(e) => { e.currentTarget.style.background = isCurrentMonth ? "transparent" : "color-mix(in srgb, var(--s2) 30%, transparent)"; }}
    >
      {/* Date number */}
      <div style={{
        display: "inline-flex",
        alignItems: "center", justifyContent: "center",
        minWidth: 22, height: 22,
        borderRadius: isToday ? 11 : 0,
        background: isToday ? "var(--acc)" : "transparent",
        color: isToday ? "var(--bg)" : isCurrentMonth ? "var(--t1)" : "var(--t3)",
        fontFamily: "'DM Mono',monospace",
        fontSize: isMobile ? 11 : 12,
        fontWeight: isToday ? 700 : 500,
        padding: isToday ? "0 6px" : "0",
      }}>
        {date.getDate()}
      </div>

      {/* +N more indicator at bottom of cell, if overflow */}
      {hiddenCount > 0 && (
        <div style={{
          position: "absolute",
          bottom: 4, left: 6, right: 6,
          fontFamily: "'DM Mono',monospace", fontSize: 9,
          color: "var(--t3)",
          textAlign: "center",
        }}>
          +{hiddenCount} more
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Agenda view
// ──────────────────────────────────────────────────────────────────────────

function AgendaView({
  projects, profiles, timezone, onProjectClick,
}: {
  projects: Project[];
  profiles: { initials: string; name: string; color: string }[];
  timezone: string;
  onProjectClick: (p: Project) => void;
}) {
  /**
   * Group projects by day. Each group's key is the start date in
   * YYYY-MM-DD local format. Order: chronologically ascending, but the
   * agenda CAN show past projects too — they just render below today.
   *
   * We split into upcoming/today and past, render upcoming first.
   */
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  const sorted = useMemo(
    () => [...projects].sort((a, b) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    ),
    [projects]
  );

  const upcoming = useMemo(
    () => sorted.filter(p => new Date(p.startsAt).getTime() >= todayTime),
    [sorted, todayTime]
  );
  const past = useMemo(
    () => sorted.filter(p => new Date(p.startsAt).getTime() < todayTime).reverse(),
    [sorted, todayTime]
  );

  const profileColorMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.initials, p.color);
    return m;
  }, [profiles]);

  if (projects.length === 0) {
    return (
      <Card>
        <div style={{
          padding: "48px 24px", textAlign: "center",
          color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 12,
        }}>
          No projects scheduled. Switch to Month view and click any day to add one.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {upcoming.length > 0 && (
        <AgendaSection
          label="Upcoming"
          projects={upcoming}
          profileColorMap={profileColorMap}
          timezone={timezone}
          onProjectClick={onProjectClick}
        />
      )}
      {past.length > 0 && (
        <AgendaSection
          label="Past"
          projects={past}
          profileColorMap={profileColorMap}
          timezone={timezone}
          onProjectClick={onProjectClick}
          dimmed
        />
      )}
    </div>
  );
}

function AgendaSection({
  label, projects, profileColorMap, timezone, onProjectClick, dimmed,
}: {
  label: string;
  projects: Project[];
  profileColorMap: Map<string, string>;
  timezone: string;
  onProjectClick: (p: Project) => void;
  dimmed?: boolean;
}) {
  // Group consecutive projects sharing the same calendar date
  const groups = useMemo(() => {
    const result: { dateKey: string; date: Date; items: Project[] }[] = [];
    for (const p of projects) {
      const d = new Date(p.startsAt);
      const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const last = result[result.length - 1];
      if (last && last.dateKey === dateKey) {
        last.items.push(p);
      } else {
        result.push({ dateKey, date: d, items: [p] });
      }
    }
    return result;
  }, [projects]);

  return (
    <div style={{ opacity: dimmed ? 0.7 : 1 }}>
      <div style={{
        fontFamily: "'DM Mono',monospace", fontSize: 10,
        color: "var(--t3)", letterSpacing: "0.1em",
        textTransform: "uppercase", marginBottom: 10, paddingLeft: 4,
      }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {groups.map(g => (
          <Card key={g.dateKey}>
            <div style={{ padding: "12px 16px" }}>
              <div style={{
                display: "flex", alignItems: "baseline", gap: 10,
                marginBottom: 10, paddingBottom: 8,
                borderBottom: "1px solid var(--b1)",
              }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>
                  {g.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                  {g.items.length} project{g.items.length === 1 ? "" : "s"}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {g.items.map(p => (
                  <AgendaRow
                    key={p.id}
                    project={p}
                    color={p.leadInitials ? profileColorMap.get(p.leadInitials) ?? "var(--t3)" : "var(--t3)"}
                    timezone={timezone}
                    onClick={() => onProjectClick(p)}
                  />
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AgendaRow({
  project, color, timezone, onClick,
}: {
  project: Project;
  color: string;
  timezone: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      display: "flex", gap: 10, alignItems: "stretch",
      width: "100%", textAlign: "left",
      background: "transparent", border: "none",
      padding: "8px 10px", borderRadius: 6,
      cursor: "pointer",
      transition: "background 0.12s",
    }}
    onMouseEnter={e => { e.currentTarget.style.background = "var(--s2)"; }}
    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
      {/* Color stripe */}
      <div style={{ width: 3, background: color, borderRadius: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>
            {project.title}
          </span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
            · {project.client}
          </span>
          {project.status === "active" && (
            <span style={{
              fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
              padding: "1px 6px", borderRadius: 3, letterSpacing: "0.05em",
              background: "rgba(236,255,112,0.12)", color: "var(--acc)",
              textTransform: "uppercase",
            }}>active</span>
          )}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t2)" }}>
          {formatShootRange(project.startsAt, project.endsAt, timezone)}
          {project.location && <span style={{ marginLeft: 8 }}>📍 {project.location}</span>}
          {project.assignedTeam.length > 0 && <span style={{ marginLeft: 8 }}>· {project.assignedTeam.length} team</span>}
          {project.assignedKits.length > 0 && <span style={{ marginLeft: 4 }}>· {project.assignedKits.length} kit{project.assignedKits.length === 1 ? "" : "s"}</span>}
        </div>
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Quick-create popover
// ──────────────────────────────────────────────────────────────────────────

function QuickCreatePopover({
  date, onClose, onCreate,
}: {
  date: Date;
  onClose: () => void;
  onCreate: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  /*
   * Click-outside-to-close, fixed iter-26. Uses the same mousedown/mouseup
   * pattern as the canonical Modal component: only close when BOTH the
   * mousedown AND the mouseup landed on the overlay. Prevents the modal
   * from disappearing when a user is highlighting text and the cursor
   * drifts outside before they release.
   */
  const mouseDownOnOverlayRef = useRef(false);

  function handleOverlayMouseDown(e: React.MouseEvent) {
    mouseDownOnOverlayRef.current = e.target === e.currentTarget;
  }
  function handleOverlayMouseUp(e: React.MouseEvent) {
    const releasedOnOverlay = e.target === e.currentTarget;
    if (releasedOnOverlay && mouseDownOnOverlayRef.current) {
      onClose();
    }
    mouseDownOnOverlayRef.current = false;
  }

  return (
    <div
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          background: "var(--s1)",
          border: "1px solid var(--b2)",
          borderRadius: 10,
          maxWidth: 380, width: "100%", padding: 20,
        }}
      >
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
          Schedule project
        </div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 16 }}>
          {dateLabel}
        </div>

        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && title.trim()) onCreate(title);
          }}
          placeholder="Project title"
          style={{
            width: "100%", padding: "10px 12px",
            background: "var(--s2)", border: "1px solid var(--b2)",
            borderRadius: 6, color: "var(--t1)",
            fontFamily: "'DM Sans',sans-serif", fontSize: 13,
            outline: "none", marginBottom: 14, boxSizing: "border-box",
          }}
        />

        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginBottom: 14, lineHeight: 1.5 }}>
          Defaults to 9:00 AM – 5:00 PM on this date. Click the project to add team, kits, client, and other details.
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "9px 14px", borderRadius: 6,
            background: "transparent", border: "1px solid var(--b2)",
            color: "var(--t1)", cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif", fontSize: 12,
          }}>Cancel</button>
          <button
            disabled={!title.trim()}
            onClick={() => onCreate(title)}
            style={{
              padding: "9px 16px", borderRadius: 6,
              background: title.trim() ? "var(--acc)" : "var(--s3)",
              color: title.trim() ? "var(--bg)" : "var(--t3)",
              border: "none",
              cursor: title.trim() ? "pointer" : "not-allowed",
              fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700,
            }}>Add project</button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Calendar math helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Build a 42-cell array of Date objects for a month grid.
 * Cells start from the Sunday of the week containing the 1st of the month
 * and continue for 6 weeks (42 cells). Some cells fall in the previous or
 * next month — they're styled differently (current-month detection via
 * date.getMonth() === month.getMonth()).
 *
 * All dates are at midnight local time so equality comparisons against
 * today work cleanly.
 */
function buildMonthGrid(monthStart: Date): Date[] {
  const firstOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const dayOfWeek = firstOfMonth.getDay();  // 0 = Sunday
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - dayOfWeek);
  gridStart.setHours(0, 0, 0, 0);

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function addMonths(d: Date, delta: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + delta);
  return r;
}

/**
 * For each row of the grid, find all projects that touch any cell in that row.
 * Compute the start/end columns within the row and whether the project
 * continues into adjacent rows.
 *
 * The result is consumed by allocateSlots to determine vertical stacking.
 */
interface RowPill {
  project: Project;
  startCol: number;  // 0-6
  endCol: number;    // 0-6 inclusive
  continuesLeft: boolean;   // true if pill continues from previous row
  continuesRight: boolean;  // true if pill continues into next row
}

function groupProjectsByRow(projects: Project[], gridCells: Date[]): RowPill[][] {
  const rows: RowPill[][] = [[], [], [], [], [], []];

  for (const project of projects) {
    const start = new Date(project.startsAt);
    start.setHours(0, 0, 0, 0);
    const end = project.endsAt ? new Date(project.endsAt) : new Date(project.startsAt);
    end.setHours(0, 0, 0, 0);

    const startTime = start.getTime();
    const endTime = end.getTime();

    // For each row, find the intersection of [startTime, endTime] with the
    // row's date range. If non-empty, add a RowPill.
    for (let rowIdx = 0; rowIdx < 6; rowIdx++) {
      const rowStart = gridCells[rowIdx * 7].getTime();
      const rowEnd = gridCells[rowIdx * 7 + 6].getTime();

      if (endTime < rowStart || startTime > rowEnd) continue;  // no overlap

      const intersectStart = Math.max(startTime, rowStart);
      const intersectEnd = Math.min(endTime, rowEnd);

      // Compute col indices within the row
      const startCol = Math.round((intersectStart - rowStart) / (24 * 60 * 60 * 1000));
      const endCol = Math.round((intersectEnd - rowStart) / (24 * 60 * 60 * 1000));

      rows[rowIdx].push({
        project,
        startCol: Math.max(0, Math.min(6, startCol)),
        endCol: Math.max(0, Math.min(6, endCol)),
        continuesLeft: startTime < rowStart,
        continuesRight: endTime > rowEnd,
      });
    }
  }

  return rows;
}

/**
 * For each row, greedily assign vertical slots to pills so they don't
 * overlap horizontally. Pills are sorted by start column ascending, then
 * by duration descending (longer pills get lower slots so they're more
 * visible).
 */
interface AllocatedPill extends RowPill { slot: number; }

function allocateSlots(rowGroups: RowPill[][]): { pills: AllocatedPill[]; maxSlots: number }[] {
  return rowGroups.map(rowPills => {
    // Sort by start col, then by duration desc
    const sorted = [...rowPills].sort((a, b) => {
      if (a.startCol !== b.startCol) return a.startCol - b.startCol;
      return (b.endCol - b.startCol) - (a.endCol - a.startCol);
    });

    // slotEndCol[i] = the last endCol used in slot i (or -1 if free)
    const slotEndCol: number[] = [];
    const allocated: AllocatedPill[] = [];

    for (const pill of sorted) {
      // Find lowest slot whose end < pill.startCol
      let slot = slotEndCol.findIndex(end => end < pill.startCol);
      if (slot === -1) {
        slot = slotEndCol.length;
        slotEndCol.push(pill.endCol);
      } else {
        slotEndCol[slot] = pill.endCol;
      }
      allocated.push({ ...pill, slot });
    }

    return { pills: allocated, maxSlots: slotEndCol.length };
  });
}
