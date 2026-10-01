import { LogoMark } from "@/components/brand/logo";
import { cn, formatDate, formatDateTime, formatINR } from "@/lib/utils";
import { Barcode } from "../barcode";

export interface LabelData {
  awb?: string;
  orderId: string;
  lineId: string;
  cod: boolean;
  amount: number;
  buyer: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  weightKg: number;
  dims: [number, number, number];
  dispatchBy?: string;
  sku: string;
  qty: number;
}

/** 4 x 6 inch BluBuy Logistics label preview (address lines stay masked until printing). */
export function ShippingLabel({ d, className }: { d: LabelData; className?: string }) {
  const route = `BOM-SC-01 > ${d.city.slice(0, 3).toUpperCase()}-DH`;
  return (
    <div className={cn("mx-auto w-full max-w-[22rem] rounded-lg border-2 border-ink-900 bg-white font-sans text-ink-900", className)} aria-label="Shipping label preview">
      <div className="flex items-center justify-between border-b-2 border-ink-900 px-3 py-2">
        <span className="flex items-center gap-2">
          <LogoMark className="size-6" />
          <span className="text-[13px] leading-tight font-bold">
            BluBuy Logistics
            <span className="block text-[10px] font-medium text-ink-600">BluBuy Ship, surface</span>
          </span>
        </span>
        <span className={cn("rounded px-2 py-1 text-[12px] font-bold", d.cod ? "bg-ink-900 text-white" : "border border-ink-900")}>
          {d.cod ? `COD ${formatINR(d.amount)}` : "PREPAID"}
        </span>
      </div>
      <div className="border-b-2 border-ink-900 px-3 pt-3 pb-2 text-ink-900">
        <Barcode value={d.awb ?? "PENDING"} height={52} />
        <p className={cn("mt-1 text-center font-mono font-semibold", d.awb ? "text-[13px] tracking-[0.18em]" : "text-[11px] text-ink-500")}>{d.awb ?? "AWB assigned when the label is generated"}</p>
      </div>
      <div className="grid grid-cols-[1fr_auto] border-b-2 border-ink-900">
        <div className="px-3 py-2.5">
          <p className="text-[10px] font-semibold text-ink-600">DELIVER TO</p>
          <p className="mt-0.5 text-[13px] font-semibold">{d.buyer}</p>
          <p className="text-[12px] leading-snug">{d.addressLine}</p>
          <p className="text-[12px] leading-snug">
            {d.city}, {d.state}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center border-l-2 border-ink-900 px-3">
          <p className="text-[10px] font-semibold text-ink-600">PIN</p>
          <p className="font-mono text-[20px] leading-none font-bold">{d.pincode}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 border-b-2 border-ink-900 text-[11px]">
        <div className="px-3 py-2">
          <p className="text-[10px] text-ink-600">Weight</p>
          <p className="font-semibold">{d.weightKg} kg</p>
        </div>
        <div className="border-x-2 border-ink-900 px-3 py-2">
          <p className="text-[10px] text-ink-600">Size (cm)</p>
          <p className="font-semibold">{d.dims.join(" x ")}</p>
        </div>
        <div className="px-3 py-2">
          <p className="text-[10px] text-ink-600">Route</p>
          <p className="font-mono font-semibold">{route}</p>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3 px-3 py-2.5 text-[11px]">
        <div className="min-w-0">
          <p className="text-[10px] text-ink-600">Order item</p>
          <p className="truncate font-mono font-semibold">{d.lineId}</p>
          <p className="mt-1 truncate text-[10px] text-ink-600">
            SKU {d.sku}, qty {d.qty}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-ink-600">Return to</p>
          <p className="font-semibold">Apex Retail, Andheri East</p>
          <p className="text-[10px] text-ink-600">Mumbai 400072</p>
        </div>
      </div>
    </div>
  );
}

export interface InvoiceLine {
  title: string;
  hsn: string;
  qty: number;
  total: number;
  gst: number;
}

