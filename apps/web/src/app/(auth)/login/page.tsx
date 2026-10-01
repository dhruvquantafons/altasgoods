import { LoginForm } from "@/components/store/auth-forms";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const raw = typeof sp.next === "string" ? sp.next : "/";
  // only allow same-site paths as the post-login destination
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  return <LoginForm next={next} />;
}
