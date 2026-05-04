"use client";
import { useState, useMemo } from "react";
import Modal from "@/components/ui/Modal";
import WordCountTextarea, { countWords } from "@/components/ui/WordCountTextarea";
import PhotoUpload from "@/components/ui/PhotoUpload";
import PhotoDisplay from "@/components/ui/PhotoDisplay";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";
import type { ServiceFlag, RepairNote } from "@/lib/hooks/workspaceTypes";

const MIN_WORDS = 20;

interface Props {
  open: boolean;
  onClose: () => void;
  flag: ServiceFlag | null;
}

const ACTION_LABELS: Record<RepairNote["actionType"], string> = {
  diagnostic: "Diagnostic",
  sent_to_vendor: "Sent to vendor",
  received_back: "Received back",
  tested: "Tested",
  other: "Other",
};

const ACTION_COLORS: Record<RepairNote["actionType"], string> = {
  diagnostic: "var(--blue)",
  sent_to_vendor: "var(--amber)",
  received_back: "var(--purple)",
  tested: "var(--acc)",
  other: "var(--t3)",
};

export default function FlagDetailModal({ open, onClose, flag }: Props) {
  const { data, addRepairNote, resolveFlag, isReadOnly } = useWorkspace();
  const { activeWorkspaceId } = useAuth();
  const [mode, setMode] = useState<"view" | "addNote" | "resolve">("view");

  // Note form
  const [noteAction, setNoteAction] = useState<RepairNote["actionType"]>("diagnostic");
  const [noteAuthor, setNoteAuthor] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [notePhotoUrls, setNotePhotoUrls] = useState<string[]>([]);

  // Resolve form
  const [resolveBy, setResolveBy] = useState("");
  const [resolveSummary, setResolveSummary] = useState("");

  const asset = useMemo(() => {
    if (!flag) return null;
    return data.assets.find(a => a.id === flag.assetId) ?? null;
  }, [flag, data.assets]);

  if (!flag || !asset) return null;

  const noteReady = countWords(noteBody) >= MIN_WORDS && noteAuthor.trim().length > 0;
  const resolveReady = countWords(resolveSummary) >= MIN_WORDS && resolveBy.trim().length > 0;

  function resetForms() {
    setNoteAction("diagnostic"); setNoteAuthor(""); setNoteBody(""); setNotePhotoUrls([]);
    setResolveBy(""); setResolveSummary("");
    setMode("view");
  }

  function handleClose() {
    resetForms();
    onClose();
  }

  function handleAddNote() {
    if (!flag || !noteReady) return;
    addRepairNote({
      flagId: flag.id,
      author: noteAuthor.trim(),
      actionType: noteAction,
      body: noteBody.trim(),
      photoUrls: notePhotoUrls.length > 0 ? notePhotoUrls : undefined,
    });
    toast(`Repair note added`, { detail: ACTION_LABELS[noteAction] });
    resetForms();
  }

  function handleResolve() {
    if (!flag || !resolveReady) return;
    resolveFlag({
      flagId: flag.id,
      resolvedBy: resolveBy.trim(),
      resolutionSummary: resolveSummary.trim(),
    });
    toast(`Flag resolved on ${asset?.name}`);
    handleClose();
  }

  const sevColor = flag.severity === "critical" ? "var(--red)" : "var(--amber)";
  const statusColor =
    flag.status === "resolved" ? "var(--green)" :
    flag.status === "in_repair" ? "var(--amber)" : "var(--red)";
  const flaggedAt = new Date(flag.flaggedAtISO);
  const flaggedAtLabel = new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(flaggedAt);

  // ============== ADD NOTE FORM ==============
  if (mode === "addNote") {
    return (
      <Modal open={open} onClose={handleClose} title={`Add repair note · ${asset.name}`} maxWidth={560}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Action type</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 6 }}>
              {(Object.keys(ACTION_LABELS) as RepairNote["actionType"][]).map(at => (
                <button key={at} onClick={() => setNoteAction(at)} style={{
                  padding: "9px 10px", borderRadius: 6,
                  border: `1px solid ${noteAction === at ? ACTION_COLORS[at] : "var(--b1)"}`,
                  background: noteAction === at ? "var(--s3)" : "var(--s2)",
                  color: noteAction === at ? ACTION_COLORS[at] : "var(--t2)",
                  cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 11, minHeight: 40,
                }}>
                  {ACTION_LABELS[at]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Note (min 20 words)</label>
            <WordCountTextarea
              value={noteBody}
              onChange={setNoteBody}
              minWords={MIN_WORDS}
              placeholder="What did you do, where did it go, what's the next step. Be specific so future you understands what happened."
              autoFocus
            />
          </div>

          {activeWorkspaceId && (
            <div>
              <label style={labelStyle}>Photos <span style={{ textTransform: "none", color: "var(--t3)" }}>(optional)</span></label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {notePhotoUrls.map((url, i) => (
                  <PhotoDisplay
                    key={url}
                    url={url}
                    alt={`Note photo ${i + 1}`}
                    size="small"
                    onRemove={() => setNotePhotoUrls(notePhotoUrls.filter(u => u !== url))}
                  />
                ))}
                <PhotoUpload
                  workspaceId={activeWorkspaceId}
                  pathPrefix={`flags/${flag.id}/notes`}
                  onUploaded={(url) => setNotePhotoUrls([...notePhotoUrls, url])}
                  compact
                />
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>Author</label>
            <input
              value={noteAuthor}
              onChange={e => setNoteAuthor(e.target.value)}
              placeholder="Your name"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--b1)" }}>
            <button onClick={() => setMode("view")} style={{
              flex: 1, padding: "12px 18px", borderRadius: 7,
              background: "transparent", border: "1px solid var(--b1)",
              color: "var(--t2)", cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
            }}>← Back</button>
            <button onClick={handleAddNote} disabled={!noteReady} style={{
              flex: 2, padding: "12px 18px", borderRadius: 7,
              background: noteReady ? "var(--acc)" : "var(--s3)",
              border: "none",
              color: noteReady ? "var(--bg)" : "var(--t3)",
              cursor: noteReady ? "pointer" : "not-allowed",
              fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, minHeight: 44,
            }}>Add note</button>
          </div>
        </div>
      </Modal>
    );
  }

  // ============== RESOLVE FORM ==============
  if (mode === "resolve") {
    return (
      <Modal open={open} onClose={handleClose} title={`Resolve flag · ${asset.name}`} maxWidth={560}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            padding: "10px 12px", background: "rgba(109,238,159,0.06)",
            border: "1px solid rgba(109,238,159,0.25)", borderRadius: 7,
            fontSize: 12, color: "var(--green)", lineHeight: 1.5,
          }}>
            Resolving this flag returns the asset to active inventory and removes any out-of-service block on its kits at the kiosk.
          </div>

          <div>
            <label style={labelStyle}>Resolution summary (min 20 words)</label>
            <WordCountTextarea
              value={resolveSummary}
              onChange={setResolveSummary}
              minWords={MIN_WORDS}
              placeholder="What was the final fix, how was it tested, and what should the next user know about the asset's current state."
              autoFocus
            />
          </div>

          <div>
            <label style={labelStyle}>Resolved by</label>
            <input
              value={resolveBy}
              onChange={e => setResolveBy(e.target.value)}
              placeholder="Your name"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--b1)" }}>
            <button onClick={() => setMode("view")} style={{
              flex: 1, padding: "12px 18px", borderRadius: 7,
              background: "transparent", border: "1px solid var(--b1)",
              color: "var(--t2)", cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
            }}>← Back</button>
            <button onClick={handleResolve} disabled={!resolveReady} style={{
              flex: 2, padding: "12px 18px", borderRadius: 7,
              background: resolveReady ? "var(--green)" : "var(--s3)",
              border: "none",
              color: resolveReady ? "var(--bg)" : "var(--t3)",
              cursor: resolveReady ? "pointer" : "not-allowed",
              fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, minHeight: 44,
            }}>✓ Mark resolved</button>
          </div>
        </div>
      </Modal>
    );
  }

  // ============== VIEW MODE ==============
  return (
    <Modal open={open} onClose={handleClose} title={`Flag · ${asset.name}`} maxWidth={620}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Asset + status header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap", paddingBottom: 12, borderBottom: "1px solid var(--b1)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 3 }}>
              {asset.barcode} · {asset.category}{asset.location ? ` · ${asset.location}` : ""}
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
              Flagged {flaggedAtLabel} by {flag.flaggedBy}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ ...badgeStyle, background: `${sevColor}20`, color: sevColor }}>
              {flag.severity}
            </span>
            <span style={{ ...badgeStyle, background: `${statusColor}20`, color: statusColor }}>
              {flag.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Original reason */}
        <div>
          <div style={labelStyle}>Reason</div>
          <div style={{
            background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7,
            padding: "11px 13px", fontSize: 13, color: "var(--t1)", lineHeight: 1.55,
          }}>
            {flag.reason}
          </div>
          {flag.photoUrls && flag.photoUrls.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {flag.photoUrls.map((url, i) => (
                <PhotoDisplay key={url} url={url} alt={`Flag photo ${i + 1}`} size="medium" />
              ))}
            </div>
          )}
        </div>

        {/* Repair history */}
        <div>
          <div style={labelStyle}>
            Repair history ({flag.repairNotes.length})
          </div>
          {flag.repairNotes.length === 0 ? (
            <div style={{
              padding: "16px 14px", textAlign: "center",
              background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7,
              fontSize: 12, color: "var(--t3)", fontFamily: "'DM Mono',monospace",
            }}>
              No repair activity yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {flag.repairNotes.map(note => {
                const ts = new Date(note.timestamp);
                const tsLabel = new Intl.DateTimeFormat("en-US", {
                  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                }).format(ts);
                return (
                  <div key={note.id} style={{
                    background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7,
                    padding: "11px 13px",
                    borderLeft: `3px solid ${ACTION_COLORS[note.actionType]}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          fontSize: 9, padding: "2px 7px", borderRadius: 3,
                          fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.05em",
                          background: "var(--s3)", color: ACTION_COLORS[note.actionType],
                        }}>{ACTION_LABELS[note.actionType]}</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)" }}>{note.author}</span>
                      </div>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>{tsLabel}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--t1)", lineHeight: 1.55 }}>{note.body}</div>
                    {note.photoUrls && note.photoUrls.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {note.photoUrls.map((url, i) => (
                          <PhotoDisplay key={url} url={url} alt={`Note photo ${i + 1}`} size="small" />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resolution (if resolved) */}
        {flag.status === "resolved" && flag.resolutionSummary && (
          <div>
            <div style={labelStyle}>Resolution</div>
            <div style={{
              background: "rgba(109,238,159,0.05)", border: "1px solid rgba(109,238,159,0.2)", borderRadius: 7,
              padding: "11px 13px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ color: "var(--green)", fontSize: 13 }}>✓</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--green)" }}>
                  {flag.resolvedBy}
                </span>
                {flag.resolvedAtISO && (
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                    · {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(flag.resolvedAtISO))}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--t1)", lineHeight: 1.55 }}>{flag.resolutionSummary}</div>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isReadOnly && flag.status !== "resolved" && (
          <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--b1)", flexWrap: "wrap" }}>
            <button onClick={() => setMode("addNote")} style={{
              flex: 1, padding: "12px 18px", borderRadius: 7,
              background: "var(--s2)", border: "1px solid var(--b1)",
              color: "var(--t1)", cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 500, minHeight: 44,
            }}>+ Add repair note</button>
            <button onClick={() => setMode("resolve")} style={{
              flex: 1, padding: "12px 18px", borderRadius: 7,
              background: "var(--green)", border: "none",
              color: "var(--bg)", cursor: "pointer",
              fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, minHeight: 44,
            }}>✓ Resolve flag</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "var(--s2)", border: "1px solid var(--b1)",
  borderRadius: 7, padding: "10px 12px",
  color: "var(--t1)", outline: "none",
  fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
  colorScheme: "dark",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace", fontSize: 10,
  color: "var(--t3)", letterSpacing: "0.08em",
  textTransform: "uppercase", marginBottom: 6, display: "block",
};

const badgeStyle: React.CSSProperties = {
  fontSize: 10, padding: "3px 8px", borderRadius: 4,
  fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.05em",
};
