import { AddressBook } from "@/components/account/address-book";
import { toBookAddress } from "@/lib/address-book";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api/server";
import { INDIAN_STATES, PINCODES } from "@/lib/mock/account-extra";

export const metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const r = await (await api()).GET("/v1/me/addresses").catch(() => null);
  const initial = (r?.data ?? []).map(toBookAddress);
  return (
    <>
      <PageHeader title="Addresses" description="Where we deliver your orders and pick up returns. Your default address is used at checkout." />
      <AddressBook initial={initial} pincodes={PINCODES} states={INDIAN_STATES} />
    </>
  );
}
