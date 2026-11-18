import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Geist_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { serverNow } from "@/lib/clock";
import { NowProvider } from "@/components/now-provider";

// The rupee sign only ships in the latin-ext subset, so every face loads it.
const ui = Inter({
  variable: "--font-ui",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const heading = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const code = Geist_Mono({
  variable: "--font-code",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AltasGoods: Shop smarter, live better",
    template: "%s | AltasGoods",
  },
  description:
    "AltasGoods is India's elegant marketplace for electronics, fashion, home and more. Fast delivery, easy returns and secure payments.",
  applicationName: "AltasGoods",
};

export const viewport: Viewport = {
  themeColor: "#2358e0",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page reads the real clock, so render per request instead of freezing build time into static HTML.
  await connection();
  const now = serverNow();
  return (
    <html lang="en-IN" className={`${ui.variable} ${heading.variable} ${code.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col"><NowProvider now={now}>{children}</NowProvider></body>
    </html>
  );
}
