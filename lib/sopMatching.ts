/**
 * lib/sopMatching.ts — SOP-to-entity lookups (iter-27c).
 *
 * Option B linking model (locked iter-27c): SOPs surface on entities ONLY
 * via explicit links set by Manager+. No category auto-matching. Categories
 * remain a library-filtering dimension only.
 *
 * These are pure functions — no React hooks, no state. Called from detail
 * page renders. They scan the workspace's SOP list once per call which is
 * fine at expected scales (a few hundred SOPs per workspace).
 */

import type { SOP, Project } from "@/lib/hooks/workspaceTypes";
import type { Asset, Kit } from "@/lib/data";

/**
 * SOPs linked to a specific asset.
 *
 * Returned in display order: by SOP lastEditedAt descending (most-recent
 * edits surface first — matches the library list ordering for consistency).
 */
export function getSOPsForAsset(asset: Asset, allSOPs: SOP[]): SOP[] {
  return allSOPs
    .filter(s => s.linkedAssetIds.includes(asset.id))
    .sort(byRecency);
}

/**
 * SOPs linked to a kit. This INCLUDES SOPs linked to the kit itself
 * AND SOPs linked to any of its component assets (deduplicated).
 *
 * Rationale: scanning a kit at the kiosk should surface every procedure
 * relevant to the gear inside, not just kit-level documentation. If "FX6
 * setup" is linked to the FX6 asset and that asset is part of a kit,
 * the kit's procedures list should include "FX6 setup."
 *
 * The returned array dedupes by SOP id so an SOP linked to BOTH the kit
 * and a component asset shows up once.
 */
export function getSOPsForKit(kit: Kit, allSOPs: SOP[]): SOP[] {
  const seen = new Set<string>();
  const result: SOP[] = [];

  for (const sop of allSOPs) {
    if (seen.has(sop.id)) continue;
    const matchesKit = sop.linkedKitIds.includes(kit.id);
    const matchesComponent = kit.componentIds.some(cid =>
      sop.linkedAssetIds.includes(cid)
    );
    if (matchesKit || matchesComponent) {
      seen.add(sop.id);
      result.push(sop);
    }
  }
  return result.sort(byRecency);
}

/**
 * SOPs linked to a project.
 *
 * Unlike kits, projects don't have a "components" notion in the data
 * model — assignedKits + assignedTeam aren't structural enough to
 * traverse for SOPs. Projects only surface SOPs that are linked
 * directly to them.
 *
 * If a customer wants "show me SOPs for any kit on this project", that's
 * a future enhancement.
 */
export function getSOPsForProject(project: Project, allSOPs: SOP[]): SOP[] {
  return allSOPs
    .filter(s => s.linkedProjectIds.includes(project.id))
    .sort(byRecency);
}

/**
 * Reverse lookup: which entities is this SOP linked to?
 *
 * Used on the SOP detail page's "Linked to" section. Resolves ids to
 * entity records so the UI can show names + render proper links.
 *
 * Returns entities grouped by type. Each group may be empty.
 */
export function getEntitiesForSOP(
  sop: SOP,
  workspace: { assets: Asset[]; kits: Kit[]; projects: Project[] },
): {
  assets: Asset[];
  kits: Kit[];
  projects: Project[];
} {
  return {
    assets: workspace.assets.filter(a => sop.linkedAssetIds.includes(a.id)),
    kits: workspace.kits.filter(k => sop.linkedKitIds.includes(k.id)),
    projects: workspace.projects.filter(p => sop.linkedProjectIds.includes(p.id)),
  };
}

function byRecency(a: SOP, b: SOP): number {
  return new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime();
}
