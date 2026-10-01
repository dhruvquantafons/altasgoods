import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Table primitives. Wrap in <TableContainer> inside a Card for the standard
 * look: hairline row dividers, quiet header, tabular numbers.
 */
export function TableContainer({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("w-full overflow-x-auto scrollbar-thin", className)} {...props} />;
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("border-y border-line bg-ink-50/70", className)} {...props} />;
}

export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-line", className)} {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-ink-50/60", className)} {...props} />;
}

export function TH({ className, align, ...props }: ComponentProps<"th"> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "h-10 px-4 text-[12px] font-medium whitespace-nowrap text-ink-500 first:pl-5 last:pr-5",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, align, ...props }: ComponentProps<"td"> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle whitespace-nowrap text-ink-700 first:pl-5 last:pr-5",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

/** Toolbar row above a table: search, filters on the left, actions on the right. */
export function TableToolbar({ children, actions, className }: { children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-5 py-3.5", className)}>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Pagination footer. Pass prevHref / nextHref (e.g. "?page=2") to make the buttons navigate. */
export function TableFooter({
  shown,
  total,
  label = "results",
  prevHref,
  nextHref,
}: {
  shown: number;
  total: number;
  label?: string;
  prevHref?: string;
  nextHref?: string;
}) {
  const btn = "inline-flex h-8 items-center rounded-lg border border-line-strong bg-white px-3 text-[13px] font-medium";
  return (
    <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[13px] text-ink-500">
      <span>
        Showing <span className="font-medium text-ink-800">{shown}</span> of{" "}
        <span className="font-medium text-ink-800">{total.toLocaleString("en-IN")}</span> {label}
      </span>
      <div className="flex items-center gap-1.5">
        {prevHref ? (
          <Link href={prevHref} scroll={false} className={`${btn} text-ink-700 hover:bg-ink-50`}>
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={`${btn} text-ink-400`}>
            Previous
          </span>
        )}
        {nextHref ? (
          <Link href={nextHref} scroll={false} className={`${btn} text-ink-700 hover:bg-ink-50`}>
            Next
          </Link>
        ) : (
          <span aria-disabled="true" className={`${btn} text-ink-400`}>
            Next
          </span>
        )}
      </div>
    </div>
  );
}
