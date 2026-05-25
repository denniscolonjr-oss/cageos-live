import type { Metadata, Viewport } from "next";
import "./globals.css";
import ToastHost from "@/components/ui/Toast";
import { WorkspaceProvider } from "@/lib/hooks/useWorkspace";
import { AuthProvider } from "@/lib/supabase/AuthContext";

export const metadata: Metadata = {
  metadataBase: new URL("https://cageos.app"),
  title: {
    default: "CageOS — Built for crews that move gear",
    template: "%s · CageOS",
  },
  description:
    "Replaces your spreadsheet, your group chat, and the \"who has the 50mm lens?\" problem. CageOS is checkout, tracking, and audit-trail software for production crews, contractors, and any team that lives out of a gear cage.",
  keywords: [
    "equipment checkout software",
    "gear tracking",
    "production inventory management",
    "asset checkout system",
    "barcode equipment tracking",
    "kit management software",
    "av equipment inventory",
    "construction tool tracking",
  ],
  authors: [{ name: "CageOS" }],
  creator: "CageOS",
  publisher: "CageOS",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://cageos.app",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://cageos.app",
    siteName: "CageOS",
    title: "CageOS — Built for crews that move gear",
    description:
      "Replaces your spreadsheet, your group chat, and the \"who has the 50mm lens?\" problem. Checkout, tracking, and audit-trail software for crews that can't afford to lose their gear.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CageOS dashboard preview — equipment operations for production crews",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CageOS — Built for crews that move gear",
    description:
      "Replaces your spreadsheet, your group chat, and the \"who has the 50mm lens?\" problem.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon.png" },
    ],
  },
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
