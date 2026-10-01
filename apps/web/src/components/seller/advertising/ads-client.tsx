"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Rocket, X } from "lucide-react";
import { AreaChart } from "@/components/charts/area-chart";
import type { ValueFormat } from "@/components/charts/format";
import { ProductImage } from "@/components/commerce/product-image";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal, Switch, useToast } from "@/components/ui/interactive";
import { Stepper } from "@/components/ui/misc";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CAMPAIGN_STATUS, type CampaignStatus } from "@/lib/status";
import { cn, formatCompact, formatINR, formatNumber } from "@/lib/utils";
import { InlineNumber } from "../catalog/listings-table";

/* ------------------------------ Metric chart ------------------------------ */

const METRICS: { key: string; label: string; format: ValueFormat }[] = [
  { key: "sales", label: "Ad sales", format: "inr" },
  { key: "spend", label: "Spend", format: "inr" },
  { key: "clicks", label: "Clicks", format: "number" },
  { key: "acos", label: "ACoS", format: "percent" },
];

/** One metric at a time over completed days, so there is one series and one axis. */
export function AdsMetricChart({ data }: { data: { label: string; sales: number; spend: number; clicks: number; acos: number }[] }) {
  const [metric, setMetric] = useState("sales");
  const m = METRICS.find((x) => x.key === metric)!;
  return (
    <div>
      <div role="tablist" aria-label="Metric" className="mb-4 inline-flex flex-wrap gap-1 rounded-xl bg-ink-100 p-1">
        {METRICS.map((x) => (
          <button
            key={x.key}
            role="tab"
            type="button"
            aria-selected={metric === x.key}
            onClick={() => setMetric(x.key)}
            className={cn("h-8 rounded-lg px-3 text-[13px] font-medium transition-colors", metric === x.key ? "bg-white text-ink-900 shadow-xs" : "text-ink-500 hover:text-ink-800")}
          >
            {x.label}
          </button>
        ))}
      </div>
      <AreaChart data={data} series={[{ key: metric, label: m.label }]} format={m.format} height={250} ariaLabel={`${m.label} per day, last 14 completed days`} />
    </div>
  );
}

/* ----------------------------- Campaigns table ---------------------------- */

export interface CampaignRow {
  id: string;
  name: string;
  typeLabel: string;
  targeting: string;
  status: CampaignStatus;
  dailyBudget: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  orders: number;
  sales: number;
  acos: number;
  roas: number;
}

