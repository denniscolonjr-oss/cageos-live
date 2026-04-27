"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { SHOOTS } from "@/lib/data";

type Step = 1 | 2 | 3 | 4 | 5;

interface KioskUser {
  name: string;
  role: string;
  initials: string;
  color: string;
  isGuest?: boolean;
}

export default function KioskPage() {
  const isMobile = useIsMobile();
  const { data, hydrated, isReadOnly } = useWorkspace();
  const [step, setStep] = useState<Step>(1);
  const [user, setUser] = useState<KioskUser | null>(null);
  const [shoot, setShoot] = useState<(typeof SHOOTS)[0] | null>(null);
  const [photos, setPhotos] = useState<Record<string, boolean>>({});
  const [rating, setRating] = useState("good");
  const [animDir, setAnimDir] = useState<"right" | "left">("right");
  const [expandedKits, setExpandedKits] = useState<Record<string, boolean>>({});
  const badgeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1 && !isMobile) badgeInputRef.current?.focus();
  }, [step, isMobile]);

  function goStep(next: Step) {
    setAnimDir(next > step ? "right" : "left");
    setStep(next);
  }

  function selectUser(u: KioskUser) {
    setUser(u);
    goStep(2);
  }

  function selectShoot(s: typeof SHOOTS[0]) { setShoot(s); }
  function toggleKit(id: string) { setExpandedKits(prev => ({ ...prev, [id]: !prev[id] })); }
  function capturePhoto(id: string) { setPhotos(prev => ({ ...prev, [id]: true })); }

  function reset() {
    setStep(1); setUser(null); setShoot(null); setPhotos({}); setRating("good");
    setExpandedKits({});
  }

  const animClass = animDir === "right" ? "animate-slide-right" : "animate-slide-left";

  // Derive demo users from workspace profiles (first 4)
  const kioskUsers: KioskUser[] = data.profiles.slice(0, 4).map(p => ({
    name: p.name, role: p.role, initials: p.initials, color: p.color, isGuest: p.isGuest,
  }));
  // Show first 3 kits as "assigned" for the demo flow
  const kitsForUser = data.kits.slice(0, 3);

  // Empty workspace — kiosk needs at least one kit and one person
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
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--bg)" }}>
          <Card>
            <div style={{ padding: isMobile ? "32px 24px" : "44px 36px", textAlign: "center", maxWidth: 460 }}>
              <div style={{ width: 56, height: 56, background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 16px" }}>⬡</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 19 : 22, fontWeight: 700, marginBottom: 8 }}>Set up the kiosk first</div>
              <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 22 }}>
                {data.kits.length === 0 && data.profiles.length === 0
                  ? "The kiosk needs at least one team member and one kit before it can run a checkout flow."
                  : data.kits.length === 0
                  ? "The kiosk needs at least one kit before it can run a checkout flow."
                  : "The kiosk needs at least one team member before it can run a checkout flow."}
              </div>
              <Link href="/dashboard" style={{
                display: "inline-block",
                background: "var(--acc)", color: "var(--bg)", border: "none",
                padding: "12px 24px", borderRadius: 7,
                fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700,
                textDecoration: "none", minHeight: 44,
              }}>Go to dashboard →</Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TopNav />
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: isMobile ? "stretch" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 24,
        background: "var(--bg)",
        overflow: "hidden",
      }}>
        <div style={{
          width: "100%",
          maxWidth: isMobile ? "100%" : 540,
          background: isMobile ? "var(--bg)" : "var(--s1)",
          border: isMobile ? "none" : "1px solid var(--b1)",
          borderRadius: isMobile ? 0 : 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          height: isMobile ? "100%" : "auto",
          maxHeight: isMobile ? "100%" : "calc(100vh - 110px)",
        }}>
          {/* Kiosk header */}
          <div style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--b1)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
            background: isMobile ? "var(--s1)" : "transparent",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, background: "var(--acc)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 500, color: "var(--bg)" }}>CO</div>
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 800 }}>Kiosk</span>
            </div>
            <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: "var(--t3)" }}>LMG05 · DC</span>
          </div>

          {/* Step body */}
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
                      <input
                        ref={badgeInputRef}
                        placeholder="Waiting for badge scan..."
                        onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) selectUser({ name: "Badge User", role: "Staff", initials: "BU", color: "var(--acc)" }); }}
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
                      cursor: "pointer", textAlign: "left",
                      fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
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
                  {SHOOTS.map(s => (
                    <button key={s.id} onClick={() => selectShoot(s)} style={{
                      background: "var(--s2)",
                      border: `1px solid ${shoot?.id === s.id ? "var(--acc)" : "var(--b1)"}`,
                      borderRadius: 8, padding: "13px 14px",
                      cursor: "pointer", textAlign: "left",
                      fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
                      backgroundColor: shoot?.id === s.id ? "rgba(226,245,92,0.07)" : "var(--s2)",
                      minHeight: 56,
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--t1)" }}>{s.title}</div>
                      {s.client && <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)", marginTop: 3 }}>{s.client}{s.when ? ` · ${s.when}` : ""}</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Your assigned kits</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {kitsForUser.map(kit => {
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
                <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 7, padding: "10px 12px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--amber)" }}>
                  ⚠ Sigma 85MM has a critical service flag and is blocked from checkout.
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Condition check — Venice Cinema Kit</div>
                <div style={{ fontSize: 11, color: "var(--t2)", fontFamily: "'DM Mono', monospace", marginBottom: 14 }}>Capture photos before leaving the cage.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[{ id: "front", label: "Front of case" }, { id: "body", label: "Camera body" }].map(slot => (
                    <div key={slot.id} onClick={() => capturePhoto(slot.id)} style={{
                      aspectRatio: "4/3",
                      background: "var(--s2)",
                      border: `1px ${photos[slot.id] ? "solid" : "dashed"} ${photos[slot.id] ? "var(--green)" : "var(--b2)"}`,
                      borderRadius: 8,
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      gap: 6, cursor: "pointer", transition: "all 0.15s",
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
                      fontSize: isMobile ? 10 : 10, fontFamily: "'DM Mono', monospace",
                      cursor: "pointer", textAlign: "center",
                      border: `1px solid ${rating === r ? "var(--acc)" : "var(--b1)"}`,
                      background: rating === r ? "rgba(226,245,92,0.08)" : "var(--s2)",
                      color: rating === r ? "var(--acc)" : "var(--t2)",
                      transition: "all 0.15s", minHeight: 40,
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
                <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6, marginBottom: 18 }}>Gear checked out. Receipt sent to your email. Return all items by 6PM today.</div>
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
                  {kitsForUser.slice(0, 2).map(k => (
                    <div key={k.id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "var(--t2)" }}>
                      <span>{k.name}</span><span style={{ color: "var(--t1)" }}>{k.barcode}</span>
                    </div>
                  ))}
                  <hr style={{ border: "none", borderTop: "1px dashed var(--b2)", margin: "7px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "var(--t2)" }}>
                    <span>Return by</span><span style={{ color: "var(--amber)" }}>6:00 PM</span>
                  </div>
                </div>
                <button onClick={reset} style={{ background: "var(--s2)", border: "1px solid var(--b1)", color: "var(--t2)", padding: "12px 24px", borderRadius: 7, cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif", minHeight: 44, width: isMobile ? "100%" : "auto" }}>
                  Start new checkout
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: "13px 18px",
            paddingBottom: `max(13px, var(--safe-bottom))`,
            borderTop: "1px solid var(--b1)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
            background: isMobile ? "var(--s1)" : "transparent",
          }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--t3)", marginBottom: 4 }}>
                {step < 5 ? `Step ${step} of 4` : "Done"}
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {[1, 2, 3, 4].map(s => (
                  <div key={s} style={{ width: s === step ? 18 : 5, height: 5, borderRadius: s === step ? 3 : "50%", background: s === step ? "var(--acc)" : s < step ? "var(--t3)" : "var(--b2)", transition: "all 0.2s" }} />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {step > 1 && step < 5 && (
                <button onClick={() => goStep((step - 1) as Step)} style={{ background: "none", border: "none", color: "var(--t2)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: "10px 12px", minHeight: 44 }}>← Back</button>
              )}
              {step === 2 && shoot && (
                <button onClick={() => goStep(3)} style={{ background: "var(--acc)", color: "var(--bg)", border: "none", padding: "12px 24px", borderRadius: 7, fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: "pointer", minHeight: 44 }}>Continue →</button>
              )}
              {step === 3 && (
                <button onClick={() => goStep(4)} style={{ background: "var(--acc)", color: "var(--bg)", border: "none", padding: "12px 24px", borderRadius: 7, fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: "pointer", minHeight: 44 }}>Continue →</button>
              )}
              {step === 4 && (
                <button onClick={() => goStep(5)} style={{ background: "var(--acc)", color: "var(--bg)", border: "none", padding: "12px 20px", borderRadius: 7, fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: "pointer", minHeight: 44 }}>Confirm →</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
