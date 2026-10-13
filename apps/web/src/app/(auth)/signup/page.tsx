import { SignupForm } from "@/components/store/auth-forms";

export const metadata = { title: "Create an account" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const sp = await props.searchParams;
  const raw = typeof sp.next === "string" ? sp.next : "/";
  // only allow same-site paths as the destination after sign up
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  return <SignupForm next={next} />;
}
