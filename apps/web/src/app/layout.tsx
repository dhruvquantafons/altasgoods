import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

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
    default: "BluBuy: Shop smarter, live better",
    template: "%s | BluBuy",
  },
  description:
    "BluBuy is India's elegant marketplace for electronics, fashion, home and more. Fast delivery, easy returns and secure payments.",
  applicationName: "BluBuy",
};

export const viewport: Viewport = {
  themeColor: "#2358e0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${ui.variable} ${heading.variable} ${code.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
