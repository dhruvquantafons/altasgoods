import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <Logo />
      <p className="mt-10 font-mono text-sm text-ink-400">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink-900">We could not find that page</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500">The link may be broken or the page may have moved. Try the store or pick a workspace.</p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
          Go to the store
        </Link>
        <Link href="/portals" className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-white px-4 text-sm font-medium text-ink-800 hover:bg-ink-50">
          All workspaces
        </Link>
      </div>
    </div>
  );
}
