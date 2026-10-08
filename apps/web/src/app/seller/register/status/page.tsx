import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CircleAlert, CircleCheck, CircleX, Clock3, FileCheck2, Mail, PartyPopper, Store } from "lucide-react";
import { enterSellerHub } from "@/app/actions/onboarding";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Timeline, type TimelineItem } from "@/components/ui/misc";
import { api, currentUser } from "@/lib/api/server";
import type { ApplicationStatus, SellerApplication } from "@/lib/api/types";
import { APPLICATION_STATUS, stepForFlag, STEPS } from "@/lib/onboarding";
import type { Tone } from "@/lib/status";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Application status" };

const EVENT_TITLE: Record<ApplicationStatus, string> = {
  KYC_IN_PROGRESS: "Application started",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  ACTION_REQUIRED: "Changes requested",
  APPROVED: "Approved",
  REJECTED: "Declined",
};

const HEAD: Record<ApplicationStatus, { icon: typeof Clock3; tone: string; title: (a: SellerApplication) => string }> = {
  KYC_IN_PROGRESS: { icon: Clock3, tone: "bg-ink-100 text-ink-600", title: () => "Your application is in progress" },
  SUBMITTED: { icon: Clock3, tone: "bg-info-50 text-info-600", title: () => "Your application is under review" },
  UNDER_REVIEW: { icon: Clock3, tone: "bg-info-50 text-info-600", title: () => "Your application is under review" },
  ACTION_REQUIRED: { icon: CircleAlert, tone: "bg-warning-50 text-warning-600", title: () => "We need a few changes" },
  APPROVED: { icon: PartyPopper, tone: "bg-success-50 text-success-600", title: (a) => `${a.store.name ?? "Your store"} is approved` },
  REJECTED: { icon: CircleX, tone: "bg-danger-50 text-danger-600", title: () => "Your application was declined" },
};

function checkRows(app: SellerApplication): { label: string; detail: string; tone: Tone; badge: string }[] {
  const out: { label: string; detail: string; tone: Tone; badge: string }[] = [];
  const g = app.checks.gst;
  if (g) out.push({ label: `GSTIN ${g.gstin}`, detail: g.portalStatus === "ACTIVE" ? "Active on the GST portal, legal name fetched" : `${g.portalStatus.toLowerCase()} on the GST portal`, tone: g.result === "VERIFIED" ? "success" : "danger", badge: g.result === "VERIFIED" ? "Auto verified" : "Failed" });
  const p = app.checks.pan;
  if (p) out.push({ label: `PAN ${p.pan}`, detail: `Name on PAN matches ${p.nameMatchScore}%`, tone: p.result === "VERIFIED" ? "success" : p.result === "PARTIAL" ? "warning" : "danger", badge: p.result === "VERIFIED" ? "Auto verified" : p.result === "PARTIAL" ? "In review" : "Failed" });
  const b = app.checks.bank;
  if (b) out.push({ label: `Bank account ending ${b.accountLast4}`, detail: `₹1 penny drop, ${b.nameMatchScore}% name match`, tone: b.result === "VERIFIED" ? "success" : "warning", badge: b.result === "VERIFIED" ? "Verified" : "In review" });
  for (const d of app.documents) {
    out.push({
      label: d.label,
      detail: d.status === "REJECTED" ? (d.note ?? "Upload a new file") : d.fileName,
      tone: d.status === "VERIFIED" ? "success" : d.status === "REJECTED" ? "danger" : "info",
      badge: d.status === "VERIFIED" ? "Verified" : d.status === "REJECTED" ? "Action required" : app.status === "KYC_IN_PROGRESS" ? "Uploaded" : "In review",
    });
  }
  return out;
}

