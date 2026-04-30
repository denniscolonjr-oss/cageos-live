"use client";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";

interface Props {
  open: boolean;
  onClose: () => void;
  assetId: string | null;
  assetName: string;
  currentKitId: string | null;
}

export default function PickKitModal({ open, onClose, assetId, assetName, currentKitId }: Props) {
  const { data, attachAssetToKit } = useWorkspace();

  if (!assetId) return null;

  // All kits except the current one
  const eligibleKits = data.kits.filter(k => k.id !== currentKitId);

  function handlePick(kitId: string, kitName: string) {
    if (!assetId) return;
    attachAssetToKit(assetId, kitId);
    toast(`${assetName} added to ${kitName}`);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Add ${assetName} to a kit`}>
      {eligibleKits.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 28, opacity: 0.4, marginBottom: 12 }}>⬡</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
            {data.kits.length === 0 ? "No kits exist yet" : "Already in your only kit"}
          </div>
          <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginBottom: 16 }}>
            {data.kits.length === 0
              ? "Build a kit first, then come back here to assign this asset."
              : "Build another kit to give yourself options."}
          </div>
          <button onClick={onClose} style={{
            padding: "10px 20px", borderRadius: 7, background: "var(--acc)",
            border: "none", color: "var(--bg)", cursor: "pointer",
            fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, minHeight: 40,
          }}>OK</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
          {eligibleKits.map(k => (
            <button key={k.id} onClick={() => handlePick(k.id, k.name)} style={{
              background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 8,
              padding: "12px 14px", cursor: "pointer", textAlign: "left",
              fontFamily: "'DM Sans',sans-serif", minHeight: 56,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 3 }}>{k.name}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)" }}>
                  {k.barcode} · {k.componentIds.length} component{k.componentIds.length === 1 ? "" : "s"} · {k.location}
                </div>
              </div>
              <div style={{ fontSize: 16, color: "var(--t3)", flexShrink: 0 }}>+</div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
