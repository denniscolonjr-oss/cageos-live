import { CSSProperties } from "react";

type Variant = "green" | "amber" | "red" | "blue" | "purple" | "gray";

const VARIANTS: Record<Variant, { bg: string; color: string }> = {
  green:  { bg: "rgba(109,238,159,0.1)",  color: "var(--green)" },
  amber:  { bg: "rgba(251,194,92,0.1)",  color: "var(--amber)" },
  red:    { bg: "rgba(255,122,122,0.1)",   color: "var(--red)" },
  blue:   { bg: "rgba(122,181,245,0.1)",  color: "var(--blue)" },
  purple: { bg: "rgba(167,139,250,0.1)", color: "var(--purple)" },
  gray:   { bg: "var(--s2)",             color: "var(--t2)" },
};

export default function Badge({ variant = "gray", children, style }: {
  variant?: Variant;
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  const v = VARIANTS[variant];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 3,
      fontSize: 10, fontFamily: "'DM Mono', monospace", fontWeight: 500,
      background: v.bg, color: v.color,
      ...style,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
      {children}
    </span>
  );
}
