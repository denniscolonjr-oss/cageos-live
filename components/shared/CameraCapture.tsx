"use client";

/**
 * CameraCapture — fullscreen camera overlay.
 *
 * Opens the device's camera (rear-facing by default for tablets/phones)
 * via the WebRTC `getUserMedia` API. Live preview fills the viewport.
 * User taps the shutter, sees a confirm/retake screen, then either
 * commits (uploads to Supabase + calls onCapture) or retakes.
 *
 * Behavior on no camera / permission denied:
 *   Renders a graceful fallback screen with two options:
 *     1. "Try again" — re-request permission (useful if they denied accidentally)
 *     2. "Continue on phone" — placeholder for iter-20b (QR handoff). For
 *        now this button shows a message instructing them to use a phone
 *        or device with a camera. iter-20b will wire QR handoff here.
 *
 * Image compression: before upload we re-encode to JPEG at quality 80 and
 * cap the max dimension at 1600px. Typical output is 150-400KB which is
 * ~10x smaller than raw camera output and a meaningful Supabase Storage
 * savings as customers accumulate photos over time.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <button onClick={() => setOpen(true)}>Take photo</button>
 *   {open && (
 *     <CameraCapture
 *       onCapture={(url) => { setOpen(false); doSomethingWith(url); }}
 *       onCancel={() => setOpen(false)}
 *       workspaceId={workspaceId}
 *       pathPrefix="checkouts"
 *     />
 *   )}
 */

import { useEffect, useRef, useState } from "react";
import { uploadPhoto } from "@/lib/supabase/uploadPhoto";

interface CameraCaptureProps {
  /** Called with the uploaded public URL once the user confirms a photo. */
  onCapture: (publicUrl: string) => void;
  /** Called when the user cancels or closes the camera without capturing. */
  onCancel: () => void;
  /** Workspace id — needed by uploadPhoto for storage path scoping. */
  workspaceId: string;
  /** Subfolder under the workspace where the photo will be stored. e.g. "checkouts", "flags". */
  pathPrefix: string;
  /** Optional label shown at the top of the camera (e.g. "Front of case"). */
  label?: string;
}

type CameraStatus = "starting" | "live" | "captured" | "uploading" | "denied" | "no-camera" | "error";

