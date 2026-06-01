/**
 * UserAvatar — universal profile-image renderer.
 *
 * Strategy:
 *   - If `avatarKey` is set (and is a valid AvatarKey), render the
 *     corresponding Y2K SVG avatar from AvatarLibrary
 *   - Else, render the existing initials-circle (preserves pre-iter-30
 *     behavior for profiles that haven't picked an avatar yet)
 *
 * The component is sized via the `size` prop (default 48px). The wrapper
 * gets `border-radius: 50%` so the SVG (which has square 100×100 viewBox)
 * crops circular. The initials fallback uses a rounded square (matches
 * the pre-iter-30 look exactly — same border-radius: 10).
 *
 * Usage anywhere a profile image displays:
 *   <UserAvatar profile={p} size={48} />
 *
 * Or for cases where you only have parts (denormalized author info on a
 * Note, for example):
 *   <UserAvatar initials="DC" color="#7ee0ff" size={32} />
 */

"use client";

import React from "react";
import { AvatarSVG } from "./AvatarLibrary";
import { isAvatarKey } from "./avatarKeys";
import type { UserProfile } from "@/lib/data";

interface UserAvatarProps {
  /** Full profile object — preferred when available. */
  profile?: UserProfile;
  /** Initials override (used when only denormalized data is available). */
  initials?: string;
  /** Color override (used with `initials`). */
  color?: string;
  /** Avatar key override (used when only denormalized data is available). */
  avatarKey?: string;
  /** Pixel size — width and height both. Default 48. */
  size?: number;
  /** Optional className for the outer wrapper. */
  className?: string;
  /** Optional inline style overrides for the outer wrapper. */
  style?: React.CSSProperties;
}

export default function UserAvatar({
  profile,
  initials,
  color,
  avatarKey,
  size = 48,
  className,
  style,
}: UserAvatarProps) {
  // Resolve the rendering inputs, preferring `profile` over individual overrides
  const resolvedInitials = profile?.initials ?? initials ?? "?";
  const resolvedColor = profile?.color ?? color ?? "var(--t1)";
  const resolvedAvatarKey = profile?.avatarKey ?? avatarKey;

  // If a valid avatar is selected, render that
  if (isAvatarKey(resolvedAvatarKey)) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          // Subtle border to match the visual weight of the initials square
          // and keep the avatar visually anchored on light AND dark surfaces.
          boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.08)",
          ...style,
        }}
        aria-label={profile ? `${profile.name}'s avatar` : `User avatar`}
      >
        <AvatarSVG avatarKey={resolvedAvatarKey} size={size} />
      </div>
    );
  }

  // Fallback: initials circle (preserves pre-iter-30 look exactly)
  // Font size scales with the avatar size — 48px avatar = 17px text.
  const fontSize = Math.round(size * 0.36);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        // Pre-iter-30 used borderRadius: 10 for a rounded square. We keep that
        // for the initials fallback so users without an avatar look identical
        // to before. Avatars use full circles (above).
        borderRadius: Math.round(size * 0.21),
        background: "var(--s3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        fontWeight: 700,
        fontFamily: "'Syne', sans-serif",
        color: resolvedColor,
        flexShrink: 0,
        ...style,
      }}
      aria-label={profile ? `${profile.name}'s initials` : `User initials`}
    >
      {resolvedInitials}
    </div>
  );
}
