import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/ui/page-header";
import { categories } from "@/lib/mock";
import { platformSettings } from "@/lib/mock/admin-extra";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Platform settings"
        description="Marketplace-wide configuration. Values are versioned; anything that changes what customers pay or sellers receive needs a Finance Manager's approval."
      />
      <SettingsForm
        data={{
          ...platformSettings,
          returnWindows: platformSettings.returnWindows.map((r) => ({ ...r, name: categories.find((c) => c.id === r.categoryId)?.name ?? r.categoryId })),
        }}
      />
    </>
  );
}
