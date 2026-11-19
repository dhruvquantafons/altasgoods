import { Download } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { exportHref, type ExportKind } from "@/lib/api/exports";

type Filters = Parameters<typeof exportHref>[1];

/**
 * Downloads a CSV of what the page lists, for the filters currently applied.
 * A plain link (not a client navigation), so the browser saves the file.
 */
export function ExportButton({ kind, filters = {}, children = "Export CSV" }: { kind: ExportKind; filters?: Filters; children?: string }) {
  return (
    <a href={exportHref(kind, filters)} download className={buttonClasses({ variant: "secondary", size: "sm" })}>
      <Download size={15} strokeWidth={1.9} aria-hidden="true" />
      {children}
    </a>
  );
}
