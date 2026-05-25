/**
 * Privacy policy page (route: `/privacy`)
 *
 * Placeholder content for v1. Real lawyer-vetted privacy policy comes later,
 * before we charge anyone or onboard users at scale. For now this satisfies:
 *   - Footer link target
 *   - SOC 2 / vendor security review checkbox (some prospects ask)
 *   - Apple/Google/Vercel sometimes require a privacy URL for app submissions
 *
 * Update this BEFORE doing any of these:
 *   - Charging customers
 *   - Onboarding regulated industries (healthcare, finance, government)
 *   - Marketing to EU users (GDPR)
 *   - Adding cookies beyond session/auth
 *   - Integrating third-party tracking (analytics, ads)
 */

export const metadata = {
  title: "Privacy Policy",
  description: "How CageOS collects, uses, and protects your data.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPage() {
  return (
    <div style={{
      height: "100vh",
      overflowY: "auto",
      overflowX: "hidden",
      background: "var(--bg)",
      color: "var(--t1)",
    }}>
      <div style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "60px 24px 100px",
        fontFamily: "'DM Sans', sans-serif",
        lineHeight: 1.6,
      }}>
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 36, fontWeight: 700,
          letterSpacing: "-0.02em",
          margin: "0 0 8px",
        }}>Privacy Policy</h1>
        <p style={{
          fontFamily: "'DM Mono', monospace", fontSize: 12,
          color: "var(--t3)", margin: "0 0 40px",
        }}>Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <Section title="What we collect">
          <p>
            When you sign up for CageOS, we collect your email address and the name
            you choose to display. When you use the product, we store the data you
            put into your workspace: equipment records, photos, kits, comments,
            audit log entries, and other inventory information.
          </p>
        </Section>

        <Section title="How we use it">
          <p>
            We use this data to operate CageOS — showing you your workspace,
            authenticating your sessions, sending you operational emails (password
            resets, invitations you&apos;ve been sent), and maintaining backups.
            We do not sell your data. We do not share it with third parties for
            advertising. We do not use it to train AI models.
          </p>
        </Section>

        <Section title="Where it lives">
          <p>
            CageOS uses Supabase for database and storage, hosted in AWS US-East.
            Files (photos, attachments) are stored in Supabase storage. Your data
            is encrypted at rest and in transit. We make daily backups.
          </p>
        </Section>

        <Section title="Workspace isolation">
          <p>
            Every workspace is logically isolated from every other workspace via
            row-level security policies. Members of one workspace cannot see, query,
            or modify data in another workspace.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can export your entire workspace to CSV at any time from the
            Settings page. You can delete your workspace at any time, which removes
            all your data from our systems within 30 days (the 30-day window
            covers backup retention).
          </p>
          <p>
            For data deletion or access requests, email{" "}
            <a href="mailto:hello@cageos.app" style={{ color: "var(--acc)" }}>hello@cageos.app</a>.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We&apos;ll update this page when our practices change. Material changes
            will be communicated to active workspaces via email.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions? Email{" "}
            <a href="mailto:hello@cageos.app" style={{ color: "var(--acc)" }}>hello@cageos.app</a>.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: 20, fontWeight: 700,
        letterSpacing: "-0.01em",
        margin: "0 0 12px",
      }}>{title}</h2>
      <div style={{
        fontSize: 15, color: "var(--t2)",
      }}>{children}</div>
    </div>
  );
}
