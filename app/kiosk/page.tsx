"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";
import type { Shoot, ActiveCheckout } from "@/lib/hooks/workspaceTypes";
import { formatShootRange } from "@/lib/timezone";

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
  const { data, hydrated, isReadOnly, checkoutKits, returnCheckout } = useWorkspace();
  const [flow, setFlow] = useState<Flow>("menu");

  // Checkout state
  const [step, setStep] = useState<CheckoutStep>(1);
  const [user, setUser] = useState<KioskUser | null>(null);
  const [shoot, setShoot] = useState<Shoot | null>(null);
  const [photos, setPhotos] = useState<Record<string, boolean>>({});
  const [rating, setRating] = useState("good");
  const [animDir, setAnimDir] = useState<"right" | "left">("right");
  const [expandedKits, setExpandedKits] = useState<Record<string, boolean>>({});
  const [createdCheckout, setCreatedCheckout] = useState<ActiveCheckout | null>(null);
  const badgeInputRef = useRef<HTMLInputElement>(null);

  // Return state
  const [returnUser, setReturnUser] = useState<KioskUser | null>(null);

  useEffect(() => {
    if (flow === "checkout" && step === 1 && !isMobile) badgeInputRef.current?.focus();
  }, [flow, step, isMobile]);

  function goStep(next: CheckoutStep) {
    setAnimDir(next > step ? "right" : "left");
    setStep(next);
  }

  function selectUser(u: KioskUser) {
    setUser(u);
    goStep(2);
  }

  function selectShoot(s: Shoot) { setShoot(s); }
  function toggleKit(id: string) { setExpandedKits(prev => ({ ...prev, [id]: !prev[id] })); }
  function capturePhoto(id: string) { setPhotos(prev => ({ ...prev, [id]: true })); }

  function resetCheckout() {
    setStep(1); setUser(null); setShoot(null); setPhotos({}); setRating("good");
    setExpandedKits({}); setCreatedCheckout(null);
  }
  function resetReturn() { setReturnUser(null); }

  function backToMenu() {
    setFlow("menu");
    resetCheckout();
    resetReturn();
  }

  // Derive demo users from workspace profiles (first 4)
  const kioskUsers: KioskUser[] = data.profiles.slice(0, 4).map(p => ({
    name: p.name, role: p.role, initials: p.initials, color: p.color, isGuest: p.isGuest,
  }));

  // For checkout: prefer the kits assigned to the selected shoot, else first 3 available kits
  const kitsForCheckout = shoot && shoot.assignedKits.length > 0
    ? data.kits.filter(k => shoot.assignedKits.includes(k.id) && k.status !== "out")
    : data.kits.filter(k => k.status !== "out").slice(0, 3);

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
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
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
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
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
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
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
                <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>Take gear out for a shoot</div>
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
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? 10 : 7 }}>
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
                              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{co.shoot}</div>
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
                              // If this checkout is tied to a shoot whose end is in the future, ask first.
                              const activeCheckout = co as ActiveCheckout;
                              if (activeCheckout.shootId && activeCheckout.shootId !== "general") {
                                const shoot = data.shoots.find(s => s.id === activeCheckout.shootId);
                                const now = new Date();
                                if (shoot && (shoot.status === "active" || shoot.status === "scheduled")) {
                                  // Use endsAt if set, else startsAt as a proxy
                                  const endRef = shoot.endsAt || shoot.startsAt;
                                  if (endRef) {
                                    const endDate = new Date(endRef);
                                    if (!isNaN(endDate.getTime()) && endDate > now) {
                                      const ok = confirm(
                                        `This kit is still scheduled for "${shoot.title}" until ${formatShootRange(shoot.startsAt, shoot.endsAt, data.timezone)}.\n\nDo you still want to return it now?`
                                      );
                                      if (!ok) return;
                                    }
                                  }
                                }
                              }
                              returnCheckout(co.id);
                              toast(`Returned: ${co.kits.join(" · ")}`, { detail: `from ${co.shoot}` });
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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? 10 : 7 }}>
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

                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Select your shoot</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    ...data.shoots.filter(s => s.status === "active" || s.status === "scheduled"),
                    { id: "general", title: "General use / no shoot", client: "Ad hoc", startsAt: "", assignedTeam: [], assignedKits: [], status: "scheduled" } as Shoot,
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
                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                  {shoot && shoot.assignedKits.length > 0 ? "Kits assigned to this shoot" : "Available kits"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {kitsForCheckout.length === 0 ? (
                    <div style={{ padding: "20px 14px", textAlign: "center", color: "var(--t3)", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>
                      No kits available right now.
                    </div>
                  ) : kitsForCheckout.map(kit => {
                    const components = data.assets.filter(a => kit.componentIds.includes(a.id));
                    const isOpen = expandedKits[kit.id];
                    return (
                      <div key={kit.id} style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 8, overflow: "hidden" }}>
                        <div onClick={() => toggleKit(kit.id)} style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", minHeight: 48 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{kit.name}</div>
                            <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t2)", marginTop: 2 }}>{kit.barcode} · {kit.componentIds.length} items</div>
                          </div>
                          <span style={{ fontSize: 11, color: "var(--t3)", transition: "transform 0.15s", transform: isOpen ? "rotate(0)" : "rotate(-90deg)" }}>▾</span>
                        </div>
                        {isOpen && (
                          <div style={{ borderTop: "1px solid var(--b1)", padding: "6px 0" }}>
                            {components.map(c => (
                              <div key={c.id} style={{ padding: "5px 14px 5px 26px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)", display: "flex", alignItems: "center", gap: 7 }}>
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
                {data.assets.some(a => a.serviceFlag?.severity === "critical" && kitsForCheckout.some(k => k.componentIds.includes(a.id))) && (
                  <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 7, padding: "10px 12px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--amber)" }}>
                    ⚠ One or more components have a critical service flag and may be blocked at checkout.
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div>
                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Condition check</div>
                <div style={{ fontSize: 11, color: "var(--t2)", fontFamily: "'DM Mono', monospace", marginBottom: 14 }}>Capture photos before leaving the cage.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[{ id: "front", label: "Front of case" }, { id: "body", label: "Camera body" }].map(slot => (
                    <div key={slot.id} onClick={() => capturePhoto(slot.id)} style={{
                      aspectRatio: "4/3",
                      background: "var(--s2)",
                      border: `1px ${photos[slot.id] ? "solid" : "dashed"} ${photos[slot.id] ? "var(--green)" : "var(--b2)"}`,
                      borderRadius: 8,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 6, cursor: "pointer",
                      backgroundColor: photos[slot.id] ? "rgba(74,222,128,0.06)" : "var(--s2)",
                    }}>
                      <span style={{ fontSize: 22, opacity: 0.5 }}>{photos[slot.id] ? "✓" : "⬡"}</span>
                      <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: photos[slot.id] ? "var(--green)" : "var(--t3)" }}>{photos[slot.id] ? "Captured" : slot.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Overall condition</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5, marginBottom: 14 }}>
                  {["excellent","good","fair","damaged","broken"].map(r => (
                    <button key={r} onClick={() => setRating(r)} style={{
                      padding: "10px 3px", borderRadius: 5,
                      fontSize: 10, fontFamily: "'DM Mono', monospace",
                      cursor: "pointer", textAlign: "center",
                      border: `1px solid ${rating === r ? "var(--acc)" : "var(--b1)"}`,
                      background: rating === r ? "rgba(226,245,92,0.08)" : "var(--s2)",
                      color: rating === r ? "var(--acc)" : "var(--t2)",
                      minHeight: 40,
                    }}>{r.slice(0, 4)}</button>
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
                    ["Shoot", shoot?.title ?? "General use"],
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
                <button onClick={() => goStep(4)} style={{ background: "var(--acc)", color: "var(--bg)", border: "none", padding: "12px 24px", borderRadius: 7, fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: "pointer", minHeight: 44 }}>Continue →</button>
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
                  const result = checkoutKits({
                    user: { name: user.name, initials: user.initials, color: user.color, isGuest: user.isGuest },
                    kitIds: kitsForCheckout.map(k => k.id),
                    shootTitle: shoot?.title ?? "General use",
                    shootId: shoot?.id !== "general" ? shoot?.id : undefined,
                    dueBackHoursFromNow: 8,
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
