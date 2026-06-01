/**
 * Avatar metadata — the 7 Y2K avatars available to users.
 *
 * Each avatar is a Y2K-style product render (chrome + aurora + grid floor)
 * designed in iter-28 / iter-29 sessions. They live as React SVG components
 * in AvatarLibrary.tsx and are referenced everywhere by their `key` string.
 *
 * To add a new avatar:
 *   1. Add its render function to AvatarLibrary.tsx
 *   2. Add an entry to AVATARS below
 *   3. Add a case to renderAvatar() in AvatarLibrary.tsx
 *
 * The `roleHint` field is for the picker UI — helps users self-identify
 * ("I'm an audio op → pick the boom mic"). It's a guideline, not a rule;
 * any user can pick any avatar.
 */

export type AvatarKey =
  | "cinema_camera"
  | "ptz_camera"
  | "boom_mic"
  | "prime_lens"
  | "studio_headphones"
  | "field_mixer"
  | "channel_strip";

export interface AvatarMeta {
  key: AvatarKey;
  label: string;
  roleHint: string;
  /** Single-color accent representing this avatar — used as a halo color
   *  in compact-size renders. Matches the avatar's dominant subject color. */
  accentColor: string;
}

export const AVATARS: AvatarMeta[] = [
  {
    key: "cinema_camera",
    label: "Cinema Camera",
    roleHint: "Camera, DP, video",
    accentColor: "#5fb6ff",
  },
  {
    key: "ptz_camera",
    label: "PTZ Camera",
    roleHint: "Broadcast, control room, AV",
    accentColor: "#e8eef4",
  },
  {
    key: "boom_mic",
    label: "Boom Mic",
    roleHint: "Audio, A1, sound op",
    accentColor: "#f0c47a",
  },
  {
    key: "prime_lens",
    label: "Prime Lens",
    roleHint: "Photographer, stills, DP",
    accentColor: "#dc3a28",
  },
  {
    key: "studio_headphones",
    label: "Studio Headphones",
    roleHint: "Editor, mix, monitor",
    accentColor: "#3a4050",
  },
  {
    key: "field_mixer",
    label: "Field Mixer",
    roleHint: "A2, location sound, recordist",
    accentColor: "#ff7e2a",
  },
  {
    key: "channel_strip",
    label: "Channel Strip",
    roleHint: "A1, live mix, studio engineer",
    accentColor: "#dca85a",
  },
];

/** Lookup helper — returns the metadata for a given key, or undefined. */
export function getAvatarMeta(key: string | undefined): AvatarMeta | undefined {
  if (!key) return undefined;
  return AVATARS.find((a) => a.key === key);
}

/** Type guard — true if `key` is one of the known AvatarKey values. */
export function isAvatarKey(key: string | undefined): key is AvatarKey {
  return !!key && AVATARS.some((a) => a.key === key);
}
