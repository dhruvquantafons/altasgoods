import Link from "next/link";
import type { Metadata } from "next";
import { CircleCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { WORKSPACES } from "@/components/shell/workspaces";

export const metadata: Metadata = { title: "Signed out" };

export default async function SignedOutPage(props: PageProps<"/signed-out">) {
  const sp = await props.searchParams;
  const from = typeof sp.from === "string" ? sp.from : "";
  const workspace = WORKSPACES.find((w) => w.key === from);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-card">
        <div className="flex justify-center">
          <Logo />
        </div>
        <CircleCheck size={40} strokeWidth={1.6} className="mx-auto mt-8 text-success-600" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold text-ink-900">You have signed out</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          {workspace ? `Your ${workspace.name} session has ended on this device.` : "Your session has ended on this device."} For your security, close this window if
          you are on a shared computer.
        </p>
        <div className="mt-8 flex flex-col gap-2">
          <Link href={workspace?.href ?? "/login"} className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700">
            Sign in again{workspace ? ` to ${workspace.name}` : ""}
          </Link>
          <Link href="/" className="inline-flex h-11 items-center justify-center rounded-lg border border-line-strong bg-white text-sm font-medium text-ink-800 hover:bg-ink-50">
            Go to the AltasGoods store
          </Link>
        </div>
      </div>
    </div>
  );
}