export default async function StatusPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/seller/register/status&as=seller");
  const r = await (await api()).GET("/v1/me/seller-application");
  const app = r.data;
  if (!app) redirect("/seller/register");
  if (app.status === "KYC_IN_PROGRESS") redirect("/seller/register");

  const head = HEAD[app.status];
  const Icon = head.icon;
  const first = (user.name ?? "").split(" ")[0] || "there";
  const timeline: TimelineItem[] = app.events.map((e, i) => ({
    title: EVENT_TITLE[e.toStatus],
    time: formatDateTime(e.at),
    description: e.note && e.note !== EVENT_TITLE[e.toStatus] ? e.note : undefined,
    tone: i === app.events.length - 1 ? (APPLICATION_STATUS[e.toStatus].tone === "neutral" ? undefined : APPLICATION_STATUS[e.toStatus].tone) : undefined,
  }));
  if (app.status === "SUBMITTED" || app.status === "UNDER_REVIEW") {
    timeline.push({ title: "Approved", description: "You can create listings", done: false });
    timeline.push({ title: "Active", description: "First listing approved and pickup address verified", done: false });
  }
  const checks = checkRows(app);

  const body: Record<ApplicationStatus, React.ReactNode> = {
    KYC_IN_PROGRESS: null,
    SUBMITTED: null,
    UNDER_REVIEW: (
      <>
        Thanks, {first}. {app.business.legalName} is in the verification queue as application {app.id}. We aim to decide by {app.slaDueAt ? formatDateTime(app.slaDueAt) : "within 72 hours"} and will email {app.account.email} as soon as there is news.
      </>
    ),
    ACTION_REQUIRED: <>Our verification team reviewed application {app.id} and needs a few corrections before it can be approved. Fix the items below and resubmit within 30 days.</>,
    APPROVED: <>Congratulations, {first}. Your seller account is ready. Open Seller Hub to create your first listing; your store goes live once it passes a quality check and AltasGoods Logistics verifies your pickup address.</>,
    REJECTED: (
      <>
        Reason: {app.rejectionReason}. If you think this is a mistake, contact Seller Support. A declined application can be reopened 30 days after the decision.
      </>
    ),
  };
  body.SUBMITTED = body.UNDER_REVIEW;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
        <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl", head.tone)}>
          <Icon size={26} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold text-ink-900">{head.title(app)}</h1>
            <Badge tone={APPLICATION_STATUS[app.status].tone} dot>
              {APPLICATION_STATUS[app.status].label}
            </Badge>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-600">{body[app.status]}</p>
        </div>
        {app.status === "APPROVED" ? (
          <form action={enterSellerHub} className="self-start sm:self-center">
            <Button type="submit" iconRight={ArrowRight}>
              Open Seller Hub
            </Button>
          </form>
        ) : app.status === "ACTION_REQUIRED" ? (
          <ButtonLink href="/seller/register" iconRight={ArrowRight} className="self-start sm:self-center">
            Fix and resubmit
          </ButtonLink>
        ) : (
          <ButtonLink href="/" variant="secondary" className="self-start sm:self-center">
            Back to AltasGoods
          </ButtonLink>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
          {app.status === "ACTION_REQUIRED" && (
            <Card>
              <CardHeader title="What to fix" description="From your reviewer" />
              <div className="px-5 pt-3 pb-5">
                {app.reviewerMessage && <p className="rounded-xl bg-warning-50 px-4 py-3 text-[13px] text-ink-800">{app.reviewerMessage}</p>}
                <ul className="mt-3 divide-y divide-line">
                  {app.flaggedItems.map((f) => (
                    <li key={f.key} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="flex items-center gap-2 text-[13px] font-medium text-ink-900">
                        <CircleAlert size={15} className="text-warning-600" aria-hidden="true" />
                        {f.label}
                      </span>
                      <Link href="/seller/register" className="text-xs font-medium text-brand-700 hover:underline">
                        Fix in step {stepForFlag(f.key) + 1}, {STEPS[stepForFlag(f.key)]!.title.toLowerCase()}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}
          {app.status === "APPROVED" && (
            <Card>
              <CardHeader title="Your first week" description="What happens next" />
              <ul className="mt-2 divide-y divide-line border-t border-line">
                {[
                  { done: true, title: "Business, PAN, bank and documents verified", body: "" },
                  { done: false, title: "Create your first listing", body: "Find your product in the catalog or create a new one. It goes live after a quality check." },
                  { done: false, title: "Book a pickup test", body: "AltasGoods Logistics visits your pickup address once to verify it." },
                  { done: false, title: "Set up your store page", body: "Logo, banner and description customers see." },
                ].map((c) => (
                  <li key={c.title} className="flex items-start gap-3 px-5 py-3.5">
                    {c.done ? <CircleCheck size={19} className="mt-px shrink-0 text-success-600" aria-hidden="true" /> : <Store size={18} className="mt-px shrink-0 text-ink-400" aria-hidden="true" />}
                    <div>
                      <p className={cn("text-[13px] font-medium", c.done ? "text-ink-500" : "text-ink-900")}>{c.title}</p>
                      {c.body && <p className="mt-0.5 text-xs text-ink-500">{c.body}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader title="Verification checks" description={app.status === "APPROVED" ? "Everything we verified" : "Automatic checks run on submission; documents are checked by a verifier"} />
            <ul className="mt-2 divide-y divide-line">
              {checks.map((d) => (
                <li key={d.label} className="flex items-start gap-3 px-5 py-3">
                  <FileCheck2 size={16} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink-900">{d.label}</p>
                    <p className="truncate text-xs text-ink-500">{d.detail}</p>
                  </div>
                  <Badge size="sm" tone={d.tone}>
                    {d.badge}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader title="Application timeline" description={`Application ${app.id}`} />
            <div className="px-5 pt-4 pb-5">
              <Timeline items={timeline} />
            </div>
          </Card>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-500">
            <Mail size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              We email {app.account.email} at every step. Questions?{" "}
              <a href="tel:18004192600" className="font-medium text-brand-700 hover:underline">
                Call Seller Support on 1800 419 2600
              </a>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
