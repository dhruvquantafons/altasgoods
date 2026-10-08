/**
 * AltasGoods Rider (Flutter) screen mockups for the Hub Console preview page.
 * Each screen is designed at the native 390 x 780 logical size and scaled by
 * <PhoneFrame> so typography and spacing match the real device.
 */
import type { ReactNode } from "react";
import {
  ArrowLeft,
  BatteryFull,
  Camera,
  Check,
  ChevronRight,
  CircleCheck,
  Headset,
  House,
  IndianRupee,
  ListChecks,
  LocateFixed,
  Navigation,
  Package,
  PhoneCall,
  QrCode,
  ScanLine,
  ShieldCheck,
  Signal,
  Undo2,
  Wallet,
  Wifi,
} from "lucide-react";
import type { Runsheet, RunStop } from "@/lib/mock/ops-extra";
import { cn, formatINR } from "@/lib/utils";

/* ------------------------------ Frame ------------------------------ */

export function PhoneFrame({ children, label, darkStatus }: { children: ReactNode; label: string; darkStatus?: boolean }) {
  return (
    <figure className="flex flex-col items-center">
      <div className="relative [--s:0.8] min-[1400px]:[--s:0.635]" style={{ width: "calc(414px * var(--s))", height: "calc(804px * var(--s))" }} role="img" aria-label={label}>
        <div className="absolute top-0 left-0 origin-top-left" style={{ transform: "scale(var(--s))", width: 414, height: 804 }}>
          <div className="h-full w-full rounded-[58px] bg-ink-950 p-3 shadow-[0_30px_60px_-20px_rgb(16_24_40/0.35)] ring-1 ring-ink-800">
            <div className="relative h-[780px] w-[390px] overflow-hidden rounded-[47px] bg-[#f6f7f9]">
              <StatusBar dark={darkStatus} />
              {children}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-[13px] font-medium text-ink-700">{label}</figcaption>
    </figure>
  );
}

function StatusBar({ dark }: { dark?: boolean }) {
  return (
    <div className={cn("absolute inset-x-0 top-0 z-20 flex h-[50px] items-center justify-between px-8 pt-1 text-[15px] font-semibold", dark ? "text-white" : "text-ink-900")}>
      <span className="tabular-nums">10:30</span>
      <span className="absolute top-[11px] left-1/2 h-[30px] w-[112px] -translate-x-1/2 rounded-full bg-ink-950" aria-hidden="true" />
      <span className="flex items-center gap-1.5" aria-hidden="true">
        <Signal size={16} strokeWidth={2.4} />
        <Wifi size={16} strokeWidth={2.4} />
        <BatteryFull size={22} strokeWidth={1.8} />
      </span>
    </div>
  );
}

