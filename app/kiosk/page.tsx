"use client";
import { useState, useEffect, useRef } from "react";
import TopNav from "@/components/shared/TopNav";
import Badge from "@/components/ui/Badge";
import { KITS, ASSETS, SHOOTS, DEMO_USERS } from "@/lib/data";

type Step = 1 | 2 | 3 | 4 | 5;

interface KioskUser {
  name: string;
  role: string;
  initials: string;
  color: string;
  isGuest?: boolean;
}

export default function KioskPage() {
  const [step, setStep] = useState<Step>(1);
  const [user, setUser] = useState<KioskUser | null>(null);
  const [shoot, setShoot] = useState<(typeof SHOOTS)[0] | null>(null);
  const [photos, setPhotos] = useState<Record<string, boolean>>({});
  const [rating, setRating] = useState("good");
  const [animDir, setAnimDir] = useState<"right" | "left">("right");
  const [expandedKits, setExpandedKits] = useState<Record<string, boolean>>({ "MMG-0000576": true, "MMG-0000575": true });
  const badgeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1) badgeInputRef.current?.focus();
  }, [step]);

  function goStep(next: Step) {
    setAnimDir(next > step ? "right" : "left");
    setStep(next);
  }

  function selectUser(u: KioskUser) {
    setUser(u);
    goStep(2);
  }

  function selectShoot(s: typeof SHOOTS[0]) {
    setShoot(s);
  }

  function toggleKit(id: string) {
    setExpandedKits(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function capturePhoto(id: string) {
    setPhotos(prev => ({ ...prev, [id]: true }));
  }

  function reset() {
    setStep(1);
    setUser(null);
    setShoot(null);
    setPhotos({});
    setRating("good");
    setExpandedKits({ "MMG-0000576": true, "MMG-0000575": true });
  }

  const animClass = animDir === "right" ? "animate-slide-right" : "animate-slide-left";

  const kitsForUser = KITS.slice(0, 3); // Venice, Lens, ULXD

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TopNav />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--bg)", overflow: "hidden" }}>
        <div style={{ width: "100%", maxWidth: 540, background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 110px)" }}>

          {/* Kiosk header */}
          <div style={{ padding: "15px 20px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, background: "var(--acc)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 500, color: "var(--bg)" }}>CO</div>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 800 }}>CageOS</span>
            </div>
            <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t3)" }}>LMG05 · Washington DC</span>
          </div>

          {/* Step body */}
          <div key={step} className={animClass} style={{ flex: 1, padding: "24px 22px", overflowY: "auto" }}>

            {/* STEP 1 — Badge scan */}
            {step === 1 && (
              <div>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ width: 56, height: 56, background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, margin: "0 auto 14px" }}>⬡</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>Scan your badge</div>
                  <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5 }}>Hold badge to the reader, or use your guest token QR code.</div>
                </div>
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
                  <span style={{ flex: 1, height: 1, background: "var(--b1)" }} />or tap a demo user<span style={{ flex: 1, height: 1, background: "var(--b1)" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  {DEMO_USERS.map(u => (
                    <button key={u.name} onClick={() => selectUser(u)} style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7, padding: "10px 12px", cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget.style.borderColor = "var(--acc)"); (e.currentTarget.style.background = "rgba(226,245,92,0.04)"); }}
                      onMouseLeave={e => { (e.currentTarget.style.borderColor = "var(--b1)"); (e.currentTarget.style.background = "var(--s2)"); }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t1)" }}>{u.name}</div>
                      <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{u.role}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2 — Pick shoot */}
            {step === 2 && user && (
              <div>
                <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 9, padding: 14, display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 9, background: "var(--s3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: user.color, flexShrink: 0 }}>{user.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, fontFamily: "'Syne', sans-serif", display: "flex", alignItems: "center", gap: 7 }}>
                      {user.name}
                      {user.isGuest && <Badge variant="purple" style={{ fontSize: 9 }}>GUEST</Badge>}
                    </div>
                    <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t2)", marginTop: 3 }}>Badge confirmed · {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <Badge variant="green">Verified</Badge>
                </div>

                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>Select your shoot</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {SHOOTS.map(s => (
                    <button key={s.id} onClick={() => selectShoot(s)} style={{ background: "var(--s2)", border: `1px solid ${shoot?.id === s.id ? "var(--acc)" : "var(--b1)"}`, borderRadius: 7, padding: "11px 13px", cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s", backgroundColor: shoot?.id === s.id ? "rgba(226,245,92,0.07)" : "var(--s2)" }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)" }}>{s.title}</div>
                      {s.client && <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t2)", marginTop: 2 }}>{s.client}{s.when ? ` · ${s.when}` : ""}</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3 — Kit confirmation */}
            {step === 3 && (
              <div>
                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Your assigned kits</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
                  {kitsForUser.map(kit => {
                    const components = ASSETS.filter(a => kit.componentIds.includes(a.id));
                    const isOpen = expandedKits[kit.id];
                    return (
                      <div key={kit.id} style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 8, overflow: "hidden" }}>
                        <div onClick={() => toggleKit(kit.id)} style={{ padding: "10px 13px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{kit.name}</div>
                            <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t2)", marginTop: 2 }}>{kit.barcode} · {kit.componentIds.length} items</div>
                          </div>
                          <span style={{ fontSize: 10, color: "var(--t3)", transition: "transform 0.15s", transform: isOpen ? "rotate(0)" : "rotate(-90deg)" }}>▾</span>
                        </div>
                        {isOpen && (
                          <div style={{ borderTop: "1px solid var(--b1)", padding: "6px 0" }}>
                            {components.map(c => (
                              <div key={c.id} style={{ padding: "5px 13px 5px 26px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)", display: "flex", alignItems: "center", gap: 7 }}>
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
                <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 7, padding: "9px 12px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--amber)" }}>
                  ⚠ Sigma 85MM has a critical service flag and is blocked from checkout. All other items are available.
                </div>
              </div>
            )}

            {/* STEP 4 — Condition capture */}
            {step === 4 && (
              <div>
                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Condition check — Venice Cinema Kit</div>
                <div style={{ fontSize: 11, color: "var(--t2)", fontFamily: "'DM Mono', monospace", marginBottom: 14 }}>Capture photos and note any damage before leaving the cage.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                  {[{ id: "front", label: "Front of case" }, { id: "body", label: "Camera body" }].map(slot => (
                    <div key={slot.id} onClick={() => capturePhoto(slot.id)} style={{ aspectRatio: "4/3", background: "var(--s2)", border: `1px ${photos[slot.id] ? "solid" : "dashed"} ${photos[slot.id] ? "var(--green)" : "var(--b2)"}`, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer", transition: "all 0.15s", backgroundColor: photos[slot.id] ? "rgba(74,222,128,0.06)" : "var(--s2)" }}>
                      <span style={{ fontSize: 20, opacity: 0.5 }}>{photos[slot.id] ? "✓" : "⬡"}</span>
                      <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: photos[slot.id] ? "var(--green)" : "var(--t3)" }}>{photos[slot.id] ? "Captured" : slot.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>Overall condition</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5, marginBottom: 12 }}>
                  {["excellent","good","fair","damaged","broken"].map(r => (
                    <button key={r} onClick={() => setRating(r)} style={{ padding: "7px 3px", borderRadius: 5, fontSize: 10, fontFamily: "'DM Mono', monospace", cursor: "pointer", textAlign: "center", border: `1px solid ${rating === r ? "var(--acc)" : "var(--b1)"}`, background: rating === r ? "rgba(226,245,92,0.08)" : "var(--s2)", color: rating === r ? "var(--acc)" : "var(--t2)", transition: "all 0.15s" }}>{r}</button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>Photos + condition log timestamped and stored with checkout record</div>
              </div>
            )}

            {/* STEP 5 — Done */}
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
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "var(--t2)" }}>
                      <span>{k}</span><span style={{ color: "var(--t1)" }}>{v}</span>
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
                    <span>Return by</span><span style={{ color: "var(--amber)" }}>6:00 PM today</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "var(--t2)" }}>
                    <span>Kiosk</span><span style={{ color: "var(--t1)" }}>LMG05 · Washington DC</span>
                  </div>
                </div>
                <button onClick={reset} style={{ background: "var(--s2)", border: "1px solid var(--b1)", color: "var(--t2)", padding: "8px 20px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                  Start new checkout
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "13px 20px", borderTop: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--t3)", marginBottom: 4 }}>
                {step < 5 ? `Step ${step} of 4` : ""}
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {[1, 2, 3, 4].map(s => (
                  <div key={s} style={{ width: s === step ? 18 : 5, height: 5, borderRadius: s === step ? 3 : "50%", background: s === step ? "var(--acc)" : s < step ? "var(--t3)" : "var(--b2)", transition: "all 0.2s" }} />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {step > 1 && step < 5 && (
                <button onClick={() => goStep((step - 1) as Step)} style={{ background: "none", border: "none", color: "var(--t2)", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", padding: "9px" }}>← Back</button>
              )}
              {step === 2 && shoot && (
                <button onClick={() => goStep(3)} style={{ background: "var(--acc)", color: "var(--bg)", border: "none", padding: "9px 22px", borderRadius: 7, fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: "pointer" }}>Continue →</button>
              )}
              {step === 3 && (
                <button onClick={() => goStep(4)} style={{ background: "var(--acc)", color: "var(--bg)", border: "none", padding: "9px 22px", borderRadius: 7, fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: "pointer" }}>Continue →</button>
              )}
              {step === 4 && (
                <button onClick={() => goStep(5)} style={{ background: "var(--acc)", color: "var(--bg)", border: "none", padding: "9px 22px", borderRadius: 7, fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: "pointer" }}>Confirm checkout →</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
