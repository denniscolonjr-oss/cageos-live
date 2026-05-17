"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";
import type { Project, ActiveCheckout } from "@/lib/hooks/workspaceTypes";
import { formatShootRange } from "@/lib/timezone";
import { useAuth } from "@/lib/supabase/AuthContext";
import CameraCapture from "@/components/shared/CameraCapture";
import ProceduresSection from "@/components/shared/ProceduresSection";
import { getSOPsForKit } from "@/lib/sopMatching";

type Flow = "menu" | "checkout" | "return";
type CheckoutStep = 1 | 2 | 3 | 4 | 5;

interface KioskUser {
  name: string;
  role: string;
  initials: string;
  color: string;
  isGuest?: boolean;
}

export default function KioskPage() {
  const isMobile = useIsMobile();
  const { data, hydrated, isReadOnly, checkoutKits, returnCheckout, getBlockingFlags } = useWorkspace();
  const { activeWorkspaceId, currentRole } = useAuth();
  const [flow, setFlow] = useState<Flow>("menu");

  // Checkout state
  const [step, setStep] = useState<CheckoutStep>(1);
  const [user, setUser] = useState<KioskUser | null>(null);
  const [shoot, setShoot] = useState<Project | null>(null);
  /**
   * Condition check photos for this checkout/check-in. Keyed by slot id
   * ("photo1" | "photo2"). Holds the uploaded Supabase Storage public URL
   * once the user captures + confirms a photo for that slot. Empty = slot
   * not yet captured. Both slots remain optional throughout the flow.
   */
  const [photos, setPhotos] = useState<Record<string, string>>({});
  /**
   * Which slot is currently being captured. null = camera not open.
   * When non-null, CameraCapture renders fullscreen until the user confirms,
   * cancels, or hits the back button.
   */
  const [activeCameraSlot, setActiveCameraSlot] = useState<string | null>(null);
  const [rating, setRating] = useState("good");
  const [animDir, setAnimDir] = useState<"right" | "left">("right");
  const [expandedKits, setExpandedKits] = useState<Record<string, boolean>>({});
  const [createdCheckout, setCreatedCheckout] = useState<ActiveCheckout | null>(null);
  const [selectedKitIds, setSelectedKitIds] = useState<Set<string>>(new Set());
  const [kitSearch, setKitSearch] = useState("");
  const badgeInputRef = useRef<HTMLInputElement>(null);

  // Return state
  const [returnUser, setReturnUser] = useState<KioskUser | null>(null);

  useEffect(() => {
    if (flow === "checkout" && step === 1 && !isMobile) badgeInputRef.current?.focus();
  }, [flow, step, isMobile]);

  // When a shoot is selected, preselect its assigned kits (those still available)
  useEffect(() => {
    if (shoot && shoot.assignedKits.length > 0) {
      const eligible = shoot.assignedKits.filter(id => {
        const kit = data.kits.find(k => k.id === id);
        return kit && kit.status !== "out";
      });
      setSelectedKitIds(new Set(eligible));
    } else {
      setSelectedKitIds(new Set());
    }
  }, [shoot, data.kits]);

  function goStep(next: CheckoutStep) {
    setAnimDir(next > step ? "right" : "left");
    setStep(next);
  }

  function selectUser(u: KioskUser) {
    setUser(u);
    goStep(2);
  }

  function selectShoot(s: Project) { setShoot(s); }
  function toggleKit(id: string) { setExpandedKits(prev => ({ ...prev, [id]: !prev[id] })); }
  function toggleKitSelected(id: string) {
    setSelectedKitIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  /** Open the camera overlay for the given slot. The CameraCapture
   *  component handles the rest (preview, shutter, confirm, upload), and
   *  calls back into `handleCameraCapture` below with the public URL once
   *  the user confirms. */
  function openCameraForSlot(slotId: string) {
    setActiveCameraSlot(slotId);
  }

  /** Called by CameraCapture after a photo is captured AND successfully
   *  uploaded to Supabase Storage. Stores the URL on the matching slot
   *  and closes the camera overlay. */
  function handleCameraCapture(slotId: string, publicUrl: string) {
    setPhotos(prev => ({ ...prev, [slotId]: publicUrl }));
    setActiveCameraSlot(null);
    toast("Photo captured", { variant: "success" });
  }

  function resetCheckout() {
    setStep(1); setUser(null); setShoot(null); setPhotos({}); setRating("good");
    setExpandedKits({}); setCreatedCheckout(null); setSelectedKitIds(new Set()); setKitSearch("");
  }
  function resetReturn() { setReturnUser(null); }

  function backToMenu() {
    setFlow("menu");
    resetCheckout();
    resetReturn();
  }

  /**
   * All workspace profiles shown as tappable user cards on step 1 of the
   * kiosk flow. Previously sliced to the first 4 for the demo seed — that
   * cap is gone now so teams of any size show all members. The render
   * below uses a responsive grid that wraps; for very large teams the
   * container scrolls vertically inside the kiosk Card.
   */
  const kioskUsers: KioskUser[] = data.profiles.map(p => ({
    name: p.name, role: p.role, initials: p.initials, color: p.color, isGuest: p.isGuest,
  }));

  // All kits not currently checked out, optionally filtered by search
  const allAvailableKits = data.kits
    .filter(k => k.status !== "out")
    .filter(k => kitSearch === "" ||
      k.name.toLowerCase().includes(kitSearch.toLowerCase()) ||
      k.barcode.toLowerCase().includes(kitSearch.toLowerCase()));

  // Kits the user has selected for this checkout (from full workspace, not filtered list)
  const kitsForCheckout = data.kits.filter(k => selectedKitIds.has(k.id));

  /**
   * SOPs surfaced during checkout — iter-27c.
   *
   * Aggregated across all currently-selected kits, deduplicated. Reactive
   * to selectedKitIds changes (the dep array forces fresh computation when
   * a user backtracks to step 3 and changes their kit selection).
   *
   * iter-27c-fix: previously computed inline inside step 4's JSX via an
   * IIFE which can stale-cache across React's batched updates. Lifting
   * to useMemo with explicit deps guarantees the panel reflects the
   * CURRENT selection on every render.
   *
   * Returns an array of SOPs (deduped by id, preserving the order from
   * getSOPsForKit which sorts by lastEditedAt desc).
   */
  const surfacedSOPs = useMemo(() => {
    const seen = new Map<string, typeof data.sops[number]>();
    for (const kit of kitsForCheckout) {
      for (const sop of getSOPsForKit(kit, data.sops)) {
        if (!seen.has(sop.id)) seen.set(sop.id, sop);
      }
    }
    return Array.from(seen.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKitIds, data.kits, data.sops]);

  // The kits assigned to the active shoot (for visual grouping)
  const shootAssignedKitIds = new Set(shoot?.assignedKits ?? []);

  // For return: find active checkouts under the selected user (or all if no user)
  const activeForUser = returnUser
    ? data.checkouts.filter(c => {
        const isActive = c.status === "active" || c.status === "overdue";
        const initialsMatch = "initials" in c && c.initials === returnUser.initials;
        return isActive && initialsMatch;
      })
    : data.checkouts.filter(c => c.status === "active" || c.status === "overdue");

  const animClass = animDir === "right" ? "animate-slide-right" : "animate-slide-left";
  const needsSetup = !isReadOnly && (data.kits.length === 0 || data.profiles.length === 0);

  if (!hydrated) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          Loading workspace...
        </div>
      </div>
    );
  }

  if (needsSetup) {
    const teamReady = data.profiles.length > 0;
    const kitsReady = data.kits.length > 0;
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "20px 14px" : "40px 28px", background: "var(--bg)" }}>
          <div style={{ maxWidth: 620, margin: "0 auto" }}>
            <Card>
              <div style={{ padding: isMobile ? "28px 20px" : "36px 32px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                  <div style={{ width: 48, height: 48, background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>⬡</div>
                  <div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--acc)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>Kiosk setup</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 20 : 24, fontWeight: 700, letterSpacing: -0.5 }}>Finish setup to enable checkouts</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 22 }}>
                  The Kiosk is the in-shop checkout terminal. It runs on a tablet at the cage door. Before it can run, your workspace needs:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
                  <SetupRow done={teamReady} num={1} title={`At least one team member${teamReady ? ` · ${data.profiles.length} added` : ""}`} desc="Crew, freelancers, or guest token holders." actionLabel={teamReady ? null : "Add team member →"} />
                  <SetupRow done={kitsReady} num={2} title={`At least one kit${kitsReady ? ` · ${data.kits.length} built` : ""}`} desc={data.assets.length === 0 ? "You'll need to add some assets first — kits are made of assets." : "Kits group related assets so crew can check them out in one tap."} actionLabel={kitsReady ? null : (data.assets.length === 0 ? "Add assets first →" : "Build a kit →")} />
                </div>
                <div style={{ padding: "12px 14px", background: "rgba(90,160,240,0.06)", border: "1px solid rgba(90,160,240,0.2)", borderRadius: 7, fontSize: 11, color: "var(--blue)", fontFamily: "'DM Mono',monospace", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--t1)" }}>Tip:</strong> Switch to the Demo workspace using the chip in the top right to see the kiosk fully working.
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ================== MENU ==================
  if (flow === "menu") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? 16 : 24, background: "var(--bg)" }}>
          <div style={{ width: "100%", maxWidth: 540, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ textAlign: "center", marginBottom: isMobile ? 8 : 16 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 22 : 28, fontWeight: 800, letterSpacing: -1, marginBottom: 6 }}>Kiosk</div>
              <div style={{ fontSize: 13, color: "var(--t2)" }}>Pick what you&apos;re here to do.</div>
            </div>

            <button onClick={() => setFlow("checkout")} style={{
              background: "var(--s1)", border: "1px solid var(--b1)",
              borderRadius: 12, padding: "20px 22px",
              cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 14,
              fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s",
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: "var(--acc)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>↗</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: "var(--t1)", marginBottom: 3 }}>Checking out</div>
                <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>Take gear out for a project</div>
              </div>
              <div style={{ fontSize: 18, color: "var(--t3)", flexShrink: 0 }}>→</div>
            </button>

            <button onClick={() => setFlow("return")} style={{
              background: "var(--s1)", border: "1px solid var(--b1)",
              borderRadius: 12, padding: "20px 22px",
              cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 14,
              fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s",
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: "var(--s3)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>↙</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: "var(--t1)", marginBottom: 3 }}>Returning gear</div>
                <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>
                  {data.checkouts.filter(c => c.status === "active" || c.status === "overdue").length} active checkout{data.checkouts.filter(c => c.status === "active" || c.status === "overdue").length === 1 ? "" : "s"} right now
                </div>
              </div>
              <div style={{ fontSize: 18, color: "var(--t3)", flexShrink: 0 }}>→</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================== RETURN FLOW ==================
  if (flow === "return") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "center", padding: isMobile ? 0 : 24, background: "var(--bg)", overflow: "hidden" }}>
          <div style={{
            width: "100%", maxWidth: isMobile ? "100%" : 540,
            background: isMobile ? "var(--bg)" : "var(--s1)",
            border: isMobile ? "none" : "1px solid var(--b1)",
            borderRadius: isMobile ? 0 : 16,
            overflow: "hidden", display: "flex", flexDirection: "column",
            height: isMobile ? "100%" : "auto",
            maxHeight: isMobile ? "100%" : "calc(100vh - 110px)",
          }}>
            <KioskHeader title="Returning gear" onBack={backToMenu} />
            <div style={{ flex: 1, padding: isMobile ? "20px 18px" : "24px 22px", overflowY: "auto" }}>
              {!returnUser ? (
                <>
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 20 : 18, fontWeight: 700, marginBottom: 6 }}>Who&apos;s returning gear?</div>
                    <div style={{ fontSize: 13, color: "var(--t2)" }}>Pick your name to see what you&apos;ve got out.</div>
                  </div>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
                    gap: isMobile ? 10 : 7,
                  }}>
                    {kioskUsers.map(u => (
                      <button key={u.name} onClick={() => setReturnUser(u)} style={{
                        background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 8,
                        padding: isMobile ? "14px 12px" : "10px 12px",
                        cursor: "pointer", textAlign: "left",
                        fontFamily: "'DM Sans',sans-serif", minHeight: isMobile ? 64 : "auto",
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)" }}>{u.name}</div>
                        <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Mono',monospace", marginTop: 3 }}>{u.role}</div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 9, padding: 14, display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--s3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: returnUser.color, flexShrink: 0 }}>{returnUser.initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Syne',sans-serif" }}>{returnUser.name}</div>
                      <div style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: "var(--t2)", marginTop: 2 }}>
                        {activeForUser.length} item{activeForUser.length === 1 ? "" : "s"} checked out
                      </div>
                    </div>
                    <button onClick={() => setReturnUser(null)} style={{ background: "none", border: "none", color: "var(--t3)", fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>Change</button>
                  </div>

                  {activeForUser.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 0" }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Nothing to return</div>
                      <div style={{ fontSize: 12, color: "var(--t2)" }}>{returnUser.name.split(" ")[0]} has no active checkouts right now.</div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Active checkouts</div>
                      {activeForUser.map(co => (
                        <div key={co.id} style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 9, padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{(co as { project?: string; shoot?: string }).project ?? (co as { shoot?: string }).shoot ?? ""}</div>
                              <div style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: "var(--t2)" }}>
                                {co.kits.join(" · ")}
                              </div>
                              <div style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: "var(--t3)", marginTop: 3 }}>
                                Out at {("checkedOutAt" in co ? co.checkedOutAt : null) ?? ("checkedOutAtLabel" in co ? co.checkedOutAtLabel : "—")}
                                {co.status === "overdue" ? " · OVERDUE" : ""}
                              </div>
                            </div>
                            {co.status === "overdue" && <Badge variant="red">overdue</Badge>}
                          </div>
                          <button
                            onClick={() => {
                              if (isReadOnly) {
                                toast("Demo mode is read-only", { variant: "info" });
                                return;
                              }
                              // If this checkout is tied to a project whose end is in the future, ask first.
                              const activeCheckout = co as ActiveCheckout & { shootId?: string; shoot?: string };
                              const linkedId = activeCheckout.projectId ?? activeCheckout.shootId;
                              if (linkedId && linkedId !== "general") {
                                const project = data.projects.find(s => s.id === linkedId);
                                const now = new Date();
                                if (project && (project.status === "active" || project.status === "scheduled")) {
                                  // Use endsAt if set, else startsAt as a proxy
                                  const endRef = project.endsAt || project.startsAt;
                                  if (endRef) {
                                    const endDate = new Date(endRef);
                                    if (!isNaN(endDate.getTime()) && endDate > now) {
                                      const ok = confirm(
                                        `This kit is still scheduled for "${project.title}" until ${formatShootRange(project.startsAt, project.endsAt, data.timezone)}.\n\nDo you still want to return it now?`
                                      );
                                      if (!ok) return;
                                    }
                                  }
                                }
                              }
                              returnCheckout(co.id);
                              toast(`Returned: ${co.kits.join(" · ")}`, { detail: `from ${activeCheckout.project ?? activeCheckout.shoot ?? "—"}` });
                            }}
                            style={{
                              width: "100%",
                              padding: "10px 14px", borderRadius: 6,
                              background: "var(--green)", color: "var(--bg)",
                              border: "none", cursor: "pointer",
                              fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                              minHeight: 40, marginTop: 6,
                            }}>
                            ✓ Confirm return
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div style={{ padding: "13px 18px", paddingBottom: `max(13px, var(--safe-bottom))`, borderTop: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: isMobile ? "var(--s1)" : "transparent" }}>
              <button onClick={backToMenu} style={{ background: "none", border: "none", color: "var(--t2)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", padding: "10px 12px", minHeight: 44 }}>← Back to menu</button>
              <button onClick={backToMenu} style={{ background: "var(--acc)", color: "var(--bg)", border: "none", padding: "12px 22px", borderRadius: 7, fontSize: 13, fontWeight: 700, fontFamily: "'Syne',sans-serif", cursor: "pointer", minHeight: 44 }}>Done</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================== CHECKOUT FLOW ==================
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
      <TopNav />
      <div style={{ flex: 1, display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "center", padding: isMobile ? 0 : 24, background: "var(--bg)", overflow: "hidden" }}>
        <div style={{
          width: "100%", maxWidth: isMobile ? "100%" : 540,
          background: isMobile ? "var(--bg)" : "var(--s1)",
          border: isMobile ? "none" : "1px solid var(--b1)",
          borderRadius: isMobile ? 0 : 16,
          overflow: "hidden", display: "flex", flexDirection: "column",
          height: isMobile ? "100%" : "auto",
          maxHeight: isMobile ? "100%" : "calc(100vh - 110px)",
        }}>
          <KioskHeader title="Checking out" onBack={backToMenu} />

          <div key={step} className={animClass} style={{ flex: 1, padding: isMobile ? "20px 18px" : "24px 22px", overflowY: "auto" }}>

            {step === 1 && (
              <div>
                <div style={{ textAlign: "center", marginBottom: 22 }}>
                  <div style={{ width: 60, height: 60, background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 14px" }}>⬡</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 22 : 20, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>Scan your badge</div>
                  <div style={{ fontSize: isMobile ? 14 : 13, color: "var(--t2)", lineHeight: 1.5 }}>{isMobile ? "Hold badge to reader, or pick your name below." : "Hold badge to the reader, or use your guest token QR code."}</div>
                </div>
                {!isMobile && (
                  <>
                    <div style={{ position: "relative", marginBottom: 14 }}>
                      <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--t3)", fontSize: 15 }}>▷</span>
                      <input ref={badgeInputRef} placeholder="Waiting for badge scan..."
                        onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim() && data.profiles[0]) selectUser({ name: data.profiles[0].name, role: data.profiles[0].role, initials: data.profiles[0].initials, color: data.profiles[0].color }); }}
                        style={{ width: "100%", background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 8, padding: "13px 14px 13px 40px", fontFamily: "'DM Mono', monospace", fontSize: 14, color: "var(--t1)", outline: "none" }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0", color: "var(--t3)", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>
                      <span style={{ flex: 1, height: 1, background: "var(--b1)" }} />or pick your name<span style={{ flex: 1, height: 1, background: "var(--b1)" }} />
                    </div>
                  </>
                )}
                {/*
                 * User picker grid. Responsive columns: 2 columns on mobile
                 * (touch-target friendly), 3 on wider viewports to keep
                 * larger team rosters from becoming an excessive vertical
                 * scroll. No member cap — every workspace profile renders.
                 */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
                  gap: isMobile ? 10 : 7,
                }}>
                  {kioskUsers.map(u => (
                    <button key={u.name} onClick={() => selectUser(u)} style={{
                      background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 8,
                      padding: isMobile ? "14px 12px" : "10px 12px",
                      cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans', sans-serif",
                      minHeight: isMobile ? 64 : "auto",
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)" }}>{u.name}</div>
                      <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>{u.role}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && user && (
              <div>
                <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 9, padding: 14, display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 9, background: "var(--s3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: user.color, flexShrink: 0 }}>{user.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "'Syne', sans-serif", display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      {user.name}
                      {user.isGuest && <Badge variant="purple" style={{ fontSize: 9 }}>GUEST</Badge>}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t2)", marginTop: 3 }}>Confirmed · {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <Badge variant="green">Verified</Badge>
                </div>

                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Select your project</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    ...data.projects.filter(s => s.status === "active" || s.status === "scheduled"),
                    { id: "general", title: "General use / no project", client: "Ad hoc", startsAt: "", assignedTeam: [], assignedKits: [], status: "scheduled" } as Project,
                  ].map(s => (
                    <button key={s.id} onClick={() => selectShoot(s)} style={{
                      background: "var(--s2)",
                      border: `1px solid ${shoot?.id === s.id ? "var(--acc)" : "var(--b1)"}`,
                      borderRadius: 8, padding: "13px 14px",
                      cursor: "pointer", textAlign: "left",
                      fontFamily: "'DM Sans', sans-serif",
                      backgroundColor: shoot?.id === s.id ? "rgba(226,245,92,0.07)" : "var(--s2)",
                      minHeight: 56,
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--t1)" }}>{s.title}</div>
                      {s.client && <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)", marginTop: 3 }}>
                        {s.client}{s.startsAt ? ` · ${formatShootRange(s.startsAt, s.endsAt, data.timezone)}` : ""}
                      </div>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Pick kits to check out
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: selectedKitIds.size > 0 ? "var(--acc)" : "var(--t3)" }}>
                    {selectedKitIds.size} selected
                  </div>
                </div>

                {/* Search input — only show if there are more than 6 kits */}
                {data.kits.filter(k => k.status !== "out").length > 6 && (
                  <input
                    type="text"
                    value={kitSearch}
                    onChange={e => setKitSearch(e.target.value)}
                    placeholder="Search kits by name or barcode..."
                    style={{
                      width: "100%", background: "var(--s2)", border: "1px solid var(--b1)",
                      borderRadius: 7, padding: "10px 12px", marginBottom: 12,
                      color: "var(--t1)", outline: "none",
                      fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 40,
                      colorScheme: "dark",
                    }}
                  />
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {allAvailableKits.length === 0 ? (
                    <div style={{ padding: "20px 14px", textAlign: "center", color: "var(--t3)", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>
                      {data.kits.filter(k => k.status !== "out").length === 0
                        ? "No kits available right now."
                        : "No kits match your search."}
                    </div>
                  ) : (() => {
                    // Group: shoot-assigned first, then everything else
                    const shootAssigned = allAvailableKits.filter(k => shootAssignedKitIds.has(k.id));
                    const others = allAvailableKits.filter(k => !shootAssignedKitIds.has(k.id));
                    const sections: { label: string; kits: typeof allAvailableKits }[] = [];
                    if (shootAssigned.length > 0) sections.push({ label: "Assigned to this project", kits: shootAssigned });
                    if (others.length > 0) sections.push({
                      label: shootAssigned.length > 0 ? "Other available" : "Available",
                      kits: others,
                    });
                    return sections.map(section => (
                      <div key={section.label}>
                        {sections.length > 1 && (
                          <div style={{
                            fontSize: 9, fontFamily: "'DM Mono',monospace",
                            color: "var(--t3)", letterSpacing: "0.08em",
                            textTransform: "uppercase", padding: "8px 0 6px 4px",
                          }}>{section.label} ({section.kits.length})</div>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {section.kits.map(kit => {
                            const components = data.assets.filter(a => kit.componentIds.includes(a.id));
                            const isOpen = expandedKits[kit.id];
                            const isSelected = selectedKitIds.has(kit.id);
                            const hasFlagged = components.some(c => c.serviceFlag);
                            return (
                              <div key={kit.id} style={{
                                background: isSelected ? "rgba(226,245,92,0.06)" : "var(--s2)",
                                border: `1px solid ${isSelected ? "var(--acc)" : "var(--b1)"}`,
                                borderRadius: 8, overflow: "hidden",
                              }}>
                                <div style={{ display: "flex", alignItems: "stretch", minHeight: 56 }}>
                                  {/* Checkbox column */}
                                  <button
                                    onClick={() => toggleKitSelected(kit.id)}
                                    style={{
                                      padding: "0 14px",
                                      background: "transparent", border: "none",
                                      cursor: "pointer", display: "flex",
                                      alignItems: "center", justifyContent: "center",
                                    }}
                                    aria-label={isSelected ? "Deselect" : "Select"}
                                  >
                                    <div style={{
                                      width: 22, height: 22, borderRadius: 5,
                                      border: `2px solid ${isSelected ? "var(--acc)" : "var(--b2)"}`,
                                      background: isSelected ? "var(--acc)" : "transparent",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      color: "var(--bg)", fontSize: 14, fontWeight: 700,
                                    }}>
                                      {isSelected ? "✓" : ""}
                                    </div>
                                  </button>
                                  {/* Kit details — click to expand */}
                                  <div onClick={() => toggleKit(kit.id)} style={{
                                    flex: 1, padding: "12px 14px 12px 0", cursor: "pointer",
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                  }}>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                                        {kit.name}
                                        {hasFlagged && <span style={{ color: "var(--red)", marginLeft: 6, fontSize: 11 }}>⚠</span>}
                                      </div>
                                      <div style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: "var(--t2)" }}>
                                        {kit.barcode} · {kit.componentIds.length} items
                                      </div>
                                    </div>
                                    <span style={{
                                      fontSize: 11, color: "var(--t3)",
                                      transition: "transform 0.15s",
                                      transform: isOpen ? "rotate(0)" : "rotate(-90deg)",
                                      flexShrink: 0,
                                    }}>▾</span>
                                  </div>
                                </div>
                                {isOpen && (
                                  <div style={{ borderTop: "1px solid var(--b1)", padding: "6px 0" }}>
                                    {components.map(c => (
                                      <div key={c.id} style={{ padding: "5px 14px 5px 50px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)", display: "flex", alignItems: "center", gap: 7 }}>
                                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--b2)", flexShrink: 0 }} />
                                        {c.name}
                                        {c.serviceFlag && <span style={{ color: "var(--red)", fontSize: 10, marginLeft: 4 }}>⚠ {c.serviceFlag.severity}</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* Critical-flag warning */}
                {kitsForCheckout.some(k => {
                  const components = data.assets.filter(a => k.componentIds.includes(a.id));
                  return components.some(c => c.serviceFlag?.severity === "critical");
                }) && (
                  <div style={{ background: "rgba(255,79,79,0.08)", border: "1px solid rgba(255,79,79,0.25)", borderRadius: 7, padding: "10px 12px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--red)" }}>
                    ⚠ One or more selected kits contain a critical-flagged component and will be blocked at checkout.
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div>
                {/*
                 * Procedures panel (iter-27c). Renders only when the current
                 * kit selection produces at least one linked SOP. The
                 * surfacedSOPs array is computed at the top of this component
                 * via useMemo so it's guaranteed to reflect the LATEST
                 * selectedKitIds even after step backtracking.
                 *
                 * Read-only — kiosk users (who may not have edit access to
                 * the workspace) can view and click into SOPs but can't
                 * link or unlink from this view.
                 */}
                {surfacedSOPs.length > 0 && (
                  <div style={{
                    marginBottom: 18,
                    background: "color-mix(in srgb, var(--acc) 5%, var(--s2))",
                    border: "1px solid color-mix(in srgb, var(--acc) 40%, var(--b1))",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}>
                    <ProceduresSection
                      targetType="kit"
                      targetId={kitsForCheckout[0]?.id ?? ""}
                      targetName="this checkout"
                      sops={surfacedSOPs}
                      readOnly
                      headerLabel="Review before taking"
                    />
                  </div>
                )}

                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Condition check</div>
                <div style={{ fontSize: 11, color: "var(--t2)", fontFamily: "'DM Mono', monospace", marginBottom: 14 }}>Capture photos before leaving the cage. Optional but recommended.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    // Renamed from camera-specific labels (Front of case / Camera body)
                    // to generic Photo 1 / Photo 2 so the kiosk reads well across
                    // any industry: AV, landscaping, construction, schools, theater,
                    // auto repair. The label below each tile is purely guidance.
                    { id: "photo1", label: "Photo 1" },
                    { id: "photo2", label: "Photo 2" },
                  ].map(slot => {
                    const url = photos[slot.id];
                    const hasPhoto = !!url;
                    return (
                      <div key={slot.id} onClick={() => openCameraForSlot(slot.id)} style={{
                        aspectRatio: "4/3",
                        background: hasPhoto ? "var(--bg)" : "var(--s2)",
                        border: `1px ${hasPhoto ? "solid" : "dashed"} ${hasPhoto ? "var(--green)" : "var(--b2)"}`,
                        borderRadius: 8,
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        gap: 6, cursor: "pointer",
                        position: "relative",
                        overflow: "hidden",
                      }}>
                        {hasPhoto ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`${slot.label} preview`}
                              style={{
                                position: "absolute", inset: 0,
                                width: "100%", height: "100%",
                                objectFit: "cover",
                              }}
                            />
                            {/* Replace badge — clicking the tile while it has a photo
                                re-opens the camera to retake. The badge confirms the
                                current state and reinforces tap-to-retake affordance. */}
                            <div style={{
                              position: "absolute", bottom: 6, right: 6,
                              background: "rgba(0,0,0,0.7)", color: "#fff",
                              fontFamily: "'DM Mono', monospace", fontSize: 9,
                              padding: "3px 7px", borderRadius: 3,
                              letterSpacing: "0.06em",
                            }}>
                              ✓ {slot.label.toUpperCase()} · TAP TO RETAKE
                            </div>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: 22, opacity: 0.5 }}>⬡</span>
                            <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)" }}>
                              {slot.label}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Overall condition</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5, marginBottom: 14 }}>
                  {/* Capitalize for display so labels render in full ("Excellent" not "exce"). */}
                  {[
                    { value: "excellent", label: "Excellent" },
                    { value: "good", label: "Good" },
                    { value: "fair", label: "Fair" },
                    { value: "damaged", label: "Damaged" },
                    { value: "broken", label: "Broken" },
                  ].map(r => (
                    <button key={r.value} onClick={() => setRating(r.value)} style={{
                      padding: "10px 3px", borderRadius: 5,
                      fontSize: 10, fontFamily: "'DM Mono', monospace",
                      cursor: "pointer", textAlign: "center",
                      border: `1px solid ${rating === r.value ? "var(--acc)" : "var(--b1)"}`,
                      background: rating === r.value ? "rgba(226,245,92,0.08)" : "var(--s2)",
                      color: rating === r.value ? "var(--acc)" : "var(--t2)",
                      minHeight: 40,
                    }}>{r.label}</button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>Photos + condition log timestamped and stored</div>
              </div>
            )}

            {step === 5 && (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div className="animate-pop" style={{ width: 64, height: 64, background: "rgba(74,222,128,0.1)", border: "1px solid var(--green)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 16px" }}>✓</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>You&apos;re all set</div>
                <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6, marginBottom: 18 }}>
                  Gear checked out. Return by {createdCheckout?.dueBackLabel ?? "end of day"}.
                </div>
                <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 9, padding: 14, textAlign: "left", fontFamily: "'DM Mono', monospace", fontSize: 11, marginBottom: 16 }}>
                  {[
                    ["Checked out", user?.name ?? "—"],
                    ["Project", shoot?.title ?? "General use"],
                    ["Time", new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "var(--t2)", gap: 10 }}>
                      <span style={{ flexShrink: 0 }}>{k}</span><span style={{ color: "var(--t1)", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</span>
                    </div>
                  ))}
                  <hr style={{ border: "none", borderTop: "1px dashed var(--b2)", margin: "7px 0" }} />
                  {(createdCheckout?.kits ?? []).map((label, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "var(--t2)" }}>
                      <span>{label}</span>
                    </div>
                  ))}
                  <hr style={{ border: "none", borderTop: "1px dashed var(--b2)", margin: "7px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "var(--t2)" }}>
                    <span>Return by</span><span style={{ color: "var(--amber)" }}>{createdCheckout?.dueBackLabel ?? "—"}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={() => { resetCheckout(); }} style={{ background: "var(--s2)", border: "1px solid var(--b1)", color: "var(--t2)", padding: "12px 24px", borderRadius: 7, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif", minHeight: 44 }}>
                    Start new checkout
                  </button>
                  <button onClick={backToMenu} style={{ background: "var(--acc)", border: "none", color: "var(--bg)", padding: "12px 24px", borderRadius: 7, cursor: "pointer", fontSize: 13, fontFamily: "'Syne',sans-serif", fontWeight: 700, minHeight: 44 }}>
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "13px 18px", paddingBottom: `max(13px, var(--safe-bottom))`, borderTop: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: isMobile ? "var(--s1)" : "transparent" }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--t3)", marginBottom: 4 }}>
                {step < 5 ? `Step ${step} of 4` : "Done"}
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {[1, 2, 3, 4].map(s => (
                  <div key={s} style={{ width: s === step ? 18 : 5, height: 5, borderRadius: s === step ? 3 : "50%", background: s === step ? "var(--acc)" : s < step ? "var(--t3)" : "var(--b2)" }} />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {step > 1 && step < 5 && (
                <button onClick={() => goStep((step - 1) as CheckoutStep)} style={{ background: "none", border: "none", color: "var(--t2)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: "10px 12px", minHeight: 44 }}>← Back</button>
              )}
              {step === 2 && shoot && (
                <button onClick={() => goStep(3)} style={{ background: "var(--acc)", color: "var(--bg)", border: "none", padding: "12px 24px", borderRadius: 7, fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: "pointer", minHeight: 44 }}>Continue →</button>
              )}
              {step === 3 && (
                <button
                  onClick={() => goStep(4)}
                  disabled={selectedKitIds.size === 0}
                  style={{
                    background: selectedKitIds.size === 0 ? "var(--s3)" : "var(--acc)",
                    color: selectedKitIds.size === 0 ? "var(--t3)" : "var(--bg)",
                    border: "none", padding: "12px 24px", borderRadius: 7,
                    fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif",
                    cursor: selectedKitIds.size === 0 ? "not-allowed" : "pointer",
                    minHeight: 44,
                  }}>Continue →</button>
              )}
              {step === 4 && (
                <button onClick={() => {
                  if (isReadOnly) {
                    toast("Demo mode is read-only — switch to your workspace to record real checkouts.", { variant: "info" });
                    goStep(5);
                    return;
                  }
                  if (!user || kitsForCheckout.length === 0) {
                    toast("No kits available to check out.", { variant: "error" });
                    return;
                  }
                  // Block on open service flags — with role-aware override
                  // logic (iter-27c-fix). Owner has absolute authority and can
                  // override any flag, including critical. Manager can override
                  // warning-severity flags but NOT critical (critical means "out
                  // of service" — that decision sits with the Owner). Crew is
                  // always blocked by any open flag.
                  const blocking = getBlockingFlags(kitsForCheckout.map(k => k.id));
                  if (blocking.length > 0) {
                    const critical = blocking.filter(b => b.severity === "critical");
                    // Critical flags: Owner-only override.
                    if (critical.length > 0 && currentRole !== "owner") {
                      toast("Checkout blocked", {
                        variant: "error",
                        detail: `${critical[0].assetName} has a critical flag and is out of service. Resolve the flag in the Service Flags page before checkout.`,
                      });
                      return;
                    }
                    // Warning flags: Manager+ override. Crew gets the "manager
                    // review required" message that prompts them to find someone.
                    if (critical.length === 0
                        && currentRole !== "owner"
                        && currentRole !== "manager") {
                      toast("Checkout blocked", {
                        variant: "error",
                        detail: `${blocking[0].assetName} has a warning flag. Manager review required before checkout.`,
                      });
                      return;
                    }
                    // Owner OR Manager (depending on severity) is allowed
                    // through — surface an info-level confirmation so we
                    // capture intent without forcing extra clicks.
                    const overrideCount = blocking.length;
                    toast(
                      `Proceeding with ${overrideCount} open flag${overrideCount === 1 ? "" : "s"}`,
                      {
                        variant: "info",
                        detail: critical.length > 0
                          ? `Owner override on critical flag: ${critical[0].assetName}`
                          : `Manager+ override on ${blocking[0].assetName}`,
                      }
                    );
                  }
                  const result = checkoutKits({
                    user: { name: user.name, initials: user.initials, color: user.color, isGuest: user.isGuest },
                    kitIds: kitsForCheckout.map(k => k.id),
                    projectTitle: shoot?.title ?? "General use",
                    projectId: shoot?.id !== "general" ? shoot?.id : undefined,
                    dueBackHoursFromNow: 8,
                    // Pass through any photos captured at step 4. Falsy values
                    // (slot not captured) are filtered out so we send only the
                    // URLs that exist — the type allows undefined if none.
                    intakePhotoUrls: Object.values(photos).filter((url): url is string => !!url),
                    intakeCondition: rating as "excellent" | "good" | "fair" | "damaged" | "broken",
                  });
                  if (result) {
                    setCreatedCheckout(result);
                    toast(`${kitsForCheckout.length} kit${kitsForCheckout.length === 1 ? "" : "s"} checked out`, {
                      detail: `Return by ${result.dueBackLabel}`,
                    });
                  }
                  goStep(5);
                }} style={{ background: "var(--acc)", color: "var(--bg)", border: "none", padding: "12px 20px", borderRadius: 7, fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: "pointer", minHeight: 44 }}>Confirm →</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/*
       * Fullscreen camera overlay — only mounted when a slot is being captured.
       * Sits OUTSIDE the kiosk's nested scroll containers so it can claim the
       * full viewport (position: fixed, inset: 0). Photos upload to
       * `<workspaceId>/checkouts/<timestamp>-<rand>.jpg`. iter-20a.
       */}
      {activeCameraSlot && activeWorkspaceId && (
        <CameraCapture
          label={activeCameraSlot === "photo1" ? "Photo 1" : "Photo 2"}
          workspaceId={activeWorkspaceId}
          pathPrefix="checkouts"
          onCapture={(url) => handleCameraCapture(activeCameraSlot, url)}
          onCancel={() => setActiveCameraSlot(null)}
        />
      )}
    </div>
  );
}

// ============== Helper components ==============

function KioskHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{
      padding: "14px 18px", borderBottom: "1px solid var(--b1)",
      display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--t2)", fontSize: 18, cursor: "pointer", padding: "4px 8px" }}>←</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, background: "var(--acc)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 500, color: "var(--bg)" }}>CO</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 800 }}>{title}</span>
        </div>
      </div>
      <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: "var(--t3)" }}>LMG05 · DC</span>
    </div>
  );
}

function SetupRow({ done, num, title, desc, actionLabel }: { done: boolean; num: number; title: string; desc: string; actionLabel: string | null }) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 8, background: "var(--s2)",
      border: `1px solid ${done ? "rgba(74,222,128,0.3)" : "var(--b1)"}`,
      display: "flex", alignItems: "flex-start", gap: 12,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
        background: done ? "rgba(74,222,128,0.12)" : "var(--s3)",
        color: done ? "var(--green)" : "var(--t3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700,
      }}>{done ? "✓" : num}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--t2)", fontFamily: "'DM Mono',monospace", lineHeight: 1.5, marginBottom: actionLabel ? 10 : 0 }}>{desc}</div>
        {actionLabel && (
          <Link href="/dashboard" style={{ display: "inline-block", padding: "8px 14px", borderRadius: 6, background: "var(--acc)", color: "var(--bg)", fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 500, textDecoration: "none", minHeight: 36 }}>{actionLabel}</Link>
        )}
      </div>
    </div>
  );
}
