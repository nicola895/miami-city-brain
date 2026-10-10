import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Miami City Brain",
  description: "Your next step in Miami, mapped to your goals. Powered by Gemma 4.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