export default function CameraCapture({
  onCapture, onCancel, workspaceId, pathPrefix, label,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<CameraStatus>("starting");
  const [error, setError] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);  // for preview

  // Boot the camera on mount. Re-runs on attempts.
  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      setStatus("starting");
      setError(null);

      // Check basic API support — older browsers / privacy-locked browsers
      // may not expose getUserMedia at all.
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("no-camera");
        return;
      }

      try {
        // facingMode: "environment" requests the back-facing camera on mobile.
        // On laptops/desktops it's ignored and the only camera is used.
        // ideal vs exact — we use ideal so devices with only a front camera
        // still work (graceful degradation).
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // play() must be triggered manually on some browsers (Safari, especially)
          await videoRef.current.play().catch(() => {
            // play() can reject if the user navigates away mid-load. Ignore.
          });
        }
        setStatus("live");
      } catch (err) {
        if (cancelled) return;
        const e = err as DOMException;
        // NotAllowedError = permission denied; NotFoundError = no camera hardware
        if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
          setStatus("denied");
        } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
          setStatus("no-camera");
        } else {
          setStatus("error");
          setError(e.message || "Camera failed to start.");
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      // Stop all tracks so the device's camera indicator turns off.
      // Critical for tablets sitting in shared spaces — leaving the camera
      // on after the user navigates away is a privacy red flag.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  function handleShutter() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Compress and resize: cap max dimension at 1600px. Aspect ratio preserved.
    // 1600px at JPEG q80 yields ~150-400KB for typical handheld captures —
    // sharp enough for damage documentation, small enough to be storage-cheap.
    const MAX_DIM = 1600;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    let cw = vw;
    let ch = vh;
    if (Math.max(vw, vh) > MAX_DIM) {
      const scale = MAX_DIM / Math.max(vw, vh);
      cw = Math.round(vw * scale);
      ch = Math.round(vh * scale);
    }
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, cw, ch);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setStatus("error");
          setError("Failed to encode photo.");
          return;
        }
        setCapturedBlob(blob);
        // Local object URL for preview — never sent over the network.
        // Revoked when component unmounts via the cleanup below.
        setCapturedUrl(URL.createObjectURL(blob));
        setStatus("captured");
      },
      "image/jpeg",
      0.8,
    );
  }

  // Revoke object URL when captured photo changes or component unmounts.
  // Without this, the browser leaks memory on multi-photo sessions.
  useEffect(() => {
    return () => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [capturedUrl]);

  function handleRetake() {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(null);
    setCapturedUrl(null);
    setStatus("live");
  }

  async function handleConfirm() {
    if (!capturedBlob) return;
    setStatus("uploading");
    try {
      const url = await uploadPhoto(capturedBlob, workspaceId, pathPrefix);
      onCapture(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setError(msg);
      setStatus("error");
    }
  }

  function handleRetry() {
    // Re-trigger the boot effect by remounting via state — easiest path
    // is to flip status back to starting and let the effect's stale closure
    // run again. Since the effect doesn't re-run (empty deps), we instead
    // call startCamera-equivalent inline. Simpler: just reload the component
    // by calling onCancel, parent re-opens. But that's UX-fragile.
    //
    // Better: imperatively retry without unmounting.
    setStatus("starting");
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus("live");
      } catch (err) {
        const e = err as DOMException;
        if (e.name === "NotAllowedError") setStatus("denied");
        else if (e.name === "NotFoundError") setStatus("no-camera");
        else { setStatus("error"); setError(e.message); }
      }
    })();
  }

  // ────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#000",
      display: "flex", flexDirection: "column",
    }}>
      {/* Top bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 22px",
        background: "linear-gradient(180deg, rgba(0,0,0,0.6), transparent)",
      }}>
        <button onClick={onCancel} aria-label="Close camera" style={{
          background: "rgba(255,255,255,0.1)", border: "none",
          color: "#fff", width: 38, height: 38, borderRadius: 19,
          fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          ✕
        </button>
        {label && (
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: 11,
            color: "#fff", letterSpacing: "0.08em",
            textTransform: "uppercase",
            background: "rgba(0,0,0,0.4)",
            padding: "6px 14px", borderRadius: 999,
          }}>{label}</div>
        )}
        <div style={{ width: 38 }} />  {/* spacer to center label */}
      </div>

      {/* Video / preview */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          width: "100%", height: "100%",
          objectFit: "cover",
          display: status === "live" ? "block" : "none",
        }}
      />

      {/* Captured photo preview */}
      {status === "captured" && capturedUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={capturedUrl}
          alt="Captured photo preview"
          style={{
            width: "100%", height: "100%",
            objectFit: "cover",
          }}
        />
      )}

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Status overlays */}
      {status === "starting" && (
        <StatusOverlay
          title="Starting camera..."
          subtitle="Please allow access if prompted."
        />
      )}

      {status === "uploading" && (
        <StatusOverlay
          title="Uploading photo..."
          subtitle="One moment."
        />
      )}

      {status === "denied" && (
        <FallbackOverlay
          title="Camera access denied."
          subtitle="To take photos here, allow camera access in your browser settings. Or continue on a phone or tablet with a camera."
          primaryLabel="Try again"
          primaryAction={handleRetry}
          secondaryLabel="Continue on phone (coming soon)"
          secondaryAction={() => alert("Cross-device handoff lands in the next push. For now, open CageOS on a phone or tablet and add the photo from there.")}
          onCancel={onCancel}
        />
      )}

      {status === "no-camera" && (
        <FallbackOverlay
          title="No camera detected."
          subtitle="This device doesn't have a camera available, or the browser doesn't support camera access."
          primaryLabel="Try again"
          primaryAction={handleRetry}
          secondaryLabel="Continue on phone (coming soon)"
          secondaryAction={() => alert("Cross-device handoff lands in the next push. For now, open CageOS on a phone or tablet and add the photo from there.")}
          onCancel={onCancel}
        />
      )}

      {status === "error" && (
        <FallbackOverlay
          title="Camera failed."
          subtitle={error ?? "Something went wrong. Try again."}
          primaryLabel="Try again"
          primaryAction={handleRetry}
          secondaryLabel="Close"
          secondaryAction={onCancel}
          onCancel={onCancel}
        />
      )}

      {/* Bottom controls */}
      {status === "live" && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
          display: "flex", justifyContent: "center", alignItems: "center",
          padding: "32px 22px 44px",
          background: "linear-gradient(0deg, rgba(0,0,0,0.7), transparent)",
        }}>
          <button onClick={handleShutter} aria-label="Take photo" style={{
            width: 76, height: 76, borderRadius: "50%",
            background: "#fff",
            border: "4px solid rgba(255,255,255,0.4)",
            outline: "none", cursor: "pointer",
            boxShadow: "0 0 0 2px #fff",
          }} />
        </div>
      )}

      {status === "captured" && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2,
          display: "flex", justifyContent: "center", alignItems: "center",
          gap: 16,
          padding: "32px 22px 44px",
          background: "linear-gradient(0deg, rgba(0,0,0,0.7), transparent)",
        }}>
          <button onClick={handleRetake} style={{
            background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
            color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 600,
            fontSize: 14, padding: "12px 22px", borderRadius: 7, cursor: "pointer",
          }}>
            Retake
          </button>
          <button onClick={handleConfirm} style={{
            background: "var(--acc)", border: "none",
            color: "var(--bg)", fontFamily: "'Syne', sans-serif", fontWeight: 700,
            fontSize: 14, padding: "12px 26px", borderRadius: 7, cursor: "pointer",
          }}>
            Use this photo
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Status overlays
// ────────────────────────────────────────────────────────────────────────

