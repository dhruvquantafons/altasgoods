import { RegisterWizard } from "@/components/seller/register/register-wizard";
import { CONSTITUTIONS, INDIAN_STATES, ONBOARDING_CATEGORIES } from "@/lib/mock/seller-extra";

export const metadata = { title: "Register" };

export default async function RegisterPage(props: PageProps<"/seller/register">) {
  const sp = await props.searchParams;
  const raw = Number(Array.isArray(sp.step) ? sp.step[0] : sp.step);
  // ?step=N (1 to 10) deep-links to a step with a filled-in example, useful for reviews
  const initialStep = Number.isInteger(raw) && raw >= 1 && raw <= 10 ? raw - 1 : 0;
  return <RegisterWizard initialStep={initialStep} constitutions={CONSTITUTIONS} states={INDIAN_STATES} categories={ONBOARDING_CATEGORIES} />;
}
