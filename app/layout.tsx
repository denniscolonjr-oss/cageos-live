import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CageOS — Production Equipment Tracking",
  description: "Badge-first kiosk checkout for production shops",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ height: "100vh", overflow: "hidden" }}>{children}</body>
    </html>
  );
}
