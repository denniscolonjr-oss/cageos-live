/**
 * Avatar library — the 7 Y2K SVG avatars, sized for use as profile images.
 *
 * Each avatar is a 100×100 SVG showing JUST the subject (camera, mic, lens,
 * etc.) on a circular gradient backdrop. The scene chrome from the original
 * 680×540 hero versions (aurora, grid floor, HUD text, sparkles) is
 * intentionally omitted — none of it reads at avatar size, and the subject
 * itself carries the Y2K vocabulary (chrome multi-stop gradients, glass,
 * gloss highlights).
 *
 * Usage:
 *   import { AvatarSVG } from "@/components/profile/AvatarLibrary";
 *   <AvatarSVG avatarKey="cinema_camera" size={48} />
 *
 * The component is fully self-contained (gradients defined inside each SVG
 * so multiple instances on the same page don't clash on gradient IDs —
 * each AvatarSVG gets a unique suffix appended to its def IDs).
 */

import React from "react";
import type { AvatarKey } from "./avatarKeys";

interface AvatarSVGProps {
  avatarKey: AvatarKey;
  /** Pixel size — width and height both. Default 48. */
  size?: number;
  /** Optional className for styling the wrapper. */
  className?: string;
  /** ARIA label override. Default is generated from the avatar key. */
  ariaLabel?: string;
}

/** Counter to give each rendered avatar instance a unique ID suffix.
 *  Prevents gradient ID collisions when multiple avatars render on the same
 *  page. SSR-safe because it's only incremented at render time (and even
 *  if SSR and hydration generate different suffixes, the SVGs render
 *  correctly because the suffix is only used internally). */
let instanceCounter = 0;

export function AvatarSVG({ avatarKey, size = 48, className, ariaLabel }: AvatarSVGProps) {
  // Unique suffix for this instance — prevents <defs> ID collisions on a
  // page with multiple avatars rendered at the same time.
  const uid = React.useMemo(() => `${avatarKey}-${++instanceCounter}`, [avatarKey]);

  const label = ariaLabel ?? `${avatarKey.replace(/_/g, " ")} avatar`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      className={className}
    >
      {renderAvatar(avatarKey, uid)}
    </svg>
  );
}

