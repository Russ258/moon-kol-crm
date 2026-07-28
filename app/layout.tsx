import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moon Card | KOL CRM",
  description: "Moon Inc. internal KOL and affiliate program CRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-dark antialiased">{children}</body>
    </html>
  );
}
