import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Lock, Truck, Undo2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: { default: "Sign in", template: "%s | BluBuy" },
};

const TILES = ["headphones-studio", "dress-summer", "vase-ceramic", "sneakers-white", "coffee-maker", "watch-analog"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="pointer-events-none absolute -top-40 -right-24 size-[34rem] rounded-full bg-brand-600/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 size-96 rounded-full bg-accent-400/15 blur-3xl" aria-hidden="true" />
        <Logo inverted className="relative" />
        <div className="relative">
          <div className="grid max-w-md grid-cols-3 gap-3" aria-hidden="true">
            {TILES.map((t, i) => (
              <span key={t} className={`relative aspect-square overflow-hidden rounded-2xl ring-1 ring-white/10 ${i % 2 ? "translate-y-5" : ""}`}>
                <Image src={`/images/products/${t}.jpg`} alt="" fill sizes="160px" className="object-cover" />
              </span>
            ))}
          </div>
          <h1 className="mt-14 max-w-md font-display text-4xl leading-tight font-semibold tracking-tight">Shop calmly. Pay honestly. Return easily.</h1>
          <ul className="mt-6 flex flex-col gap-3 text-[15px] text-brand-100">
            {[
              { icon: Truck, t: "Real delivery dates for your pincode" },
              { icon: Undo2, t: "Free doorstep returns, refunds in 2 hours to BluBuy Credits" },
              { icon: BadgeCheck, t: "Verified sellers with their details on every product" },
            ].map((x) => (
              <li key={x.t} className="flex items-center gap-3">
                <x.icon size={18} className="text-accent-300" aria-hidden="true" /> {x.t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-brand-200">
          <Lock size={13} aria-hidden="true" /> Your number is used only to sign you in and send order updates.
        </p>
      </aside>
      <main id="main" className="flex flex-col px-5 py-8 sm:px-10 lg:px-16 lg:py-12">
        <div className="flex items-center justify-between lg:justify-end">
          <Logo className="lg:hidden" />
          <Link href="/help" className="text-sm font-medium text-ink-600 hover:text-ink-900">
            Need help?
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        <p className="text-center text-xs text-ink-500">
          © 2026 BluBuy Commerce Private Limited.{" "}
          <Link href="/policies/terms" className="hover:text-ink-800">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/policies/privacy" className="hover:text-ink-800">
            Privacy
          </Link>
        </p>
      </main>
    </div>
  );
}
