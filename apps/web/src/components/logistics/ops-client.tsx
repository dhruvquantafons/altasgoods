"use client";

import Form from "next/form";
import type { ReactNode } from "react";

/**
 * GET form that navigates client side and submits as soon as a select changes,
 * so filter rows feel instant while staying URL driven and server rendered.
 */
export function AutoSubmitForm({ action, children, className }: { action: string; children: ReactNode; className?: string }) {
  return (
    <Form
      action={action}
      scroll={false}
      className={className}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </Form>
  );
}