/** Seller tax invoice preview: seller GSTIN plus BluBuy as the e-commerce operator. */
export function TaxInvoice({
  number,
  date,
  seller,
  buyer,
  lines,
  intraState,
}: {
  number: string;
  date: string;
  seller: { legalName: string; gstin: string; address: string };
  buyer: { name: string; city: string; state: string; pincode: string };
  lines: InvoiceLine[];
  intraState: boolean;
}) {
  const rows = lines.map((l) => {
    const taxable = l.total / (1 + l.gst / 100);
    return { ...l, taxable, tax: l.total - taxable };
  });
  const totals = rows.reduce((a, r) => ({ taxable: a.taxable + r.taxable, tax: a.tax + r.tax, total: a.total + r.total }), { taxable: 0, tax: 0, total: 0 });
  return (
    <div className="mx-auto w-full max-w-2xl rounded-lg border border-line-strong bg-white p-5 text-[12px] text-ink-800 shadow-xs" aria-label="Tax invoice preview">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-[15px] font-semibold text-ink-900">Tax invoice</p>
          <p className="mt-1 text-ink-600">Original for recipient</p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-right">
          <dt className="text-ink-500">Invoice no.</dt>
          <dd className="font-mono font-medium text-ink-900">{number}</dd>
          <dt className="text-ink-500">Date</dt>
          <dd className="text-ink-900">{formatDate(date)}</dd>
        </dl>
      </div>
      <div className="grid gap-4 border-b border-line py-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium text-ink-500">Sold by</p>
          <p className="mt-0.5 font-semibold text-ink-900">{seller.legalName}</p>
          <p className="text-ink-600">{seller.address}</p>
          <p className="mt-1 font-mono text-ink-900">GSTIN {seller.gstin}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-ink-500">Bill to and ship to</p>
          <p className="mt-0.5 font-semibold text-ink-900">{buyer.name}</p>
          <p className="text-ink-600">
            {buyer.city}, {buyer.state} {buyer.pincode}
          </p>
          <p className="mt-1 text-ink-600">Place of supply: {buyer.state}</p>
        </div>
      </div>
      <div className="overflow-x-auto py-3">
        <table className="w-full min-w-[30rem] text-left">
          <thead className="text-[11px] text-ink-500">
            <tr className="border-b border-line">
              <th className="py-2 pr-3 font-medium">Description</th>
              <th className="py-2 pr-3 font-medium">HSN</th>
              <th className="py-2 pr-3 text-right font-medium">Qty</th>
              <th className="py-2 pr-3 text-right font-medium">Taxable value</th>
              <th className="py-2 pr-3 text-right font-medium">{intraState ? "CGST + SGST" : "IGST"}</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line align-top">
                <td className="max-w-[16rem] py-2 pr-3 text-ink-900">{r.title}</td>
                <td className="py-2 pr-3 font-mono">{r.hsn}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.qty}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatINR(r.taxable, { paise: true })}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatINR(r.tax, { paise: true })}
                  <span className="block text-[10px] text-ink-500">{intraState ? `${r.gst / 2}% + ${r.gst / 2}%` : `${r.gst}%`}</span>
                </td>
                <td className="py-2 text-right font-medium text-ink-900 tabular-nums">{formatINR(r.total, { paise: true })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-2 text-ink-500">
                Amounts are inclusive of GST
              </td>
              <td className="pt-2 pr-3 text-right tabular-nums">{formatINR(totals.taxable, { paise: true })}</td>
              <td className="pt-2 pr-3 text-right tabular-nums">{formatINR(totals.tax, { paise: true })}</td>
              <td className="pt-2 text-right text-[13px] font-semibold text-ink-900 tabular-nums">{formatINR(totals.total, { paise: true })}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-3 text-[11px] text-ink-500">
        <p className="max-w-sm">
          Supplied through BluBuy Internet Private Limited (e-commerce operator, GSTIN 27AAJCB4821K1Z6). TCS under section 52 is collected by the operator.
        </p>
        <div className="text-right">
          <p className="font-[cursive] text-[15px] text-ink-700 italic">R. Mehta</p>
          <p>Authorised signatory, generated {formatDateTime(date)}</p>
        </div>
      </div>
    </div>
  );
}
