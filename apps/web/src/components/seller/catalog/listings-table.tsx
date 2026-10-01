"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Archive, Copy, Ellipsis, PackageSearch, Pause, Pencil, Play, X } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { MenuItem, Popover, useToast } from "@/components/ui/interactive";
import { EmptyState } from "@/components/ui/misc";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { LISTING_STATUS, type ListingStatus, type Tone } from "@/lib/status";
import { cn, formatINR, formatNumber } from "@/lib/utils";
import { ChannelBadge } from "../primitives";
import type { Channel } from "../shared";

export interface ListingRow {
  id: string;
  title: string;
  image: string;
  brand: string;
  bsin: string;
  sku: string;
  status: ListingStatus;
  note?: string;
  quality: number;
  issues: number;
  price: number;
  mrp: number;
  stock: number;
  channel: Channel;
  featured: "won" | "lost" | "ineligible";
  featuredPct: number;
  featuredPrice: number;
  lowestSeller?: string;
  units30d: number;
  sales30d: number;
}

function qualityMeta(q: number): { word: string; tone: Tone; bar: string } {
  if (q >= 85) return { word: "Great", tone: "success", bar: "bg-success-500" };
  if (q >= 70) return { word: "Good", tone: "brand", bar: "bg-brand-500" };
  if (q >= 55) return { word: "Fair", tone: "warning", bar: "bg-warning-500" };
  return { word: "Poor", tone: "danger", bar: "bg-danger-500" };
}

/** Click-to-edit numeric cell. Enter saves, Escape cancels. */
export function InlineNumber({
  value,
  prefix,
  label,
  validate,
  onSave,
  disabled,
  display,
}: {
  value: number;
  prefix?: string;
  label: string;
  validate: (v: number) => string | null;
  onSave: (v: number) => void;
  disabled?: boolean;
  display: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const n = Number(draft);
  const error = draft.trim() === "" || Number.isNaN(n) ? "Enter a number" : validate(n);

  if (disabled) return <>{display}</>;
  if (!editing)
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        className="group -mx-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-right hover:bg-ink-100"
        aria-label={`Edit ${label}`}
      >
        <Pencil size={12} className="text-ink-300 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
        {display}
      </button>
    );
  return (
    <div className="ml-auto w-32">
      <div className={cn("flex h-8 items-center rounded-lg border bg-white pr-1 pl-2 ring-4", error ? "border-danger-500 ring-danger-100" : "border-brand-500 ring-brand-100")}>
        {prefix && <span className="text-[13px] text-ink-500">{prefix}</span>}
        <input
          autoFocus
          inputMode="numeric"
          aria-label={label}
          aria-invalid={Boolean(error)}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
            if (e.key === "Enter" && !error) {
              onSave(n);
              setEditing(false);
            }
          }}
          onBlur={() => setEditing(false)}
          className="w-full min-w-0 bg-transparent px-1 text-right text-[13px] text-ink-900 tabular-nums outline-none"
        />
      </div>
      <p className={cn("mt-1 text-right text-[11px] leading-tight whitespace-normal", error ? "text-danger-700" : "text-ink-500")}>{error ?? "Enter to save"}</p>
    </div>
  );
}

