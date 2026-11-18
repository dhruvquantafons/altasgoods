import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Marks a detail the store has not supplied yet, so it is never mistaken for real data. */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <Badge tone="warning" icon={TriangleAlert}>
      {children}
    </Badge>
  );
}
