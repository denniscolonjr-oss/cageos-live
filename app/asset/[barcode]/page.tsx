"use client";
import { use, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import TopNav from "@/components/shared/TopNav";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import PhotoUpload from "@/components/ui/PhotoUpload";
import PhotoDisplay from "@/components/ui/PhotoDisplay";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";
import FlagItemModal from "@/components/forms/FlagItemModal";
import FlagDetailModal from "@/components/forms/FlagDetailModal";
import PickKitModal from "@/components/forms/PickKitModal";

const CATEGORIES = ["Video", "Audio", "Lighting", "Grip", "Power", "Misc Prod", "IT / Network"];
const LIFECYCLE_OPTIONS = ["active", "retired", "lost"] as const;

export default function AssetDetailPage({ params }: { params: Promise<{ barcode: string }> }) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const { data, hydrated, isReadOnly, updateAsset, deleteAsset, detachAssetFromKit } = useWorkspace();
  const { activeWorkspaceId } = useAuth();
  const { barcode } = use(params);

  const [showFlagModal, setShowFlagModal] = useState(false);
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);
  const [showPickKit, setShowPickKit] = useState(false);

  // Editing state — manager mode required for sensitive fields
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const selectedFlag = selectedFlagId ? data.flags.find(f => f.id === selectedFlagId) ?? null : null;

  if (!hydrated) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          Loading workspace...
        </div>
      </div>
    );
  }

  // URL barcode is the asset's barcode field (which is also the asset id in our data model)
  const decoded = decodeURIComponent(barcode);
  const asset = data.assets.find(a => a.barcode === decoded || a.id === decoded);
  if (!asset) return notFound();

  const kit = asset.kitId ? data.kits.find(k => k.id === asset.kitId) ?? null : null;

  // Flag history for this asset
  const flagHistory = data.flags
    .filter(f => f.assetId === asset.id)
    .sort((a, b) => b.flaggedAtISO.localeCompare(a.flaggedAtISO));
  const openFlag = flagHistory.find(f => f.status !== "resolved") ?? null;

  // Checkout history for this asset — we look at all checkout records that include this asset
  const checkoutHistory = data.checkouts.filter(c => {
    const ac = c as { assetIds?: string[] };
    return ac.assetIds?.includes(asset.id);
  });

  // Audit events that mention this asset's barcode in the detail string
  const assetEvents = data.events.filter(e => {
    const haystack = `${e.summary} ${e.detail ?? ""}`;
    return haystack.includes(asset.barcode) || haystack.includes(asset.name);
  }).slice(0, 8);

  // Field editing — applies a single-field change immediately
  function startEdit(field: string, currentValue: string | number | null | undefined) {
    setEditingField(field);
    setEditValue(currentValue?.toString() ?? "");
  }

  function commitEdit(field: string) {
    if (isReadOnly) { setEditingField(null); return; }
    let value: string | number | null = editValue.trim();
    if (field === "cost") {
      const n = parseFloat(editValue);
      value = isNaN(n) ? null : n;
    } else if (value === "") {
      value = null;
    }
    updateAsset(asset!.id, { [field]: value });
    toast(`${field} updated`);
    setEditingField(null);
  }

  function cancelEdit() {
    setEditingField(null);
    setEditValue("");
  }

  function handleDelete() {
    if (!confirm(`Delete "${asset!.name}"? This removes it from any kit and resolves any open flags.`)) return;
    const assetName = asset!.name;
    const undo = deleteAsset(asset!.id);
    toast(`${assetName} deleted`, {
      action: undo ? { label: "Undo", onClick: () => { undo(); toast(`${assetName} restored`); } } : undefined,
    });
    router.push("/dashboard");
  }

  function handleDetachFromKit() {
    if (!kit) return;
    if (!confirm(`Remove ${asset!.name} from ${kit.name}? The asset stays in inventory.`)) return;
    detachAssetFromKit(asset!.id);
    toast(`Removed from ${kit.name}`);
  }

  // Asset status badge color
  const statusVariant: "green" | "amber" | "red" =
    asset.status === "in" ? "green" :
    asset.status === "out" ? "amber" : "red";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TopNav />
      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: isMobile ? "20px 14px 60px" : "32px 28px 60px" }}>

          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <Link href="/dashboard" style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", textDecoration: "none" }}>
              ← Dashboard
            </Link>
            <span style={{ color: "var(--t3)", fontSize: 11 }}>/</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)" }}>Assets</span>
            <span style={{ color: "var(--t3)", fontSize: 11 }}>/</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t1)" }}>{asset.barcode}</span>
          </div>

          {/* Header */}
          <div className="animate-fade-up" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--acc)", marginBottom: 8 }}>
                  Asset · {asset.barcode}
                </div>
                {editingField === "name" ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => commitEdit("name")}
                    onKeyDown={e => { if (e.key === "Enter") commitEdit("name"); if (e.key === "Escape") cancelEdit(); }}
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontSize: isMobile ? 24 : 32, fontWeight: 800, letterSpacing: -1,
                      background: "var(--s2)", border: "1px solid var(--acc)", borderRadius: 7,
                      padding: "6px 10px", color: "var(--t1)", outline: "none",
                      width: "100%", maxWidth: 600, colorScheme: "dark",
                    }}
                  />
                ) : (
                  <h1
                    onClick={() => !isReadOnly && startEdit("name", asset.name)}
                    title={isReadOnly ? undefined : "Click to edit"}
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontSize: isMobile ? 24 : 32, fontWeight: 800, letterSpacing: -1, lineHeight: 1.1,
                      cursor: isReadOnly ? "default" : "text",
                    }}
                  >{asset.name}</h1>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <Badge variant={statusVariant}>{asset.status}</Badge>
                  <Badge variant={asset.lifecycle === "active" ? "blue" : asset.lifecycle === "retired" ? "gray" : "red"}>
                    {asset.lifecycle}
                  </Badge>
                  {openFlag && (
                    <Badge variant={openFlag.severity === "critical" ? "red" : "amber"}>
                      ⚠ {openFlag.severity}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              {!isReadOnly && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href="/kiosk" style={{
                    padding: "10px 16px", borderRadius: 7,
                    background: "var(--acc)", color: "var(--bg)",
                    fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                    textDecoration: "none", minHeight: 40,
                    display: "inline-flex", alignItems: "center",
                  }}>↗ Check out</Link>
                  {data.managerMode && (
                    <button
                      onClick={() => setShowFlagModal(true)}
                      disabled={!!openFlag}
                      title={openFlag ? "Already has an open flag" : "Flag this asset for service"}
                      style={{
                        padding: "10px 16px", borderRadius: 7,
                        background: "transparent",
                        border: `1px solid ${openFlag ? "var(--b2)" : "var(--red)"}`,
                        color: openFlag ? "var(--t3)" : "var(--red)",
                        cursor: openFlag ? "not-allowed" : "pointer",
                        fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 500,
                        minHeight: 40,
                      }}>
                      ⚠ Flag
                    </button>
                  )}
                  {kit ? (
                    <button onClick={handleDetachFromKit} style={{
                      padding: "10px 16px", borderRadius: 7,
                      background: "transparent", border: "1px solid var(--b1)",
                      color: "var(--t2)", cursor: "pointer",
                      fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 500,
                      minHeight: 40,
                    }}>Remove from kit</button>
                  ) : (
                    <button onClick={() => setShowPickKit(true)} style={{
                      padding: "10px 16px", borderRadius: 7,
                      background: "transparent", border: "1px solid var(--b1)",
                      color: "var(--t2)", cursor: "pointer",
                      fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 500,
                      minHeight: 40,
                    }}>+ Add to kit</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Two-column layout: details + sidebar */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 320px",
            gap: 14,
          }}>

            {/* LEFT — main column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>

              {/* Open flag callout */}
              {openFlag && (
                <Card accentColor={openFlag.severity === "critical" ? "var(--red)" : "var(--amber)"}>
                  <div style={{ padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 7, flexShrink: 0,
                      background: openFlag.severity === "critical" ? "rgba(255,79,79,0.12)" : "rgba(245,166,35,0.12)",
                      color: openFlag.severity === "critical" ? "var(--red)" : "var(--amber)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                    }}>⚠</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                        Open service flag — {openFlag.status.replace(/_/g, " ")}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginBottom: 8 }}>
                        {openFlag.reason}
                      </div>
                      <button onClick={() => setSelectedFlagId(openFlag.id)} style={{
                        padding: "6px 12px", borderRadius: 5,
                        background: "var(--s2)", border: "1px solid var(--b1)",
                        color: "var(--t1)", cursor: "pointer",
                        fontFamily: "'DM Sans',sans-serif", fontSize: 12, minHeight: 32,
                      }}>View / manage flag</button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Photo */}
              <Card>
                <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--b1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700 }}>Photo</div>
                  {!isReadOnly && asset.photoUrl && activeWorkspaceId && (
                    <PhotoUpload
                      workspaceId={activeWorkspaceId}
                      pathPrefix={`assets/${asset.id}`}
                      onUploaded={(url) => updateAsset(asset.id, { photoUrl: url })}
                      label="Replace"
                      compact
                    />
                  )}
                </div>
                <div style={{ padding: "16px 18px" }}>
                  {asset.photoUrl ? (
                    <PhotoDisplay
                      url={asset.photoUrl}
                      alt={asset.name}
                      size="large"
                      onRemove={!isReadOnly ? () => updateAsset(asset.id, { photoUrl: undefined }) : undefined}
                    />
                  ) : !isReadOnly && activeWorkspaceId ? (
                    <div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", marginBottom: 10, lineHeight: 1.5 }}>
                        Add a reference photo so crew can identify this asset at the cage.
                      </div>
                      <PhotoUpload
                        workspaceId={activeWorkspaceId}
                        pathPrefix={`assets/${asset.id}`}
                        onUploaded={(url) => updateAsset(asset.id, { photoUrl: url })}
                        label="+ Upload photo"
                      />
                    </div>
                  ) : (
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
                      No photo {isReadOnly ? "" : "— sign in to upload"}
                    </div>
                  )}
                </div>
              </Card>

              {/* Details — editable fields */}
              <Card>
                <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--b1)" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700 }}>Details</div>
                </div>
                <div style={{ padding: "8px 0" }}>
                  {/* Editable rows */}
                  <DetailRow
                    label="Category" value={asset.category}
                    isEditing={editingField === "category"}
                    editValue={editValue} setEditValue={setEditValue}
                    onStartEdit={() => startEdit("category", asset.category)}
                    onCommit={() => commitEdit("category")}
                    onCancel={cancelEdit}
                    editable={!isReadOnly}
                    selectOptions={CATEGORIES}
                  />
                  <DetailRow
                    label="Make" value={asset.make || "—"}
                    isEditing={editingField === "make"}
                    editValue={editValue} setEditValue={setEditValue}
                    onStartEdit={() => startEdit("make", asset.make)}
                    onCommit={() => commitEdit("make")}
                    onCancel={cancelEdit}
                    editable={!isReadOnly}
                  />
                  <DetailRow
                    label="Model" value={asset.model || "—"}
                    isEditing={editingField === "model"}
                    editValue={editValue} setEditValue={setEditValue}
                    onStartEdit={() => startEdit("model", asset.model)}
                    onCommit={() => commitEdit("model")}
                    onCancel={cancelEdit}
                    editable={!isReadOnly}
                  />
                  <DetailRow
                    label="Location" value={asset.location || "—"}
                    isEditing={editingField === "location"}
                    editValue={editValue} setEditValue={setEditValue}
                    onStartEdit={() => startEdit("location", asset.location)}
                    onCommit={() => commitEdit("location")}
                    onCancel={cancelEdit}
                    editable={!isReadOnly}
                  />
                  <DetailRow
                    label="Kit" value={kit ? `${kit.name} (${kit.barcode})` : "Not in a kit"}
                    editable={false}
                    customAction={kit ? (
                      <Link href={`/kit/${encodeURIComponent(kit.barcode)}`} style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--blue)", textDecoration: "none" }}>
                        view kit →
                      </Link>
                    ) : null}
                  />
                  {/* Manager-only fields */}
                  <DetailRow
                    label="Serial" value={asset.serialNumber || "—"}
                    isEditing={editingField === "serialNumber"}
                    editValue={editValue} setEditValue={setEditValue}
                    onStartEdit={() => startEdit("serialNumber", asset.serialNumber)}
                    onCommit={() => commitEdit("serialNumber")}
                    onCancel={cancelEdit}
                    editable={!isReadOnly && data.managerMode}
                    managerOnly
                  />
                  <DetailRow
                    label="Cost" value={asset.cost ? `$${asset.cost.toLocaleString()}` : "—"}
                    isEditing={editingField === "cost"}
                    editValue={editValue} setEditValue={setEditValue}
                    onStartEdit={() => startEdit("cost", asset.cost)}
                    onCommit={() => commitEdit("cost")}
                    onCancel={cancelEdit}
                    editable={!isReadOnly && data.managerMode}
                    inputType="number"
                    managerOnly
                  />
                  <DetailRow
                    label="EOL date" value={asset.eolDate || "—"}
                    isEditing={editingField === "eolDate"}
                    editValue={editValue} setEditValue={setEditValue}
                    onStartEdit={() => startEdit("eolDate", asset.eolDate)}
                    onCommit={() => commitEdit("eolDate")}
                    onCancel={cancelEdit}
                    editable={!isReadOnly && data.managerMode}
                    inputType="text"
                    managerOnly
                  />
                  <DetailRow
                    label="Lifecycle" value={asset.lifecycle}
                    isEditing={editingField === "lifecycle"}
                    editValue={editValue} setEditValue={setEditValue}
                    onStartEdit={() => startEdit("lifecycle", asset.lifecycle)}
                    onCommit={() => commitEdit("lifecycle")}
                    onCancel={cancelEdit}
                    editable={!isReadOnly && data.managerMode}
                    selectOptions={[...LIFECYCLE_OPTIONS]}
                    managerOnly
                  />
                </div>
              </Card>

              {/* Notes — long-form editable */}
              <Card>
                <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--b1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700 }}>Notes</div>
                  {!isReadOnly && editingField !== "notes" && (
                    <button onClick={() => startEdit("notes", asset.notes ?? "")} style={{
                      padding: "5px 10px", borderRadius: 5,
                      background: "transparent", border: "1px solid var(--b1)",
                      color: "var(--t2)", cursor: "pointer",
                      fontFamily: "'DM Mono',monospace", fontSize: 11,
                    }}>{asset.notes ? "Edit" : "+ Add"}</button>
                  )}
                </div>
                <div style={{ padding: "14px 18px" }}>
                  {editingField === "notes" ? (
                    <div>
                      <textarea
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        rows={4}
                        placeholder="Anything worth knowing — quirks, accessories, special handling, repair history pre-tracked, etc."
                        style={{
                          width: "100%", background: "var(--s2)", border: "1px solid var(--b1)",
                          borderRadius: 7, padding: "10px 12px",
                          color: "var(--t1)", outline: "none",
                          fontFamily: "'DM Sans',sans-serif", fontSize: 13,
                          resize: "vertical", colorScheme: "dark",
                        }}
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={cancelEdit} style={{
                          padding: "8px 14px", borderRadius: 6,
                          background: "transparent", border: "1px solid var(--b1)",
                          color: "var(--t2)", cursor: "pointer",
                          fontFamily: "'DM Sans',sans-serif", fontSize: 12, minHeight: 36,
                        }}>Cancel</button>
                        <button onClick={() => commitEdit("notes")} style={{
                          padding: "8px 14px", borderRadius: 6,
                          background: "var(--acc)", border: "none",
                          color: "var(--bg)", cursor: "pointer",
                          fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700, minHeight: 36,
                        }}>Save</button>
                      </div>
                    </div>
                  ) : asset.notes ? (
                    <div style={{ fontSize: 13, color: "var(--t1)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{asset.notes}</div>
                  ) : (
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>No notes yet.</div>
                  )}
                </div>
              </Card>

              {/* Flag history */}
              <Card>
                <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--b1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700 }}>Flag history</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
                    {flagHistory.length} total · {flagHistory.filter(f => f.status !== "resolved").length} open
                  </div>
                </div>
                {flagHistory.length === 0 ? (
                  <div style={{ padding: "24px 18px", textAlign: "center", fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
                    Never flagged.
                  </div>
                ) : (
                  flagHistory.map((f, i) => {
                    const sevColor = f.severity === "critical" ? "var(--red)" : "var(--amber)";
                    const statusColor =
                      f.status === "resolved" ? "var(--green)" :
                      f.status === "in_repair" ? "var(--amber)" : "var(--red)";
                    const flaggedAt = new Date(f.flaggedAtISO);
                    return (
                      <div key={f.id} onClick={() => setSelectedFlagId(f.id)} style={{
                        padding: "12px 18px",
                        borderBottom: i < flagHistory.length - 1 ? "1px solid var(--b1)" : "none",
                        cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start",
                      }}>
                        <div style={{ width: 4, alignSelf: "stretch", flexShrink: 0, background: sevColor, borderRadius: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 7, marginBottom: 4, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ ...miniBadge, background: `${sevColor}20`, color: sevColor }}>{f.severity}</span>
                            <span style={{ ...miniBadge, background: `${statusColor}20`, color: statusColor }}>
                              {f.status.replace(/_/g, " ")}
                            </span>
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                              {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(flaggedAt)} · by {f.flaggedBy}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5,
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                          }}>
                            {f.reason}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, color: "var(--t3)", alignSelf: "center", flexShrink: 0 }}>›</div>
                      </div>
                    );
                  })
                )}
              </Card>

            </div>

            {/* RIGHT — sidebar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>

              {/* At a glance */}
              <Card>
                <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--b1)" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700 }}>At a glance</div>
                </div>
                <div style={{ padding: "0" }}>
                  <SidebarRow label="Last user" value={asset.lastUser || "Never used"} />
                  <SidebarRow label="Last updated" value={asset.lastUpdated || "—"} />
                  <SidebarRow label="Times checked out" value={String(checkoutHistory.length)} />
                  <SidebarRow label="Times flagged" value={String(flagHistory.length)} last />
                </div>
              </Card>

              {/* Recent activity for this asset */}
              <Card>
                <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--b1)" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700 }}>Recent activity</div>
                </div>
                {assetEvents.length === 0 ? (
                  <div style={{ padding: "20px 18px", textAlign: "center", fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
                    No activity yet.
                  </div>
                ) : (
                  assetEvents.map((e, i) => {
                    const ts = new Date(e.timestamp);
                    const ago = Math.floor((Date.now() - ts.getTime()) / (1000 * 60));
                    const agoLabel = ago < 1 ? "just now" : ago < 60 ? `${ago}m ago` : ago < 60 * 24 ? `${Math.floor(ago / 60)}h ago` : `${Math.floor(ago / (60 * 24))}d ago`;
                    return (
                      <div key={e.id} style={{
                        padding: "10px 18px",
                        borderBottom: i < assetEvents.length - 1 ? "1px solid var(--b1)" : "none",
                      }}>
                        <div style={{ fontSize: 12, color: "var(--t1)", marginBottom: 3, lineHeight: 1.4 }}>{e.summary}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                          {agoLabel} · {e.actor}
                        </div>
                      </div>
                    );
                  })
                )}
              </Card>

              {/* Manager-only delete */}
              {!isReadOnly && data.managerMode && (
                <Card>
                  <div style={{ padding: "16px 18px" }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Danger zone</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14, lineHeight: 1.5 }}>
                      Removes the asset from inventory and resolves any open flags.
                    </div>
                    <button onClick={handleDelete} style={{
                      width: "100%",
                      padding: "10px 16px", borderRadius: 6,
                      background: "transparent", border: "1px solid var(--red)",
                      color: "var(--red)", cursor: "pointer",
                      fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 40,
                    }}>Delete asset</button>
                  </div>
                </Card>
              )}

            </div>
          </div>
        </div>
      </div>

      <FlagItemModal open={showFlagModal} onClose={() => setShowFlagModal(false)} asset={asset} />
      <FlagDetailModal open={!!selectedFlag} onClose={() => setSelectedFlagId(null)} flag={selectedFlag} />
      <PickKitModal open={showPickKit} onClose={() => setShowPickKit(false)} assetId={asset.id} assetName={asset.name} currentKitId={asset.kitId} />
    </div>
  );
}

