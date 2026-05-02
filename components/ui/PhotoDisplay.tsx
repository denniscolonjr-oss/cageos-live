"use client";

/**
 * PhotoDisplay — show a photo as a thumbnail; click to view full size in a lightbox.
 *
 * Used by asset detail and flag detail pages.
 */

import { useState } from "react";

interface Props {
  url: string;
  alt: string;
  /** "small" thumbnail (60px) or "medium" (140px). Default medium. */
  size?: "small" | "medium" | "large";
  onRemove?: () => void;
}

export default function PhotoDisplay({ url, alt, size = "medium", onRemove }: Props) {
  const [open, setOpen] = useState(false);

  const sizes = {
    small: 60,
    medium: 140,
    large: 220,
  };
  const px = sizes[size];

  return (
    <>
      <div style={{ position: "relative", display: "inline-block" }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            width: px, height: px, padding: 0,
            border: "1px solid var(--b1)", borderRadius: 6,
            background: `url("${url}") center/cover`,
            cursor: "pointer", overflow: "hidden",
          }}
          title={`${alt} — click to enlarge`}
          aria-label={alt}
        />
        {onRemove && (
          <button
            onClick={onRemove}
            title="Remove photo"
            style={{
              position: "absolute", top: -6, right: -6,
              width: 22, height: 22, borderRadius: 11,
              background: "var(--s1)", border: "1px solid var(--b1)",
              color: "var(--red)", cursor: "pointer",
              fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            ×
          </button>
        )}
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20, cursor: "zoom-out",
          }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            style={{
              maxWidth: "100%", maxHeight: "100%",
              borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            style={{
              position: "absolute", top: 20, right: 20,
              width: 36, height: 36, borderRadius: 18,
              background: "var(--s1)", border: "1px solid var(--b1)",
              color: "var(--t1)", cursor: "pointer",
              fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
