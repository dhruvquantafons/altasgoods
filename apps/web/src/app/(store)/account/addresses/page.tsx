import { AddressBook, type BookAddress } from "@/components/account/address-book";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api/server";
import { INDIAN_STATES, PINCODES } from "@/lib/mock/account-extra";

export const metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const r = await (await api()).GET("/v1/me/addresses").catch(() => null);
  const initial: BookAddress[] = (r?.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? undefined,
    landmark: a.landmark ?? undefined,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    type: a.type.toLowerCase() as BookAddress["type"],
    isDefault: a.isDefault,
  }));
  return (
    <>
      <PageHeader title="Addresses" description="Where we deliver your orders and pick up returns. Your default address is used at checkout." />
      {/* remounts when the saved addresses change, so a default the API moved shows straight away */}
      <AddressBook key={initial.map((a) => `${a.id}:${a.isDefault}`).join()} initial={initial} pincodes={PINCODES} states={INDIAN_STATES} />
    </>
  );
}
