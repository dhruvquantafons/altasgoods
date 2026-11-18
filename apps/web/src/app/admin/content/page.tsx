import { AboutEditor } from "@/components/admin/content/about-editor";
import { CareersEditor, PressList } from "@/components/admin/content/careers-press-editor";
import { HelpEditor } from "@/components/admin/content/help-editor";
import { PagesEditor } from "@/components/admin/content/pages-editor";
import { SpotlightsEditor } from "@/components/admin/content/spotlights-editor";
import { sp } from "@/components/admin/helpers";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { loadContentAbout, loadContentFaqs, loadContentPages, loadContentPress, loadContentRoles, loadContentSpotlights, loadContentTopics } from "@/lib/api/admin-content";
import { canEditArea } from "@/lib/api/server";

export const metadata = { title: "Pages and content" };

const TABS = [
  { key: "pages", label: "Pages and policies" },
  { key: "help", label: "FAQs and topics" },
  { key: "careers", label: "Careers" },
  { key: "press", label: "Press" },
  { key: "about", label: "About" },
  { key: "spotlights", label: "Brand spotlights" },
] as const;

export default async function ContentPage(props: PageProps<"/admin/content">) {
  const params = await props.searchParams;
  const requested = sp(params, "tab");
  const tab = TABS.find((t) => t.key === requested)?.key ?? "pages";
  const edit = await canEditArea("content");

  return (
    <>
      <PageHeader
        title="Pages and content"
        description="The policies, help centre, careers, press and About pages, and the homepage brand spotlights. Changes show on the storefront within a minute, and every change is in the audit log."
      />
      <TabLinks className="mb-6" active={tab} items={TABS.map((t) => ({ key: t.key, label: t.label, href: `?tab=${t.key}` }))} />
      {tab === "pages" && <PagesEditor pages={await loadContentPages()} canEdit={edit} />}
      {tab === "help" && <HelpEditor faqs={await loadContentFaqs()} topics={await loadContentTopics()} canEdit={edit} />}
      {tab === "careers" && <CareersEditor roles={await loadContentRoles()} canEdit={edit} />}
      {tab === "press" && <PressList items={await loadContentPress()} canEdit={edit} />}
      {tab === "about" && <AboutEditor about={await loadContentAbout()} canEdit={edit} />}
      {tab === "spotlights" && <SpotlightsEditor items={await loadContentSpotlights()} canEdit={edit} />}
    </>
  );
}
