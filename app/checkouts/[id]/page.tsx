"use client";

/**
 * /checkouts/[id] — Single checkout detail
 *
 * The operational drilldown for one active or returned checkout. Surfaces
 * everything a shop manager needs:
 *   - WHO has the gear (with contact info — email + phone)
 *   - WHAT was checked out (kits + their components)
 *   - WHEN it was checked out and when it's due back
 *   - WHERE the shoot/project is (location from the Shoot record)
 *   - PHOTOS captured at intake (and return, when iter-20b lands)
 *   - CONDITION rating at intake
 *   - COMMENTS thread on this checkout (uses parentType="checkout")
 *
 * Action buttons:
 *   - Mark as returned (Crew+, only if status === "active"|"overdue")
 *   - Send reminder (writes a pre-filled @mention comment)
 *   - mailto: / sms: links to the person directly
 *
 * The link target for the dashboard's active-checkout card and the
 * /checkouts list page rows.
 */

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopNav from "@/components/shared/TopNav";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import CommentsThread from "@/components/shared/CommentsThread";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { toast } from "@/components/ui/Toast";
import type { ActiveCheckout, Shoot } from "@/lib/hooks/workspaceTypes";
import { formatShootRange } from "@/lib/timezone";

export default function CheckoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isMobile = useIsMobile();
  const router = useRouter();
  const auth = useAuth();
  const { data, hydrated, returnCheckout, addNote } = useWorkspace();
  const [lightbox, setLightbox] = useState<string | null>(null);

  const signedOut = auth.supabaseEnabled && !auth.loading && !auth.session;
  if (signedOut) {
    router.replace("/login");
    return null;
  }

  if (!hydrated || auth.loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          Loading workspace...
        </div>
      </div>
    );
  }

  // Find the checkout. Only ActiveCheckout entries have ids that match
  // the URL param (legacy CheckoutRecord entries from demo data don't).
  const checkout = (data.checkouts as ActiveCheckout[]).find(c => c.id === id);

  if (!checkout) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: "var(--t1)" }}>
            Checkout not found
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
            This checkout doesn&apos;t exist or has been deleted.
          </div>
          <Link href="/checkouts" style={{
            marginTop: 8, padding: "10px 18px",
            background: "var(--acc)", color: "var(--bg)",
            borderRadius: 6, textDecoration: "none",
            fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
          }}>← Back to checkouts</Link>
        </div>
      </div>
    );
  }

  return (
    <CheckoutDetailBody
      checkout={checkout}
      isMobile={isMobile}
      router={router}
      lightbox={lightbox}
      setLightbox={setLightbox}
    />
  );
}

