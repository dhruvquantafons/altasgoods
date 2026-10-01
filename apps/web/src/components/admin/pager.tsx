import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { hrefWith } from "./helpers";

/** Link based pagination footer for server-filtered tables ("1 to 25 of 240"). */
export function Pager({
  path,
  params,
  page,
  pages,
  from,
  to,
  total,
  label = "results",
}: {
  path: string;
  params: Record<string, string | undefined>;
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
  label?: string;
}) {
  const btn = "inline-flex h-8 items-center gap-1 rounded-lg border border-line-strong bg-white px-2.5 text-[13px] font-medium";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-ink-500">
      <span>
        {total ? (
          <>
            <span className="font-medium text-ink-800 tabular-nums">
              {formatNumber(from)} to {formatNumber(to)}
            </span>{" "}
            of <span className="font-medium text-ink-800 tabular-nums">{formatNumber(total)}</span> {label}
          </>
        ) : (
          `No ${label}`
        )}
      </span>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={hrefWith(path, params, { page: String(page - 1) })} scroll={false} className={cn(btn, "text-ink-700 hover:bg-ink-50")}>
            <ChevronLeft size={15} aria-hidden="true" />
            Previous
          </Link>
        ) : (
          <span className={cn(btn, "text-ink-300")} aria-disabled="true">
            <ChevronLeft size={15} aria-hidden="true" />
            Previous
          </span>
        )}
        <span className="px-1.5 tabular-nums">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={hrefWith(path, params, { page: String(page + 1) })} scroll={false} className={cn(btn, "text-ink-700 hover:bg-ink-50")}>
            Next
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
        ) : (
          <span className={cn(btn, "text-ink-300")} aria-disabled="true">
            Next
            <ChevronRight size={15} aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}
