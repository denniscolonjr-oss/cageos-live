"use client";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import Card from "@/components/ui/Card";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

const DIFFERENTIATORS = [
  { icon: "⬡", title: "Badge-first kiosk checkout", body: "Scan a badge or guest QR code — the system already knows who you are, what shoot you're on, and what kits are assigned. Three taps and you're out the door.", tag: "Pain #5 solved" },
  { icon: "⬡", title: "Kit drift detection", body: "On every return, the system compares what came back against what went out. Missing required components get flagged instantly — before the kit goes back on the shelf.", tag: "Pain #4 solved" },
  { icon: "⬡", title: "Freelancer guest tokens", body: "Generate a time-limited, shoot-scoped QR code for freelancers. Full accountability trail, no HR enrollment required. Token expires after the shoot.", tag: "Pain #9 solved" },
];

const COMPARE = [
  { feature: "Physical kiosk with badge scanner", them: false, us: true },
  { feature: "Shoot-context attached to every checkout", them: false, us: true },
  { feature: "Freelancer guest token flow", them: false, us: true },
  { feature: "Kit drift detection on return", them: "partial", us: true },
  { feature: "Per-asset condition photo at checkout", them: "partial", us: true },
  { feature: "Unlimited assets (plan-gated)", them: true, us: true },
  { feature: "Built for production, not IT", them: false, us: true },
];

const PLANS = [
  { name: "Starter", price: "$79", assets: "250 assets", users: "5 users", kiosks: "0 kiosks", features: ["Barcode checkout","Kit management","Overdue alerts","Email notifications"] },
  { name: "Pro", price: "$199", assets: "1,500 assets", users: "25 users", kiosks: "1 kiosk", features: ["Everything in Starter","Guest tokens","Condition photos","Kit drift detection","Calendar sync"], featured: true },
  { name: "Studio", price: "$499", assets: "5,000 assets", users: "100 users", kiosks: "3 kiosks", features: ["Everything in Pro","API access","ServiceNow sync","Full audit log","SSO support"] },
  { name: "Enterprise", price: "Custom", assets: "Unlimited", users: "Unlimited", kiosks: "Unlimited", features: ["Everything in Studio","Dedicated support","Custom integrations","On-site setup","SOC 2 / FedRAMP path"] },
];

