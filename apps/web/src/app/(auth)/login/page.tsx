import { LoginForm } from "@/components/store/auth-forms";
import { currentUser } from "@/lib/api/server";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const raw = typeof sp.next === "string" ? sp.next : "/";
  // only allow same-site paths as the post-login destination
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const audience = sp.as === "staff" ? "staff" : "shopper";
  const user = await currentUser();
  // someone already signed in who lacks access here can switch to another number
  const lacksAccess = !!user && audience === "staff" && !user.staffRoles.length;
  return <LoginForm next={next} audience={audience} denied={sp.denied === "1"} signedInAs={lacksAccess ? (user!.name ?? user!.phone) : undefined} />;
}
