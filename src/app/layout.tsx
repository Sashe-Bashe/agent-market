import type { Metadata } from "next";
import "./globals.css";
import { brand } from "@/lib/brand";
export const metadata: Metadata = {
  title: `${brand.name} · Workspace`,
  description:
    "A local B2B agent commerce marketplace. Discover suppliers, negotiate structured offers, and approve demo orders.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
