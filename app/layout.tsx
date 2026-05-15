import type { Metadata, Viewport } from "next";
import "./globals.css";
import ToastHost from "@/components/ui/Toast";
import { WorkspaceProvider } from "@/lib/hooks/useWorkspace";
import { AuthProvider } from "@/lib/supabase/AuthContext";

export const metadata: Metadata = {
  title: "CageOS — Production Equipment Tracking",
  description: "Badge-first kiosk checkout for production shops",
};

export const viewport: Viewport = {
  themeColor: "#0e0e0e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/*
       * Body locked to the visible viewport so the app shell (TopNav + sticky
       * content) can fit a single scroll context inside the dashboard / kiosk
       * / detail routes. Uses `100dvh` (dynamic viewport height) rather than
       * `100vh` to handle iOS Safari's collapsing URL bar correctly — on
       * iPhone, `100vh` is the height of the viewport WITHOUT subtracting
       * the bottom browser UI, so kiosk Confirm buttons end up off-screen.
       * `100dvh` shrinks to the actually visible area. `100vh` stays as a
       * fallback for older browsers that don't support dvh (pre-2022 Safari).
       */}
      <body style={{ height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <AuthProvider>
          <WorkspaceProvider>
            {children}
            <ToastHost />
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