const miniBadge: React.CSSProperties = {
  fontSize: 9, padding: "2px 6px", borderRadius: 3,
  fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.05em",
};

interface DetailRowProps {
  label: string;
  value: string;
  isEditing?: boolean;
  editValue?: string;
  setEditValue?: (v: string) => void;
  onStartEdit?: () => void;
  onCommit?: () => void;
  onCancel?: () => void;
  editable: boolean;
  selectOptions?: string[];
  inputType?: string;
  managerOnly?: boolean;
  customAction?: React.ReactNode;
}

function DetailRow({
  label, value, isEditing, editValue, setEditValue,
  onStartEdit, onCommit, onCancel, editable, selectOptions, inputType, managerOnly, customAction,
}: DetailRowProps) {
  return (
    <div style={{
      padding: "10px 18px", display: "flex", alignItems: "center",
      gap: 12, borderBottom: "1px solid var(--b1)", flexWrap: "wrap",
    }}>
      <div style={{ width: 110, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0 }}>
        {label}
        {managerOnly && <span title="Manager mode only" style={{ color: "var(--acc)", marginLeft: 4 }}>★</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
        {isEditing && setEditValue && onCommit && onCancel ? (
          selectOptions ? (
            <select
              autoFocus
              value={editValue ?? ""}
              onChange={e => setEditValue(e.target.value)}
              onBlur={onCommit}
              style={{
                flex: 1, background: "var(--s2)", border: "1px solid var(--acc)",
                borderRadius: 6, padding: "6px 10px",
                color: "var(--t1)", outline: "none",
                fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 36,
                colorScheme: "dark",
              }}
            >
              {selectOptions.map(opt => <option key={opt} value={opt} style={{ backgroundColor: "var(--s2)", color: "var(--t1)" }}>{opt}</option>)}
            </select>
          ) : (
            <input
              autoFocus
              type={inputType ?? "text"}
              value={editValue ?? ""}
              onChange={e => setEditValue(e.target.value)}
              onBlur={onCommit}
              onKeyDown={e => { if (e.key === "Enter") onCommit(); if (e.key === "Escape") onCancel(); }}
              style={{
                flex: 1, background: "var(--s2)", border: "1px solid var(--acc)",
                borderRadius: 6, padding: "6px 10px",
                color: "var(--t1)", outline: "none",
                fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 36,
                colorScheme: "dark",
              }}
            />
          )
        ) : (
          <>
            <span
              onClick={editable && onStartEdit ? onStartEdit : undefined}
              title={editable ? "Click to edit" : undefined}
              style={{
                fontSize: 13, color: "var(--t1)",
                cursor: editable ? "text" : "default",
                padding: editable ? "4px 8px" : 0, borderRadius: 5,
                marginLeft: editable ? -8 : 0,
                background: editable ? "transparent" : "transparent",
              }}
            >{value}</span>
            {customAction}
          </>
        )}
      </div>
    </div>
  );
}

function SidebarRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      padding: "12px 18px",
      borderBottom: last ? "none" : "1px solid var(--b1)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    }}>
      <div style={{ fontSize: 12, color: "var(--t2)" }}>{label}</div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>{value}</div>
    </div>
  );
}
