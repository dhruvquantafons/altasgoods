"use client";

import type { ComponentProps } from "react";
import { Select } from "@/components/ui/input";

/** A select that submits its form on change, for URL driven filters. */
export function AutoSubmitSelect(props: Omit<ComponentProps<typeof Select>, "onChange">) {
  return <Select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
