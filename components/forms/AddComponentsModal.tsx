"use client";

/**
 * AddComponentsModal — multi-select picker for adding assets to a kit.
 *
 * Default view: assets not currently in any kit (the usual case).
 * Toggle to show all unarchived assets if the user wants to move things from
 * other kits.
 *
 * Search by name or barcode. Filter by category. Click rows to add to a
 * selected pile, then "Add N components" commits the change as a single
 * mutator call (one audit event).
 */

import { useState, useMemo } from "react";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";

interface Props {
  open: boolean;
  onClose: () => void;
  kitId: string;
  kitName: string;
}

const CATEGORIES = ["Video", "Audio", "Lighting", "Grip", "Power", "Misc Prod", "IT / Network"];

export default function AddComponentsModal({ open, onClose, kitId, kitName }: Props) {
  const { data, attachAssetsToKit } = useWorkspace();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);

  const candidates = useMemo(() => {
    return data.assets.filter(a => {
      if (a.archivedAt) return false;
      if (a.kitId === kitId) return false; // already in this kit
      if (!showAll && a.kitId) return false; // hide assets in other kits unless toggled
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!a.name.toLowerCase().includes(q) && !a.barcode.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [data.assets, kitId, showAll, categoryFilter, search]);

  function toggleSelected(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function handleSubmit() {
    if (selected.size === 0) return;
    attachAssetsToKit(Array.from(selected), kitId, "Manager");
    toast(`Added ${selected.size} component${selected.size === 1 ? "" : "s"} to ${kitName}`);
    setSelected(new Set());
    setSearch("");
    setCategoryFilter("all");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Add components to ${kitName}`} maxWidth={620}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or barcode"
            autoFocus
            style={{
              flex: 1, minWidth: 200,
              background: "var(--s2)", border: "1px solid var(--b1)",
              borderRadius: 6, padding: "8px 10px",
              color: "var(--t1)", outline: "none",
              fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 36,
              colorScheme: "dark",
            }}
          />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{
              background: "var(--s2)", border: "1px solid var(--b1)",
              borderRadius: 6, padding: "8px 10px",
              color: "var(--t1)", outline: "none",
              fontFamily: "'DM Sans',sans-serif", fontSize: 12, minHeight: 36,
              colorScheme: "dark",
            }}>
            <option value="all">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--t2)", fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Show assets that are already in other kits
        </label>

        {/* List */}
        <div style={{
          maxHeight: 360, overflow: "auto",
          background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7,
        }}>
          {candidates.length === 0 ? (
            <div style={{ padding: "32px 18px", textAlign: "center", fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
              {data.assets.filter(a => !a.archivedAt && a.kitId !== kitId).length === 0
                ? "No assets available. Add some to your inventory first."
                : "No matches. Try clearing the search or showing assets in other kits."}
            </div>
          ) : (
            candidates.map((a, i) => {
              const isSelected = selected.has(a.id);
              return (
                <div
                  key={a.id}
                  onClick={() => toggleSelected(a.id)}
                  style={{
                    padding: "10px 14px",
                    borderBottom: i < candidates.length - 1 ? "1px solid var(--b1)" : "none",
                    display: "flex", gap: 12, alignItems: "center",
                    cursor: "pointer",
                    background: isSelected ? "rgba(226,245,92,0.08)" : "transparent",
                  }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: `1.5px solid ${isSelected ? "var(--acc)" : "var(--b2)"}`,
                    background: isSelected ? "var(--acc)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--bg)", fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {isSelected ? "✓" : ""}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--t1)", marginBottom: 2 }}>{a.name}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                      {a.barcode} · {a.category}{a.kitId ? " · in another kit" : ""}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)" }}>
            {selected.size} selected
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{
              padding: "10px 16px", borderRadius: 7,
              background: "transparent", border: "1px solid var(--b1)",
              color: "var(--t1)", cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 40,
            }}>Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={selected.size === 0}
              style={{
                padding: "10px 16px", borderRadius: 7,
                background: selected.size === 0 ? "var(--s3)" : "var(--acc)",
                border: "none",
                color: selected.size === 0 ? "var(--t3)" : "var(--bg)",
                cursor: selected.size === 0 ? "not-allowed" : "pointer",
                fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, minHeight: 40,
              }}>
              Add {selected.size > 0 ? `${selected.size} ` : ""}component{selected.size === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
