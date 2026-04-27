"use client";
import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import AddAssetModal from "@/components/forms/AddAssetModal";
import AddKitModal from "@/components/forms/AddKitModal";
import AddTeamMemberModal from "@/components/forms/AddTeamMemberModal";
import CSVUploadModal from "@/components/forms/CSVUploadModal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

export default function EmptyState({ context }: { context: "dashboard" | "team" | "kits" | "assets" }) {
  const isMobile = useIsMobile();
  const { switchMode } = useWorkspace();
  const [openModal, setOpenModal] = useState<"asset" | "kit" | "team" | "csv" | null>(null);

  const COPY: Record<string, { title: string; subtitle: string; primary: { label: string; modal: "asset" | "kit" | "team" | "csv" } }> = {
    dashboard: {
      title: "Your workspace is empty",
      subtitle: "Get started by adding your first asset, uploading a CSV, or adding a teammate.",
      primary: { label: "Upload CSV", modal: "csv" },
    },
    team: {
      title: "No team members yet",
      subtitle: "Add yourself and your crew. CageOS builds expertise profiles automatically based on what each person checks out.",
      primary: { label: "Add team member", modal: "team" },
    },
    kits: {
      title: "No kits built yet",
      subtitle: "Group related assets into kits — like a Venice Cinema Kit or Wireless Audio Kit. CageOS will track drift on returns automatically.",
      primary: { label: "Build a kit", modal: "kit" },
    },
    assets: {
      title: "No assets in inventory",
      subtitle: "Upload your existing inventory CSV or add assets one at a time.",
      primary: { label: "Upload CSV", modal: "csv" },
    },
  };

  const c = COPY[context];

  return (
    <>
      <Card>
        <div style={{
          padding: isMobile ? "32px 20px" : "48px 32px",
          textAlign: "center",
          maxWidth: 480, margin: "0 auto",
        }}>
          <div style={{
            width: 56, height: 56,
            background: "var(--s2)", border: "1px solid var(--b1)",
            borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
            margin: "0 auto 16px",
          }}>⬡</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 19 : 22, fontWeight: 700, marginBottom: 8 }}>{c.title}</div>
          <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 24 }}>{c.subtitle}</div>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 18, flexWrap: "wrap" }}>
            <button onClick={() => setOpenModal(c.primary.modal)} style={{
              background: "var(--acc)", color: "var(--bg)", border: "none",
              padding: "12px 22px", borderRadius: 7,
              fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700,
              cursor: "pointer", minHeight: 44,
            }}>
              {c.primary.label}
            </button>

            {context === "dashboard" && (
              <>
                <button onClick={() => setOpenModal("asset")} style={{
                  background: "transparent", color: "var(--t1)",
                  border: "1px solid var(--b1)",
                  padding: "12px 22px", borderRadius: 7,
                  fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 500,
                  cursor: "pointer", minHeight: 44,
                }}>
                  Add manually
                </button>
              </>
            )}
          </div>

          {/* Other quick actions */}
          {context === "dashboard" && (
            <div style={{
              borderTop: "1px solid var(--b1)",
              paddingTop: 18,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 10,
              textAlign: "left",
            }}>
              <button onClick={() => setOpenModal("kit")} style={{
                padding: "12px 14px", borderRadius: 7,
                background: "var(--s2)", border: "1px solid var(--b1)",
                cursor: "pointer", textAlign: "left",
                fontFamily: "'DM Sans',sans-serif",
                minHeight: 44,
              }}>
                <div style={{ fontSize: 13, color: "var(--t1)", marginBottom: 2 }}>Build a kit</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>Group assets together</div>
              </button>
              <button onClick={() => setOpenModal("team")} style={{
                padding: "12px 14px", borderRadius: 7,
                background: "var(--s2)", border: "1px solid var(--b1)",
                cursor: "pointer", textAlign: "left",
                fontFamily: "'DM Sans',sans-serif",
                minHeight: 44,
              }}>
                <div style={{ fontSize: 13, color: "var(--t1)", marginBottom: 2 }}>Add team member</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>Build your crew</div>
              </button>
            </div>
          )}

          {/* See example link */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--b1)" }}>
            <button onClick={() => switchMode("demo")} style={{
              background: "transparent", border: "none",
              color: "var(--t2)", cursor: "pointer",
              fontFamily: "'DM Mono',monospace", fontSize: 11,
              textDecoration: "underline", padding: 8,
            }}>
              Or see a populated example workspace →
            </button>
          </div>
        </div>
      </Card>

      <AddAssetModal open={openModal === "asset"} onClose={() => setOpenModal(null)} />
      <AddKitModal open={openModal === "kit"} onClose={() => setOpenModal(null)} />
      <AddTeamMemberModal open={openModal === "team"} onClose={() => setOpenModal(null)} />
      <CSVUploadModal open={openModal === "csv"} onClose={() => setOpenModal(null)} />
    </>
  );
}
