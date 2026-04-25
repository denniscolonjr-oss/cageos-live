import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CageOS — Production Equipment Tracking",
  description: "Badge-first kiosk checkout for production shops",
};

export const viewport: Viewport = {
  themeColor: "#0c0c0c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ height: "100vh", overflow: "hidden" }}>{children}</body>
    </html>
  );
}
