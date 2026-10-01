import { AddressBook } from "@/components/account/address-book";
import { PageHeader } from "@/components/ui/page-header";
import { customerAddresses } from "@/lib/mock";
import { addressExtras, INDIAN_STATES, PINCODES } from "@/lib/mock/account-extra";

export const metadata = { title: "Addresses" };

export default function AddressesPage() {
  const initial = customerAddresses.map((a) => ({
    ...a,
    instructions: addressExtras[a.id]?.instructions,
    weekendDelivery: addressExtras[a.id]?.weekendDelivery ?? true,
  }));
  return (
    <>
      <PageHeader title="Addresses" description="Where we deliver your orders and pick up returns. Your default address is used at checkout." />
      <AddressBook initial={initial} pincodes={PINCODES} states={INDIAN_STATES} />
    </>
  );
}
