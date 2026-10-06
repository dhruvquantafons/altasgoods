import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, DescriptionList } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { formatDate } from "@/lib/utils";
import { PreferencesForm, ProfileForm, SessionsList, type StaffPerson } from "./account-forms";

export type AccountTab = "profile" | "security" | "preferences";

export function accountTab(raw: string | string[] | undefined): AccountTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "security" || v === "preferences" ? v : "profile";
}

/**
 * Personal account page shared by every dashboard workspace
 * (Seller Hub, AltasGoods Control, Hub Console, Care Desk).
 */
export function StaffAccountPage({
  person,
  workspaceName,
  tab,
  topics,
}: {
  person: StaffPerson;
  workspaceName: string;
  tab: AccountTab;
  topics: { key: string; label: string; description: string }[];
}) {
  return (
    <>
      <PageHeader title="Your account" description={`Your profile, sign in security and preferences for ${workspaceName}.`} />

      <div className="mb-6 flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <Avatar name={person.name} size="lg" />
        <div className="min-w-0">
          <p className="text-lg font-semibold text-ink-900">{person.name}</p>
          <p className="text-sm text-ink-500">
            {person.role}, {person.team}
          </p>
        </div>
      </div>

      <TabLinks
        className="mb-6"
        active={tab}
        items={[
          { key: "profile", label: "Profile", href: "?tab=profile" },
          { key: "security", label: "Sign in and security", href: "?tab=security" },
          { key: "preferences", label: "Preferences", href: "?tab=preferences" },
        ]}
      />

      {tab === "profile" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader title="Profile details" description="How you appear to your team and in activity logs." />
            <div className="p-5">
              <ProfileForm person={person} />
            </div>
          </Card>
          <Card className="self-start">
            <CardHeader title="Account" />
            <div className="p-5">
              <DescriptionList
                items={[
                  { label: "Role", value: person.role },
                  { label: "Team", value: person.team },
                  { label: "User ID", value: <span className="font-mono text-[13px]">{person.userId}</span> },
                  { label: "Member since", value: formatDate(person.memberSince) },
                ]}
              />
              <p className="mt-5 text-xs leading-relaxed text-ink-500">Role and permissions are managed by your administrator.</p>
            </div>
          </Card>
        </div>
      )}

      {tab === "security" && (
        <Card className="max-w-3xl">
          <CardHeader title="Sign in and security" description="You sign in with your mobile number and a one-time code." />
          <div className="p-5">
            <SessionsList />
          </div>
        </Card>
      )}

      {tab === "preferences" && (
        <Card className="max-w-4xl">
          <CardHeader title="Preferences" description="Notifications and display settings apply to you only." />
          <div className="p-5">
            <PreferencesForm topics={topics} />
          </div>
        </Card>
      )}
    </>
  );
}