export default function ProductPage() {
  const isMobile = useIsMobile();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TopNav />
      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
        <div style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: isMobile ? "28px 16px 60px" : "40px 28px 80px",
          paddingBottom: `max(${isMobile ? 60 : 80}px, var(--safe-bottom))`,
        }} className="animate-fade-up">

          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: isMobile ? 36 : 52 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--acc)", background: "rgba(226,245,92,0.1)", border: "1px solid rgba(226,245,92,0.25)", padding: "5px 12px", borderRadius: 20, marginBottom: 18, letterSpacing: "0.05em" }}>
              ⬡ Now in early access
            </div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 30 : 42, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 16 }}>
              Equipment tracking built<br />for{" "}
              <em style={{ fontStyle: "normal", color: "var(--acc)" }}>production</em>, not IT.
            </h1>
            <p style={{ fontSize: isMobile ? 14 : 15, color: "var(--t2)", lineHeight: 1.7, maxWidth: 500, margin: "0 auto 28px", padding: isMobile ? "0 4px" : 0 }}>
              CageOS combines a physical kiosk, badge-first identity, and shoot-context-aware checkout — designed by AV professionals, for AV professionals.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/kiosk" style={{ background: "var(--acc)", color: "var(--bg)", padding: "12px 24px", borderRadius: 8, fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, textDecoration: "none", display: "inline-block", minHeight: 44 }}>
                See the kiosk demo →
              </Link>
              <Link href="/dashboard" style={{ background: "transparent", color: "var(--t1)", padding: "12px 24px", borderRadius: 8, fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 600, textDecoration: "none", border: "1px solid var(--b2)", display: "inline-block", minHeight: 44 }}>
                View dashboard
              </Link>
            </div>
          </div>

          {/* Differentiators */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--acc)", marginBottom: 8 }}>Three things nobody else does</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 14 }}>
              {DIFFERENTIATORS.map((d, i) => (
                <Card key={i} accentColor={i === 0 ? "var(--acc)" : i === 1 ? "var(--blue)" : "var(--green)"}>
                  <div style={{ padding: 20 }}>
                    <div style={{ fontSize: 22, marginBottom: 10 }}>{d.icon}</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{d.title}</div>
                    <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>{d.body}</div>
                    <div style={{ display: "inline-block", marginTop: 10, fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--acc)", background: "rgba(226,245,92,0.08)", border: "1px solid rgba(226,245,92,0.2)", padding: "2px 8px", borderRadius: 3 }}>{d.tag}</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Comparison */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--acc)", marginBottom: 8 }}>vs. Cheqroom, EZOfficeInventory, Reftab</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: -0.5, marginBottom: 14 }}>What they don&apos;t have</div>
            <Card>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--b1)", display: "flex", gap: 8 }}>
                <div style={{ flex: 1, fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)" }}>Feature</div>
                <div style={{ width: isMobile ? 60 : 80, textAlign: "center", fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t2)" }}>{isMobile ? "Them" : "Competitors"}</div>
                <div style={{ width: isMobile ? 50 : 80, textAlign: "center", fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--acc)" }}>CageOS</div>
              </div>
              {COMPARE.map((row, i) => (
                <div key={i} style={{ padding: "11px 12px", borderBottom: i < COMPARE.length - 1 ? "1px solid var(--b1)" : "none", display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1, fontSize: isMobile ? 12 : 13, color: "var(--t2)", lineHeight: 1.4 }}>{row.feature}</div>
                  <div style={{ width: isMobile ? 60 : 80, textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: isMobile ? 11 : 12, color: row.them === true ? "var(--green)" : row.them === "partial" ? "var(--amber)" : "var(--red)" }}>
                    {row.them === true ? "✓" : row.them === "partial" ? "partial" : "✗"}
                  </div>
                  <div style={{ width: isMobile ? 50 : 80, textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--acc)", fontWeight: 500 }}>✓</div>
                </div>
              ))}
            </Card>
          </div>

          {/* Pricing */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--acc)", marginBottom: 8 }}>Pricing</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: -0.5, marginBottom: 14 }}>Simple, scalable tiers</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 }}>
              {PLANS.map(p => (
                <Card key={p.name} style={{ border: p.featured ? "1px solid var(--acc)" : "1px solid var(--b1)", background: p.featured ? "rgba(226,245,92,0.04)" : "var(--s1)" }}>
                  <div style={{ padding: "16px 14px" }}>
                    {p.featured && (
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--acc)", background: "rgba(226,245,92,0.12)", border: "1px solid rgba(226,245,92,0.25)", padding: "2px 7px", borderRadius: 3, display: "inline-block", marginBottom: 8 }}>POPULAR</div>
                    )}
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{p.name}</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 22 : 26, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>{p.price}</div>
                    <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)", marginBottom: 10 }}>/month</div>
                    <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t2)", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--b1)" }}>
                      {p.assets}<br />{p.users}<br />{p.kiosks}
                    </div>
                    {p.features.slice(0, isMobile ? 3 : 5).map(f => (
                      <div key={f} style={{ fontSize: 11, color: "var(--t2)", padding: "3px 0", display: "flex", gap: 6, alignItems: "flex-start" }}>
                        <span style={{ color: "var(--green)", fontSize: 10, flexShrink: 0, marginTop: 1 }}>✓</span>
                        {f}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Card>
            <div style={{ padding: isMobile ? 24 : 32, textAlign: "center" }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 20 : 22, fontWeight: 700, marginBottom: 8 }}>Get in touch</div>
              <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20, lineHeight: 1.6 }}>Currently onboarding production shops in early access. Reach out to set up a walkthrough.</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {["cageos.io", "hello@cageos.io"].map(item => (
                  <div key={item} style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 8, padding: "10px 16px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--t2)" }}>{item}</div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