export function CampaignsTable({ rows }: { rows: CampaignRow[] }) {
  const [status, setStatus] = useState<Record<string, CampaignStatus>>({});
  const [budget, setBudget] = useState<Record<string, number>>({});
  const toast = useToast();
  return (
    <>
      <TableContainer>
        <Table className="min-w-[1040px]">
          <THead className="border-t-0">
            <TR className="hover:bg-transparent">
              <TH className="w-14">On</TH>
              <TH>Campaign</TH>
              <TH>Status</TH>
              <TH align="right">Daily budget</TH>
              <TH align="right">Spend</TH>
              <TH align="right">Clicks</TH>
              <TH align="right">Orders</TH>
              <TH align="right">Ad sales</TH>
              <TH align="right">ACoS</TH>
              <TH align="right">ROAS</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => {
              const st = status[r.id] ?? r.status;
              const toggleable = st === "active" || st === "paused";
              const live = r.impressions > 0;
              return (
                <TR key={r.id}>
                  <TD className="w-14">
                    {toggleable ? (
                      <Switch
                        checked={st === "active"}
                        onChange={(v) => {
                          setStatus((p) => ({ ...p, [r.id]: v ? "active" : "paused" }));
                          toast.show(v ? `${r.name} is running again.` : `${r.name} paused. Ads stop showing within minutes.`);
                        }}
                        label={<span className="sr-only">Run {r.name}</span>}
                      />
                    ) : (
                      <span className="text-xs text-ink-400">Off</span>
                    )}
                  </TD>
                  <TD>
                    <p className="text-[13px] font-medium text-ink-900">{r.name}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {r.typeLabel}, {r.targeting.toLowerCase()} targeting
                    </p>
                  </TD>
                  <TD>
                    <StatusBadge meta={CAMPAIGN_STATUS[st]} size="sm" />
                  </TD>
                  <TD align="right">
                    <InlineNumber
                      label={`daily budget for ${r.name}`}
                      value={budget[r.id] ?? r.dailyBudget}
                      prefix="₹"
                      disabled={st === "ended"}
                      validate={(v) => (v < 100 ? "Minimum ₹100 a day" : null)}
                      onSave={(v) => {
                        setBudget((p) => ({ ...p, [r.id]: v }));
                        toast.show(`Daily budget for ${r.name} set to ${formatINR(v)}.`);
                      }}
                      display={<span className="text-[13px] text-ink-900">{formatINR(budget[r.id] ?? r.dailyBudget)}</span>}
                    />
                  </TD>
                  <TD align="right">
                    {live ? (
                      <>
                        <p>{formatINR(r.spend)}</p>
                        <p className="mt-0.5 text-xs text-ink-500">CPC {formatINR(r.cpc, { paise: true })}</p>
                      </>
                    ) : (
                      <span className="text-ink-400">None</span>
                    )}
                  </TD>
                  <TD align="right">
                    {live && (
                      <>
                        <p>{formatNumber(r.clicks)}</p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          CTR {r.ctr.toFixed(2)}% of {formatCompact(r.impressions)}
                        </p>
                      </>
                    )}
                  </TD>
                  <TD align="right">{live ? formatNumber(r.orders) : ""}</TD>
                  <TD align="right" className="font-medium text-ink-900">
                    {live ? formatCompact(r.sales, true) : ""}
                  </TD>
                  <TD align="right" className={cn(live && r.acos > 25 ? "text-warning-700" : undefined)}>
                    {live ? `${r.acos.toFixed(1)}%` : ""}
                  </TD>
                  <TD align="right">{live ? `${r.roas.toFixed(1)}x` : ""}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableContainer>
      {toast.node}
    </>
  );
}

/* ----------------------------- Keywords table ----------------------------- */

export interface KeywordRow {
  id: string;
  campaign: string;
  keyword: string;
  match: string;
  bid: number;
  suggested: [number, number];
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  status: "active" | "paused";
}

export function KeywordsTable({ rows }: { rows: KeywordRow[] }) {
  const [bids, setBids] = useState<Record<string, number>>({});
  const toast = useToast();
  return (
    <>
      <TableContainer>
        <Table className="min-w-[900px]">
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Keyword</TH>
              <TH>Match</TH>
              <TH align="right">Bid</TH>
              <TH align="right">Suggested</TH>
              <TH align="right">Clicks</TH>
              <TH align="right">Spend</TH>
              <TH align="right">Ad sales</TH>
              <TH align="right">ACoS</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((k) => {
              const acos = k.sales ? (k.spend / k.sales) * 100 : 0;
              const bid = bids[k.id] ?? k.bid;
              return (
                <TR key={k.id}>
                  <TD>
                    <p className={cn("text-[13px] font-medium", k.status === "paused" ? "text-ink-500" : "text-ink-900")}>{k.keyword}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {k.campaign}
                      {k.status === "paused" ? ", paused" : ""}
                    </p>
                  </TD>
                  <TD className="text-[13px]">{k.match}</TD>
                  <TD align="right">
                    <InlineNumber
                      label={`bid for ${k.keyword}`}
                      value={bid}
                      prefix="₹"
                      validate={(v) => (v < 1 ? "Minimum bid ₹1" : v > 200 ? "Maximum bid ₹200" : null)}
                      onSave={(v) => {
                        setBids((p) => ({ ...p, [k.id]: v }));
                        toast.show(`Bid for "${k.keyword}" set to ${formatINR(v)}.`);
                      }}
                      display={<span className="text-[13px] font-medium text-ink-900">{formatINR(bid)}</span>}
                    />
                  </TD>
                  <TD align="right" className="text-[13px] text-ink-500">
                    {formatINR(k.suggested[0])} to {formatINR(k.suggested[1])}
                  </TD>
                  <TD align="right">{formatNumber(k.clicks)}</TD>
                  <TD align="right">{formatINR(k.spend)}</TD>
                  <TD align="right">{formatCompact(k.sales, true)}</TD>
                  <TD align="right" className={acos > 25 ? "text-warning-700" : undefined}>
                    {acos.toFixed(1)}%
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableContainer>
      {toast.node}
    </>
  );
}

/* ----------------------------- Create campaign ---------------------------- */

const STEPS = [{ label: "Type" }, { label: "Products" }, { label: "Targeting" }, { label: "Budget" }, { label: "Review" }];

const TYPES = [
  { key: "sp", label: "Sponsored Products", hint: "Your products in search results and on product pages. Pay per click.", locked: false },
  { key: "sb", label: "Sponsored Brands", hint: "A headline banner with your logo and three products. Needs BluBuy Brand Registry.", locked: true },
  { key: "sd", label: "Sponsored Display", hint: "Reach shoppers who viewed similar products, on and off BluBuy.", locked: false },
];

export function CreateCampaign({ products }: { products: { id: string; title: string; image: string; price: number }[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [type, setType] = useState("sp");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [targeting, setTargeting] = useState<"auto" | "manual">("manual");
  const [keywords, setKeywords] = useState<{ text: string; match: string; bid: number }[]>([
    { text: "wireless earbuds", match: "Broad", bid: 9 },
    { text: "anc earbuds under 5000", match: "Phrase", bid: 11 },
  ]);
  const [kw, setKw] = useState("");
  const [kwNote, setKwNote] = useState("");
  const [budget, setBudget] = useState(1500);
  const [name, setName] = useState("Diwali: Audio");
  const toast = useToast();

  const valid = [Boolean(type), picked.size > 0, targeting === "auto" || keywords.length > 0, budget >= 100 && name.trim().length > 2, true][step];

  function close() {
    setOpen(false);
    setStep(0);
  }

  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>
        Create campaign
      </Button>
      <Modal
        open={open}
        onClose={close}
        side="right"
        size="lg"
        title="Create a campaign"
        description="BluBuy Ads run on a second-price cost-per-click auction. You only pay when a shopper clicks."
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(step - 1)}>
                Back
              </Button>
            ) : (
              <span />
            )}
            {step < 4 ? (
              <Button iconRight={ArrowRight} disabled={!valid} onClick={() => setStep(step + 1)}>
                Continue
              </Button>
            ) : (
              <Button
                icon={Rocket}
                onClick={() => {
                  close();
                  toast.show(`${name} launched with a ${formatINR(budget)} daily budget. First results in about an hour.`);
                }}
              >
                Launch campaign
              </Button>
            )}
          </div>
        }
      >
        <Stepper steps={STEPS} current={step} className="mb-6" />

        {step === 0 && (
          <fieldset className="flex flex-col gap-2.5">
            <legend className="sr-only">Campaign type</legend>
            {TYPES.map((t) => (
              <label key={t.key} className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", t.locked ? "cursor-not-allowed opacity-60" : "cursor-pointer", type === t.key ? "border-brand-300 bg-brand-50/50" : "border-line hover:bg-ink-50")}>
                <input type="radio" name="ad-type" disabled={t.locked} checked={type === t.key} onChange={() => setType(t.key)} className="mt-1 accent-brand-600" />
                <span>
                  <span className="block text-sm font-medium text-ink-900">{t.label}</span>
                  <span className="block text-xs text-ink-500">{t.hint}</span>
                  {t.locked && <span className="mt-1 block text-xs font-medium text-warning-700">Enrol in Brand Registry to unlock</span>}
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {step === 1 && (
          <div>
            <p className="mb-3 text-[13px] text-ink-600">Pick products with stock and a featured offer you win; ads for offers you do not win rarely convert.</p>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {products.map((p) => {
                const on = picked.has(p.id);
                return (
                  <li key={p.id}>
                    <label className={cn("flex cursor-pointer items-center gap-3 px-3.5 py-2.5", on && "bg-brand-50/40")}>
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-600"
                        checked={on}
                        onChange={() =>
                          setPicked((s) => {
                            const n = new Set(s);
                            if (n.has(p.id)) n.delete(p.id);
                            else n.add(p.id);
                            return n;
                          })
                        }
                      />
                      <ProductImage src={p.image} alt="" size={36} rounded="md" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-900">{p.title}</span>
                      <span className="shrink-0 text-[13px] text-ink-600 tabular-nums">{formatINR(p.price)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {(["auto", "manual"] as const).map((t) => (
                <label key={t} className={cn("cursor-pointer rounded-xl border px-4 py-3", targeting === t ? "border-brand-300 bg-brand-50/50" : "border-line hover:bg-ink-50")}>
                  <input type="radio" className="sr-only" name="targeting" checked={targeting === t} onChange={() => setTargeting(t)} />
                  <span className="block text-sm font-medium text-ink-900">{t === "auto" ? "Automatic" : "Manual keywords"}</span>
                  <span className="block text-xs text-ink-500">{t === "auto" ? "BluBuy matches searches and products to your listings" : "You choose keywords, match types and bids"}</span>
                </label>
              ))}
            </div>
            {targeting === "manual" && (
              <>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = kw.trim().toLowerCase().replace(/\s+/g, " ");
                    if (!text) return setKwNote("Type a keyword first");
                    // one row per keyword: a repeat would clash with the existing row (change its match type instead)
                    if (keywords.some((k) => k.text === text)) return setKwNote(`"${text}" is already in the list. Change its match type or bid instead.`);
                    setKeywords([...keywords, { text, match: "Phrase", bid: 8 }]);
                    setKw("");
                    setKwNote("");
                  }}
                >
                  <Input
                    value={kw}
                    onChange={(e) => {
                      setKw(e.target.value);
                      if (kwNote) setKwNote("");
                    }}
                    placeholder="Add a keyword, for example noise cancelling earbuds"
                    aria-label="Add keyword"
                    className="flex-1"
                  />
                  <Button type="submit" variant="secondary" icon={Plus}>
                    Add
                  </Button>
                </form>
                {kwNote && (
                  <p className="-mt-2 text-xs text-warning-700" role="status">
                    {kwNote}
                  </p>
                )}
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {keywords.map((k, i) => (
                    <li key={k.text} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                      <span className="min-w-0 flex-1 text-[13px] font-medium text-ink-900">{k.text}</span>
                      <Select selectSize="sm" value={k.match} aria-label={`Match type for ${k.text}`} onChange={(e) => setKeywords(keywords.map((x, j) => (j === i ? { ...x, match: e.target.value } : x)))} className="w-28">
                        <option>Broad</option>
                        <option>Phrase</option>
                        <option>Exact</option>
                      </Select>
                      <Input inputSize="sm" inputMode="numeric" value={k.bid} aria-label={`Bid for ${k.text}`} onChange={(e) => setKeywords(keywords.map((x, j) => (j === i ? { ...x, bid: Number(e.target.value.replace(/\D/g, "")) } : x)))} className="w-20" />
                      <span className="w-24 text-xs text-ink-500">Suggested ₹7 to ₹12</span>
                      <button type="button" onClick={() => setKeywords(keywords.filter((_, j) => j !== i))} className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label={`Remove ${k.text}`}>
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Campaign name" htmlFor="cc-name" className="sm:col-span-2">
              <Input id="cc-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Daily budget" htmlFor="cc-budget" hint="Minimum ₹100. Spend can reach 120% of budget on a busy day; the monthly total stays within budget x days." error={budget < 100 ? "Minimum ₹100 a day" : undefined}>
              <Input id="cc-budget" inputMode="numeric" value={budget} onChange={(e) => setBudget(Number(e.target.value.replace(/\D/g, "")))} suffix="INR" />
            </Field>
            <Field label="Schedule" htmlFor="cc-start">
              <Select id="cc-start" defaultValue="now">
                <option value="now">Start today, no end date</option>
                <option value="diwali">28 Oct to 9 Nov (Diwali Dhamaka)</option>
              </Select>
            </Field>
            <p className="rounded-xl bg-ink-50 px-4 py-3 text-[13px] text-ink-600 sm:col-span-2">
              Charged from your ad wallet (balance ₹48,250, auto-recharge on). Invalid clicks are filtered and credited daily.
            </p>
          </div>
        )}

        {step === 4 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line p-4 text-[13px]">
            <dt className="text-ink-500">Name</dt>
            <dd className="text-right font-medium text-ink-900">{name}</dd>
            <dt className="text-ink-500">Type</dt>
            <dd className="text-right text-ink-900">{TYPES.find((t) => t.key === type)?.label}</dd>
            <dt className="text-ink-500">Products</dt>
            <dd className="text-right text-ink-900">{picked.size}</dd>
            <dt className="text-ink-500">Targeting</dt>
            <dd className="text-right text-ink-900">{targeting === "auto" ? "Automatic" : `${keywords.length} keywords`}</dd>
            <dt className="text-ink-500">Daily budget</dt>
            <dd className="text-right text-ink-900 tabular-nums">{formatINR(budget)}</dd>
          </dl>
        )}
      </Modal>
      {toast.node}
    </>
  );
}
