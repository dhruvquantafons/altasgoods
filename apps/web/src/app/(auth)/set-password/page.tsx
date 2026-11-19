import { SetPasswordForm } from "@/components/store/auth-forms";

export const metadata = { title: "Choose your password", robots: { index: false }, referrer: "no-referrer" as const };

/** The link in a staff invite email: choose a password, then sign in. */
export default async function SetPasswordPage(props: PageProps<"/set-password">) {
  const sp = await props.searchParams;
  return <SetPasswordForm token={typeof sp.token === "string" ? sp.token : ""} />;
}
