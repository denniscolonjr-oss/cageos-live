/**
 * Terms of Service page (route: `/terms`)
 *
 * Placeholder content for v1. Real lawyer-vetted terms come later, before
 * charging anyone or signing enterprise customers. This v1 covers the basics:
 *   - Use of the service during beta
 *   - Your responsibility for your data and your team
 *   - Our right to discontinue features or the service
 *   - Liability disclaimers
 *
 * Pay a lawyer for proper terms BEFORE:
 *   - Charging customers (changes the contract entirely)
 *   - Signing any enterprise deal
 *   - Storing regulated data (HIPAA, FERPA, ITAR, etc.)
 */

export const metadata = {
  title: "Terms of Service",
  description: "Terms governing use of CageOS during open beta.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsPage() {
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
        }}>Terms of Service</h1>
        <p style={{
          fontFamily: "'DM Mono', monospace", fontSize: 12,
          color: "var(--t3)", margin: "0 0 40px",
        }}>Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <Section title="Acceptance">
          <p>
            By signing up for or using CageOS, you agree to these terms. If you
            don&apos;t agree, don&apos;t use the service.
          </p>
        </Section>

        <Section title="Beta status">
          <p>
            CageOS is currently in open beta. The service is provided as-is. We
            may change, restrict, or remove features without notice. We will make
            reasonable efforts to maintain uptime but cannot guarantee it during
            this period.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            You&apos;re responsible for keeping your account credentials secure
            and for the activity of users you invite to your workspace. If you
            think your account has been compromised, tell us immediately at{" "}
            <a href="mailto:hello@cageos.app" style={{ color: "var(--acc)" }}>hello@cageos.app</a>.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            Don&apos;t use CageOS to:
          </p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li>Store unlawful content</li>
            <li>Attempt to access other workspaces or our infrastructure</li>
            <li>Scrape, reverse-engineer, or resell the service</li>
            <li>Send spam through invitation features</li>
          </ul>
        </Section>

        <Section title="Your data">
          <p>
            You retain ownership of all data you put into CageOS. We have a
            limited license to host, display, and process it solely to provide
            the service. See our{" "}
            <a href="/privacy" style={{ color: "var(--acc)" }}>Privacy Policy</a>{" "}
            for details.
          </p>
        </Section>

        <Section title="Termination">
          <p>
            You can stop using CageOS and delete your workspace at any time. We
            may suspend or terminate accounts that violate these terms.
          </p>
        </Section>

        <Section title="Disclaimers">
          <p>
            The service is provided &ldquo;as is&rdquo; without warranties of any
            kind. We&apos;re not liable for losses arising from your use of the
            service except where prohibited by law. Maximum liability is limited
            to the fees you&apos;ve paid us in the prior 12 months (currently $0
            during beta).
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms. Material changes will be communicated to
            active workspaces via email at least 14 days before they take effect.
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
