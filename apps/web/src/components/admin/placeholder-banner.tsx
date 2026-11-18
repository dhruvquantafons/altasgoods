import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Notice } from "@/components/account/ui";

/** Warns while company or grievance details still hold the placeholders a fresh store starts with; renders nothing once they are all set. */
export function PlaceholderBanner({
  fields,
  linkToSettings = true,
  className,
}: {
  fields: string[];
  linkToSettings?: boolean;
  className?: string;
}) {
  if (!fields.length) return null;
  return (
    <Notice
      tone="warning"
      icon={TriangleAlert}
      title="Store details still use placeholders"
      className={className}
      action={
        linkToSettings ? (
          <Link
            href="/admin/settings"
            className="font-semibold text-warning-700 underline underline-offset-2 hover:text-warning-800"
          >
            Open Settings
          </Link>
        ) : undefined
      }
    >
      Store details still use placeholders: {fields.join(", ")}. Customers see
      these on product pages, the footer and policies.
    </Notice>
  );
}