function AppBar({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-line bg-white px-4 pt-[58px] pb-3">
      <span className="flex size-10 items-center justify-center rounded-full bg-ink-100 text-ink-700">
        <ArrowLeft size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-[17px] font-semibold text-ink-900">{title}</p>
        {subtitle && <p className="truncate text-[13px] text-ink-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function BottomButton({ children, tone = "brand", sub }: { children: ReactNode; tone?: "brand" | "dark"; sub?: ReactNode }) {
  return (
    <div className={cn("absolute inset-x-0 bottom-0 border-t border-line bg-white/95 px-4 pt-3 backdrop-blur", sub ? "pb-6" : "pb-8")}>
      <div className={cn("flex h-[54px] items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold text-white", tone === "brand" ? "bg-brand-600" : "bg-ink-900")}>{children}</div>
      {sub && <p className="mt-2 text-center text-[14px] font-medium text-ink-600">{sub}</p>}
    </div>
  );
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" | "brand" | "success" | "info" }) {
  const t = {
    neutral: "bg-ink-100 text-ink-700",
    warning: "bg-warning-50 text-warning-700",
    brand: "bg-brand-50 text-brand-700",
    success: "bg-success-50 text-success-700",
    info: "bg-info-50 text-info-700",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold", t)}>{children}</span>;
}

/* ---------------------------- 1. Today ----------------------------- */

export function TodayScreen({ run, associate }: { run: Runsheet; associate: string }) {
  const doneCount = run.delivered + run.failed + run.pickedUp;
  const next = run.sequence.find((s) => s.status === "pending")!;
  const after = run.sequence.filter((s) => s.status === "pending").slice(1, 3);
  const recent = run.sequence.filter((s) => s.status !== "pending").slice(-2).reverse();
  return (
    <div className="h-full">
      <div className="bg-brand-950 px-5 pt-[64px] pb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[14px] text-brand-200">Good morning, {associate.split(" ")[0]}</p>
            <p className="mt-0.5 text-[26px] leading-tight font-semibold">Today&apos;s run</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 font-mono text-[12px] text-brand-100 ring-1 ring-white/15">{run.beat.code}</span>
        </div>
        <div className="mt-5 rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
          <div className="flex items-end justify-between">
            <p className="text-[34px] leading-none font-semibold tabular-nums">
              {doneCount}
              <span className="text-[18px] font-medium text-brand-200"> of {run.stops} stops</span>
            </p>
            <p className="text-[13px] text-brand-200">{run.distanceKm} km route</p>
          </div>
          <div className="mt-3 flex h-2 gap-[2px] overflow-hidden rounded-full bg-white/15">
            <span className="h-full rounded-l-full bg-success-500" style={{ width: `${((run.delivered + run.pickedUp) / run.stops) * 100}%` }} />
            <span className="h-full bg-warning-500" style={{ width: `${(run.failed / run.stops) * 100}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-[12px] text-brand-200">
            <div>
              <p className="text-[17px] font-semibold text-white tabular-nums">{run.deliveries}</p>
              Deliveries
            </div>
            <div>
              <p className="text-[17px] font-semibold text-white tabular-nums">{run.pickups}</p>
              Pickups
            </div>
            <div>
              <p className="text-[17px] font-semibold text-white tabular-nums">{formatINR(run.codToCollect - run.codCollected)}</p>
              COD to collect
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        <p className="mb-2 px-1 text-[12px] font-semibold tracking-[0.06em] text-ink-500 uppercase">Next stop</p>
        <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-[0_6px_18px_-10px_rgb(35_88_224/0.45)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-brand-700">
                Stop {next.seq}, {next.slot}
              </p>
              <p className="mt-0.5 text-[18px] font-semibold text-ink-900">{next.customer}</p>
              <p className="text-[14px] text-ink-600">Tower B, Lakeview Residency</p>
            </div>
            <span className="text-[13px] font-medium text-ink-500">1.2 km</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {next.cod > 0 ? <Pill tone="warning">COD {formatINR(next.cod)}</Pill> : <Pill>Prepaid</Pill>}
            <Pill tone="brand">
              <ShieldCheck size={13} /> Secure Delivery
            </Pill>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <span className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong text-[14px] font-semibold text-ink-800">
              <PhoneCall size={17} /> Call
            </span>
            <span className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 text-[14px] font-semibold text-white">
              <Navigation size={17} /> Navigate
            </span>
          </div>
        </div>

        <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
          {[...after.map((s) => ({ s, done: false })), ...recent.map((s) => ({ s, done: true }))].map(({ s, done }) => (
            <StopRow key={s.seq} s={s} done={done} />
          ))}
        </ul>
      </div>

      <TabBar active="today" />
    </div>
  );
}

function StopRow({ s, done }: { s: RunStop; done: boolean }) {
  return (
    <li className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
          done ? (s.status === "failed" ? "bg-warning-50 text-warning-700" : "bg-success-50 text-success-700") : "bg-ink-100 text-ink-700",
        )}
      >
        {done ? s.status === "failed" ? <Undo2 size={15} /> : <Check size={16} strokeWidth={2.6} /> : s.seq}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[15px] font-medium", done ? "text-ink-500" : "text-ink-900")}>{s.customer}</p>
        <p className="truncate text-[13px] text-ink-500">{done ? (s.status === "failed" ? "Attempt failed, NDR raised" : s.kind === "pickup" ? "Picked up, QC passed" : "Delivered") : `${s.kind === "pickup" ? "Return pickup" : "Delivery"}, ${s.slot}`}</p>
      </div>
      {!done && s.cod > 0 && <span className="text-[14px] font-semibold text-ink-900 tabular-nums">{formatINR(s.cod)}</span>}
      <ChevronRight size={18} className="text-ink-300" />
    </li>
  );
}

function TabBar({ active }: { active: "today" | "stops" | "cash" | "help" }) {
  const tabs = [
    { key: "today", label: "Today", icon: House },
    { key: "stops", label: "Stops", icon: ListChecks },
    { key: "cash", label: "Cash", icon: Wallet },
    { key: "help", label: "Help", icon: Headset },
  ] as const;
  return (
    <div className="absolute inset-x-0 bottom-0 grid grid-cols-4 border-t border-line bg-white/95 px-2 pt-2 pb-7 backdrop-blur">
      {tabs.map((t) => (
        <span key={t.key} className={cn("flex flex-col items-center gap-1 text-[11px] font-semibold", t.key === active ? "text-brand-700" : "text-ink-400")}>
          <t.icon size={22} strokeWidth={t.key === active ? 2.2 : 1.8} />
          {t.label}
        </span>
      ))}
    </div>
  );
}

/* --------------------------- 2. Delivery --------------------------- */

export function DeliveryScreen({ stop, total }: { stop: RunStop; total: number }) {
  const cod = stop.cod || 1499;
  return (
    <div className="h-full">
      <AppBar title={`Stop ${stop.seq} of ${total}`} subtitle={<span className="font-mono">{stop.awb}</span>} />
      <div className="flex flex-col gap-2.5 px-4 pt-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[18px] font-semibold text-ink-900">{stop.customer}</p>
              <p className="mt-0.5 text-[14px] leading-snug text-ink-600">Flat 11XX, Tower B, Lakeview Residency, Whitefield 560066</p>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-700">
              <PhoneCall size={19} />
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-success-50 px-3 py-2 text-[13px] font-medium text-success-700">
            <ScanLine size={16} /> Package and tamper bag TB-77310 scanned
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={19} className="text-brand-600" />
            <p className="text-[16px] font-semibold text-ink-900">Secure Delivery OTP</p>
          </div>
          <p className="mt-1 text-[13px] text-ink-500">Ask the customer for the 4 digit code sent to +91 98XXXXXX21</p>
          <div className="mt-3 grid grid-cols-4 gap-2.5">
            {["4", "8", "2", ""].map((d, i) => (
              <span
                key={i}
                className={cn(
                  "flex h-[52px] items-center justify-center rounded-xl border text-[24px] font-semibold text-ink-900 tabular-nums",
                  d ? "border-line-strong bg-white" : "border-brand-500 bg-brand-50/40 ring-4 ring-brand-100",
                )}
              >
                {d || <span className="h-7 w-0.5 rounded-full bg-brand-600" />}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-ink-500">Resend in 0:42. Offline? Use a fallback code.</p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[13px] font-medium text-ink-500">Collect</p>
              <p className="text-[28px] leading-tight font-semibold text-ink-900 tabular-nums">{formatINR(cod)}</p>
            </div>
            <div className="grid grid-cols-2 rounded-xl bg-ink-100 p-1 text-[14px] font-semibold">
              <span className="flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-ink-900 shadow-xs">
                <IndianRupee size={15} /> Cash
              </span>
              <span className="flex h-9 items-center gap-1.5 px-3 text-ink-500">
                <QrCode size={15} /> UPI
              </span>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-[14px]">
            <span className="text-ink-600">Received {formatINR(Math.ceil(cod / 500) * 500)}</span>
            <span className="font-semibold text-ink-900">Return {formatINR(Math.ceil(cod / 500) * 500 - cod)}</span>
          </div>
        </div>
      </div>
      <BottomButton sub="Delivery failed">
        <CircleCheck size={20} /> Mark delivered
      </BottomButton>
    </div>
  );
}

/* ------------------------- 3. Failed attempt ------------------------ */

export function FailedScreen({ stop, reasons }: { stop: RunStop; reasons: string[] }) {
  return (
    <div className="h-full">
      <AppBar title="Delivery attempt failed" subtitle={<span className="font-mono">{stop.awb}, attempt 1 of 3</span>} />
      <div className="px-4 pt-3">
        <p className="mb-2 px-1 text-[12px] font-semibold tracking-[0.06em] text-ink-500 uppercase">Reason</p>
        <ul className="overflow-hidden rounded-2xl border border-line bg-white">
          {reasons.map((r, i) => (
            <li key={r} className={cn("flex items-center gap-3 border-b border-line px-4 py-[9px] text-[15px] last:border-0", i === 0 ? "bg-brand-50/60 font-semibold text-ink-900" : "text-ink-700")}>
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", i === 0 ? "border-brand-600" : "border-ink-300")}>{i === 0 && <span className="size-2.5 rounded-full bg-brand-600" />}</span>
              {r}
            </li>
          ))}
        </ul>

        <p className="mt-3 mb-2 px-1 text-[12px] font-semibold tracking-[0.06em] text-ink-500 uppercase">Evidence</p>
        <div className="grid grid-cols-[96px_1fr] gap-3 rounded-2xl border border-line bg-white p-3">
          <div className="relative flex h-[96px] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-ink-200 to-ink-300 text-ink-600">
            <Camera size={24} />
            <span className="absolute right-1.5 bottom-1.5 flex size-5 items-center justify-center rounded-full bg-success-600 text-white">
              <Check size={12} strokeWidth={3} />
            </span>
          </div>
          <ul className="flex flex-col justify-center gap-2 text-[13px]">
            <li className="flex items-center gap-2 text-ink-800">
              <Camera size={15} className="text-success-600" /> Doorstep photo added
            </li>
            <li className="flex items-center gap-2 text-ink-800">
              <LocateFixed size={15} className="text-success-600" /> 42 m from the address
            </li>
            <li className="flex items-center gap-2 text-ink-800">
              <PhoneCall size={15} className="text-success-600" /> 2 calls, 10:21 and 10:24
            </li>
          </ul>
        </div>
      </div>
      <BottomButton tone="dark">Submit failed attempt</BottomButton>
    </div>
  );
}

/* --------------------------- 4. Cash summary ------------------------ */

export function CashScreen({ cash, upi, codShipments, returnsToHub }: { cash: number; upi: number; codShipments: number; returnsToHub: string[] }) {
  // denomination breakdown that adds up exactly to the cash figure
  const notes = [500, 200, 100, 50, 20, 10, 5, 2, 1];
  let left = cash;
  const counts = notes.map((n) => {
    const c = Math.floor(left / n);
    left -= c * n;
    return { n, c };
  });
  return (
    <div className="h-full">
      <AppBar title="End of shift" subtitle="Cash summary, Thu, 1 Oct" />
      <div className="flex flex-col gap-2.5 px-4 pt-3">
        <div className="rounded-2xl bg-ink-900 p-4 text-white">
          <p className="text-[13px] text-ink-300">Cash to deposit at hub</p>
          <p className="mt-1 text-[32px] leading-none font-semibold tabular-nums">{formatINR(cash)}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-2.5 text-[13px]">
            <div>
              <p className="text-ink-400">COD shipments</p>
              <p className="mt-0.5 font-semibold tabular-nums">{codShipments}</p>
            </div>
            <div>
              <p className="text-ink-400">Paid by UPI QR</p>
              <p className="mt-0.5 font-semibold tabular-nums">{formatINR(upi)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <p className="text-[15px] font-semibold text-ink-900">Count your cash</p>
          <ul className="mt-2 divide-y divide-line">
            {counts
              .filter((x) => x.c > 0)
              .map(({ n, c }) => (
                <li key={n} className="flex items-center justify-between py-1.5 text-[14px]">
                  <span className="text-ink-600">{n >= 10 ? `₹${n} notes` : `₹${n} coins`}</span>
                  <span className="flex items-center gap-3">
                    <span className="flex h-7 w-11 items-center justify-center rounded-lg border border-line-strong font-semibold text-ink-900 tabular-nums">{c}</span>
                    <span className="w-16 text-right font-medium text-ink-900 tabular-nums">{formatINR(n * c)}</span>
                  </span>
                </li>
              ))}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t border-ink-200 pt-2.5 text-[15px] font-semibold">
            <span className="text-ink-900">Total counted</span>
            <span className="flex items-center gap-1.5 text-success-700">
              <CircleCheck size={16} /> {formatINR(cash)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
            <Package size={17} className="text-ink-500" /> Hand back at hub
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 font-mono text-[13px] text-ink-700">
            {returnsToHub.slice(0, 2).map((a) => (
              <li key={a} className="flex items-center justify-between">
                {a}
                <span className="font-sans text-[12px] text-warning-700">NDR</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <BottomButton sub="The hub cashier confirms on Hub Console">Declare cash</BottomButton>
    </div>
  );
}

/* ---------------------------- Notes card --------------------------- */

export function FeatureNote({ icon: Icon, title, children }: { icon: typeof Package; title: string; children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink-900">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{children}</p>
    </div>
  );
}
