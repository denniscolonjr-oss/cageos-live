import { CSSProperties, ReactNode } from "react";

export default function Card({
  children,
  accentColor,
  style,
  className,
}: {
  children: ReactNode;
  accentColor?: string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: "var(--s1)",
        border: "1px solid var(--b1)",
        borderRadius: 10,
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      {accentColor && (
        <div
          style={{
            position: "absolute", top: 0, left: 0, right: 0,
            height: 2, background: accentColor,
          }}
        />
      )}
      {children}
    </div>
  );
}
