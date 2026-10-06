import type { Metadata } from "next";
import { Headset } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SellerSignIn } from "@/components/seller/seller-sign-in";
import { currentUser } from "@/lib/api/server";
import { formatPhone } from "@/lib/onboarding";

export const metadata: Metadata = {
  title: { default: "Start selling", template: "%s | AltasGoods Seller Hub" },
  description: "Register as a seller on AltasGoods: verify your business, add a pickup address and bank account, and start listing.",
};

export default async function RegisterLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo href="/seller/register" label="Seller Hub" size="sm" />
          <div className="flex items-center gap-1 sm:gap-4">
            <a href="tel:18004192600" className="hidden items-center gap-1.5 text-[13px] text-ink-600 hover:text-ink-900 sm:inline-flex">
              <Headset size={15} aria-hidden="true" />
              Help: 1800 419 2600
            </a>
            {user && !user.sellers.length && <span className="hidden text-[13px] text-ink-500 md:inline">Signed in as {user.name ?? formatPhone(user.phone)}</span>}
            <SellerSignIn className="rounded-lg px-2 py-1.5 text-[13px] font-medium text-brand-700 hover:bg-brand-50">Already selling? Sign in</SellerSignIn>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-5 text-xs text-ink-500 sm:flex-row sm:justify-between sm:px-6">
          <p>AltasGoods Internet Private Limited, an e-commerce operator under the CGST Act.</p>
          <p>Your documents are encrypted and used only for KYC verification.</p>
        </div>
      </footer>
    </div>
  );
}
