"use client";

interface Props {
  value: string;
  onChange: (val: string) => void;
  minWords: number;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  /** Optional override for the requirement label. */
  requirementLabel?: string;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

export default function WordCountTextarea({
  value, onChange, minWords, placeholder, rows = 5, autoFocus, requirementLabel,
}: Props) {
  const words = countWords(value);
  const met = words >= minWords;

  return (
    <div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        style={{
          width: "100%",
          background: "var(--s2)",
          border: `1px solid ${met ? "var(--green)" : "var(--b1)"}`,
          borderRadius: 7,
          padding: "10px 12px",
          color: "var(--t1)",
          outline: "none",
          fontFamily: "'DM Sans',sans-serif",
          fontSize: 14,
          resize: "vertical",
          minHeight: rows * 22,
          colorScheme: "dark",
        }}
      />
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 6, gap: 10, flexWrap: "wrap",
      }}>
        <div style={{
          fontFamily: "'DM Mono',monospace", fontSize: 10,
          color: met ? "var(--green)" : "var(--t3)",
        }}>
          {met
            ? `✓ ${words} words`
            : `${words} of ${minWords} words minimum`}
        </div>
        {requirementLabel && (
          <div style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: "var(--t3)" }}>
            {requirementLabel}
          </div>
        )}
      </div>
    </div>
  );
}
