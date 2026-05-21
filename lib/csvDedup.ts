/**
 * lib/csvDedup.ts — Duplicate detection for CSV asset uploads (iter-28c).
 *
 * Dedup model (option D — locked iter-28c):
 *   1. PRIMARY: barcode match. If a parsed row has a barcode and that
 *      barcode exists on an existing asset, it's a duplicate.
 *   2. FALLBACK: when a parsed row has NO barcode, check make + model +
 *      serial number. All three must match (and all three must be
 *      non-empty) for a fallback duplicate. This catches the common case
 *      where re-imported gear sheets lack barcodes but have manufacturer
 *      metadata.
 *
 * Rows that match nothing in either check are "unique" — safe to import.
 * Rows that match are "duplicates" and need a per-row user decision in the
 * preview screen.
 *
 * Pure functions. No state, no React, no network. Easy to test.
 */

import type { Asset } from "@/lib/data";

/** A row parsed from a CSV upload — pre-import, no Asset id yet. */
export interface ParsedRow {
  /** Stable index from the CSV parse, used as row identity in the UI. */
  rowIndex: number;
  /** All fields that map to Asset fields. Empty string = field missing. */
  name: string;
  barcode: string;
  category: string;
  make: string;
  model: string;
  location: string;
  serialNumber: string;
  cost: number | null;
  eolDate: string | null;
  notes: string;
}

/**
 * How a duplicate was detected. Surfaced in the preview UI so users
 * understand what triggered the flag.
 */
export type DuplicateMatchType = "barcode" | "make_model_serial";

export interface DuplicateMatch {
  row: ParsedRow;
  matchedAsset: Asset;
  matchType: DuplicateMatchType;
}

export interface DedupAnalysis {
  /** Rows that do NOT collide with any existing asset. Safe to import. */
  unique: ParsedRow[];
  /** Rows that DO collide. Need a per-row decision in the preview. */
  duplicates: DuplicateMatch[];
}

/**
 * Per-row user decision in the preview screen. Defaults to "skip" — the
 * safest behavior. User can flip per-row or use mass-action buttons.
 */
export type DedupDecision = "skip" | "overwrite" | "import_as_new";

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

/**
 * Analyze parsed CSV rows against the existing asset set.
 *
 * Algorithm:
 *   For each row:
 *     1. If row.barcode is non-empty AND matches any existing asset's
 *        barcode → duplicate via "barcode" match.
 *     2. Else if row.barcode is empty AND row.make, row.model,
 *        row.serialNumber are all non-empty AND the triple matches an
 *        existing asset's (make, model, serialNumber) → duplicate via
 *        "make_model_serial" match.
 *     3. Else → unique.
 *
 * The fallback (rule 2) only fires when barcode is EMPTY. A row with a
 * barcode that doesn't match anything is unique — barcodes are
 * authoritative when present. If you want to match across both, do two
 * passes; we keep it simple here.
 *
 * Case-insensitive matching on make, model, serial — these are
 * user-entered strings prone to "FX6" vs "fx6" inconsistency. Barcodes
 * compare case-sensitive because they're often machine-scanned and
 * case matters in some barcode encodings.
 */
export function analyzeDuplicates(
  rows: ParsedRow[],
  existingAssets: Asset[],
): DedupAnalysis {
  // Build lookup indexes once — O(n) prep, then O(1) per row.
  // Skip archived assets — they're effectively deleted and shouldn't
  // block re-imports of the same gear.
  const active = existingAssets.filter(a => !a.archivedAt);

  const byBarcode = new Map<string, Asset>();
  for (const a of active) {
    if (a.barcode) byBarcode.set(a.barcode, a);
  }

  const byMakeModelSerial = new Map<string, Asset>();
  for (const a of active) {
    const key = makeModelSerialKey(a.make, a.model, a.serialNumber);
    if (key) byMakeModelSerial.set(key, a);
  }

  const unique: ParsedRow[] = [];
  const duplicates: DuplicateMatch[] = [];

  for (const row of rows) {
    // Rule 1: barcode match
    if (row.barcode) {
      const hit = byBarcode.get(row.barcode);
      if (hit) {
        duplicates.push({ row, matchedAsset: hit, matchType: "barcode" });
        continue;
      }
      // Has a barcode, didn't match — unique. Don't fall through to rule 2.
      unique.push(row);
      continue;
    }

    // Rule 2: fallback match on make + model + serial (all three required)
    const key = makeModelSerialKey(row.make, row.model, row.serialNumber);
    if (key) {
      const hit = byMakeModelSerial.get(key);
      if (hit) {
        duplicates.push({ row, matchedAsset: hit, matchType: "make_model_serial" });
        continue;
      }
    }

    // No barcode AND (no make/model/serial OR no match) → unique
    unique.push(row);
  }

  return { unique, duplicates };
}

/**
 * Build the lookup key for the make+model+serial fallback rule. Returns
 * null if any of the three fields is empty — the rule requires all three.
 */
function makeModelSerialKey(
  make: string | null | undefined,
  model: string | null | undefined,
  serial: string | null | undefined,
): string | null {
  const m = (make ?? "").trim().toLowerCase();
  const mod = (model ?? "").trim().toLowerCase();
  const s = (serial ?? "").trim().toLowerCase();
  if (!m || !mod || !s) return null;
  return `${m}|${mod}|${s}`;
}