function renderAvatar(key: AvatarKey, uid: string): React.ReactElement {
  switch (key) {
    case "cinema_camera": return <CinemaCamera uid={uid} />;
    case "ptz_camera": return <PTZCamera uid={uid} />;
    case "boom_mic": return <BoomMic uid={uid} />;
    case "prime_lens": return <PrimeLens uid={uid} />;
    case "studio_headphones": return <StudioHeadphones uid={uid} />;
    case "field_mixer": return <FieldMixer uid={uid} />;
    case "channel_strip": return <ChannelStrip uid={uid} />;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// SHARED BACKDROP — used by all 7 avatars
// ──────────────────────────────────────────────────────────────────────────
//
// A circular dark backdrop with a subtle aurora wash, sized to fill the
// 100×100 viewBox. Crops cleanly when the consumer wraps the avatar in a
// `border-radius: 50%` container.

function Backdrop({ uid, accent }: { uid: string; accent: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`bd-${uid}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#1a2438" />
          <stop offset="60%" stopColor="#0a0e18" />
          <stop offset="100%" stopColor="#04060c" />
        </radialGradient>
        <radialGradient id={`bd-acc-${uid}`} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#bd-${uid})`} />
      <rect width="100" height="100" fill={`url(#bd-acc-${uid})`} />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 1. CINEMA CAMERA
// ──────────────────────────────────────────────────────────────────────────

function CinemaCamera({ uid }: { uid: string }) {
  return (
    <>
      <Backdrop uid={uid} accent="#5fb6ff" />
      <defs>
        <linearGradient id={`cc-body-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5fb6ff" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#1f78dc" />
          <stop offset="100%" stopColor="#0a1a3a" />
        </linearGradient>
        <linearGradient id={`cc-chrome-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f4faff" />
          <stop offset="50%" stopColor="#5a7894" />
          <stop offset="100%" stopColor="#1a2434" />
        </linearGradient>
        <radialGradient id={`cc-lens-${uid}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#a8e0ff" />
          <stop offset="30%" stopColor="#3878c8" />
          <stop offset="70%" stopColor="#0a1838" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
      </defs>
      {/* Top handle */}
      <rect x="34" y="22" width="32" height="5" rx="1.5" fill={`url(#cc-chrome-${uid})`} />
      <rect x="36" y="27" width="3" height="5" fill={`url(#cc-chrome-${uid})`} />
      <rect x="61" y="27" width="3" height="5" fill={`url(#cc-chrome-${uid})`} />
      {/* Camera body */}
      <rect x="28" y="32" width="44" height="36" rx="4" fill={`url(#cc-body-${uid})`} />
      <rect x="28" y="32" width="44" height="14" rx="4" fill="#ffffff" opacity="0.25" />
      {/* Lens */}
      <circle cx="42" cy="50" r="11" fill="#0a0408" />
      <circle cx="42" cy="50" r="9" fill={`url(#cc-lens-${uid})`} />
      {/* Lens flare */}
      <ellipse cx="40" cy="48" rx="6" ry="0.7" fill="#fff" opacity="0.9" />
      <ellipse cx="40" cy="48" rx="0.7" ry="6" fill="#fff" opacity="0.9" />
      <circle cx="40" cy="48" r="1.5" fill="#fff" />
      {/* REC LED */}
      <circle cx="63" cy="40" r="3.5" fill="#ff5a4a" opacity="0.3" />
      <circle cx="63" cy="40" r="2" fill="#ff5a4a" />
      <circle cx="62.5" cy="39.5" r="0.6" fill="#fff" />
      {/* Side vents */}
      <line x1="50" y1="56" x2="68" y2="56" stroke="#0a1a30" strokeWidth="0.8" />
      <line x1="50" y1="60" x2="68" y2="60" stroke="#0a1a30" strokeWidth="0.8" />
      <line x1="50" y1="64" x2="68" y2="64" stroke="#0a1a30" strokeWidth="0.8" />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 2. PTZ CAMERA
// ──────────────────────────────────────────────────────────────────────────

function PTZCamera({ uid }: { uid: string }) {
  return (
    <>
      <Backdrop uid={uid} accent="#7ee0ff" />
      <defs>
        <linearGradient id={`ptz-shell-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#c8d0dc" />
          <stop offset="100%" stopColor="#3a4a60" />
        </linearGradient>
        <linearGradient id={`ptz-visor-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a8f0ff" />
          <stop offset="50%" stopColor="#3aa8dc" />
          <stop offset="100%" stopColor="#0a2a5a" />
        </linearGradient>
        <radialGradient id={`ptz-lens-${uid}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#d4f0ff" />
          <stop offset="30%" stopColor="#3878c8" />
          <stop offset="80%" stopColor="#0a1838" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
      </defs>
      {/* Ceiling mount plate */}
      <ellipse cx="50" cy="22" rx="18" ry="2.5" fill={`url(#ptz-shell-${uid})`} />
      {/* Pan column */}
      <rect x="44" y="24" width="12" height="8" fill={`url(#ptz-shell-${uid})`} />
      {/* Yoke arms */}
      <rect x="26" y="32" width="6" height="32" rx="3" fill={`url(#ptz-shell-${uid})`} />
      <rect x="68" y="32" width="6" height="32" rx="3" fill={`url(#ptz-shell-${uid})`} />
      <rect x="26" y="32" width="48" height="5" fill={`url(#ptz-shell-${uid})`} />
      {/* Head sphere */}
      <ellipse cx="50" cy="55" rx="22" ry="18" fill={`url(#ptz-shell-${uid})`} />
      <path d="M 32 49 Q 50 38 68 49 Q 60 42 50 41 Q 40 42 32 49 Z" fill="#ffffff" opacity="0.5" />
      {/* Visor / lens */}
      <circle cx="50" cy="56" r="13" fill="#0a1428" />
      <circle cx="50" cy="56" r="11" fill={`url(#ptz-visor-${uid})`} />
      <circle cx="50" cy="56" r="8" fill={`url(#ptz-lens-${uid})`} />
      <path d="M 41 50 Q 50 45 59 50 Q 54 47 50 47 Q 46 47 41 50 Z" fill="#ffffff" opacity="0.65" />
      {/* Lens flare */}
      <ellipse cx="47" cy="53" rx="5" ry="0.6" fill="#fff" opacity="0.95" />
      <ellipse cx="47" cy="53" rx="0.6" ry="5" fill="#fff" opacity="0.95" />
      <circle cx="47" cy="53" r="1.3" fill="#fff" />
      {/* ON AIR green LED */}
      <circle cx="36" cy="42" r="3" fill="#5aff7a" opacity="0.4" />
      <circle cx="36" cy="42" r="1.6" fill="#5aff7a" />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 3. BOOM MIC
// ──────────────────────────────────────────────────────────────────────────

function BoomMic({ uid }: { uid: string }) {
  return (
    <>
      <Backdrop uid={uid} accent="#f0c47a" />
      <defs>
        <linearGradient id={`bm-bronze-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff0c8" />
          <stop offset="40%" stopColor="#c89548" />
          <stop offset="100%" stopColor="#3a2408" />
        </linearGradient>
        <linearGradient id={`bm-chrome-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f4faff" />
          <stop offset="50%" stopColor="#384e64" />
          <stop offset="100%" stopColor="#0a1018" />
        </linearGradient>
        <radialGradient id={`bm-fur-${uid}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#a8b2c4" />
          <stop offset="60%" stopColor="#4a5468" />
          <stop offset="100%" stopColor="#1a2030" />
        </radialGradient>
      </defs>
      {/* Boom angled across the frame — capsule upper-left, grip lower-right */}
      <g transform="rotate(-30 50 50)">
        {/* Boom pole */}
        <rect x="48" y="50" width="3" height="36" rx="1.5" fill={`url(#bm-chrome-${uid})`} />
        {/* Telescoping joints */}
        <rect x="47" y="62" width="5" height="1.5" fill="#0a1018" />
        <rect x="47" y="74" width="5" height="1.5" fill="#0a1018" />
        {/* Mount */}
        <rect x="45" y="44" width="9" height="6" rx="1" fill="#0a0c12" />
        {/* XLR coupling */}
        <rect x="46" y="39" width="7" height="5" rx="1" fill="#1a1410" />
        {/* Bronze capsule body */}
        <rect x="46.5" y="28" width="6" height="11" rx="1" fill={`url(#bm-bronze-${uid})`} />
        {/* Slots on capsule */}
        <line x1="47.5" y1="32" x2="51.5" y2="32" stroke="#3a2408" strokeWidth="0.4" />
        <line x1="47.5" y1="34" x2="51.5" y2="34" stroke="#3a2408" strokeWidth="0.4" />
        <line x1="47.5" y1="36" x2="51.5" y2="36" stroke="#3a2408" strokeWidth="0.4" />
        {/* Windscreen — egg shape, fuzzy */}
        <ellipse cx="49.5" cy="20" rx="8" ry="13" fill={`url(#bm-fur-${uid})`} />
        {/* Fur strokes */}
        <g stroke="#a8b2c4" strokeWidth="0.8" strokeLinecap="round">
          <line x1="42" y1="18" x2="40" y2="17" />
          <line x1="42" y1="22" x2="40" y2="22" />
          <line x1="42" y1="26" x2="40" y2="27" />
          <line x1="57" y1="18" x2="59" y2="17" />
          <line x1="57" y1="22" x2="59" y2="22" />
          <line x1="57" y1="26" x2="59" y2="27" />
          <line x1="46" y1="9" x2="45" y2="6" />
          <line x1="50" y1="8" x2="50" y2="5" />
          <line x1="53" y1="9" x2="54" y2="6" />
        </g>
      </g>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 4. PRIME LENS
// ──────────────────────────────────────────────────────────────────────────

function PrimeLens({ uid }: { uid: string }) {
  return (
    <>
      <Backdrop uid={uid} accent="#dc3a28" />
      <defs>
        <linearGradient id={`pl-body-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3a4050" />
          <stop offset="50%" stopColor="#080a10" />
          <stop offset="100%" stopColor="#1a1e28" />
        </linearGradient>
        <linearGradient id={`pl-red-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ff8a7a" />
          <stop offset="50%" stopColor="#dc3a28" />
          <stop offset="100%" stopColor="#7a1408" />
        </linearGradient>
        <linearGradient id={`pl-chrome-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f4faff" />
          <stop offset="50%" stopColor="#6a849c" />
          <stop offset="100%" stopColor="#1a2434" />
        </linearGradient>
        <radialGradient id={`pl-glass-${uid}`} cx="30%" cy="25%" r="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="15%" stopColor="#7ed0f0" />
          <stop offset="40%" stopColor="#3878c8" />
          <stop offset="70%" stopColor="#1a3870" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
      </defs>
      {/* Lens body — vertical orientation, glass at top */}
      {/* Mount (bottom) */}
      <rect x="35" y="70" width="30" height="10" fill={`url(#pl-chrome-${uid})`} />
      <rect x="35" y="70" width="30" height="3" fill="#ffffff" opacity="0.6" />
      {/* Aperture ring */}
      <rect x="35" y="60" width="30" height="10" fill={`url(#pl-body-${uid})`} />
      {/* Red L-ring */}
      <rect x="34" y="56" width="32" height="4" fill={`url(#pl-red-${uid})`} />
      {/* Focus ring */}
      <rect x="34" y="34" width="32" height="22" fill={`url(#pl-body-${uid})`} />
      {/* Ribbing texture */}
      <g stroke="#3a4050" strokeWidth="0.4" opacity="0.85">
        <line x1="36" y1="36" x2="36" y2="54" />
        <line x1="40" y1="36" x2="40" y2="54" />
        <line x1="44" y1="36" x2="44" y2="54" />
        <line x1="48" y1="36" x2="48" y2="54" />
        <line x1="52" y1="36" x2="52" y2="54" />
        <line x1="56" y1="36" x2="56" y2="54" />
        <line x1="60" y1="36" x2="60" y2="54" />
        <line x1="64" y1="36" x2="64" y2="54" />
      </g>
      {/* Filter ring */}
      <rect x="33" y="30" width="34" height="5" fill={`url(#pl-chrome-${uid})`} />
      {/* Front element — convex glass dome */}
      <ellipse cx="50" cy="25" rx="18" ry="10" fill="#000" />
      <ellipse cx="50" cy="25" rx="16" ry="8" fill={`url(#pl-glass-${uid})`} />
      {/* Concentric ring */}
      <ellipse cx="50" cy="25" rx="9" ry="4.5" fill="none" stroke="#1a3870" strokeWidth="0.4" opacity="0.5" />
      {/* Lens flare on glass */}
      <ellipse cx="44" cy="22" rx="8" ry="0.7" fill="#fff" opacity="0.95" />
      <ellipse cx="44" cy="22" rx="0.7" ry="6" fill="#fff" opacity="0.95" />
      <circle cx="44" cy="22" r="1.5" fill="#fff" />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 5. STUDIO HEADPHONES
// ──────────────────────────────────────────────────────────────────────────

function StudioHeadphones({ uid }: { uid: string }) {
  return (
    <>
      <Backdrop uid={uid} accent="#a8c4dc" />
      <defs>
        <radialGradient id={`sh-cup-${uid}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#3a4050" />
          <stop offset="60%" stopColor="#0a0c12" />
          <stop offset="100%" stopColor="#000408" />
        </radialGradient>
        <linearGradient id={`sh-chrome-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f4faff" />
          <stop offset="50%" stopColor="#6a849c" />
          <stop offset="100%" stopColor="#1a2434" />
        </linearGradient>
      </defs>
      {/* Headband arch */}
      <path d="M 22 56 Q 22 22 50 22 Q 78 22 78 56" fill="none" stroke="#0a0c12" strokeWidth="9" strokeLinecap="round" />
      <path d="M 22 56 Q 22 22 50 22 Q 78 22 78 56" fill="none" stroke="#1a1e28" strokeWidth="7" strokeLinecap="round" />
      {/* Headband highlight */}
      <path d="M 30 30 Q 50 22 70 30" fill="none" stroke="#5a6478" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      {/* Adjustment slides */}
      <rect x="20" y="40" width="4" height="14" rx="1" fill={`url(#sh-chrome-${uid})`} />
      <rect x="76" y="40" width="4" height="14" rx="1" fill={`url(#sh-chrome-${uid})`} />
      {/* Left ear cup */}
      <circle cx="22" cy="68" r="18" fill={`url(#sh-cup-${uid})`} />
      <circle cx="22" cy="68" r="15" fill="none" stroke={`url(#sh-chrome-${uid})`} strokeWidth="1.5" />
      <circle cx="22" cy="68" r="12" fill="#0a0c12" />
      {/* L marker */}
      <text x="22" y="71.5" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="6" fill="#7ee0ff" fontWeight="500">L</text>
      {/* Right ear cup */}
      <circle cx="78" cy="68" r="18" fill={`url(#sh-cup-${uid})`} />
      <circle cx="78" cy="68" r="15" fill="none" stroke={`url(#sh-chrome-${uid})`} strokeWidth="1.5" />
      <circle cx="78" cy="68" r="12" fill="#0a0c12" />
      <text x="78" y="71.5" textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="6" fill="#7ee0ff" fontWeight="500">R</text>
      {/* Cup specular highlights */}
      <ellipse cx="14" cy="60" rx="3" ry="5" fill="#ffffff" opacity="0.25" />
      <ellipse cx="70" cy="60" rx="3" ry="5" fill="#ffffff" opacity="0.25" />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 6. FIELD MIXER
// ──────────────────────────────────────────────────────────────────────────

function FieldMixer({ uid }: { uid: string }) {
  return (
    <>
      <Backdrop uid={uid} accent="#ff7e2a" />
      <defs>
        <linearGradient id={`fm-body-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffb878" />
          <stop offset="40%" stopColor="#ff7e2a" />
          <stop offset="100%" stopColor="#5a1a00" />
        </linearGradient>
        <radialGradient id={`fm-knob-${uid}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="40%" stopColor="#c8d0dc" />
          <stop offset="100%" stopColor="#1a2434" />
        </radialGradient>
      </defs>
      {/* Body */}
      <rect x="14" y="26" width="72" height="48" rx="3" fill={`url(#fm-body-${uid})`} />
      <rect x="14" y="26" width="72" height="14" rx="3" fill="#ffffff" opacity="0.25" />
      {/* Recessed black panel */}
      <rect x="18" y="30" width="64" height="40" rx="2" fill="#0a0c12" />
      {/* VU meter display */}
      <rect x="21" y="33" width="30" height="14" rx="1" fill="#000a04" />
      {/* VU bars L */}
      <rect x="23" y="36" width="2" height="2" fill="#5aff7a" />
      <rect x="26" y="36" width="2" height="2" fill="#5aff7a" />
      <rect x="29" y="36" width="2" height="2" fill="#5aff7a" />
      <rect x="32" y="36" width="2" height="2" fill="#5aff7a" />
      <rect x="35" y="36" width="2" height="2" fill="#ffe48a" />
      <rect x="38" y="36" width="2" height="2" fill="#ff5a4a" />
      {/* VU bars R */}
      <rect x="23" y="40" width="2" height="2" fill="#5aff7a" />
      <rect x="26" y="40" width="2" height="2" fill="#5aff7a" />
      <rect x="29" y="40" width="2" height="2" fill="#5aff7a" />
      <rect x="32" y="40" width="2" height="2" fill="#5aff7a" />
      <rect x="35" y="40" width="2" height="2" fill="#ffe48a" />
      {/* Timecode hint */}
      <rect x="23" y="44" width="20" height="1.5" fill="#5aff7a" opacity="0.7" />
      {/* Knobs */}
      <circle cx="60" cy="38" r="5" fill="#0a0c12" />
      <circle cx="60" cy="38" r="4" fill={`url(#fm-knob-${uid})`} />
      <line x1="60" y1="38" x2="60" y2="35" stroke="#1a2434" strokeWidth="0.8" />
      <circle cx="72" cy="38" r="5" fill="#0a0c12" />
      <circle cx="72" cy="38" r="4" fill={`url(#fm-knob-${uid})`} />
      <line x1="72" y1="38" x2="74" y2="35" stroke="#1a2434" strokeWidth="0.8" />
      {/* Faders */}
      <rect x="22" y="51" width="2" height="16" rx="1" fill="#1a2434" />
      <rect x="21" y="56" width="4" height="3" rx="0.5" fill={`url(#fm-knob-${uid})`} />
      <rect x="28" y="51" width="2" height="16" rx="1" fill="#1a2434" />
      <rect x="27" y="59" width="4" height="3" rx="0.5" fill={`url(#fm-knob-${uid})`} />
      <rect x="34" y="51" width="2" height="16" rx="1" fill="#1a2434" />
      <rect x="33" y="54" width="4" height="3" rx="0.5" fill={`url(#fm-knob-${uid})`} />
      {/* Status LEDs */}
      <circle cx="52" cy="55" r="1.2" fill="#5aff7a" />
      <circle cx="58" cy="55" r="1.2" fill="#ff5a4a" />
      <circle cx="64" cy="55" r="1.2" fill="#7ee0ff" />
      {/* Master knob */}
      <circle cx="74" cy="62" r="6" fill="#0a0c12" />
      <circle cx="74" cy="62" r="5" fill={`url(#fm-knob-${uid})`} />
      <line x1="74" y1="62" x2="74" y2="58" stroke="#1a2434" strokeWidth="1" />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// 7. CHANNEL STRIP
// ──────────────────────────────────────────────────────────────────────────

function ChannelStrip({ uid }: { uid: string }) {
  return (
    <>
      <Backdrop uid={uid} accent="#dca85a" />
      <defs>
        <linearGradient id={`cs-body-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff0c0" />
          <stop offset="40%" stopColor="#dca85a" />
          <stop offset="100%" stopColor="#4a3010" />
        </linearGradient>
        <radialGradient id={`cs-knob-gold-${uid}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fff5d0" />
          <stop offset="50%" stopColor="#dca85a" />
          <stop offset="100%" stopColor="#2a1c08" />
        </radialGradient>
        <radialGradient id={`cs-knob-red-${uid}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffb0a0" />
          <stop offset="50%" stopColor="#dc4a3a" />
          <stop offset="100%" stopColor="#2a0804" />
        </radialGradient>
        <radialGradient id={`cs-knob-blue-${uid}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#a8d4ff" />
          <stop offset="50%" stopColor="#3a78c8" />
          <stop offset="100%" stopColor="#04081a" />
        </radialGradient>
        <radialGradient id={`cs-knob-green-${uid}`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#a8e8b8" />
          <stop offset="50%" stopColor="#3aa848" />
          <stop offset="100%" stopColor="#041a04" />
        </radialGradient>
      </defs>
      {/* Tall narrow strip body */}
      <rect x="32" y="14" width="36" height="72" rx="3" fill={`url(#cs-body-${uid})`} />
      <rect x="32" y="14" width="36" height="14" rx="3" fill="#ffffff" opacity="0.3" />
      {/* CH display */}
      <rect x="36" y="18" width="28" height="8" rx="1" fill="#1a140a" />
      <text x="50" y="24" textAnchor="middle" fontFamily="ui-monospace,monospace" fontSize="5" fill="#5aff7a" fontWeight="500" letterSpacing="0.1em">CH 12</text>
      {/* EQ knobs 2x2 */}
      <circle cx="42" cy="34" r="4" fill="#1a0c00" />
      <circle cx="42" cy="34" r="3.3" fill={`url(#cs-knob-red-${uid})`} />
      <line x1="42" y1="34" x2="40" y2="32" stroke="#2a0804" strokeWidth="0.7" />
      <circle cx="58" cy="34" r="4" fill="#1a0c00" />
      <circle cx="58" cy="34" r="3.3" fill={`url(#cs-knob-gold-${uid})`} />
      <line x1="58" y1="34" x2="60" y2="32" stroke="#2a1c08" strokeWidth="0.7" />
      <circle cx="42" cy="46" r="4" fill="#1a0c00" />
      <circle cx="42" cy="46" r="3.3" fill={`url(#cs-knob-blue-${uid})`} />
      <line x1="42" y1="46" x2="40" y2="44" stroke="#04081a" strokeWidth="0.7" />
      <circle cx="58" cy="46" r="4" fill="#1a0c00" />
      <circle cx="58" cy="46" r="3.3" fill={`url(#cs-knob-green-${uid})`} />
      <line x1="58" y1="46" x2="60" y2="48" stroke="#041a04" strokeWidth="0.7" />
      {/* MUTE button (lit red) */}
      <rect x="36" y="55" width="12" height="4" rx="0.5" fill="#1a0c00" />
      <rect x="37" y="56" width="10" height="2" rx="0.5" fill="#ff5a4a" />
      {/* SOLO unlit */}
      <rect x="52" y="55" width="12" height="4" rx="0.5" fill="#1a0c00" />
      {/* Fader */}
      <rect x="48" y="62" width="4" height="20" rx="1" fill="#1a0c00" />
      <rect x="44" y="66" width="12" height="5" rx="1" fill="#c8d0dc" />
      <rect x="44" y="66" width="12" height="2" rx="1" fill="#ffffff" opacity="0.7" />
      {/* Unity 0dB mark */}
      <line x1="42" y1="71" x2="58" y2="71" stroke="#5aff7a" strokeWidth="0.4" opacity="0.7" />
    </>
  );
}
