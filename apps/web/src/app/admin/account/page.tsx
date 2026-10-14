import { redirect } from "next/navigation";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { ChangePasswordButton, EditNameButton, EmailButton, SignOutOthersButton } from "@/components/account/profile-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { currentUser } from "@/lib/api/server";
import { STAFF_ROLE_LABEL } from "@/lib/api/staff";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Your account" };

export default async function AdminAccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login?as=staff&next=/admin/account");
  const name = user.name ?? user.email;

  return (
    <>
      <PageHeader title="Your account" description="Your staff profile and how you sign in to AltasGoods Control." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Profile" action={<EditNameButton name={user.name ?? ""} />} />
          <div className="flex items-center gap-4 px-5 pt-3 pb-5">
            <Avatar name={name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink-900">{name}</p>
              <p className="text-[13px] text-ink-500">Staff since {formatDate(user.createdAt)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {user.staffRoles.map((r) => (
                  <Badge key={r} tone="brand" size="sm" icon={ShieldCheck}>
                    {STAFF_ROLE_LABEL[r] ?? r}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Sign in email" />
          <div className="flex items-center gap-3 px-5 pt-3 pb-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
              <Mail size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-ink-900">{user.email}</p>
              <Badge size="sm" tone={user.emailVerified ? "success" : "warning"} dot>
                {user.emailVerified ? "Verified" : "Not verified"}
              </Badge>
            </div>
            <EmailButton email={user.email} verified={user.emailVerified} />
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Password and sign in" />
          <div className="flex flex-col gap-4 px-5 pt-3 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-3 text-[13px] text-ink-600">
              <KeyRound size={16} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
              Changing your password signs you out on every other device. Roles are changed by a Super Admin with npm run admin:create.
            </p>
            <div className="flex flex-wrap gap-2">
              <SignOutOthersButton />
              <ChangePasswordButton />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
