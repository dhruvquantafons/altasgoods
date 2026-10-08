import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { CartProvider } from "@/components/store/cart-context";
import { COMPANY } from "@/lib/mock/store-extra";

export const metadata: Metadata = {
  title: { default: "Secure checkout", template: "%s | AltasGoods" },
};

/** Enclosed, distraction-free checkout: logo, secure label and help only. */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-canvas">
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Logo />
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-800">
              <ShieldCheck size={18} className="text-success-600" aria-hidden="true" />
              <span className="hidden sm:inline">Secure checkout</span>
              <span className="sm:hidden">Secure</span>
            </p>
            <Link href="/help" className="flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
              <HelpCircle size={17} aria-hidden="true" /> Help
            </Link>
          </div>
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-line bg-white">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 py-5 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>
              Payments are processed by RBI regulated partners. AltasGoods never stores your card number. Need help? Call {COMPANY.customerCare} (toll free).
            </p>
            <p className="flex gap-4">
              <Link href="/policies/terms" className="hover:text-ink-800">
                Terms
              </Link>
              <Link href="/policies/privacy" className="hover:text-ink-800">
                Privacy
              </Link>
              <Link href="/policies/returns" className="hover:text-ink-800">
                Returns
              </Link>
            </p>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
