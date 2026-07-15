import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpinWord — Social word play, verifiable rounds",
  description: "Play unlimited server-authoritative SpinWord rounds with free Loot Coins or purchased, nonredeemable Spin Coins.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#080511" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
