"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Modal, Switch, useToast } from "@/components/ui/interactive";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatINR, timeAgo } from "@/lib/utils";
import { InlineNumber } from "../catalog/listings-table";

export interface PriceRow {
  id: string;
  title: string;
  image: string;
  sku: string;
  price: number;
  mrp: number;
  featured: "won" | "lost" | "ineligible";
  featuredPct: number;
  featuredPrice: number;
  lowestPrice?: number;
  lowestSeller?: string;
  /** settlement per unit at the current price, from the rate card */
  netPerUnit: number;
  /** settlement as a share of price, used to preview the net after an edit */
  netRatio: number;
  rule?: string;
}

/** Price manager table with inline price edits and live net preview. */
export function PriceTable({ rows }: { rows: PriceRow[] }) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const toast = useToast();
  return (
    <>
      <TableContainer>
        <Table className="min-w-[1060px]">
          <THead className="border-t-0">
            <TR className="hover:bg-transparent">
              <TH>Product</TH>
              <TH align="right">Your price</TH>
              <TH align="right">Featured offer</TH>
              <TH align="right">Lowest other offer</TH>
              <TH align="right">M.R.P.</TH>
              <TH>Featured offer status</TH>
              <TH align="right">You receive</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => {
              const price = prices[r.id] ?? r.price;
              const gap = r.featured === "lost" ? ((price - r.featuredPrice) / r.featuredPrice) * 100 : 0;
              return (
                <TR key={r.id}>
                  <TD>
                    <div className="flex max-w-[17rem] items-center gap-3">
                      <ProductImage src={r.image} alt="" size={40} rounded="md" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink-900">{r.title}</p>
                        <p className="mt-0.5 truncate text-xs text-ink-500">
                          <span className="font-mono">{r.sku}</span>
                          {r.rule ? `, rule: ${r.rule}` : ""}
                        </p>
                      </div>
                    </div>
                  </TD>
                  <TD align="right">
                    <InlineNumber
                      label={`price for ${r.title}`}
                      value={price}
                      prefix="₹"
                      validate={(v) => (v <= 0 ? "Price must be above zero" : v > r.mrp ? `At or below M.R.P. ${formatINR(r.mrp)}` : null)}
                      onSave={(v) => {
                        setPrices((p) => ({ ...p, [r.id]: v }));
                        const over = r.featured !== "ineligible" && v > r.featuredPrice * 1.05;
                        toast.show(over ? `Saved at ${formatINR(v)}. That is more than 5% above the featured offer, so it is unlikely to win.` : `Saved at ${formatINR(v)}. Live within 15 minutes.`);
                      }}
                      display={<span className="text-[13px] font-semibold text-ink-900">{formatINR(price)}</span>}
                    />
                  </TD>
                  <TD align="right">{formatINR(r.featured === "won" ? price : r.featuredPrice)}</TD>
                  <TD align="right">
                    {r.lowestPrice ? (
                      <>
                        <p>{formatINR(r.lowestPrice)}</p>
                        <p className="mt-0.5 text-xs text-ink-500">{r.lowestSeller}</p>
                      </>
                    ) : (
                      <span className="text-ink-400">Only you</span>
                    )}
                  </TD>
                  <TD align="right" className="text-ink-500">
                    {formatINR(r.mrp)}
                  </TD>
                  <TD>
                    {r.featured === "won" ? (
                      <Badge tone="success" size="sm">
                        Won, {r.featuredPct}% of views
                      </Badge>
                    ) : r.featured === "lost" ? (
                      <>
                        <Badge tone="warning" size="sm">
                          Lost
                        </Badge>
                        <p className="mt-1 text-xs text-ink-500">{gap > 0 ? `${gap.toFixed(1)}% above the featured offer` : "Price matched, other factors decide"}</p>
                      </>
                    ) : (
                      <Badge tone="neutral" size="sm">
                        Not eligible
                      </Badge>
                    )}
                  </TD>
                  <TD align="right">
                    <p className="font-medium text-ink-900">{formatINR(prices[r.id] ? Math.round(price * r.netRatio) : r.netPerUnit)}</p>
                    <p className="mt-0.5 text-xs text-ink-500">{Math.round(r.netRatio * 1000) / 10}% of price</p>
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

export interface RuleRow {
  id: string;
  name: string;
  strategy: string;
  detail: string;
  listings: number;
  floor: string;
  status: "active" | "paused";
  lastRun: string;
  changes7d: number;
}

export function RulesTable({ rules }: { rules: RuleRow[] }) {
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(rules.map((r) => [r.id, r.status === "active"])));
  const toast = useToast();
  return (
    <>
      <ul className="divide-y divide-line">
        {rules.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13px] font-semibold text-ink-900">{r.name}</p>
                <Badge size="sm" tone={on[r.id] ? "success" : "neutral"}>
                  {on[r.id] ? "Active" : "Paused"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-ink-600">
                {r.detail}. {r.floor}.
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {r.listings} {r.listings === 1 ? "listing" : "listings"}, last run {timeAgo(r.lastRun)}, {r.changes7d} price {r.changes7d === 1 ? "change" : "changes"} in 7 days
              </p>
            </div>
            <Switch
              checked={on[r.id]}
              onChange={(v) => {
                setOn((p) => ({ ...p, [r.id]: v }));
                toast.show(v ? `${r.name} resumed. It runs every 15 minutes.` : `${r.name} paused. Prices stay where they are.`);
              }}
              label={<span className="sr-only">{r.name}</span>}
            />
          </li>
        ))}
      </ul>
      {toast.node}
    </>
  );
}

