import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallScope — Evidence-first traceability",
  description:
    "Trace ingredient lots to customer deliveries, review uncertain links, and run evidence-backed recall drills.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
