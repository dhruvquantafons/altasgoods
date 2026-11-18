import Link from "next/link";
import { redirect } from "next/navigation";
import { FileLock2, KeyRound, Mail, Phone, ShieldAlert, ShieldCheck } from "lucide-react";
import { dateLabel } from "@/components/account/lib";
import { ChangePasswordButton, DeleteAccountButton, EditNameButton, EditPhoneButton, EmailButton, SignOutOthersButton } from "@/components/account/profile-forms";
import { Panel } from "@/components/account/ui";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { currentUser } from "@/lib/api/server";
import { staffHome } from "@/lib/api/staff";
import { formatPhone } from "@/lib/utils";

export const metadata = { title: "Profile and security" };

export default async function ProfilePage(props: PageProps<"/account/profile">) {
  const [user, sp] = await Promise.all([currentUser(), props.searchParams]);
  if (!user) redirect("/login?next=/account/profile");
  const name = user.name ?? user.email;
  // staff signed in with a temporary password land here (?change=1) until they choose their own
  const mustChange = user.mustChangePassword && user.staffRoles.length > 0;
  const prompt = mustChange || sp.change === "1";

  return (
    <>
      <PageHeader title="Profile and security" description="Your details and how you sign in." />

      {prompt && (
        <div role="alert" className="mb-6 flex flex-col gap-4 rounded-2xl border border-warning-100 bg-warning-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} className="mt-0.5 shrink-0 text-warning-700" aria-hidden="true" />
            <div>
              <p className="text-[14px] font-semibold text-ink-900">{mustChange ? "Choose your own password" : "Change your password"}</p>
              <p className="mt-0.5 text-[13px] text-ink-700">
                {mustChange
                  ? "A Super Admin gave you a temporary password. AltasGoods Control and the Care Desk open once you replace it with one only you know."
                  : "Pick a new password only you know. Every other device is signed out."}
              </p>
            </div>
          </div>
          <ChangePasswordButton required={mustChange} then={mustChange ? staffHome(user.staffRoles) : undefined} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Profile" action={<EditNameButton name={user.name ?? ""} />}>
          <div className="flex items-center gap-4">
            <Avatar name={name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink-900">{name}</p>
              <p className="text-[13px] text-ink-500">Customer since {dateLabel(user.createdAt)}</p>
            </div>
          </div>
        </Panel>

        <Panel title="Email and mobile" description="You sign in with your email. Order updates and password reset codes go there too.">
          <ul className="flex flex-col divide-y divide-line">
            <li className="flex items-center gap-3 pb-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                <Mail size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-ink-900">{user.email}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                  Sign in email
                  <Badge size="sm" tone={user.emailVerified ? "success" : "warning"} dot>
                    {user.emailVerified ? "Verified" : "Not verified"}
                  </Badge>
                </p>
              </div>
              <EmailButton email={user.email} verified={user.emailVerified} />
            </li>
            <li className="flex items-center gap-3 pt-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                <Phone size={16} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-ink-900">{user.phone ? formatPhone(user.phone) : "No mobile number"}</p>
                <p className="mt-0.5 text-xs text-ink-500">Mobile number, optional</p>
              </div>
              <EditPhoneButton phone={user.phone} />
            </li>
          </ul>
        </Panel>

        <Panel title="Password and sign in" className="xl:col-span-2">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                <KeyRound size={16} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[13.5px] font-medium text-ink-900">Password</p>
                <p className="mt-0.5 text-xs text-ink-500">Changing it signs you out on every other device. Forgotten it? Sign out and use Forgot password.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SignOutOthersButton />
              <ChangePasswordButton />
            </div>
          </div>
          <p className="mt-5 flex items-start gap-2.5 rounded-xl bg-ink-50 px-3.5 py-3 text-xs text-ink-600">
            <ShieldCheck size={16} className="mt-px shrink-0 text-success-600" aria-hidden="true" />
            AltasGoods will never ask for your password or a verification code on a call, chat or email.
          </p>
        </Panel>

        <Panel title="Your data" className="xl:col-span-2">
          <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-600">
            <FileLock2 size={16} className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true" />
            <span>
              For a copy of your data under the Digital Personal Data Protection Act, 2023,{" "}
              <Link href="/account/support" className="font-medium text-brand-700 hover:underline">
                contact AltasGoods Care
              </Link>
              . We reply within 7 days. You can also delete your account yourself, below.
            </span>
          </p>
        </Panel>

        {!user.staffRoles.length && (
          <Panel title="Delete account" className="border-danger-100 xl:col-span-2">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl text-[13px] leading-relaxed text-ink-600">
                <p>
                  Deleting your account erases your name, email, mobile number, saved addresses, cart and wishlist, and signs you out everywhere. This cannot be undone.
                </p>
                <p className="mt-2">
                  Your past orders and returns are kept without your name, phone or street address, because tax law requires us to keep those records. Your reviews stay, shown as
                  Anonymous. You can delete once your orders and returns are finished.
                </p>
              </div>
              <DeleteAccountButton />
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