function CheckoutDetailBody({
  checkout, isMobile, router, lightbox, setLightbox,
}: {
  checkout: ActiveCheckout;
  isMobile: boolean;
  router: ReturnType<typeof useRouter>;
  lightbox: string | null;
  setLightbox: (url: string | null) => void;
}) {
  const auth = useAuth();
  const { data, returnCheckout, addNote } = useWorkspace();

  // Resolve relations.
  // - Person: lookup profile by initials (profiles don't always have a userId)
  // - Shoot: lookup by shootId, falls back to title-match
  // - Kits: lookup by kitIds
  const person = data.profiles.find(p => p.initials === checkout.initials);
  const shoot: Shoot | undefined = checkout.shootId
    ? data.shoots.find(s => s.id === checkout.shootId)
    : undefined;
  const kits = data.kits.filter(k => checkout.kitIds.includes(k.id));

  const now = Date.now();
  const due = checkout.dueBackISO ? new Date(checkout.dueBackISO).getTime() : 0;
  const isOverdue = due > 0 && due < now && checkout.status !== "returned";
  const isReturned = checkout.status === "returned";
  const canReturn = !isReturned && (auth.currentRole === "owner" || auth.currentRole === "manager" || auth.currentRole === "crew");

  function handleMarkReturned() {
    if (!confirm("Mark this checkout as returned?\n\nAll kits and assets will move back to available status.")) return;
    returnCheckout(checkout.id);
    toast("Marked as returned", { detail: `${checkout.kits.join(" · ")}` });
    // Stay on the detail page so the user sees the new state. The status
    // pills + photos remain visible — this is a historical record now.
  }

  function handleSendReminder() {
    /**
     * Posts a pre-filled @mention comment on this checkout, which triggers
     * the existing iter-17 email pipeline. The recipient gets:
     *   - An email with the reminder text
     *   - An unread mention in their inbox bell
     *   - A row on /inbox linking back here
     *
     * Reuses ALL the comments + mentions infrastructure already built.
     * No new email template or notification system required.
     */
    if (!person?.initials) {
      toast("Can't find profile to mention", { variant: "error" });
      return;
    }
    const dueLabel = checkout.dueBackLabel ?? "soon";
    const body = `@${person.initials} Friendly reminder: ${checkout.kits.join(", ")} due back ${dueLabel}. Let me know if you need an extension.`;
    addNote({
      parentType: "checkout",
      parentId: checkout.id,
      body,
      isTask: false,
    });
    toast("Reminder sent", { detail: `${person.name} will get a notification.` });
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 14px" : "28px 28px", background: "var(--bg)" }}>
          <div style={{ maxWidth: 920, margin: "0 auto" }}>

            {/* Back link */}
            <Link href="/checkouts" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontFamily: "'DM Mono',monospace", fontSize: 11,
              color: "var(--t3)", textDecoration: "none",
              marginBottom: 12,
            }}>
              ← All checkouts
            </Link>

            {/* Page header */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 6 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>
                  {checkout.kits.length === 1 ? checkout.kits[0] : `${checkout.kits.length} kits`}
                </div>
                {isOverdue && <Badge variant="red">OVERDUE</Badge>}
                {isReturned && <Badge variant="green">RETURNED</Badge>}
                {!isOverdue && !isReturned && <Badge variant="amber">ACTIVE</Badge>}
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
                for {checkout.shoot}
              </div>
            </div>

            {/* Action buttons row — hide for returned checkouts */}
            {!isReturned && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                {canReturn && (
                  <button onClick={handleMarkReturned} style={{
                    background: "var(--green)", color: "var(--bg)",
                    border: "none", borderRadius: 6,
                    padding: "10px 16px",
                    fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13,
                    cursor: "pointer", minHeight: 40,
                  }}>
                    ✓ Mark as returned
                  </button>
                )}
                <button onClick={handleSendReminder} style={{
                  background: "var(--s2)", color: "var(--t1)",
                  border: "1px solid var(--b2)", borderRadius: 6,
                  padding: "10px 16px",
                  fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 13,
                  cursor: "pointer", minHeight: 40,
                }}>
                  📨 Send reminder
                </button>
              </div>
            )}

            {/* Status + timing strip */}
            <Card style={{ marginBottom: 14 }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
                padding: "16px 18px",
                gap: isMobile ? 14 : 0,
              }}>
                <Stat label="Checked out" value={formatDateTime(checkout.checkedOutAtISO)} />
                <Stat
                  label={isReturned ? "Returned" : "Due back"}
                  value={
                    isReturned && checkout.returnedAtISO
                      ? formatDateTime(checkout.returnedAtISO)
                      : checkout.dueBackISO
                      ? formatDateTime(checkout.dueBackISO)
                      : "—"
                  }
                  color={isOverdue ? "var(--red)" : undefined}
                />
                <Stat
                  label="Condition at checkout"
                  value={
                    checkout.intakeCondition
                      ? checkout.intakeCondition.charAt(0).toUpperCase() + checkout.intakeCondition.slice(1)
                      : "—"
                  }
                  color={conditionColor(checkout.intakeCondition)}
                />
              </div>
            </Card>

            {/* Who has it */}
            <Card style={{ marginBottom: 14 }}>
              <div style={{ padding: "14px 18px" }}>
                <SectionLabel>Who has it</SectionLabel>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: "50%",
                    background: "var(--s3)", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700,
                    color: checkout.color,
                  }}>{checkout.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 600, color: "var(--t1)" }}>
                        {checkout.user}
                      </span>
                      {person?.role && (
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                          · {person.role}
                        </span>
                      )}
                      {checkout.isGuest && <Badge variant="purple" style={{ fontSize: 9 }}>GUEST</Badge>}
                    </div>
                    {person?.department && (
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 3 }}>
                        {person.department}
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact links */}
                {(person?.email || person?.phone) && (
                  <div style={{
                    marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--b1)",
                    display: "flex", gap: 8, flexWrap: "wrap",
                  }}>
                    {person.email && (
                      <a href={`mailto:${person.email}`} style={contactLinkStyle}>
                        ✉ {person.email}
                      </a>
                    )}
                    {person.phone && (
                      <>
                        <a href={`sms:${person.phone}`} style={contactLinkStyle}>
                          💬 Text {person.phone}
                        </a>
                        <a href={`tel:${person.phone}`} style={contactLinkStyle}>
                          📞 Call
                        </a>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Shoot/project info */}
            {shoot && (
              <Card style={{ marginBottom: 14 }}>
                <div style={{ padding: "14px 18px" }}>
                  <SectionLabel>Project</SectionLabel>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: "var(--t1)", marginBottom: 4 }}>
                    {shoot.title}
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 6 }}>
                    {shoot.client}
                  </div>
                  <div style={{ display: "flex", gap: 14, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", flexWrap: "wrap" }}>
                    <span>📅 {formatShootRange(shoot.startsAt, shoot.endsAt, data.timezone)}</span>
                    {shoot.location && <span>📍 {shoot.location}</span>}
                  </div>
                </div>
              </Card>
            )}

            {/* Equipment */}
            <Card style={{ marginBottom: 14 }}>
              <div style={{ padding: "14px 18px" }}>
                <SectionLabel>Equipment</SectionLabel>
                {kits.length === 0 ? (
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
                    Kit data unavailable. Names: {checkout.kits.join(", ")}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {kits.map(kit => {
                      const components = data.assets.filter(a => kit.componentIds.includes(a.id));
                      return (
                        <div key={kit.id}>
                          <Link href={`/kit/${encodeURIComponent(kit.id)}`} style={{
                            display: "flex", alignItems: "baseline", gap: 8,
                            textDecoration: "none",
                            marginBottom: 4,
                          }}>
                            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>
                              {kit.name}
                            </span>
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                              {kit.barcode}
                            </span>
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--acc)" }}>
                              → open
                            </span>
                          </Link>
                          {components.length > 0 && (
                            <div style={{
                              marginLeft: 4, paddingLeft: 10,
                              borderLeft: "1px solid var(--b1)",
                              display: "flex", flexDirection: "column", gap: 3,
                            }}>
                              {components.map(c => (
                                <Link key={c.id} href={`/asset/${encodeURIComponent(c.id)}`} style={{
                                  fontFamily: "'DM Mono',monospace", fontSize: 11,
                                  color: "var(--t2)", textDecoration: "none",
                                  display: "flex", gap: 6, alignItems: "center",
                                }}>
                                  <span style={{ color: "var(--t3)" }}>·</span>
                                  <span>{c.name}</span>
                                  <span style={{ color: "var(--t3)", fontSize: 10 }}>{c.barcode}</span>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>

            {/* Intake photos */}
            {checkout.intakePhotoUrls && checkout.intakePhotoUrls.length > 0 && (
              <Card style={{ marginBottom: 14 }}>
                <div style={{ padding: "14px 18px" }}>
                  <SectionLabel>Photos at checkout</SectionLabel>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: checkout.intakePhotoUrls.length === 1 ? "1fr" : "1fr 1fr",
                    gap: 10,
                  }}>
                    {checkout.intakePhotoUrls.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setLightbox(url)}
                        style={{
                          aspectRatio: "4/3",
                          background: "var(--s2)",
                          border: "1px solid var(--b1)",
                          borderRadius: 8,
                          overflow: "hidden",
                          padding: 0, cursor: "pointer",
                          position: "relative",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Intake photo ${i + 1}`}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Return photos (if returned with photos — iter-20b will add return-side capture) */}
            {checkout.returnPhotoUrls && checkout.returnPhotoUrls.length > 0 && (
              <Card style={{ marginBottom: 14 }}>
                <div style={{ padding: "14px 18px" }}>
                  <SectionLabel>Photos at return</SectionLabel>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: checkout.returnPhotoUrls.length === 1 ? "1fr" : "1fr 1fr",
                    gap: 10,
                  }}>
                    {checkout.returnPhotoUrls.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setLightbox(url)}
                        style={{
                          aspectRatio: "4/3",
                          background: "var(--s2)",
                          border: "1px solid var(--b1)",
                          borderRadius: 8,
                          overflow: "hidden",
                          padding: 0, cursor: "pointer",
                          position: "relative",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Return photo ${i + 1}`}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </button>
                    ))}
                  </div>
                  {checkout.returnCondition && (
                    <div style={{ marginTop: 10, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
                      Condition at return:{" "}
                      <span style={{ color: conditionColor(checkout.returnCondition) }}>
                        {checkout.returnCondition.charAt(0).toUpperCase() + checkout.returnCondition.slice(1)}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Comments thread on this checkout */}
            <Card>
              <div style={{ padding: "14px 18px 18px" }}>
                <CommentsThread
                  parentType="checkout"
                  parentId={checkout.id}
                  parentLabel={`${checkout.kits.join(" · ")} (${checkout.user})`}
                />
              </div>
            </Card>

          </div>
        </div>
      </div>

      {/* Lightbox — fullscreen image viewer when a photo is tapped. */}
      {lightbox && (
        <button
          onClick={() => setLightbox(null)}
          aria-label="Close lightbox"
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.95)",
            border: "none", padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Full size"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
          <div style={{
            position: "absolute", top: 18, right: 22,
            color: "#fff", fontSize: 20,
            background: "rgba(255,255,255,0.15)",
            width: 36, height: 36, borderRadius: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</div>
        </button>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'DM Mono',monospace", fontSize: 9,
      color: "var(--t3)", letterSpacing: "0.1em",
      textTransform: "uppercase", marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 500, color: color ?? "var(--t1)" }}>
        {value}
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function conditionColor(c?: string): string | undefined {
  switch (c) {
    case "excellent": return "var(--green)";
    case "good":      return "var(--t1)";
    case "fair":      return "var(--amber)";
    case "damaged":   return "var(--red)";
    case "broken":    return "var(--red)";
    default:          return undefined;
  }
}

const contactLinkStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "7px 12px",
  background: "var(--s2)", border: "1px solid var(--b1)",
  borderRadius: 5,
  fontFamily: "'DM Mono',monospace", fontSize: 11,
  color: "var(--t1)", textDecoration: "none",
};
