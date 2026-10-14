import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/ui/page-header";
import { loadSettings } from "@/lib/api/admin-system";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { updatedAt, updatedBy, ...settings } = await loadSettings();
  return (
    <>
      <PageHeader title="Settings" description="Store-wide settings. Changes take effect on the storefront and at checkout as soon as you save, and are recorded in the audit log." />
      <SettingsForm initial={settings} savedNote={updatedAt ? `Last saved ${formatDateTime(updatedAt)}${updatedBy ? ` by ${updatedBy}` : ""}.` : "Using the default settings."} />
    </>
  );
}
