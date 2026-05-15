"use client";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import TopNav from "@/components/shared/TopNav";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import AddComponentsModal from "@/components/forms/AddComponentsModal";
import SwapComponentModal from "@/components/forms/SwapComponentModal";
import CommentsThread from "@/components/shared/CommentsThread";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";
import { formatShootRange } from "@/lib/timezone";

export default function KitDetailPage({ params }: { params: Promise<{ barcode: string }> }) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const auth = useAuth();
  const { data, rawAssets, rawKits, hydrated, isReadOnly, updateKit, deleteKit, restoreKit, permanentDeleteKit, detachAssetFromKit, openFlags } = useWorkspace();
  const { barcode } = use(params);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showAddComponents, setShowAddComponents] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{ assetId: string; category: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Signed-out detection. When the user signs out while on a kit detail page,
   * rawKits empties and `notFound()` would fire before the redirect-to-login
   * can take effect — landing the user on a 404 page instead. This guard
   * intercepts that and routes cleanly to /login. Matches the pattern used
   * on the asset detail page.
   *
   * Doesn't affect anonymous demo flow — that mode never has a session,
   * so `supabaseEnabled && !session` only matches a genuine signed-out state
   * for an authenticated app.
   */
  const signedOut = auth.supabaseEnabled && !auth.loading && !auth.session;
  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

  if (!hydrated || auth.loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          Loading workspace...
        </div>
      </div>
    );
  }

  // Signed-out — render a brief loading state while the redirect-to-login
  // takes effect. Without this guard, we'd 404 below on missing kit data.
  if (signedOut) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          Signing out...
        </div>
      </div>
    );
  }

  // Search RAW kits so URLs to archived kits resolve
  const decoded = decodeURIComponent(barcode);
  const kit = rawKits.find(k => k.barcode === decoded || k.id === decoded);

  // Same pattern as asset detail: while a delete is in flight, render a graceful
  // "going away" state instead of 404.
  if (!kit && !isDeleting) return notFound();
  if (!kit && isDeleting) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t2)", fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
          Returning to dashboard...
        </div>
      </div>
    );
  }
  if (!kit) return null;

  const isArchived = !!kit.archivedAt;
  // Use rawAssets so archived components don't disappear; we'll mark them
  const components = rawAssets.filter(a => kit.componentIds.includes(a.id));
  const blockedComponents = components.filter(c => openFlags.some(f => f.assetId === c.id));

  // Projects that have this kit assigned
  const projectsWithKit = data.projects
    .filter(s => s.assignedKits.includes(kit.id))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  // Active checkout for this kit if any
  const activeCheckout = data.checkouts.find(c => {
    const ac = c as { kitIds?: string[]; status: string };
    return ac.kitIds?.includes(kit.id) && (ac.status === "active" || ac.status === "overdue");
  });

  function startEdit(field: string, current: string) {
    setEditingField(field);
    setEditValue(current);
  }

  function commitEdit(field: string) {
    if (isReadOnly) { setEditingField(null); return; }
    const value = editValue.trim();
    updateKit(kit!.id, { [field]: value });
    toast(`${field} updated`);
    setEditingField(null);
  }

  function cancelEdit() {
    setEditingField(null);
    setEditValue("");
  }

  function handleDetach(assetId: string, assetName: string) {
    if (!confirm(`Remove ${assetName} from ${kit!.name}? The asset stays in inventory.`)) return;
    detachAssetFromKit(assetId);
    toast(`Removed ${assetName} from kit`);
  }

  function handleArchive() {
    if (!kit) return;
    if (!confirm(`Archive "${kit.name}"?\n\nIt will be hidden from active inventory but kept for audit trail. Components stay available. You can restore it anytime.`)) return;

    const kitName = kit.name;
    const kitId = kit.id;
    const result = deleteKit(kitId, "Manager");
    if (!result) return;

    if (result.kind === "blocked") {
      toast(`Cannot archive ${kitName}`, { variant: "error", detail: result.reason });
      return;
    }

    router.push("/dashboard");
    setIsDeleting(true);
    toast(`${kitName} archived`, {
      action: {
        label: "Undo",
        onClick: () => { result.undo(); toast(`${kitName} restored`); },
      },
    });
  }

  function handlePermanentDelete() {
    if (!kit) return;
    if (!confirm(`PERMANENTLY DELETE "${kit.name}"?\n\nThis cannot be undone. The kit will be removed forever. Components stay in inventory.\n\nIf you might want to recover this later, use Archive instead.`)) return;
    if (!confirm(`Are you absolutely sure you want to permanently delete ${kit.name}?`)) return;

    const isCheckedOut = data.checkouts.some(c => {
      if (c.status !== "active" && c.status !== "overdue") return false;
      const ck = c as { kitIds?: string[] };
      return ck.kitIds?.includes(kit.id) ?? false;
    });
    if (isCheckedOut) {
      toast(`Cannot delete ${kit.name}`, { variant: "error", detail: "Kit is currently checked out. Return it first." });
      return;
    }

    const kitName = kit.name;
    const kitId = kit.id;
    setIsDeleting(true);
    router.push("/dashboard");
    permanentDeleteKit(kitId, "Manager");
    toast(`${kitName} permanently deleted`, { variant: "error" });
  }

  function handleRestore() {
    if (!kit || !isArchived) return;
    restoreKit(kit.id, "Manager");
    toast(`${kit.name} restored`);
  }

  // Legacy alias
  function handleDelete() { handleArchive(); }

  function openSwap(assetId: string, category: string) {
    setSwapTarget({ assetId, category });
  }

  const statusVariant: "green" | "amber" | "red" =
    kit.status === "available" ? "green" :
    kit.status === "out" ? "amber" : "red";

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
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)" }}>Kits</span>
            <span style={{ color: "var(--t3)", fontSize: 11 }}>/</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t1)" }}>{kit.barcode}</span>
          </div>

          {/* Header */}
          <div className="animate-fade-up" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--acc)", marginBottom: 8 }}>
                  Kit · {kit.barcode}
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
                    onClick={() => !isReadOnly && startEdit("name", kit.name)}
                    title={isReadOnly ? undefined : "Click to edit"}
                    style={{
                      fontFamily: "'Syne',sans-serif",
                      fontSize: isMobile ? 24 : 32, fontWeight: 800, letterSpacing: -1, lineHeight: 1.1,
                      cursor: isReadOnly ? "default" : "text",
                    }}
                  >{kit.name}</h1>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {isArchived && <Badge variant="gray">⏸ archived</Badge>}
                  <Badge variant={statusVariant}>{kit.status}</Badge>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)" }}>
                    {components.length} component{components.length === 1 ? "" : "s"}
                  </span>
                  {blockedComponents.length > 0 && (
                    <Badge variant="red">⚠ {blockedComponents.length} flagged</Badge>
                  )}
                </div>
                {isArchived && (
                  <div style={{
                    marginTop: 14,
                    padding: "10px 13px",
                    background: "rgba(205,200,188,0.08)",
                    border: "1px solid var(--b1)",
                    borderRadius: 7,
                    fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", lineHeight: 1.5,
                  }}>
                    Archived {kit.archivedAt ? new Date(kit.archivedAt).toLocaleString() : ""}
                    {kit.archivedBy && ` by ${kit.archivedBy}`}.
                    Hidden from active inventory and the kiosk picker.
                  </div>
                )}
              </div>

              {!isReadOnly && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href="/kiosk" style={{
                    padding: "10px 16px", borderRadius: 7,
                    background: "var(--acc)", color: "var(--bg)",
                    fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                    textDecoration: "none", minHeight: 40,
                    display: "inline-flex", alignItems: "center",
                  }}>↗ Check out at kiosk</Link>
                </div>
              )}
            </div>
          </div>

          {/* Two-column */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 320px",
            gap: 14,
          }}>

            {/* LEFT */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>

              {/* Active checkout banner */}
              {activeCheckout && (
                <Card accentColor="var(--amber)">
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                      Currently checked out
                    </div>
                    <div style={{ fontSize: 12, color: "var(--t2)" }}>
                      {(activeCheckout as { user: string }).user} · for {(activeCheckout as { project?: string; shoot?: string }).project ?? (activeCheckout as { shoot?: string }).shoot}
                    </div>
                  </div>
                </Card>
              )}

              {/* Editable details */}
              <Card>
                <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--b1)" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700 }}>Details</div>
                </div>
                <div style={{ padding: "8px 0" }}>
                  <KitRow
                    label="Location" value={kit.location}
                    isEditing={editingField === "location"}
                    editValue={editValue} setEditValue={setEditValue}
                    onStartEdit={() => startEdit("location", kit.location)}
                    onCommit={() => commitEdit("location")}
                    onCancel={cancelEdit}
                    editable={!isReadOnly}
                  />
                  <KitRow
                    label="Barcode" value={kit.barcode}
                    editable={false}
                  />
                  <KitRow
                    label="Status" value={kit.status}
                    editable={false}
                  />
                </div>
              </Card>

              {/* Components */}
              <Card>
                <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--b1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700 }}>
                    Components ({components.length})
                  </div>
                  {!isReadOnly && !isArchived && (
                    <button
                      onClick={() => setShowAddComponents(true)}
                      style={{
                        padding: "6px 12px", borderRadius: 6,
                        background: "var(--acc)", border: "none",
                        color: "var(--bg)", cursor: "pointer",
                        fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600,
                        minHeight: 32,
                      }}>
                      + Add components
                    </button>
                  )}
                </div>
                {components.length === 0 ? (
                  <div style={{ padding: "24px 18px", textAlign: "center", fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
                    No components in this kit yet.
                  </div>
                ) : (
                  components.map((c, i) => {
                    const flagged = openFlags.find(f => f.assetId === c.id);
                    const componentArchived = !!c.archivedAt;
                    return (
                      <div key={c.id} style={{
                        padding: "12px 18px",
                        borderBottom: i < components.length - 1 ? "1px solid var(--b1)" : "none",
                        display: "flex", gap: 10, alignItems: "center",
                        opacity: componentArchived ? 0.5 : 1,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link href={`/asset/${encodeURIComponent(c.barcode)}`} style={{ textDecoration: "none" }}>
                            <div style={{ fontSize: 13, color: "var(--t1)", marginBottom: 3 }}>
                              {c.name}
                              {componentArchived && <span style={{ color: "var(--t3)", marginLeft: 6, fontSize: 11 }}>(archived)</span>}
                              {flagged && (
                                <span title={`Flagged ${flagged.severity}`} style={{ color: "var(--red)", marginLeft: 6, fontSize: 11 }}>⚠</span>
                              )}
                            </div>
                            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                              {c.barcode} · {c.category}{c.location ? ` · ${c.location}` : ""}
                            </div>
                          </Link>
                        </div>
                        <Badge variant={c.status === "in" ? "green" : c.status === "out" ? "amber" : "red"}>{c.status}</Badge>
                        {!isReadOnly && !isArchived && (
                          <>
                            <button
                              onClick={() => openSwap(c.id, c.category)}
                              title="Swap for another asset of the same category"
                              style={{
                                padding: "5px 10px", borderRadius: 5,
                                background: "transparent", border: "1px solid var(--b1)",
                                color: "var(--t1)", cursor: "pointer",
                                fontFamily: "'DM Mono',monospace", fontSize: 10,
                                minHeight: 32,
                              }}>
                              ⇄ Swap
                            </button>
                            <button
                              onClick={() => handleDetach(c.id, c.name)}
                              title="Remove from kit"
                              style={{
                                padding: "5px 10px", borderRadius: 5,
                                background: "transparent", border: "1px solid var(--b1)",
                                color: "var(--t3)", cursor: "pointer",
                                fontFamily: "'DM Mono',monospace", fontSize: 10,
                                minHeight: 32,
                              }}>
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </Card>

              {/* Projects */}
              <Card>
                <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--b1)" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700 }}>Projects ({projectsWithKit.length})</div>
                </div>
                {projectsWithKit.length === 0 ? (
                  <div style={{ padding: "24px 18px", textAlign: "center", fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
                    Not assigned to any projects.
                  </div>
                ) : (
                  projectsWithKit.map((s, i) => {
                    const statusColor =
                      s.status === "active" ? "var(--green)" :
                      s.status === "scheduled" ? "var(--blue)" :
                      s.status === "completed" ? "var(--t3)" : "var(--red)";
                    return (
                      <div key={s.id} style={{
                        padding: "12px 18px",
                        borderBottom: i < projectsWithKit.length - 1 ? "1px solid var(--b1)" : "none",
                        display: "flex", gap: 10, alignItems: "flex-start",
                      }}>
                        <div style={{ width: 4, alignSelf: "stretch", flexShrink: 0, background: statusColor, borderRadius: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: "var(--t1)", marginBottom: 3 }}>{s.title}</div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)" }}>
                            {s.client} · {formatShootRange(s.startsAt, s.endsAt, data.timezone)}
                          </div>
                        </div>
                        <Badge variant={s.status === "active" ? "green" : s.status === "scheduled" ? "blue" : s.status === "completed" ? "gray" : "red"}>
                          {s.status}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </Card>

              {/*
               * Comments / discussion thread for this kit.
               *
               * Same setup as the asset detail page. Notes live in workspace
               * JSON under `data.notes` filtered by parentType='kit' and
               * parentId=kit.id. CommentsThread handles all the data fetching,
               * permission gating, and rendering itself.
               */}
              <Card>
                <div style={{ padding: "14px 18px 18px" }}>
                  <CommentsThread
                    parentType="kit"
                    parentId={kit.id}
                    parentLabel={kit.name}
                  />
                </div>
              </Card>

            </div>

            {/* RIGHT */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              <Card>
                <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--b1)" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700 }}>Stats</div>
                </div>
                <div style={{ padding: "0" }}>
                  <SidebarRow label="Components" value={String(components.length)} />
                  <SidebarRow label="Status" value={kit.status} />
                  <SidebarRow label="Flagged components" value={String(blockedComponents.length)} />
                  <SidebarRow label="Projects assigned" value={String(projectsWithKit.length)} last />
                </div>
              </Card>

              {!isReadOnly && data.managerMode && (() => {
                if (isArchived) {
                  return (
                    <Card>
                      <div style={{ padding: "16px 18px" }}>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Restore kit</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14, lineHeight: 1.5 }}>
                          This kit is archived and hidden from active inventory.
                          Restoring returns it to active status. Components remain unattached.
                        </div>
                        <button onClick={handleRestore} style={{
                          width: "100%",
                          padding: "10px 16px", borderRadius: 6,
                          background: "transparent", border: "1px solid var(--green)",
                          color: "var(--green)", cursor: "pointer",
                          fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 40,
                        }}>↺ Restore to active inventory</button>
                      </div>
                    </Card>
                  );
                }

                const isCheckedOut = data.checkouts.some(c => {
                  if (c.status !== "active" && c.status !== "overdue") return false;
                  const ck = c as { kitIds?: string[] };
                  return ck.kitIds?.includes(kit.id) ?? false;
                });
                const upcomingProjects = data.projects.filter(s =>
                  (s.status === "scheduled" || s.status === "active") && s.assignedKits.includes(kit.id),
                );
                const blocked = isCheckedOut || upcomingProjects.length > 0;
                const everCheckedOut = data.checkouts.some(c => {
                  const ck = c as { kitIds?: string[] };
                  return ck.kitIds?.includes(kit.id);
                });
                const hasHistory = everCheckedOut || kit.componentIds.length > 0;
                const verb = hasHistory ? "Archive" : "Delete";

                return (
                  <Card>
                    <div style={{ padding: "16px 18px" }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Danger zone</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14, lineHeight: 1.5 }}>
                        {blocked && isCheckedOut && "This kit is currently checked out. Return it first to archive or delete."}
                        {blocked && !isCheckedOut && upcomingProjects.length > 0 && `This kit is assigned to ${upcomingProjects.length} upcoming project${upcomingProjects.length === 1 ? "" : "s"}. Remove from those projects first.`}
                        {!blocked && "Archive moves the kit to the Archived list (recoverable). Permanent delete removes it forever (no undo). Components stay in inventory either way."}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <button
                          onClick={handleArchive}
                          disabled={blocked}
                          title="Hide from active inventory but keep audit history. Recoverable from the Archived view."
                          style={{
                            width: "100%",
                            padding: "11px 16px", borderRadius: 6,
                            background: "var(--s2)",
                            border: `1px solid ${blocked ? "var(--b1)" : "var(--amber)"}`,
                            color: blocked ? "var(--t3)" : "var(--amber)",
                            cursor: blocked ? "not-allowed" : "pointer",
                            fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600,
                            minHeight: 40,
                          }}>
                          ⏸ Archive kit {!blocked && <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 4 }}>(recoverable)</span>}
                        </button>

                        <button
                          onClick={handlePermanentDelete}
                          disabled={blocked}
                          title="Permanently remove. No undo. Cannot be recovered."
                          style={{
                            width: "100%",
                            padding: "11px 16px", borderRadius: 6,
                            background: "transparent",
                            border: `1px solid ${blocked ? "var(--b1)" : "var(--red)"}`,
                            color: blocked ? "var(--t3)" : "var(--red)",
                            cursor: blocked ? "not-allowed" : "pointer",
                            fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600,
                            minHeight: 40,
                          }}>
                          ✕ Permanently delete {!blocked && <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 4 }}>(no undo)</span>}
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      <AddComponentsModal
        open={showAddComponents}
        onClose={() => setShowAddComponents(false)}
        kitId={kit.id}
        kitName={kit.name}
      />
      <SwapComponentModal
        open={!!swapTarget}
        onClose={() => setSwapTarget(null)}
        oldAssetId={swapTarget?.assetId ?? null}
        category={swapTarget?.category ?? null}
        kitName={kit.name}
      />
    </div>
  );
}

interface KitRowProps {
  label: string;
  value: string;
  isEditing?: boolean;
  editValue?: string;
  setEditValue?: (v: string) => void;
  onStartEdit?: () => void;
  onCommit?: () => void;
  onCancel?: () => void;
  editable: boolean;
}

function KitRow({ label, value, isEditing, editValue, setEditValue, onStartEdit, onCommit, onCancel, editable }: KitRowProps) {
  return (
    <div style={{
      padding: "10px 18px", display: "flex", alignItems: "center",
      gap: 12, borderBottom: "1px solid var(--b1)",
    }}>
      <div style={{ width: 110, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing && setEditValue && onCommit && onCancel ? (
          <input
            autoFocus
            value={editValue ?? ""}
            onChange={e => setEditValue(e.target.value)}
            onBlur={onCommit}
            onKeyDown={e => { if (e.key === "Enter") onCommit(); if (e.key === "Escape") onCancel(); }}
            style={{
              width: "100%", background: "var(--s2)", border: "1px solid var(--acc)",
              borderRadius: 6, padding: "6px 10px",
              color: "var(--t1)", outline: "none",
              fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 36,
              colorScheme: "dark",
            }}
          />
        ) : (
          <span
            onClick={editable && onStartEdit ? onStartEdit : undefined}
            title={editable ? "Click to edit" : undefined}
            style={{
              fontSize: 13, color: "var(--t1)",
              cursor: editable ? "text" : "default",
            }}
          >{value}</span>
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