export function CreateRule({ listings }: { listings: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [strategy, setStrategy] = useState("match");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toast = useToast();
  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>
        Create rule
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Create a pricing rule"
        description="Rules re-price every 15 minutes within your floor and M.R.P. They never go above M.R.P. or below your floor."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={picked.size === 0}
              onClick={() => {
                setOpen(false);
                toast.show(`Rule created for ${picked.size} ${picked.size === 1 ? "listing" : "listings"}. First run in 15 minutes.`);
              }}
            >
              Create rule
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <Field label="Rule name" htmlFor="rule-name">
            <Input id="rule-name" placeholder="For example: Match featured offer, cameras" />
          </Field>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink-700">Strategy</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { key: "match", label: "Match featured offer", hint: "Same price as the winner" },
                { key: "beat", label: "Beat the lowest", hint: "A fixed amount below" },
                { key: "band", label: "Stay within a band", hint: "Between a floor and ceiling" },
              ].map((s) => (
                <label key={s.key} className={cn("cursor-pointer rounded-xl border px-3.5 py-3", strategy === s.key ? "border-brand-300 bg-brand-50/50" : "border-line hover:bg-ink-50")}>
                  <input type="radio" name="strategy" className="sr-only" checked={strategy === s.key} onChange={() => setStrategy(s.key)} />
                  <span className="block text-[13px] font-medium text-ink-900">{s.label}</span>
                  <span className="block text-xs text-ink-500">{s.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            {strategy === "beat" && (
              <Field label="Beat by" htmlFor="rule-beat">
                <Input id="rule-beat" inputMode="numeric" defaultValue="50" suffix="INR" />
              </Field>
            )}
            <Field label="Floor price" htmlFor="rule-floor" hint="Never price below this">
              <Select id="rule-floor" defaultValue="low">
                <option value="low">30-day low minus 3%</option>
                <option value="cost">Cost plus 8%</option>
                <option value="fixed">A fixed amount per listing</option>
              </Select>
            </Field>
            <Field label="Ceiling" htmlFor="rule-ceiling">
              <Select id="rule-ceiling" defaultValue="mrp">
                <option value="mrp">M.R.P.</option>
                <option value="current">Current price</option>
              </Select>
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink-700">Listings</legend>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-line p-1.5 scrollbar-thin">
              {listings.map((l) => (
                <div key={l.id} className="rounded-lg px-2.5 py-2 hover:bg-ink-50">
                  <Checkbox
                    checked={picked.has(l.id)}
                    onChange={() =>
                      setPicked((p) => {
                        const n = new Set(p);
                        if (n.has(l.id)) n.delete(l.id);
                        else n.add(l.id);
                        return n;
                      })
                    }
                    label={<span className="text-[13px]">{l.title}</span>}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        </div>
      </Modal>
      {toast.node}
    </>
  );
}
