/**
 * AvatarPickerModal — lets a user choose one of the 7 Y2K avatars.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <AvatarPickerModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     currentKey={profile.avatarKey}
 *     onSelect={(key) => {
 *       updateProfile(profile.id, { avatarKey: key });
 *       setOpen(false);
 *     }}
 *   />
 *
 * The "Remove avatar" button is shown only when currentKey is set, allowing
 * the user to go back to their initials circle. Selecting an avatar calls
 * onSelect with the new key and closes the modal (or you can keep it open;
 * the parent decides what to do after onSelect fires).
 */

"use client";

import React from "react";
import Modal from "@/components/ui/Modal";
import { AvatarSVG } from "./AvatarLibrary";
import { AVATARS, type AvatarKey } from "./avatarKeys";

interface AvatarPickerModalProps {
  open: boolean;
  onClose: () => void;
  /** The currently selected avatar key, if any. Used to highlight active selection. */
  currentKey?: string;
  /** Called when the user picks an avatar. Pass `null` when removing. */
  onSelect: (key: AvatarKey | null) => void;
}

export default function AvatarPickerModal({
  open,
  onClose,
  currentKey,
  onSelect,
}: AvatarPickerModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Choose your avatar" maxWidth={520}>
      <div style={{ marginBottom: 14 }}>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          color: "var(--t2)",
          lineHeight: 1.55,
          margin: 0,
        }}>
          Pick one that fits your role. You can change this any time, and you
          can always go back to your initials.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 10,
          marginBottom: currentKey ? 18 : 0,
        }}
      >
        {AVATARS.map((avatar) => {
          const isSelected = avatar.key === currentKey;
          return (
            <button
              key={avatar.key}
              onClick={() => onSelect(avatar.key)}
              style={{
                background: isSelected ? "var(--s3)" : "var(--s2)",
                border: isSelected
                  ? "1.5px solid var(--acc)"
                  : "1px solid var(--b1)",
                borderRadius: 10,
                padding: "12px 8px 10px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                transition: "all 0.12s ease",
                outline: "none",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "var(--s3)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = "var(--s2)";
                }
              }}
              aria-pressed={isSelected}
              aria-label={`Select ${avatar.label} avatar`}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  overflow: "hidden",
                  boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.08)",
                }}
              >
                <AvatarSVG avatarKey={avatar.key} size={72} />
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--t1)",
                    lineHeight: 1.2,
                  }}
                >
                  {avatar.label}
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 9,
                    color: "var(--t3)",
                    marginTop: 3,
                    letterSpacing: "0.04em",
                  }}
                >
                  {avatar.roleHint}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {currentKey && (
        <div
          style={{
            borderTop: "1px solid var(--b1)",
            paddingTop: 14,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => onSelect(null)}
            style={{
              background: "transparent",
              border: "1px solid var(--b1)",
              color: "var(--t2)",
              padding: "8px 14px",
              borderRadius: 6,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Remove avatar (use initials)
          </button>
        </div>
      )}
    </Modal>
  );
}
