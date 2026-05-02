"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import WordCountTextarea, { countWords } from "@/components/ui/WordCountTextarea";
import PhotoUpload from "@/components/ui/PhotoUpload";
import PhotoDisplay from "@/components/ui/PhotoDisplay";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";
import type { Asset } from "@/lib/data";
import type { FlagSeverity } from "@/lib/hooks/workspaceTypes";

const MIN_WORDS = 20;

interface Props {
  open: boolean;
  onClose: () => void;
  asset: Asset | null;
}

export default function FlagItemModal({ open, onClose, asset }: Props) {
  const { flagAsset } = useWorkspace();
  const { activeWorkspaceId } = useAuth();
  const [severity, setSeverity] = useState<FlagSeverity>("warning");
  const [reason, setReason] = useState("");
  const [flaggedBy, setFlaggedBy] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const ready = countWords(reason) >= MIN_WORDS && flaggedBy.trim().length > 0;

  function handleSubmit() {
    if (!asset || !ready) return;
    flagAsset({
      assetId: asset.id,
      severity,
      reason: reason.trim(),
      flaggedBy: flaggedBy.trim(),
      photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
    });
    toast(`${asset.name} flagged ${severity}`, { detail: asset.barcode });
    setSeverity("warning"); setReason(""); setFlaggedBy(""); setPhotoUrls([]);
    onClose();
  }

  if (!asset) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Flag ${asset.name}`} maxWidth={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{
          padding: "10px 12px", background: "var(--s2)", border: "1px solid var(--b1)",
          borderRadius: 7,
        }}>
          <div style={{ fontSize: 13, color: "var(--t1)" }}>{asset.name}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginTop: 3 }}>
            {asset.barcode} · {asset.category} · {asset.location || "—"}
          </div>
        </div>

        <div>
          <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
            Severity
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={() => setSeverity("warning")} style={{
              padding: "12px 14px", borderRadius: 7,
              border: `1px solid ${severity === "warning" ? "var(--amber)" : "var(--b1)"}`,
              background: severity === "warning" ? "rgba(245,166,35,0.08)" : "var(--s2)",
              color: severity === "warning" ? "var(--amber)" : "var(--t2)",
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 44,
              textAlign: "left",
            }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Warning</div>
              <div style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", opacity: 0.8 }}>Usable but degraded</div>
            </button>
            <button onClick={() => setSeverity("critical")} style={{
              padding: "12px 14px", borderRadius: 7,
              border: `1px solid ${severity === "critical" ? "var(--red)" : "var(--b1)"}`,
              background: severity === "critical" ? "rgba(255,79,79,0.08)" : "var(--s2)",
              color: severity === "critical" ? "var(--red)" : "var(--t2)",
              cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 44,
              textAlign: "left",
            }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Critical</div>
              <div style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", opacity: 0.8 }}>Out of service</div>
            </button>
          </div>
        </div>

        <div>
          <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
            Reason for flagging
          </label>
          <WordCountTextarea
            value={reason}
            onChange={setReason}
            minWords={MIN_WORDS}
            placeholder="Describe what's wrong, when you noticed it, what conditions caused it. Be specific so the next person picking this up knows exactly what they're looking at."
            requirementLabel="Min 20 words"
            autoFocus
          />
        </div>

        {activeWorkspaceId && (
          <div>
            <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
              Photos <span style={{ textTransform: "none", color: "var(--t3)" }}>(optional)</span>
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {photoUrls.map((url, i) => (
                <PhotoDisplay
                  key={url}
                  url={url}
                  alt={`Flag photo ${i + 1}`}
                  size="small"
                  onRemove={() => setPhotoUrls(photoUrls.filter(u => u !== url))}
                />
              ))}
              <PhotoUpload
                workspaceId={activeWorkspaceId}
                pathPrefix={`flags/temp-${asset.id}`}
                onUploaded={(url) => setPhotoUrls([...photoUrls, url])}
                compact
              />
            </div>
          </div>
        )}

        <div>
          <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
            Flagged by
          </label>
          <input
            value={flaggedBy}
            onChange={e => setFlaggedBy(e.target.value)}
            placeholder="Your name"
            style={{
              width: "100%", background: "var(--s2)", border: "1px solid var(--b1)",
              borderRadius: 7, padding: "10px 12px",
              color: "var(--t1)", outline: "none",
              fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
              colorScheme: "dark",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--b1)" }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px 18px", borderRadius: 7,
            background: "transparent", border: "1px solid var(--b1)",
            color: "var(--t2)", cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!ready} style={{
            flex: 2, padding: "12px 18px", borderRadius: 7,
            background: ready ? "var(--red)" : "var(--s3)",
            border: "none",
            color: ready ? "var(--bg)" : "var(--t3)",
            cursor: ready ? "pointer" : "not-allowed",
            fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, minHeight: 44,
          }}>
            ⚠ Open flag
          </button>
        </div>
      </div>
    </Modal>
  );
}
