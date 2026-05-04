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
      <body style={{ height: "100vh", overflow: "hidden" }}>
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
