import Link from "next/link";
import { BadgeCheck, Bell, Building2, CalendarOff, Landmark, MapPin, ReceiptText, Undo2, Users } from "lucide-react";
import { AddPickup, ChangeBank, HolidayMode, NotificationMatrix, ReturnAddressForm, StoreProfileForm, TaxPreferences, UsersTable } from "@/components/seller/settings/settings-client";
import { InfoGrid, Mono } from "@/components/seller/primitives";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TabLinks } from "@/components/ui/tabs";
import { BANK_ACCOUNT, businessProfile, gstRegistrations, notificationPrefs, pickupAddresses, returnAddress, SELLER, SELLER_ROLES, sellerLines, subUsers } from "@/lib/mock/seller-extra";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Settings" };

const SECTIONS = [
  { key: "business", label: "Business information", icon: Building2 },
  { key: "tax", label: "Tax details", icon: ReceiptText },
  { key: "bank", label: "Bank account", icon: Landmark },
  { key: "pickup", label: "Pickup addresses", icon: MapPin },
  { key: "users", label: "Users and permissions", icon: Users },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "holiday", label: "Holiday mode", icon: CalendarOff },
  { key: "returns", label: "Return address", icon: Undo2 },
] as const;

export default async function SettingsPage(props: PageProps<"/seller/settings">) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = SECTIONS.find((s) => s.key === raw)?.key ?? "business";
  const openOrders = sellerLines.filter((l) => ["new", "to_pack", "ready"].includes(l.stage) && l.channel === "ship").length;

  return (
    <>
      <PageHeader title="Settings" description="Business details, tax, bank, pickup locations, team access and preferences for Apex Retail." />

      <TabLinks className="mb-6 lg:hidden" active={tab} items={SECTIONS.map((s) => ({ key: s.key, label: s.label, href: `?tab=${s.key}` }))} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-24 flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <li key={s.key}>
                <Link
                  href={`?tab=${s.key}`}
                  scroll={false}
                  aria-current={tab === s.key ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-colors",
                    tab === s.key ? "bg-white text-ink-900 shadow-xs ring-1 ring-line" : "text-ink-600 hover:bg-ink-100/70 hover:text-ink-900",
                  )}
                >
                  <s.icon size={16} strokeWidth={1.8} className={tab === s.key ? "text-brand-600" : "text-ink-400"} aria-hidden="true" />
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 max-w-[52rem]">
          {tab === "business" && (
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader title="Legal details" description="From your verified GSTIN and KYC. To change them, open a support case with the new documents." action={<Badge tone="success" icon={BadgeCheck}>KYC verified</Badge>} />
                <div className="p-5">
                  <InfoGrid
                    items={[
                      { label: "Legal name", value: businessProfile.legalName },
                      { label: "Constitution", value: businessProfile.constitution },
                      { label: "CIN", value: <Mono className="text-sm">{businessProfile.cin}</Mono> },
                      { label: "PAN", value: <Mono className="text-sm">{businessProfile.pan}</Mono> },
                      { label: "Registered address", value: businessProfile.registeredAddress },
                      { label: "Selling on BluBuy since", value: formatDate(businessProfile.joinedAt) },
                      { label: "Approved categories", value: businessProfile.categories.join(", ") },
                      { label: "Seller tier", value: `${SELLER.tier}, rating ${SELLER.rating} of 5` },
                    ]}
                  />
                </div>
              </Card>
              <StoreProfileForm
                initial={{
                  displayName: businessProfile.displayName,
                  storeDescription: businessProfile.storeDescription,
                  customerCare: businessProfile.customerCare,
                  supportEmail: businessProfile.supportEmail,
                  grievanceOfficer: businessProfile.grievanceOfficer,
                }}
              />
            </div>
          )}

          {tab === "tax" && (
            <div className="flex flex-col gap-6">
              <Card className="overflow-hidden">
                <CardHeader title="GST registrations" description="One GSTIN per state you ship from. Fulfilment centres you use are added as additional places of business." />
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {gstRegistrations.map((g) => (
                    <li key={g.gstin} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <Mono className="text-sm font-medium text-ink-900">{g.gstin}</Mono>
                          <span className="text-[13px] text-ink-600">{g.state}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {g.type}, {g.address}
                        </p>
                      </div>
                      <Badge size="sm" tone="success" icon={BadgeCheck}>
                        Active on GST portal
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <CardHeader title="PAN and TDS" />
                <div className="p-5">
                  <InfoGrid
                    items={[
                      { label: "PAN", value: <Mono className="text-sm">{SELLER.pan}</Mono> },
                      { label: "Name on PAN", value: SELLER.legalName.toUpperCase() },
                      { label: "TDS u/s 194-O", value: "0.1% of taxable sales, Form 16A every quarter" },
                      { label: "TCS under GST", value: "0.5% of taxable sales, reported in GSTR-8 monthly" },
                    ]}
                  />
                </div>
              </Card>
              <TaxPreferences />
            </div>
          )}

          {tab === "bank" && (
            <Card>
              <CardHeader title="Payout bank account" action={<Badge tone="success" icon={BadgeCheck}>Verified</Badge>} />
              <div className="p-5">
                <div className="flex items-center gap-4 rounded-xl border border-line p-4">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
                    <Landmark size={20} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">
                      {BANK_ACCOUNT.bank} <Mono className="text-ink-600">XXXX XXXX {BANK_ACCOUNT.last4}</Mono>
                    </p>
                    <p className="text-xs text-ink-500">
                      {BANK_ACCOUNT.type}, {BANK_ACCOUNT.branch}, IFSC <span className="font-mono">{BANK_ACCOUNT.ifsc}</span>
                    </p>
                  </div>
                </div>
                <InfoGrid
                  className="mt-5"
                  items={[
                    { label: "Account holder", value: BANK_ACCOUNT.holder },
                    { label: "Verification", value: `${BANK_ACCOUNT.method}, ${formatDate(BANK_ACCOUNT.verifiedOn)}` },
                    { label: "Payout runs", value: "Monday, Wednesday and Friday" },
                    { label: "Who can change it", value: "Owner only, with OTP" },
                  ]}
                />
                <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-ink-500">Changing the account re-runs penny drop verification and holds payouts for 48 hours.</p>
                  <ChangeBank />
                </div>
              </div>
            </Card>
          )}

          {tab === "pickup" && (
            <div className="flex flex-col gap-4">
              {pickupAddresses.map((a) => (
                <Card key={a.id}>
                  <div className="flex flex-col gap-4 p-5 sm:flex-row">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <MapPin size={19} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink-900">{a.label}</p>
                        {a.isDefault && <Badge size="sm" tone="brand">Default</Badge>}
                        {a.verified && <Badge size="sm" tone="success">Pickup verified</Badge>}
                      </div>
                      <p className="mt-1 text-[13px] text-ink-700">
                        {a.line}, {a.city}, {a.state} <span className="font-mono">{a.pincode}</span>
                      </p>
                      <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
                        <div>
                          <dt className="text-xs text-ink-500">Pickup slot</dt>
                          <dd className="text-ink-900">{a.slot}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-ink-500">Contact</dt>
                          <dd className="text-ink-900">{a.contact}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-ink-500">Handling time</dt>
                          <dd className="text-ink-900">{a.handling}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </Card>
              ))}
              <div>
                <AddPickup />
              </div>
            </div>
          )}

          {tab === "users" && <UsersTable users={subUsers} roles={SELLER_ROLES} />}
          {tab === "notifications" && <NotificationMatrix prefs={notificationPrefs} />}
          {tab === "holiday" && <HolidayMode openOrders={openOrders} />}
          {tab === "returns" && <ReturnAddressForm initial={returnAddress} />}
        </div>
      </div>
    </>
  );
}
