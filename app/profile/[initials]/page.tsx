"use client";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import TopNav from "@/components/shared/TopNav";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { formatShootRange } from "@/lib/timezone";
import { toast } from "@/components/ui/Toast";
import AssignToShootModal from "@/components/forms/AssignToShootModal";
import UserAvatar from "@/components/profile/UserAvatar";
import AvatarPickerModal from "@/components/profile/AvatarPickerModal";
import type { AvatarKey } from "@/components/profile/avatarKeys";

const LEVEL_BAR: Record<string, { pct: number; color: string }> = {
  novice: { pct: 25, color: "var(--t3)" },
  familiar: { pct: 50, color: "var(--amber)" },
  proficient: { pct: 75, color: "var(--blue)" },
  master: { pct: 100, color: "var(--acc)" },
};

const COLOR_OPTIONS = [
  "#ecff70", "#7ab5f5", "#b89dfc", "#6dee9f",
  "#fbc25c", "#ff7a7a", "#f476b8", "#3ad6c5",
];

export default function ProfileDetailPage({ params }: { params: Promise<{ initials: string }> }) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const auth = useAuth();
  const { data, hydrated, isReadOnly, updateProfile } = useWorkspace();
  const { initials } = use(params);
  const [assignOpen, setAssignOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  /**
   * Signed-out detection. When the user signs out while on a profile detail
   * page, `data.profiles` empties out and `notFound()` would fire before the
   * redirect-to-login can take effect — landing the user on a 404 page
   * instead. This guard catches that and routes cleanly to /login. Same
   * pattern as iter-17g (asset page) and iter-17h (kit page).
   *
   * The unauthenticated demo flow has no session, so this only matches a
   * genuine signed-out state for an authenticated app.
   */
  const signedOut = auth.supabaseEnabled && !auth.loading && !auth.session;
  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

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

  /*
   * Signed-out — show a brief loading state while the redirect-to-login
   * fires from the useEffect above. Without this we'd notFound() below on
   * the empty profile list and land on a 404 page.
   */
  if (signedOut) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          Signing out...
        </div>
      </div>
    );
  }

  const profile = data.profiles.find(p => p.initials === initials);
  if (!profile) return notFound();

  const nextLevel = profile.expertise.find(e => e.level !== "master");

  // ===== Computed data from real workspace state =====

  // Audit events involving this person — actor matches name
  const profileEvents = data.events
    .filter(e => e.actor === profile.name)
    .slice(0, 20);

  // Projects this person was assigned to
  const profileProjects = data.projects
    .filter(s => s.assignedTeam.includes(profile.initials) || s.leadInitials === profile.initials)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  // Computed collaborators: count co-occurrences with other team members across projects
  const collaboratorCounts = new Map<string, number>();
  for (const project of data.projects) {
    if (!project.assignedTeam.includes(profile.initials)) continue;
    for (const otherInitials of project.assignedTeam) {
      if (otherInitials === profile.initials) continue;
      collaboratorCounts.set(otherInitials, (collaboratorCounts.get(otherInitials) ?? 0) + 1);
    }
  }
  const computedCollaborators = Array.from(collaboratorCounts.entries())
    .map(([initials, sharedProjects]) => {
      const p = data.profiles.find(pp => pp.initials === initials);
      return p ? { name: p.name, initials: p.initials, color: p.color, sharedProjects } : null;
    })
    .filter((x): x is { name: string; initials: string; color: string; sharedProjects: number } => x !== null)
    .sort((a, b) => b.sharedProjects - a.sharedProjects)
    .slice(0, 6);

  // Use real collaborators if available, otherwise the baked-in ones (demo data still has them)
  const collaboratorsToShow = computedCollaborators.length > 0 ? computedCollaborators : profile.frequentCollaborators;

  // Use real projects+events to derive history if profile.history is empty
  const hasRealActivity = profileProjects.length > 0 || profileEvents.length > 0;

  // ===== Edit helpers =====

  function startEdit(field: string, current: string) {
    setEditingField(field);
    setEditValue(current);
  }

  function commitEdit(field: string) {
    if (isReadOnly) { setEditingField(null); return; }
    updateProfile(profile!.id, { [field]: editValue.trim() });
    toast(`${field} updated`);
    setEditingField(null);
  }

  function cancelEdit() {
    setEditingField(null);
    setEditValue("");
  }

  function setColor(color: string) {
    if (isReadOnly) return;
    updateProfile(profile!.id, { color });
    toast("Color updated");
  }

  /**
   * Update this profile's chosen Y2K avatar (iter-30, Phase 2, fixed).
   *
   * Gating: only the logged-in user can change their own avatar. Avatars
   * are identity, not workspace configuration — admins do not override.
   *
   * This is the second line of defense; the picker UI itself is gated on
   * the same condition (the hero avatar isn't clickable when viewing
   * someone else's profile). This handler also refuses to act when called
   * out-of-band (e.g., via browser DevTools by a curious user).
   *
   * The `auth.supabaseEnabled === false` branch permits editing in
   * local-only workspaces where there is no concept of "other users."
   */
  function setAvatar(key: AvatarKey | null) {
    if (isReadOnly) return;

    // Ownership check — Supabase-backed workspaces enforce identity match
    if (auth.supabaseEnabled) {
      const isOwner =
        auth.user?.id !== undefined && profile!.userId === auth.user.id;
      if (!isOwner) {
        toast("You can only change your own avatar");
        setAvatarPickerOpen(false);
        return;
      }
    }

    updateProfile(profile!.id, { avatarKey: key ?? undefined });
    toast(key ? "Avatar updated" : "Avatar removed");
    setAvatarPickerOpen(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TopNav />
      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
        <div style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: isMobile ? "16px 14px 60px" : "28px 28px 80px",
          paddingBottom: `max(${isMobile ? 60 : 80}px, var(--safe-bottom))`,
        }} className="animate-fade-up">

          {/* Back nav */}
          <Link href="/profile" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)", textDecoration: "none", marginBottom: 16, padding: "6px 0", minHeight: 32 }}>
            ← All profiles
          </Link>

          {/* Hero */}
          <div style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "flex-start",
            gap: isMobile ? 14 : 22,
            marginBottom: 24,
          }}>
            {/*
             * Hero avatar. Renders the user's chosen Y2K avatar if set,
             * else falls back to the initials circle (legacy look). Clicking
             * opens the avatar picker — but ONLY for the user viewing their
             * own profile. iter-30 Phase 2 originally allowed anyone with
             * edit access to change anyone's avatar (matched the existing
             * setColor pattern); that's wrong for identity. Avatar belongs
             * to the person, period.
             *
             * Gating logic:
             *   - Read-only viewer (signed-out demo, etc.) → never editable
             *   - Auth disabled (pure localStorage workspace) → editable
             *     (no concept of "other users" in single-device mode)
             *   - Authenticated, viewing OWN profile → editable
             *   - Authenticated, viewing SOMEONE ELSE'S profile → not editable
             *
             * The `profile.userId` field links a profile to a Supabase auth
             * user. When unset (legacy profiles or local-only workspaces)
             * we fall back to the auth-disabled path, which permits editing.
             */}
            {(() => {
              const canEditAvatar =
                !isReadOnly &&
                (!auth.supabaseEnabled ||
                  (auth.user?.id !== undefined && profile.userId === auth.user.id));

              if (canEditAvatar) {
                return (
                  <button
                    onClick={() => setAvatarPickerOpen(true)}
                    aria-label="Change your avatar"
                    style={{
                      padding: 4,
                      borderRadius: profile.avatarKey ? "50%" : 14,
                      border: `2px solid ${profile.color}30`,
                      background: "transparent",
                      cursor: "pointer",
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "transform 0.12s ease, border-color 0.12s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = `${profile.color}60`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${profile.color}30`;
                    }}
                  >
                    <UserAvatar
                      profile={profile}
                      size={isMobile ? 64 : 80}
                    />
                  </button>
                );
              }

              // Not your profile (or read-only) — render as static, no click
              return (
                <div
                  style={{
                    padding: 4,
                    borderRadius: profile.avatarKey ? "50%" : 14,
                    border: `2px solid ${profile.color}30`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <UserAvatar
                    profile={profile}
                    size={isMobile ? 64 : 80}
                  />
                </div>
              );
            })()}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 22 : 28, fontWeight: 800, letterSpacing: -0.5, color: "var(--t1)" }}>{profile.name}</h1>
                {profile.isGuest && <Badge variant="purple">GUEST</Badge>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, flexWrap: "wrap", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)" }}>
                <span>{profile.role}</span>
                <span style={{ color: "var(--t3)" }}>·</span>
                <span>{profile.department}</span>
                {!isMobile && <span style={{ color: "var(--t3)" }}>·</span>}
                {!isMobile && <span>{profile.location}</span>}
                <span style={{ color: "var(--t3)" }}>·</span>
                <span>Since {profile.joinedAt}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
              {profile.email && (
                <a
                  href={`mailto:${profile.email}`}
                  style={{
                    padding: "10px 14px", borderRadius: 6, fontSize: 12,
                    background: "transparent", border: "1px solid var(--b1)",
                    color: "var(--t2)", cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                    flex: isMobile ? 1 : "0 0 auto", minHeight: 40,
                    textDecoration: "none",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                  Message
                </a>
              )}
              {data.managerMode && (
                <button
                  onClick={() => setAssignOpen(true)}
                  style={{
                    padding: "10px 14px", borderRadius: 6, fontSize: 12,
                    background: "var(--acc)", color: "var(--bg)", border: "none",
                    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500, flex: isMobile ? 1 : "0 0 auto", minHeight: 40,
                  }}>
                  Assign to project
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : `repeat(${data.managerMode ? 5 : 3}, 1fr)`,
            gap: isMobile ? 8 : 10,
            marginBottom: 24,
          }}>
            {[
              { label: "Checkouts", value: profile.totalCheckouts, sub: "lifetime", color: "var(--blue)", managerOnly: false },
              { label: "Hours", value: profile.totalHours, sub: "lifetime", color: "var(--blue)", managerOnly: false },
              { label: "Projects / yr", value: profile.shootsWorkedThisYear, sub: "2026 YTD", color: "var(--acc)", managerOnly: false },
              { label: "Condition", value: profile.conditionScore, sub: "return quality", color: profile.conditionScore >= 95 ? "var(--green)" : profile.conditionScore >= 85 ? "var(--amber)" : "var(--red)", managerOnly: true },
              { label: "Reliability", value: profile.reliabilityScore, sub: "on-time", color: profile.reliabilityScore >= 95 ? "var(--green)" : profile.reliabilityScore >= 85 ? "var(--amber)" : "var(--red)", managerOnly: true },
            ]
              .filter(s => !s.managerOnly || data.managerMode)
              .map(s => (
                <Card key={s.label} accentColor={s.color}>
                  <div style={{ padding: isMobile ? "12px 14px" : "14px 16px" }}>
                    <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 22 : 26, fontWeight: 700, letterSpacing: -1, lineHeight: 1, color: "var(--t1)" }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{s.sub}</div>
                  </div>
                </Card>
              ))}
          </div>

          {/* Two column main content */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 320px",
            gap: 18,
          }}>
            {/* LEFT */}
            <div>
              {/* Expertise */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Expertise</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700 }}>Where they shine</div>
                  </div>
                  {nextLevel && !isMobile && (
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t2)" }}>
                      Next milestone: <span style={{ color: "var(--acc)" }}>{nextLevel.category}</span>
                    </div>
                  )}
                </div>
                <Card>
                  {profile.expertise.length === 0 ? (
                    <div style={{ padding: 28, textAlign: "center" }}>
                      <div style={{ fontSize: 22, opacity: 0.4, marginBottom: 10 }}>◇</div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                        Expertise tracking coming soon
                      </div>
                      <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, maxWidth: 380, margin: "0 auto" }}>
                        Once {profile.name.split(" ")[0]} starts checking out gear, we&apos;ll
                        surface their go-to categories, signature assets, and skill
                        levels here automatically.
                      </div>
                    </div>
                  ) : profile.expertise.map((e, i) => (
                    <div key={e.category} style={{ padding: isMobile ? "12px 14px" : "14px 16px", borderBottom: i < profile.expertise.length - 1 ? "1px solid var(--b1)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 600 }}>{e.category}</div>
                          {e.rank === 1 && <Badge variant="green" style={{ fontSize: 9 }}>#1 IN SHOP</Badge>}
                          {e.rank === 2 && <Badge variant="blue" style={{ fontSize: 9 }}>#{e.rank} IN SHOP</Badge>}
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: LEVEL_BAR[e.level].color, textTransform: "capitalize" }}>{e.level}</div>
                      </div>
                      <div style={{ height: 4, background: "var(--s3)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ width: `${LEVEL_BAR[e.level].pct}%`, height: "100%", background: LEVEL_BAR[e.level].color, transition: "width 0.4s ease" }} />
                      </div>
                      <div style={{ display: "flex", gap: isMobile ? 10 : 14, fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t2)", flexWrap: "wrap" }}>
                        <span><span style={{ color: "var(--t3)" }}>Checkouts</span> {e.checkoutCount}</span>
                        <span><span style={{ color: "var(--t3)" }}>Hours</span> {e.hoursLogged}</span>
                        {!isMobile && e.signatureAsset && <span><span style={{ color: "var(--t3)" }}>Signature</span> {e.signatureAsset}</span>}
                        <span style={{ marginLeft: "auto", color: "var(--t3)" }}>{e.lastUsed}</span>
                      </div>
                      {isMobile && e.signatureAsset && (
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t2)", marginTop: 4 }}>
                          <span style={{ color: "var(--t3)" }}>Signature</span> {e.signatureAsset}
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              </div>

              {/* Upcoming projects from workspace */}
              {(() => {
                const upcomingProjects = data.projects.filter(s =>
                  (s.status === "active" || s.status === "scheduled") &&
                  (s.assignedTeam.includes(profile.initials) || s.leadInitials === profile.initials)
                );
                if (upcomingProjects.length === 0) return null;
                return (
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>On the calendar</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Upcoming projects</div>
                    <Card>
                      {upcomingProjects.map((sh, i) => (
                        <div key={sh.id} style={{ padding: isMobile ? "12px 14px" : "14px 16px", borderBottom: i < upcomingProjects.length - 1 ? "1px solid var(--b1)" : "none", display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ width: 4, alignSelf: "stretch", flexShrink: 0, background: sh.status === "active" ? "var(--green)" : "var(--blue)", borderRadius: 2 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600 }}>
                                {sh.title}
                                {sh.leadInitials === profile.initials && <span style={{ color: "var(--acc)", marginLeft: 6, fontSize: 11 }}>★ lead</span>}
                              </div>
                              <Badge variant={sh.status === "active" ? "green" : "blue"}>{sh.status}</Badge>
                            </div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)", marginBottom: sh.notes ? 6 : 0 }}>
                              {sh.client} · {formatShootRange(sh.startsAt, sh.endsAt, data.timezone)}{sh.location ? ` · ${sh.location}` : ""}
                            </div>
                            {sh.notes && (
                              <div style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.5 }}>{sh.notes}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </Card>
                  </div>
                );
              })()}

              {/* History */}
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Activity</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Recent projects</div>
                <Card>
                  {profileProjects.length === 0 && profile.history.length === 0 && (
                    <div style={{ padding: 32, textAlign: "center" }}>
                      <div style={{ fontSize: 22, opacity: 0.4, marginBottom: 10 }}>◇</div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                        No projects yet
                      </div>
                      <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, maxWidth: 380, margin: "0 auto" }}>
                        Once {profile.name.split(" ")[0]} is assigned to a project, it
                        will appear here with the kits used and the outcome.
                      </div>
                    </div>
                  )}
                  {/* Real shoots from workspace data — preferred when available */}
                  {profileProjects.length > 0 && profileProjects.slice(0, 12).map((s, i) => {
                    const statusColor =
                      s.status === "active" ? "var(--green)" :
                      s.status === "scheduled" ? "var(--blue)" :
                      s.status === "completed" ? "var(--t3)" : "var(--red)";
                    const startDate = new Date(s.startsAt);
                    const dateLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(startDate);
                    const isLead = s.leadInitials === profile.initials;
                    return (
                      <div key={s.id} style={{ padding: isMobile ? "12px 14px" : "14px 16px", borderBottom: i < Math.min(profileProjects.length, 12) - 1 ? "1px solid var(--b1)" : "none", display: "flex", gap: 12 }}>
                        <div style={{ width: 4, flexShrink: 0, background: statusColor, borderRadius: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
                            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600 }}>{s.title}</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)" }}>{dateLabel}</div>
                          </div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)", marginBottom: 6 }}>
                            {s.client} · {s.assignedKits.length} kit{s.assignedKits.length !== 1 ? "s" : ""}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            <Badge variant={s.status === "active" ? "green" : s.status === "scheduled" ? "blue" : s.status === "completed" ? "gray" : "red"}>
                              {s.status}
                            </Badge>
                            {isLead && <Badge variant="blue" style={{ fontSize: 9 }}>LEAD</Badge>}
                            {s.assignedKits.slice(0, 3).map(id => {
                              const kit = data.kits.find(k => k.id === id);
                              if (!kit) return null;
                              return (
                                <span key={id} style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t2)", background: "var(--s2)", padding: "2px 7px", borderRadius: 3 }}>
                                  {kit.name}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Demo-baked history fallback (only when no real shoots exist) */}
                  {profileProjects.length === 0 && profile.history.map((h, i) => (
                    <div key={h.id} style={{ padding: isMobile ? "12px 14px" : "14px 16px", borderBottom: i < profile.history.length - 1 ? "1px solid var(--b1)" : "none", display: "flex", gap: 12 }}>
                      <div style={{ width: 4, flexShrink: 0, background: h.incident?.severity === "major" ? "var(--red)" : h.incident?.severity === "minor" ? "var(--amber)" : h.notesAdded ? "var(--acc)" : "var(--b2)", borderRadius: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600 }}>{h.shoot}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)" }}>{h.date}</div>
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)", marginBottom: 6 }}>
                          {h.client} · {h.durationHours}h · {h.kitIds.length} kit{h.kitIds.length !== 1 ? "s" : ""}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {h.kitIds.slice(0, 3).map(id => {
                            const kit = data.kits.find(k => k.id === id);
                            return (
                              <span key={id} style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t2)", background: "var(--s2)", padding: "2px 7px", borderRadius: 3 }}>
                                {kit?.name ?? id}
                              </span>
                            );
                          })}
                          {h.conditionOnReturn !== "none" && (
                            <Badge variant={h.conditionOnReturn === "excellent" ? "green" : h.conditionOnReturn === "good" ? "blue" : h.conditionOnReturn === "fair" ? "amber" : "red"}>
                              returned {h.conditionOnReturn}
                            </Badge>
                          )}
                          {h.notesAdded && <Badge variant="green" style={{ fontSize: 9 }}>+ SOP NOTES</Badge>}
                          {h.incident && (
                            <Badge variant={h.incident.severity === "major" ? "red" : "amber"} style={{ fontSize: 9 }}>
                              {h.incident.severity === "major" ? "INCIDENT" : "minor note"}
                            </Badge>
                          )}
                        </div>
                        {h.incident && (
                          <div style={{ marginTop: 8, padding: "7px 10px", background: h.incident.severity === "major" ? "rgba(255,122,122,0.06)" : "rgba(251,194,92,0.06)", border: `1px solid ${h.incident.severity === "major" ? "rgba(255,122,122,0.2)" : "rgba(251,194,92,0.2)"}`, borderRadius: 5, fontSize: 11, color: h.incident.severity === "major" ? "var(--red)" : "var(--amber)", fontFamily: "'DM Mono', monospace", lineHeight: 1.4 }}>
                            {h.incident.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            </div>

            {/* RIGHT */}
            <div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>At a glance</div>
                <Card>
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, color: "var(--t2)" }}>SOPs contributed</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: profile.sopsContributed > 5 ? "var(--acc)" : "var(--t1)" }}>{profile.sopsContributed}</div>
                  </div>
                  {data.managerMode && (
                    <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 12, color: "var(--t2)" }}>Drift incidents</div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: profile.driftIncidents === 0 ? "var(--green)" : profile.driftIncidents > 2 ? "var(--red)" : "var(--amber)" }}>{profile.driftIncidents}</div>
                    </div>
                  )}
                  <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, color: "var(--t2)" }}>Active badges</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700 }}>{profile.badgeCount}</div>
                  </div>
                </Card>
              </div>

              {profile.frequentCollaborators.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Works often with</div>
                  <Card>
                    {profile.frequentCollaborators.map((c, i) => {
                      const collabProfile = data.profiles.find(p => p.initials === c.initials);
                      return (
                        <Link key={c.name} href={collabProfile ? `/profile/${c.initials}` : "#"} style={{ textDecoration: "none" }}>
                          <div style={{ padding: "12px 14px", borderBottom: i < profile.frequentCollaborators.length - 1 ? "1px solid var(--b1)" : "none", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minHeight: 56 }}>
                            {/*
                             * Collaborator avatar. Prefers the live collaborator
                             * profile (which carries the latest avatarKey) and
                             * falls back to the denormalized c.* fields when no
                             * matching profile exists (e.g., a collaborator who
                             * was removed from the workspace).
                             */}
                            <UserAvatar
                              profile={collabProfile}
                              initials={c.initials}
                              color={c.color}
                              size={32}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, color: "var(--t1)" }}>{c.name}</div>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", marginTop: 1 }}>{c.sharedProjects} shared projects</div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </Card>
                </div>
              )}

              {profile.certifications.length > 0 && (
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Certifications</div>
                  <Card>
                    {profile.certifications.map((c, i) => (
                      <div key={c.name} style={{ padding: "12px 14px", borderBottom: i < profile.certifications.length - 1 ? "1px solid var(--b1)" : "none" }}>
                        <div style={{ fontSize: 12, color: "var(--t1)", marginBottom: 2, lineHeight: 1.4 }}>{c.name}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)" }}>
                          Issued {c.issuedAt}{c.expiresAt ? ` · Expires ${c.expiresAt}` : " · No expiry"}
                        </div>
                      </div>
                    ))}
                  </Card>
                </div>
              )}

              {profile.certifications.length === 0 && profile.expertise.length > 0 && (
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Certifications</div>
                  <Card>
                    <div style={{ padding: 18, textAlign: "center" }}>
                      <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 8 }}>No certifications on file yet</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", lineHeight: 1.5 }}>
                        Based on checkout patterns, consider pursuing certifications for their top expertise areas.
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <AssignToShootModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        profileInitials={profile.initials}
        profileName={profile.name}
      />
      <AvatarPickerModal
        open={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        currentKey={profile.avatarKey}
        onSelect={setAvatar}
      />
    </div>
  );
}