export function ListingsTable({ rows, toolbar }: { rows: ListingRow[]; toolbar: ReactNode }) {
  const [edits, setEdits] = useState<Record<string, { price?: number; stock?: number; status?: ListingStatus }>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toast = useToast();

  const get = (r: ListingRow) => ({ ...r, ...edits[r.id] });
  const patch = (id: string, p: { price?: number; stock?: number; status?: ListingStatus }) => setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function bulk(to: "paused" | "live") {
    const eligible = rows.filter((r) => selected.has(r.id) && (to === "paused" ? ["live", "out_of_stock"].includes(get(r).status) : get(r).status === "inactive"));
    eligible.forEach((r) => patch(r.id, { status: to === "paused" ? "inactive" : r.stock > 0 ? "live" : "out_of_stock" }));
    toast.show(eligible.length ? `${eligible.length} ${eligible.length === 1 ? "listing" : "listings"} ${to === "paused" ? "paused. Customers can no longer buy them." : "resumed."}` : "None of the selected listings can be changed that way.");
    setSelected(new Set());
  }

  return (
    <>
      <div className="border-b border-line">
        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-brand-50/60 px-5 py-3">
            <p className="text-[13px] font-semibold text-ink-900">{selected.size} selected</p>
            <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
              <Button size="sm" variant="secondary" icon={Pause} onClick={() => bulk("paused")}>
                Pause
              </Button>
              <Button size="sm" variant="secondary" icon={Play} onClick={() => bulk("live")}>
                Resume
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  toast.show(`Template with ${selected.size} listings downloaded. Edit and upload it in Bulk upload.`);
                  setSelected(new Set());
                }}
              >
                Bulk edit in a sheet
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection">
                <X size={16} />
              </Button>
            </div>
          </div>
        ) : (
          toolbar
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No listings here" description="Nothing matches this view. Try another tab or clear the filters." />
      ) : (
        <TableContainer>
          <Table className="min-w-[1000px]">
            <THead className="border-t-0">
              <TR className="hover:bg-transparent">
                <TH className="w-10 pr-0">
                  <Checkbox aria-label="Select all listings" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} />
                </TH>
                <TH>Product</TH>
                <TH>Status</TH>
                <TH>Quality</TH>
                <TH align="right">Price</TH>
                <TH align="right">Stock</TH>
                <TH>Featured offer</TH>
                <TH className="w-12">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((raw) => {
                const r = get(raw);
                const q = qualityMeta(r.quality);
                const editable = !["rejected", "blocked"].includes(r.status);
                const isSel = selected.has(r.id);
                return (
                  <TR key={r.id} className={cn(isSel && "bg-brand-50/50 hover:bg-brand-50/70")}>
                    <TD className="w-10 pr-0">
                      <Checkbox
                        aria-label={`Select ${r.title}`}
                        checked={isSel}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.id)) next.delete(r.id);
                            else next.add(r.id);
                            return next;
                          })
                        }
                      />
                    </TD>
                    <TD>
                      <div className="flex max-w-[17rem] items-center gap-3 2xl:max-w-[22rem]">
                        <ProductImage src={r.image} alt="" size={44} rounded="md" />
                        <div className="min-w-0">
                          <Link href={`/seller/catalog/${r.id}`} className="block truncate text-[13px] font-medium text-ink-900 hover:text-brand-700">
                            {r.title}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-ink-500">
                            {r.brand}, <span className="font-mono">{r.bsin}</span>, <span className="font-mono">{r.sku}</span>
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <StatusBadge meta={LISTING_STATUS[r.status]} size="sm" />
                      {r.note && <p className="mt-1 max-w-[10rem] truncate text-xs text-ink-500" title={r.note}>{r.note}</p>}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="w-7 text-[13px] font-semibold text-ink-900 tabular-nums">{r.quality}</span>
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
                          <span className={cn("block h-full rounded-full", q.bar)} style={{ width: `${r.quality}%` }} />
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink-500">
                        {q.word}
                        {r.issues > 0 ? `, ${r.issues} ${r.issues === 1 ? "tip" : "tips"}` : ""}
                      </p>
                    </TD>
                    <TD align="right">
                      <InlineNumber
                        label={`price for ${r.title}`}
                        value={r.price}
                        prefix="₹"
                        disabled={!editable}
                        validate={(v) => (v <= 0 ? "Price must be above zero" : v > r.mrp ? `Must be at or below M.R.P. ${formatINR(r.mrp)}` : null)}
                        onSave={(v) => {
                          patch(r.id, { price: v });
                          toast.show(
                            v > r.featuredPrice * 1.05 && r.featured !== "ineligible"
                              ? `Price updated to ${formatINR(v)}. It is more than 5% above the featured offer, so it is unlikely to win.`
                              : `Price updated to ${formatINR(v)}. Live on BluBuy within 15 minutes.`,
                          );
                        }}
                        display={<span className="text-[13px] font-medium text-ink-900">{formatINR(r.price)}</span>}
                      />
                      <p className="mt-0.5 text-xs text-ink-400 line-through">M.R.P. {formatINR(r.mrp)}</p>
                    </TD>
                    <TD align="right">
                      <InlineNumber
                        label={`stock for ${r.title}`}
                        value={r.stock}
                        disabled={r.channel === "fulfilled" || !editable}
                        validate={(v) => (v > 9999 ? "Up to 9,999 units per location" : null)}
                        onSave={(v) => {
                          patch(r.id, { stock: v, status: r.status === "out_of_stock" && v > 0 ? "live" : r.status === "live" && v === 0 ? "out_of_stock" : undefined });
                          toast.show(`Stock set to ${formatNumber(v)} units at the Andheri warehouse.`);
                        }}
                        display={<span className={cn("text-[13px] font-medium", r.stock === 0 ? "text-danger-700" : "text-ink-900")}>{formatNumber(r.stock)}</span>}
                      />
                      <div className="mt-1 flex justify-end">
                        <ChannelBadge channel={r.channel} />
                      </div>
                    </TD>
                    <TD>
                      {r.featured === "won" ? (
                        <>
                          <Badge tone="success" size="sm">
                            Won
                          </Badge>
                          <p className="mt-1 text-xs text-ink-500">{r.featuredPct}% of views</p>
                        </>
                      ) : r.featured === "lost" ? (
                        <>
                          <Badge tone="warning" size="sm">
                            Lost
                          </Badge>
                          <p className="mt-1 text-xs text-ink-500">
                            {r.lowestSeller ?? "Another seller"} at {formatINR(r.featuredPrice)}
                          </p>
                        </>
                      ) : (
                        <>
                          <Badge tone="neutral" size="sm">
                            Not eligible
                          </Badge>
                          <p className="mt-1 text-xs text-ink-500">Listing is not live</p>
                        </>
                      )}
                    </TD>
                    <TD className="w-12">
                      <Popover
                        className="w-56"
                        trigger={(open) => (
                          <button
                            type="button"
                            className={cn("flex size-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-800", open && "bg-ink-100")}
                            aria-label={`Actions for ${r.title}`}
                          >
                            <Ellipsis size={17} />
                          </button>
                        )}
                      >
                        {(close) => (
                          <div>
                            <Link href={`/seller/catalog/${r.id}`} onClick={close} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-700 hover:bg-ink-50 hover:text-ink-900">
                              <Pencil size={15} className="text-ink-400" />
                              Edit listing
                            </Link>
                            {["live", "out_of_stock"].includes(r.status) && (
                              <MenuItem
                                icon={<Pause size={15} className="text-ink-400" />}
                                onClick={() => {
                                  patch(r.id, { status: "inactive" });
                                  toast.show("Listing paused. Resume it any time from this menu.");
                                  close();
                                }}
                              >
                                Pause listing
                              </MenuItem>
                            )}
                            {r.status === "inactive" && (
                              <MenuItem
                                icon={<Play size={15} className="text-ink-400" />}
                                onClick={() => {
                                  patch(r.id, { status: r.stock > 0 ? "live" : "out_of_stock" });
                                  toast.show("Listing resumed and buyable again.");
                                  close();
                                }}
                              >
                                Resume listing
                              </MenuItem>
                            )}
                            <MenuItem
                              icon={<Copy size={15} className="text-ink-400" />}
                              onClick={() => {
                                toast.show("Copied into a new draft. Pick the new variant values and submit.");
                                close();
                              }}
                            >
                              Copy as a new variant
                            </MenuItem>
                            <div className="my-1 h-px bg-line" />
                            <MenuItem
                              danger
                              icon={<Archive size={15} />}
                              onClick={() => {
                                toast.show("Listing archived. Open orders are not affected.");
                                close();
                              }}
                            >
                              Archive
                            </MenuItem>
                          </div>
                        )}
                      </Popover>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </TableContainer>
      )}
      {toast.node}
    </>
  );
}