function StatusOverlay({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 3,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.85)",
      color: "#fff",
      padding: 24, textAlign: "center",
    }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, opacity: 0.7 }}>
        {subtitle}
      </div>
    </div>
  );
}

function FallbackOverlay({
  title, subtitle, primaryLabel, primaryAction, secondaryLabel, secondaryAction, onCancel,
}: {
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryAction: () => void;
  secondaryLabel: string;
  secondaryAction: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 3,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.92)",
      color: "#fff",
      padding: "28px 24px", textAlign: "center",
    }}>
      <div style={{
        fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700,
        marginBottom: 10, maxWidth: 380,
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: 14,
        opacity: 0.7, lineHeight: 1.5, marginBottom: 28, maxWidth: 380,
      }}>
        {subtitle}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 280 }}>
        <button onClick={primaryAction} style={{
          background: "var(--acc)", color: "var(--bg)",
          border: "none", borderRadius: 7,
          padding: "14px", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14,
          cursor: "pointer",
        }}>
          {primaryLabel}
        </button>
        <button onClick={secondaryAction} style={{
          background: "transparent", color: "#fff",
          border: "1px solid rgba(255,255,255,0.3)", borderRadius: 7,
          padding: "14px", fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 14,
          cursor: "pointer",
        }}>
          {secondaryLabel}
        </button>
        <button onClick={onCancel} style={{
          background: "transparent", color: "rgba(255,255,255,0.6)",
          border: "none",
          padding: "10px", fontFamily: "'DM Mono', monospace", fontSize: 11,
          cursor: "pointer", marginTop: 4,
        }}>
          Skip — continue without photo
        </button>
      </div>
    </div>
  );
}
