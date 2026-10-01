import { redirect } from "next/navigation";
import { RegisterWizard } from "@/components/seller/register/register-wizard";
import { api, currentUser } from "@/lib/api/server";
import type { Constitution } from "@/lib/api/types";
import { INDIAN_STATES, ONBOARDING_CATEGORIES } from "@/lib/mock/seller-extra";

export const metadata = { title: "Register" };

const CONSTITUTIONS: Constitution[] = ["PROPRIETORSHIP", "PARTNERSHIP", "LLP", "PRIVATE_LIMITED", "PUBLIC_LIMITED"];

export default async function RegisterPage() {
  const user = await currentUser();
  if (user?.sellers.length) redirect("/seller");
  const r = user ? await (await api()).GET("/v1/me/seller-application") : null;
  const application = r?.data ?? null;
  // submitted or decided applications are followed on the status page
  if (application && !["KYC_IN_PROGRESS", "ACTION_REQUIRED"].includes(application.status)) redirect("/seller/register/status");

  return (
    <RegisterWizard
      key={user?.id ?? "signed-out"}
      user={user ? { phone: user.phone, name: user.name, email: user.email, emailVerified: user.emailVerified } : null}
      application={application}
      constitutions={CONSTITUTIONS}
      states={INDIAN_STATES}
      categories={ONBOARDING_CATEGORIES}
      sandbox={process.env.NODE_ENV !== "production"}
    />
  );
}
