import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mailtoHref, PLACEHOLDER_TEXT, realText, telHref } from "@/lib/legal";

/** Marks a detail the store has not supplied yet, so it is never mistaken for real data. */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <Badge tone="warning" icon={TriangleAlert}>
      {children}
    </Badge>
  );
}

/**
 * A company or grievance detail from Settings: the value (optionally as an email or phone link) once the store has set it,
 * the placeholder pill, and never a link, while it is still a placeholder.
 */
export function Fact({ value, link, className }: { value: string | null | undefined; link?: "mailto" | "tel"; className?: string }) {
  const v = realText(value);
  if (!v) return <Placeholder>{PLACEHOLDER_TEXT}</Placeholder>;
  if (!link) return <>{v}</>;
  return (
    <a href={link === "mailto" ? mailtoHref(v) : telHref(v)} className={className}>
      {v}
    </a>
  );
}
