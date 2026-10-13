import { ForgotPasswordForm } from "@/components/store/auth-forms";

export const metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage(props: PageProps<"/forgot-password">) {
  const sp = await props.searchParams;
  const raw = typeof sp.next === "string" ? sp.next : "/";
  // only allow same-site paths as the destination after the reset
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const email = typeof sp.email === "string" ? sp.email : "";
  return <ForgotPasswordForm next={next} initialEmail={email} audience={sp.as === "staff" ? "staff" : "shopper"} />;
}
