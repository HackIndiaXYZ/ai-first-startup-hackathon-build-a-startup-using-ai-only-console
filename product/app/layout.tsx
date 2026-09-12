import type { Metadata } from "next";
import "./globals.css";
import "./workspace-theme.css";
import { appearanceBootstrap } from "@/lib/preferences";

export const metadata: Metadata = {
  title: "RecallScope · Batch traceability",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
