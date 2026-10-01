import Link from "next/link";
import { ArrowRight, Circle, CircleCheck, Clock3, FileCheck2, GraduationCap, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Progress, Timeline, type TimelineItem } from "@/components/ui/misc";
import type { Tone } from "@/lib/status";
import { cn, formatDateTime, NOW } from "@/lib/utils";

export const metadata = { title: "Application status" };

const at = (mins: number) => formatDateTime(new Date(NOW.getTime() - mins * 60_000));

const TIMELINE: TimelineItem[] = [
  { title: "Registered", time: at(52), description: "Mobile and email verified" },
  { title: "KYC in progress", time: at(47), description: "Business, PAN, store, pickup, bank and signature added" },
  { title: "Submitted", time: at(2), description: "Seller agreement accepted and e-signed" },
  { title: "Under review", time: "Now", description: "Automatic checks passed. A verifier is reviewing your documents.", tone: "info" },
  { title: "Approved", description: "You can create listings", done: false },
  { title: "Active", description: "First listing approved and pickup address verified", done: false },
];

const DOCS: { label: string; detail: string; status: "AUTO_VERIFIED" | "VERIFIED" | "PENDING"; }[] = [
  { label: "GSTIN 27AAKFS4410M1Z2", detail: "Active on the GST portal, legal name matched", status: "AUTO_VERIFIED" },
  { label: "PAN AAKFS4410M", detail: "Name on PAN matches the GST registration", status: "AUTO_VERIFIED" },
  { label: "Bank account ending 4821", detail: "₹1 penny drop, name matched", status: "VERIFIED" },
  { label: "Digital signature", detail: "Checked against the authorised signatory", status: "PENDING" },
  { label: "Grocery: FSSAI licence", detail: "Needed before you can list in Grocery", status: "PENDING" },
  { label: "Brand registry: trademark 5281934", detail: "Checked with IP India records", status: "PENDING" },
];

const DOC_META: Record<(typeof DOCS)[number]["status"], { label: string; tone: Tone }> = {
  AUTO_VERIFIED: { label: "Auto-verified", tone: "success" },
  VERIFIED: { label: "Verified", tone: "success" },
  PENDING: { label: "In review", tone: "info" },
};

const CHECKLIST = [
  { title: "Business details and GSTIN", body: "Verified automatically", done: true },
  { title: "PAN and KYC", body: "Verified automatically", done: true },
  { title: "Bank account", body: "Penny drop verified", done: true },
  { title: "Watch: your first week on BluBuy", body: "12 minute Seller Academy lesson on listing, pricing and dispatch", done: false, action: { label: "Start lesson", href: "/seller/support" } },
  { title: "Create your first listing", body: "Find your product in the catalog or create a new one", done: false },
  { title: "Book a pickup test", body: "BluBuy Logistics visits your pickup address once to verify it", done: false },
  { title: "Set up your store page", body: "Logo, banner and description customers see", done: false },
];

export default function StatusPage() {
  const done = CHECKLIST.filter((c) => c.done).length;
  const current = CHECKLIST.findIndex((c) => !c.done);
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-info-50 text-info-600">
          <Clock3 size={26} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold text-ink-900">Your application is under review</h1>
            <Badge tone="info" dot>
              Under review
            </Badge>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-600">
            Thanks, Meera. Sahyadri Home Essentials LLP is in the verification queue. Most applications are approved within 24 to 72 hours; we will email meera@sahyadrihome.in and send an SMS as soon as there is news.
          </p>
        </div>
        <ButtonLink href="/seller" variant="secondary" iconRight={ArrowRight} className="self-start sm:self-center">
          Go to Seller Hub
        </ButtonLink>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="min-w-0 self-start lg:col-span-3">
          <CardHeader title="Set up your store" description="Finish these while we verify your documents" action={<span className="text-[13px] font-medium text-ink-700 tabular-nums">{done} of {CHECKLIST.length} complete</span>} />
          <div className="px-5 pt-4">
            <Progress value={done} max={CHECKLIST.length} label="Store setup progress" />
          </div>
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {CHECKLIST.map((c, i) => (
              <li key={c.title} className={cn("flex items-start gap-3 px-5", c.done ? "py-3" : "py-4", i === current && "bg-brand-50/40")}>
                {c.done ? <CircleCheck size={19} className="mt-px shrink-0 text-success-600" aria-hidden="true" /> : <Circle size={19} className={cn("mt-px shrink-0", i === current ? "text-brand-500" : "text-ink-300")} aria-hidden="true" />}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[13px] font-medium", c.done ? "text-ink-500" : "text-ink-900")}>
                    {c.title}
                    <span className="sr-only">{c.done ? ", done" : ", to do"}</span>
                  </p>
                  {!c.done && <p className="mt-0.5 text-xs text-ink-500">{c.body}</p>}
                </div>
                {i === current && c.action && (
                  <ButtonLink href={c.action.href} size="sm" icon={GraduationCap}>
                    {c.action.label}
                  </ButtonLink>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader title="Application timeline" />
            <div className="px-5 pt-4 pb-5">
              <Timeline items={TIMELINE} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Document checks" />
            <ul className="mt-2 divide-y divide-line">
              {DOCS.map((d) => (
                <li key={d.label} className="flex items-start gap-3 px-5 py-3">
                  <FileCheck2 size={16} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink-900">{d.label}</p>
                    <p className="text-xs text-ink-500">{d.detail}</p>
                  </div>
                  <Badge size="sm" tone={DOC_META[d.status].tone}>
                    {DOC_META[d.status].label}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-500">
            <Mail size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            If a reviewer needs a correction, the item shows Action required here and you can fix and resubmit it. Questions?{" "}
            <Link href="/seller/support" className="font-medium text-brand-700 hover:underline">
              Contact Seller Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
