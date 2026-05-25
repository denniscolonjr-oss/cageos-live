"use client";

/**
 * Landing page (route: `/`)
 *
 * Prospect-facing marketing page. Generic positioning — equipment checkout
 * software for any team where things get checked out and need to come back.
 * Not industry-specific. Replaces the previous "/" route which likely
 * redirected straight to /dashboard or /login.
 *
 * Routing behavior:
 *   - Logged-out visitors: see the landing, CTAs are "Schedule a demo"
 *     (calendly) and "Sign up free" (/signup)
 *   - Logged-in users: still see the landing if they navigate here, but
 *     the header shows "Open dashboard →" instead of sign-in CTAs.
 *     They're never auto-redirected — visitors should consistently see
 *     the landing without flicker.
 *
 * Hero screenshot: a stylized inline SVG mockup of the dashboard. Built
 * by hand rather than using a real captured image — gives precise control
 * over content (we can show ideal data) and stays sharp at any resolution.
 *
 * Industry tiles, problem strip, feature blocks, how-it-works, FAQ,
 * footer all live in this single page for v1.
 */

import Link from "next/link";
import { useAuth } from "@/lib/supabase/AuthContext";

const CALENDLY_URL = "https://calendly.com/denniscolonjr/30min";

export default function LandingPage() {
  const { session, loading } = useAuth();
  const isSignedIn = !loading && !!session;

  return (
    <div style={{
      /*
       * Self-contained scroll context.
       *
       * The root layout sets `body { height: 100vh; overflow: hidden }` to
       * give the dashboard a fixed app-shell with sticky TopNav and a single
       * inner scrolling area. That global lock is essential for the rest of
       * the app but it kills scrolling for marketing pages that need to be
       * long-form scrollable documents.
       *
       * Rather than change the global layout (and risk breaking the
       * dashboard / kiosk / detail pages), the landing owns its own scroll
       * context here: fixed to fill the viewport, with overflow-y auto so
       * the page can be as long as it needs to be while keeping body locked.
       */
      height: "100vh",
      overflowY: "auto",
      overflowX: "hidden",
      background: "var(--bg)",
      color: "var(--t1)",
      scrollBehavior: "smooth",
    }}>
      <Header isSignedIn={isSignedIn} />
      <Hero isSignedIn={isSignedIn} />
      <ProblemStrip />
      <FeatureSection />
      <IndustriesSection />
      <HowItWorks />
      <FAQ />
      <FinalCTA isSignedIn={isSignedIn} />
      <Footer />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Header
// ──────────────────────────────────────────────────────────────────────────

function Header({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(14,14,14,0.85)",
      backdropFilter: "saturate(180%) blur(12px)",
      WebkitBackdropFilter: "saturate(180%) blur(12px)",
      borderBottom: "1px solid var(--b1)",
    }}>
      <div style={{
        maxWidth: 1180, margin: "0 auto",
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{
          fontFamily: "Georgia, serif",
          fontSize: 22, fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--t1)", textDecoration: "none",
        }}>
          Cage<span style={{ color: "var(--acc)" }}>OS</span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <a href="#features" onClick={smoothScrollToId} style={navLinkStyle} className="landing-nav-link">Features</a>
          <a href="#industries" onClick={smoothScrollToId} style={navLinkStyle} className="landing-nav-link">Industries</a>

          {isSignedIn ? (
            <Link href="/dashboard" style={primaryButtonStyle}>
              Open dashboard →
            </Link>
          ) : (
            <>
              <Link href="/login" style={navLinkStyle}>Sign in</Link>
              <Link href="/signup" style={primaryButtonStyle}>
                Sign up free
              </Link>
            </>
          )}
        </nav>
      </div>
      <style jsx>{`
        @media (max-width: 720px) {
          nav a:not(:last-child) {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}

const navLinkStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 13,
  color: "var(--t2)",
  textDecoration: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  fontFamily: "'Syne', sans-serif",
  fontSize: 13, fontWeight: 700,
  background: "var(--acc)", color: "var(--bg)",
  padding: "9px 16px", borderRadius: 7,
  textDecoration: "none",
  letterSpacing: "0.01em",
};

const secondaryButtonStyle: React.CSSProperties = {
  fontFamily: "'Syne', sans-serif",
  fontSize: 13, fontWeight: 600,
  background: "transparent", color: "var(--t1)",
  padding: "9px 16px", borderRadius: 7,
  textDecoration: "none",
  border: "1px solid var(--b2)",
  letterSpacing: "0.01em",
};

/**
 * Smooth-scroll handler for in-page anchor links.
 *
 * Because the landing page owns its own scroll context (not the document /
 * window), the default browser anchor behavior won't smoothly scroll —
 * it would try to scroll the window which has no scroll. We intercept the
 * click, find the target section by id, find the nearest scrollable ancestor
 * (the landing root div), and call scrollTo on that with `behavior: "smooth"`.
 *
 * Falls back to scrollIntoView if the ancestor walk fails for any reason.
 */
function smoothScrollToId(e: React.MouseEvent<HTMLAnchorElement>) {
  const href = e.currentTarget.getAttribute("href");
  if (!href?.startsWith("#")) return;
  const id = href.slice(1);
  const target = document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  // Walk up to find the actual scroll container (the landing root div).
  let scrollParent: HTMLElement | null = target.parentElement;
  while (scrollParent) {
    const style = window.getComputedStyle(scrollParent);
    if (style.overflowY === "auto" || style.overflowY === "scroll") break;
    scrollParent = scrollParent.parentElement;
  }
  if (scrollParent) {
    // Account for the sticky header height (~50px) so the section title
    // isn't covered by the header after scrolling.
    const headerOffset = 56;
    const targetTop = target.getBoundingClientRect().top
      - scrollParent.getBoundingClientRect().top
      + scrollParent.scrollTop
      - headerOffset;
    scrollParent.scrollTo({ top: targetTop, behavior: "smooth" });
  } else {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Hero
// ──────────────────────────────────────────────────────────────────────────

function Hero({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section style={{
      padding: "80px 24px 64px",
      textAlign: "center",
      maxWidth: 1180, margin: "0 auto",
    }}>
      {/* Pre-headline pill */}
      <div style={{
        display: "inline-block",
        fontFamily: "'DM Mono', monospace", fontSize: 11,
        color: "var(--acc)", letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "5px 12px",
        background: "rgba(236,255,112,0.06)",
        border: "1px solid rgba(236,255,112,0.2)",
        borderRadius: 999,
        marginBottom: 22,
      }}>
        Built for crews that move gear
      </div>

      <h1 style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: "clamp(38px, 6vw, 64px)",
        fontWeight: 700,
        letterSpacing: "-0.02em",
        lineHeight: 1.05,
        margin: "0 0 18px",
        color: "var(--t1)",
      }}>
        Know where every piece of<br />
        equipment is. Every time.
      </h1>

      <p style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "clamp(15px, 1.6vw, 19px)",
        color: "var(--t2)",
        lineHeight: 1.5,
        maxWidth: 640, margin: "0 auto 36px",
      }}>
        Replaces your spreadsheet, your group chat, and the
        &ldquo;who has the 50mm lens?&rdquo; problem.
      </p>

      <div style={{
        display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap",
        marginBottom: 60,
      }}>
        <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" style={{
          ...primaryButtonStyle,
          padding: "14px 26px",
          fontSize: 14,
        }}>
          Schedule a demo
        </a>
        {isSignedIn ? (
          <Link href="/dashboard" style={{
            ...secondaryButtonStyle,
            padding: "14px 26px",
            fontSize: 14,
          }}>
            Open dashboard →
          </Link>
        ) : (
          <Link href="/signup" style={{
            ...secondaryButtonStyle,
            padding: "14px 26px",
            fontSize: 14,
          }}>
            Sign up free
          </Link>
        )}
      </div>

      {/* Hero mockup */}
      <div style={{ position: "relative", maxWidth: 1000, margin: "0 auto" }}>
        <HeroDashboardMockup />
        {/* Soft yellow glow under the mockup */}
        <div aria-hidden style={{
          position: "absolute",
          inset: "60% -10% -20% -10%",
          background: "radial-gradient(60% 50% at 50% 50%, rgba(236,255,112,0.15), transparent 70%)",
          filter: "blur(40px)",
          zIndex: -1,
        }} />
      </div>
    </section>
  );
}

/**
 * Inline SVG/HTML mockup of the dashboard. Pure CSS — no real image asset.
 * Stays sharp at any pixel density, easy to update if the real UI changes.
 *
 * Design philosophy: show realistic-looking data, not just empty chrome.
 * Prospects need to picture themselves using it.
 */
function HeroDashboardMockup() {
  return (
    <div style={{
      background: "var(--s1)",
      border: "1px solid var(--b1)",
      borderRadius: 12,
      boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
      overflow: "hidden",
      textAlign: "left",
    }}>
      {/* Browser-like chrome */}
      <div style={{
        background: "var(--s2)",
        padding: "10px 14px",
        borderBottom: "1px solid var(--b1)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ display: "flex", gap: 5 }}>
          <span style={dotStyle("#ff5f57")} />
          <span style={dotStyle("#febc2e")} />
          <span style={dotStyle("#28c840")} />
        </div>
        <div style={{
          flex: 1, textAlign: "center",
          fontFamily: "'DM Mono', monospace", fontSize: 10,
          color: "var(--t3)",
        }}>
          cageos.app/dashboard
        </div>
      </div>

      {/* Dashboard mock content */}
      <div style={{ display: "flex", minHeight: 380 }}>
        {/* Sidebar */}
        <div style={{
          width: 160, background: "var(--bg)",
          borderRight: "1px solid var(--b1)",
          padding: "16px 12px",
          fontFamily: "'DM Sans', sans-serif", fontSize: 11,
        }}>
          <div style={sidebarLabelStyle}>OVERVIEW</div>
          <div style={sidebarItemActiveStyle}>● Cage status</div>
          <div style={sidebarItemStyle}>● Active checkouts</div>

          <div style={{ ...sidebarLabelStyle, marginTop: 18 }}>INVENTORY</div>
          <div style={sidebarItemStyle}>● All assets <span style={countStyle}>247</span></div>
          <div style={sidebarItemStyle}>● Kits <span style={countStyle}>12</span></div>
          <div style={sidebarItemStyle}>● Service flags <span style={countStyle}>3</span></div>

          <div style={{ ...sidebarLabelStyle, marginTop: 18 }}>ADMIN</div>
          <div style={sidebarItemStyle}>● Settings</div>
          <div style={sidebarItemStyle}>● Audit log</div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: "20px 24px" }}>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700,
            marginBottom: 14,
          }}>Cage status</div>

          {/* Stat cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10, marginBottom: 18,
          }}>
            {[
              { label: "Checked in", value: "239", color: "var(--green)", count: "of 247" },
              { label: "Checked out", value: "8", color: "var(--amber)", count: "active" },
              { label: "Service flags", value: "3", color: "var(--red)", count: "open" },
              { label: "Kit drift", value: "0", color: "var(--t3)", count: "none" },
            ].map((s, i) => (
              <div key={i} style={{
                background: "var(--s2)", border: "1px solid var(--b1)",
                borderTop: `2px solid ${s.color}`,
                borderRadius: 6, padding: "9px 11px",
              }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--t3)", marginBottom: 4 }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: "var(--t1)" }}>
                  {s.value}
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "var(--t3)", marginTop: 2 }}>
                  {s.count}
                </div>
              </div>
            ))}
          </div>

          {/* Recent activity table */}
          <div style={{
            background: "var(--s2)", border: "1px solid var(--b1)",
            borderRadius: 7, overflow: "hidden",
          }}>
            <div style={{
              padding: "10px 13px",
              fontFamily: "'Syne', sans-serif", fontSize: 12, fontWeight: 700,
              borderBottom: "1px solid var(--b1)",
            }}>Recent activity</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10 }}>
              {[
                { asset: "Sigma 85mm f/1.4", code: "AST-0142", status: "out", user: "Brittany R", time: "2m ago" },
                { asset: "Sennheiser MKE 600", code: "AST-0089", status: "in", user: "Kevin L", time: "14m ago" },
                { asset: "Cinema Bag A", code: "KIT-0008", status: "out", user: "Eli M", time: "32m ago" },
                { asset: "DJI RS 4 Pro", code: "AST-0203", status: "flagged", user: "Brittany R", time: "1h ago" },
              ].map((r, i) => (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 0.7fr 1fr 0.6fr",
                  gap: 10, padding: "8px 13px",
                  borderTop: i > 0 ? "1px solid var(--b1)" : "none",
                  alignItems: "center",
                }}>
                  <span style={{ color: "var(--t1)" }}>{r.asset}</span>
                  <span style={{ color: "var(--t3)" }}>{r.code}</span>
                  <span>
                    <span style={statusPillStyle(r.status)}>● {r.status}</span>
                  </span>
                  <span style={{ color: "var(--t2)" }}>{r.user}</span>
                  <span style={{ color: "var(--t3)", textAlign: "right" }}>{r.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const dotStyle = (color: string): React.CSSProperties => ({
  display: "inline-block",
  width: 11, height: 11, borderRadius: "50%",
  background: color,
});

const sidebarLabelStyle: React.CSSProperties = {
  fontFamily: "'DM Mono', monospace", fontSize: 8.5,
  color: "var(--t3)", letterSpacing: "0.08em",
  marginBottom: 6, paddingLeft: 4,
};

const sidebarItemStyle: React.CSSProperties = {
  fontFamily: "'DM Sans', sans-serif", fontSize: 11,
  color: "var(--t2)", padding: "4px 6px", borderRadius: 3,
  display: "flex", justifyContent: "space-between", alignItems: "center",
  marginBottom: 2,
};

const sidebarItemActiveStyle: React.CSSProperties = {
  ...sidebarItemStyle,
  color: "var(--t1)",
  background: "var(--s2)",
};

const countStyle: React.CSSProperties = {
  fontFamily: "'DM Mono', monospace", fontSize: 9,
  color: "var(--t3)",
};

function statusPillStyle(status: string): React.CSSProperties {
  const colors: Record<string, string> = {
    in: "var(--green)",
    out: "var(--amber)",
    flagged: "var(--red)",
  };
  return {
    color: colors[status] ?? "var(--t3)",
    fontSize: 9,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Problem strip
// ──────────────────────────────────────────────────────────────────────────

function ProblemStrip() {
  return (
    <section style={{
      borderTop: "1px solid var(--b1)",
      borderBottom: "1px solid var(--b1)",
      background: "var(--s1)",
      padding: "44px 24px",
    }}>
      <div style={{
        maxWidth: 1180, margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 32,
      }}>
        {[
          { title: "Stuff goes missing.", body: "Crew takes a tool to a job, doesn't bring it back. Three weeks later you need it and nobody remembers who had it." },
          { title: "No one flagged that it's broken.", body: "The next person grabs it, finds out the hard way. You eat the repair cost AND a delayed job." },
          { title: "Spreadsheets break at scale.", body: "Fine for 50 items. Painful at 500. Hopeless at 5,000. You need real software." },
        ].map((p, i) => (
          <div key={i}>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700,
              color: "var(--t1)", marginBottom: 8, letterSpacing: "-0.01em",
            }}>{p.title}</div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 14,
              color: "var(--t2)", lineHeight: 1.55,
            }}>{p.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Feature section
// ──────────────────────────────────────────────────────────────────────────

function FeatureSection() {
  return (
    <section id="features" style={{
      padding: "100px 24px",
      maxWidth: 1180, margin: "0 auto",
    }}>
      <SectionHeader
        eyebrow="What's inside"
        title="Built for the way your team actually works"
        subtitle="Every part of CageOS came from a real workflow. Not a feature checklist — the things that make a difference when you're trying to find a wrench at 7am."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 80, marginTop: 64 }}>
        <FeatureBlock
          eyebrow="Inventory"
          title="Every asset has a home, a history, and a barcode."
          body="Track each piece of equipment from purchase to retirement. Photos, notes, service flags, audit trail. Barcode-ready so you can scan in the field — or just point and click."
          mockup={<AssetDetailMockup />}
          reverse={false}
        />
        <FeatureBlock
          eyebrow="Kits"
          title="Group gear that travels together."
          body="A cinema kit is a body, a lens set, a follow focus, a battery plate. A landscape rig is a mower, a trimmer, an edger, and a trailer. Kits travel as one item — check out the kit, check out everything inside."
          mockup={<KitMockup />}
          reverse={true}
        />
        <FeatureBlock
          eyebrow="Kiosk mode"
          title="Self-service checkout, no admin required."
          body="Mount a tablet by the door. Crew scans their badge, picks gear, hits go. You get the audit trail. They get out the door faster."
          mockup={<KioskMockup />}
          reverse={false}
        />
        <FeatureBlock
          eyebrow="Comments & audit"
          title="Discussion lives with the equipment."
          body="Brittany flagged the Sigma 85: 'autofocus motor clicking on pans.' Kevin replied: 'taking it to repair Tuesday.' Two months later, you can look it up. The full history sticks with the asset."
          mockup={<CommentsMockup />}
          reverse={true}
        />
      </div>
    </section>
  );
}

function FeatureBlock({
  eyebrow, title, body, mockup, reverse,
}: {
  eyebrow: string; title: string; body: string; mockup: React.ReactNode; reverse: boolean;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 56,
      alignItems: "center",
    }} className="feature-block">
      <div style={{ order: reverse ? 2 : 1 }}>
        <div style={{
          fontFamily: "'DM Mono', monospace", fontSize: 11,
          color: "var(--acc)", letterSpacing: "0.12em",
          textTransform: "uppercase", marginBottom: 14,
        }}>{eyebrow}</div>
        <h3 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "clamp(22px, 2.5vw, 30px)",
          fontWeight: 700, letterSpacing: "-0.01em",
          color: "var(--t1)", lineHeight: 1.15,
          margin: "0 0 16px",
        }}>{title}</h3>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 15, lineHeight: 1.6,
          color: "var(--t2)", margin: 0,
        }}>{body}</p>
      </div>
      <div style={{ order: reverse ? 1 : 2 }}>
        {mockup}
      </div>
      <style jsx>{`
        @media (max-width: 820px) {
          .feature-block {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
          .feature-block > div:first-child {
            order: 1 !important;
          }
          .feature-block > div:last-child {
            order: 2 !important;
          }
        }
      `}</style>
    </div>
  );
}

function AssetDetailMockup() {
  return (
    <div style={mockupCardStyle}>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 14, padding: 16 }}>
        {/* Photo placeholder with gradient camera shape */}
        <div style={{
          aspectRatio: "1", borderRadius: 8,
          background: "linear-gradient(135deg, #2a2a2a, #1a1a1a)",
          border: "1px solid var(--b1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
        }}>
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none"
               stroke="var(--t3)" strokeWidth="1.5"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 3 }}>
            Sigma 85mm f/1.4 DG HSM Art
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--t3)", marginBottom: 10 }}>
            AST-0142 · Lens · Bay 3
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px", fontSize: 10 }}>
            {[
              ["STATUS", "● Checked out"],
              ["USER", "Brittany R"],
              ["DUE BACK", "Tomorrow 9am"],
              ["LIFECYCLE", "Active"],
            ].map(([k, v]) => (
              <>
                <span key={`k-${k}`} style={{ fontFamily: "'DM Mono', monospace", color: "var(--t3)", fontSize: 8.5, letterSpacing: "0.06em" }}>{k}</span>
                <span key={`v-${k}`} style={{ fontFamily: "'DM Sans', sans-serif", color: "var(--t1)" }}>{v}</span>
              </>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: "0 16px 14px" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--t3)", marginBottom: 6, letterSpacing: "0.06em" }}>
          SERVICE HISTORY
        </div>
        <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
          <div>● Jan 2026 — Front element cleaned, calibrated</div>
          <div>● Aug 2025 — Autofocus motor replaced (warranty)</div>
          <div>● Mar 2025 — Purchased</div>
        </div>
      </div>
    </div>
  );
}

function KitMockup() {
  return (
    <div style={mockupCardStyle}>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700 }}>
            Cinema Kit A
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--amber)" }}>
            ● Checked out
          </div>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--t3)", marginBottom: 12 }}>
          KIT-0008 · 7 components
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            "Sony FX6 body",
            "Sigma 24-70mm f/2.8",
            "Sigma 85mm f/1.4",
            "DJI RS 4 Pro gimbal",
            "Sennheiser MKE 600",
            "Aputure 300d MkII",
            "Pelican 1620 case",
          ].map((c, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 8px", borderRadius: 4,
              background: i % 2 === 0 ? "var(--s2)" : "transparent",
              fontFamily: "'DM Sans', sans-serif", fontSize: 11,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "var(--green)", flexShrink: 0,
              }} />
              <span style={{ color: "var(--t1)" }}>{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KioskMockup() {
  return (
    <div style={{
      ...mockupCardStyle,
      background: "linear-gradient(180deg, var(--bg), var(--s1))",
    }}>
      <div style={{ padding: 22, textAlign: "center" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--t3)", marginBottom: 6, letterSpacing: "0.1em" }}>
          KIOSK · TAP TO START
        </div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 4, color: "var(--t1)" }}>
          Welcome back, Brittany.
        </div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "var(--t3)", marginBottom: 20 }}>
          Choose your action below.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div style={{
            padding: "16px 12px", borderRadius: 8,
            background: "var(--acc)", color: "var(--bg)",
            fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14,
          }}>↗ Check out</div>
          <div style={{
            padding: "16px 12px", borderRadius: 8,
            background: "var(--s2)", color: "var(--t1)",
            border: "1px solid var(--b2)",
            fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14,
          }}>↙ Check in</div>
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--t3)" }}>
          Currently: 8 items checked out · 3 to you
        </div>
      </div>
    </div>
  );
}

function CommentsMockup() {
  return (
    <div style={mockupCardStyle}>
      <div style={{ padding: 16 }}>
        <div style={{
          fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--t3)",
          letterSpacing: "0.08em", marginBottom: 12,
        }}>COMMENTS · DJI RS 4 PRO</div>

        {[
          {
            initials: "BR", color: "#fbc25c", name: "Brittany R.", time: "2d ago",
            body: "Heads up — motor 2 is whining when panning fast. Working but watch it.",
            isTask: true,
          },
          {
            initials: "KL", color: "#6deea0", name: "Kevin L.", time: "1d ago",
            body: "Taking it to repair Tuesday. Will swap motor before next shoot.",
          },
          {
            initials: "DC", color: "#ecff70", name: "Dennis C.", time: "3h ago",
            body: "@KL got a quote — covered under warranty. Pickup Friday.",
          },
        ].map((c, i) => (
          <div key={i} style={{
            display: "flex", gap: 9, paddingBottom: 11,
            marginBottom: 11,
            borderBottom: i < 2 ? "1px solid var(--b1)" : "none",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "var(--s2)", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Syne', sans-serif", fontSize: 8.5, fontWeight: 700,
              color: c.color,
            }}>{c.initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t1)" }}>{c.name}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8.5, color: "var(--t3)" }}>{c.time}</span>
                {c.isTask && (
                  <span style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 7.5, fontWeight: 700,
                    padding: "1px 5px", borderRadius: 2,
                    background: "rgba(251,194,92,0.1)", color: "var(--amber)",
                    border: "1px solid var(--amber)", letterSpacing: "0.05em",
                  }}>TASK</span>
                )}
              </div>
              <div style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: "var(--t1)",
                lineHeight: 1.45,
              }}>
                {c.body.split(/(@[A-Z]+)/).map((part, j) =>
                  part.match(/^@[A-Z]+$/) ? (
                    <span key={j} style={{ color: "var(--acc)", fontWeight: 600 }}>{part}</span>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const mockupCardStyle: React.CSSProperties = {
  background: "var(--s1)",
  border: "1px solid var(--b1)",
  borderRadius: 10,
  boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
  overflow: "hidden",
};

// ──────────────────────────────────────────────────────────────────────────
// Industries section
// ──────────────────────────────────────────────────────────────────────────

function IndustriesSection() {
  const industries = [
    { name: "AV & video production", body: "Cameras, lenses, mics, lighting, kit composition across shoots and venues.", icon: <IconCamera /> },
    { name: "Theater & live events", body: "Props, costumes, lighting rigs, audio gear across shows and venues.", icon: <IconLight /> },
    { name: "Construction & trades", body: "Power tools, ladders, generators, scaffolding moving across job sites.", icon: <IconHammer /> },
    { name: "Schools & education", body: "Athletic gear, AV carts, lab equipment, instruments — across departments.", icon: <IconBook /> },
    { name: "Landscaping & lawn care", body: "Mowers, trimmers, attachments, and trailers in and out daily.", icon: <IconLeaf /> },
    { name: "Auto repair shops", body: "Diagnostic tools, calibrated equipment, specialty wrenches per bay.", icon: <IconWrench /> },
  ];

  return (
    <section id="industries" style={{
      padding: "100px 24px",
      borderTop: "1px solid var(--b1)",
      background: "var(--s1)",
    }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <SectionHeader
          eyebrow="Adaptable"
          title="Built for any team with a cage, shop, or storage room."
          subtitle="If your team checks things out and needs them back, CageOS works the way you work."
        />

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 18,
          marginTop: 50,
        }}>
          {industries.map((ind, i) => (
            <div key={i} style={{
              background: "var(--bg)",
              border: "1px solid var(--b1)",
              borderRadius: 10,
              padding: "22px 22px 20px",
              transition: "transform 0.2s, border-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.borderColor = "var(--b2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "var(--b1)";
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 7,
                background: "rgba(236,255,112,0.08)",
                border: "1px solid rgba(236,255,112,0.2)",
                color: "var(--acc)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 14,
              }}>
                {ind.icon}
              </div>
              <div style={{
                fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700,
                color: "var(--t1)", marginBottom: 6,
              }}>{ind.name}</div>
              <div style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                color: "var(--t2)", lineHeight: 1.5,
              }}>{ind.body}</div>
            </div>
          ))}
        </div>

        <div style={{
          textAlign: "center",
          fontFamily: "'DM Mono', monospace", fontSize: 11,
          color: "var(--t3)", marginTop: 32,
        }}>
          Your industry not listed? It probably still works. Ask us.
        </div>
      </div>
    </section>
  );
}

// Icon set — clean line icons matching the design system
function IconCamera() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>;
}
function IconHammer() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9" /><path d="M17.64 15 22 10.64" /><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91" /></svg>;
}
function IconLeaf() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96c.6 4.78.6 8.93-.4 11.41C18 16.05 15.18 17 13 17a4 4 0 0 1-2-2Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></svg>;
}
function IconBook() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" /></svg>;
}
function IconLight() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" /></svg>;
}
function IconWrench() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>;
}

// ──────────────────────────────────────────────────────────────────────────
// How it works
// ──────────────────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { num: "01", title: "Add your gear.", body: "Import a spreadsheet, type it in, or scan barcodes. Photos optional but useful." },
    { num: "02", title: "Set up your team.", body: "Invite teammates by email. Owner, Manager, Crew, and Viewer roles control who can do what." },
    { num: "03", title: "Track and audit.", body: "Crew checks gear in and out. You get an audit trail, comments, flags, and the ability to find anything in seconds." },
  ];

  return (
    <section style={{ padding: "100px 24px", maxWidth: 1180, margin: "0 auto" }}>
      <SectionHeader
        eyebrow="How it works"
        title="Up and running in 10 minutes."
        subtitle="No IT department needed. No two-week onboarding. Open the page, add a couple assets, invite your team."
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 22, marginTop: 48,
      }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            background: "var(--s1)",
            border: "1px solid var(--b1)",
            borderRadius: 10,
            padding: "26px 24px",
            position: "relative",
          }}>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 44, fontWeight: 700,
              color: "var(--acc)",
              lineHeight: 1, marginBottom: 14,
              letterSpacing: "-0.03em",
            }}>{s.num}</div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700,
              color: "var(--t1)", marginBottom: 7,
            }}>{s.title}</div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 14,
              color: "var(--t2)", lineHeight: 1.55,
            }}>{s.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// CheckIcon
// ──────────────────────────────────────────────────────────────────────────

function CheckIcon({ accent }: { accent?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke={accent ? "var(--acc)" : "var(--green)"}
         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
         style={{ marginTop: 4, flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// FAQ
// ──────────────────────────────────────────────────────────────────────────

function FAQ() {
  const faqs = [
    { q: "Is CageOS free?", a: "CageOS is free during open beta. We're working closely with our first crews to make sure the product is genuinely useful before we think about pricing. Sign up, use it, tell us what works." },
    { q: "How is this different from a spreadsheet?", a: "Spreadsheets don't enforce checkout state, don't keep audit trails, don't notify when something's broken, and don't have a kiosk mode. They're fine until they aren't. We're built for the 'aren't' part." },
    { q: "Do I need to install anything?", a: "No. CageOS runs in any modern browser, on any device — desktop, tablet, phone. The kiosk mode is just a browser tab on a tablet by the door." },
    { q: "Can my team use it without accounts?", a: "Yes for kiosk mode — set up a passcode and crew can check gear in and out without individual accounts. For comments, audit attribution, and admin actions, accounts are needed." },
    { q: "Will my data be safe?", a: "Your workspace data is encrypted at rest, backed up daily, and isolated from other workspaces. You can export everything at any time. We don't share or sell your data." },
    { q: "What if I want to leave?", a: "Export everything to CSV. Delete your workspace. Done. No retention games, no 'contact us to cancel' nonsense." },
  ];

  return (
    <section style={{ padding: "100px 24px", maxWidth: 820, margin: "0 auto" }}>
      <SectionHeader
        eyebrow="FAQ"
        title="Common questions."
      />
      <div style={{ marginTop: 36 }}>
        {faqs.map((faq, i) => (
          <details key={i} style={{
            borderBottom: "1px solid var(--b1)",
            padding: "20px 0",
          }}>
            <summary style={{
              fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 600,
              color: "var(--t1)", cursor: "pointer",
              listStyle: "none",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              gap: 12,
            }}>
              {faq.q}
              <span style={{
                fontFamily: "'DM Mono', monospace", fontSize: 18,
                color: "var(--t3)", flexShrink: 0,
                transition: "transform 0.2s",
              }}>+</span>
            </summary>
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 14,
              color: "var(--t2)", lineHeight: 1.6,
              marginTop: 12,
            }}>{faq.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Final CTA
// ──────────────────────────────────────────────────────────────────────────

function FinalCTA({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section style={{
      padding: "80px 24px 100px",
      background: "var(--s1)",
      borderTop: "1px solid var(--b1)",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "clamp(28px, 4vw, 42px)",
          fontWeight: 700, letterSpacing: "-0.02em",
          lineHeight: 1.1, margin: "0 0 16px",
          color: "var(--t1)",
        }}>
          Find your gear in seconds.<br />
          Not in a group chat.
        </h2>
        <p style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 16,
          color: "var(--t2)", lineHeight: 1.5,
          margin: "0 auto 32px",
          maxWidth: 540,
        }}>
          Schedule a 30-minute demo and we&apos;ll walk through how CageOS
          fits your operation. Or just sign up and try it.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" style={{
            ...primaryButtonStyle,
            padding: "14px 26px",
            fontSize: 14,
          }}>
            Schedule a demo
          </a>
          {isSignedIn ? (
            <Link href="/dashboard" style={{
              ...secondaryButtonStyle,
              padding: "14px 26px",
              fontSize: 14,
            }}>
              Open dashboard →
            </Link>
          ) : (
            <Link href="/signup" style={{
              ...secondaryButtonStyle,
              padding: "14px 26px",
              fontSize: 14,
            }}>
              Sign up free
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Footer
// ──────────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid var(--b1)",
      padding: "32px 24px",
    }}>
      <div style={{
        maxWidth: 1180, margin: "0 auto",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 16,
      }}>
        <div style={{
          fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 700,
          color: "var(--t1)", letterSpacing: "-0.01em",
        }}>
          Cage<span style={{ color: "var(--acc)" }}>OS</span>
        </div>
        <div style={{
          display: "flex", gap: 22, alignItems: "center",
          fontFamily: "'DM Mono', monospace", fontSize: 11,
          color: "var(--t3)",
          flexWrap: "wrap",
        }}>
          <Link href="/privacy" style={{ color: "var(--t3)", textDecoration: "none" }}>Privacy</Link>
          <Link href="/terms" style={{ color: "var(--t3)", textDecoration: "none" }}>Terms</Link>
          <a href="mailto:hello@cageos.app" style={{ color: "var(--t3)", textDecoration: "none" }}>hello@cageos.app</a>
          <span>© {new Date().getFullYear()} CageOS</span>
        </div>
      </div>
    </footer>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Shared section header
// ──────────────────────────────────────────────────────────────────────────

function SectionHeader({
  eyebrow, title, subtitle,
}: {
  eyebrow?: string; title: string; subtitle?: string;
}) {
  return (
    <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
      {eyebrow && (
        <div style={{
          fontFamily: "'DM Mono', monospace", fontSize: 11,
          color: "var(--acc)", letterSpacing: "0.12em",
          textTransform: "uppercase", marginBottom: 14,
        }}>{eyebrow}</div>
      )}
      <h2 style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: "clamp(26px, 3.5vw, 38px)",
        fontWeight: 700, letterSpacing: "-0.02em",
        lineHeight: 1.15, margin: 0,
        color: "var(--t1)",
      }}>{title}</h2>
      {subtitle && (
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 15, color: "var(--t2)",
          lineHeight: 1.55, margin: "16px auto 0",
          maxWidth: 560,
        }}>{subtitle}</p>
      )}
    </div>
  );
}
