"use client";

import { useState, type ReactNode } from "react";
import { BadgeCheck, CalendarOff, Landmark, MapPin, Plus, ShieldAlert, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, Switch, useToast } from "@/components/ui/interactive";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, timeAgo } from "@/lib/utils";

/* -------------------------------- Save bar ------------------------------- */

function SaveBar({ show, onDiscard, onSave, label = "You have unsaved changes" }: { show: boolean; onDiscard: () => void; onSave: () => void; label?: string }) {
  if (!show) return null;
  return (
    <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/95 px-4 py-3 shadow-pop backdrop-blur-sm animate-fade-in">
      <p className="text-[13px] text-ink-700">{label}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          Discard
        </Button>
        <Button size="sm" onClick={onSave}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

function useDraft<T>(initial: T) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  return { draft, setDraft, dirty: JSON.stringify(draft) !== JSON.stringify(saved), save: () => setSaved(draft), discard: () => setDraft(saved) };
}

/* ------------------------------ Store profile ---------------------------- */

export function StoreProfileForm({ initial }: { initial: { displayName: string; storeDescription: string; customerCare: string; supportEmail: string; grievanceOfficer: string } }) {
  const { draft, setDraft, dirty, save, discard } = useDraft(initial);
  const toast = useToast();
  return (
    <>
      <Card>
        <CardHeader title="Store profile" description="Shown to customers on your store page and on every product you sell" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Display name" htmlFor="sp-name" hint={`Shown as "Sold by ${draft.displayName}"`}>
            <Input id="sp-name" value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
          </Field>
          <Field label="Customer care number" htmlFor="sp-care">
            <Input id="sp-care" value={draft.customerCare} onChange={(e) => setDraft({ ...draft, customerCare: e.target.value })} />
          </Field>
          <Field label="Store description" htmlFor="sp-desc" className="sm:col-span-2" hint={`${draft.storeDescription.length} of 500 characters`}>
            <Textarea id="sp-desc" maxLength={500} value={draft.storeDescription} onChange={(e) => setDraft({ ...draft, storeDescription: e.target.value })} />
          </Field>
          <Field label="Support email" htmlFor="sp-email" hint="Used by AltasGoods only; never shown to customers">
            <Input id="sp-email" type="email" value={draft.supportEmail} onChange={(e) => setDraft({ ...draft, supportEmail: e.target.value })} />
          </Field>
          <Field label="Grievance officer" htmlFor="sp-grievance" hint="Required under the Consumer Protection (E-Commerce) Rules">
            <Input id="sp-grievance" value={draft.grievanceOfficer} onChange={(e) => setDraft({ ...draft, grievanceOfficer: e.target.value })} />
          </Field>
        </div>
      </Card>
      <SaveBar
        show={dirty}
        onDiscard={discard}
        onSave={() => {
          save();
          toast.show("Store profile saved.");
        }}
      />
      {toast.node}
    </>
  );
}

/* --------------------------------- Tax ---------------------------------- */

export function TaxPreferences() {
  const { draft, setDraft, dirty, save, discard } = useDraft({ einvoice: true, hsn: "8518", tdsExempt: false });
  const toast = useToast();
  return (
    <>
      <Card>
        <CardHeader title="Invoicing preferences" />
        <div className="flex flex-col gap-5 p-5">
          <Switch
            checked={draft.einvoice}
            onChange={(v) => setDraft({ ...draft, einvoice: v })}
            label="Generate e-invoices (IRN)"
            description="Required when your aggregate turnover is above ₹5 crore. AltasGoods registers each invoice with the IRP and prints the QR code."
          />
          <Field label="Default HSN code" htmlFor="tx-hsn" hint="Used when a listing has no HSN; set the correct HSN on every listing">
            <Input id="tx-hsn" value={draft.hsn} onChange={(e) => setDraft({ ...draft, hsn: e.target.value.replace(/\D/g, "").slice(0, 8) })} className="sm:max-w-xs" />
          </Field>
          <Switch checked={draft.tdsExempt} onChange={(v) => setDraft({ ...draft, tdsExempt: v })} label="I have a TDS 194-O exemption" description="Upload the declaration in a support case. TDS keeps being deducted until it is verified." />
        </div>
      </Card>
      <SaveBar
        show={dirty}
        onDiscard={discard}
        onSave={() => {
          save();
          toast.show("Invoicing preferences saved.");
        }}
      />
      {toast.node}
    </>
  );
}

/* --------------------------------- Bank --------------------------------- */

export function ChangeBank() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <>
      <Button variant="secondary" icon={Landmark} onClick={() => setOpen(true)}>
        Change bank account
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Change bank account"
        description="Only the account owner can do this. Payouts pause for 48 hours while the new account is verified."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                toast.show("Verification started. We will credit ₹1 and match the account name; payouts resume after 48 hours.");
              }}
            >
              Verify with ₹1
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 rounded-xl border border-warning-100 bg-warning-50/80 px-4 py-3 text-[13px] text-ink-700">
            <ShieldAlert size={17} className="mt-0.5 shrink-0 text-warning-700" aria-hidden="true" />
            We will send an OTP to the owner&apos;s mobile and email. The account must be in the legal name Apex Retail Private Limited.
          </div>
          <Field label="Account number" htmlFor="bk-acc">
            <Input id="bk-acc" inputMode="numeric" type="password" autoComplete="off" />
          </Field>
          <Field label="Confirm account number" htmlFor="bk-acc2">
            <Input id="bk-acc2" inputMode="numeric" autoComplete="off" />
          </Field>
          <Field label="IFSC" htmlFor="bk-ifsc" hint="11 characters, for example HDFC0000240">
            <Input id="bk-ifsc" className="font-mono uppercase" maxLength={11} />
          </Field>
        </div>
      </Modal>
      {toast.node}
    </>
  );
}

/* --------------------------------- Pickup -------------------------------- */

export function AddPickup() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <>
      <Button variant="secondary" icon={Plus} onClick={() => setOpen(true)}>
        Add pickup address
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Add a pickup address"
        description="A new location in another state needs a GSTIN for that state, or an additional place of business on your GSTIN."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              icon={MapPin}
              onClick={() => {
                setOpen(false);
                toast.show("Address added. AltasGoods Logistics runs a pickup test within 2 business days before it goes live.");
              }}
            >
              Add address
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Label" htmlFor="pk-label" className="sm:col-span-2">
            <Input id="pk-label" placeholder="Pune warehouse" />
          </Field>
          <Field label="Address" htmlFor="pk-line" className="sm:col-span-2">
            <Input id="pk-line" placeholder="Building, street, area" />
          </Field>
          <Field label="Pincode" htmlFor="pk-pin">
            <Input id="pk-pin" inputMode="numeric" maxLength={6} />
          </Field>
          <Field label="Pickup slot" htmlFor="pk-slot">
            <Select id="pk-slot" defaultValue="4">
              <option value="11">11:00 AM to 1:00 PM</option>
              <option value="2">2:00 to 4:00 PM</option>
              <option value="4">4:00 to 6:00 PM</option>
            </Select>
          </Field>
          <Field label="Contact name" htmlFor="pk-contact">
            <Input id="pk-contact" />
          </Field>
          <Field label="Contact mobile" htmlFor="pk-mobile">
            <Input id="pk-mobile" inputMode="tel" placeholder="+91 98765 43210" />
          </Field>
        </div>
      </Modal>
      {toast.node}
    </>
  );
}

/* ---------------------------------- Users -------------------------------- */

export interface SubUser {
  id: string;
  name: string;
  email: string;
  role: string;
  lastActive: string;
  twoFA: boolean;
  status: "active" | "invited";
}

export function UsersTable({ users, roles }: { users: SubUser[]; roles: { key: string; description: string }[] }) {
  const [list, setList] = useState(users);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("Operations");
  const [email, setEmail] = useState("");
  const toast = useToast();
  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader
          title="Users and permissions"
          description="Give your team their own login. Every action is recorded against the person who took it."
          action={
            <Button size="sm" icon={UserPlus} onClick={() => setOpen(true)}>
              Invite user
            </Button>
          }
        />
        <TableContainer className="mt-3">
          <Table className="min-w-[720px]">
            <THead>
              <TR className="hover:bg-transparent">
                <TH>User</TH>
                <TH>Role</TH>
                <TH>Two-step login</TH>
                <TH>Last active</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {list.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} size="sm" />
                      <div>
                        <p className="text-[13px] font-medium text-ink-900">{u.name}</p>
                        <p className="text-xs text-ink-500">{u.email}</p>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    {u.role === "Owner" ? (
                      <span className="text-[13px] font-medium text-ink-900">Owner</span>
                    ) : (
                      <Select
                        selectSize="sm"
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        onChange={(e) => {
                          setList(list.map((x) => (x.id === u.id ? { ...x, role: e.target.value } : x)));
                          toast.show(`${u.name} is now ${e.target.value}.`);
                        }}
                        className="w-40"
                      >
                        {roles
                          .filter((r) => r.key !== "Owner")
                          .map((r) => (
                            <option key={r.key}>{r.key}</option>
                          ))}
                      </Select>
                    )}
                  </TD>
                  <TD>{u.twoFA ? <Badge size="sm" tone="success" icon={BadgeCheck}>On</Badge> : <Badge size="sm" tone="warning">Off</Badge>}</TD>
                  <TD className="text-[13px] text-ink-600">{u.status === "invited" ? "Never" : timeAgo(u.lastActive)}</TD>
                  <TD>
                    <Badge size="sm" tone={u.status === "active" ? "success" : "info"} dot>
                      {u.status === "active" ? "Active" : "Invited"}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      </Card>
      <Card className="mt-6">
        <CardHeader title="Roles" description="What each role can do" />
        <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
          {roles.map((r) => (
            <div key={r.key}>
              <dt className="text-[13px] font-medium text-ink-900">{r.key}</dt>
              <dd className="mt-0.5 text-[13px] text-ink-600">{r.description}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invite a user"
        description="They get an email to set a password and turn on two-step login."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(email)}
              onClick={() => {
                setList([...list, { id: `u-${list.length + 1}`, name: email.split("@")[0]!, email, role, lastActive: "", twoFA: false, status: "invited" }]);
                setOpen(false);
                setEmail("");
                toast.show(`Invitation sent to ${email}.`);
              }}
            >
              Send invite
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Work email" htmlFor="iv-email">
            <Input id="iv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@apexretail.in" />
          </Field>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink-700">Role</legend>
            <div className="flex flex-col gap-2">
              {roles
                .filter((r) => r.key !== "Owner")
                .map((r) => (
                  <label key={r.key} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5", role === r.key ? "border-brand-300 bg-brand-50/50" : "border-line hover:bg-ink-50")}>
                    <input type="radio" name="iv-role" checked={role === r.key} onChange={() => setRole(r.key)} className="mt-1 accent-brand-600" />
                    <span>
                      <span className="block text-[13px] font-medium text-ink-900">{r.key}</span>
                      <span className="block text-xs text-ink-500">{r.description}</span>
                    </span>
                  </label>
                ))}
            </div>
          </fieldset>
        </div>
      </Modal>
      {toast.node}
    </>
  );
}

/* ------------------------------ Notifications ---------------------------- */

const CHANNELS = ["email", "sms", "push", "whatsapp"] as const;
const CHANNEL_NAME: Record<(typeof CHANNELS)[number], string> = { email: "Email", sms: "SMS", push: "App", whatsapp: "WhatsApp" };

export function NotificationMatrix({ prefs }: { prefs: { group: string; event: string; email: boolean; sms: boolean; push: boolean; whatsapp: boolean }[] }) {
  const { draft, setDraft, dirty, save, discard } = useDraft(prefs);
  const toast = useToast();
  const groups = [...new Set(draft.map((p) => p.group))];
  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader title="Notification preferences" description="Choose where each alert reaches you. Payout failures and account actions always go by email." />
        <TableContainer className="mt-3">
          <Table className="min-w-[620px]">
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Event</TH>
                {CHANNELS.map((c) => (
                  <TH key={c} align="center">
                    {CHANNEL_NAME[c]}
                  </TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {groups.map((g) => (
                <GroupRows key={g} group={g}>
                  {draft
                    .map((p, i) => ({ p, i }))
                    .filter(({ p }) => p.group === g)
                    .map(({ p, i }) => (
                      <TR key={p.event}>
                        <TD className="text-[13px] text-ink-800">{p.event}</TD>
                        {CHANNELS.map((c) => (
                          <TD key={c} align="center">
                            <input
                              type="checkbox"
                              className="size-4 accent-brand-600"
                              aria-label={`${p.event} by ${CHANNEL_NAME[c]}`}
                              checked={p[c]}
                              onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, [c]: e.target.checked } : x)))}
                            />
                          </TD>
                        ))}
                      </TR>
                    ))}
                </GroupRows>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      </Card>
      <SaveBar
        show={dirty}
        onDiscard={discard}
        onSave={() => {
          save();
          toast.show("Notification preferences saved.");
        }}
      />
      {toast.node}
    </>
  );
}

function GroupRows({ group, children }: { group: string; children: ReactNode }) {
  return (
    <>
      <TR className="bg-ink-50/50 hover:bg-ink-50/50">
        <TD colSpan={5} className="py-2 text-xs font-medium text-ink-500">
          {group}
        </TD>
      </TR>
      {children}
    </>
  );
}

/* ------------------------------ Holiday mode ----------------------------- */

export function HolidayMode({ openOrders }: { openOrders: number }) {
  const { draft, setDraft, dirty, save, discard } = useDraft({ on: false, from: "2026-10-20", to: "2026-10-22", fulfilledActive: true });
  const toast = useToast();
  return (
    <>
      <Card>
        <CardHeader title="Holiday mode" description="Pause your seller-shipped listings while you are away. Your account and Seller Health are not affected." />
        <div className="flex flex-col gap-5 p-5">
          <Switch checked={draft.on} onChange={(v) => setDraft({ ...draft, on: v })} label="Turn on holiday mode" description="Listings move to Paused and come back automatically on the end date" />
          <div className={cn("grid gap-4 sm:grid-cols-2", !draft.on && "opacity-50")}>
            <Field label="From" htmlFor="hm-from">
              <Input id="hm-from" type="date" disabled={!draft.on} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
            </Field>
            <Field label="Until" htmlFor="hm-to">
              <Input id="hm-to" type="date" disabled={!draft.on} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
            </Field>
          </div>
          <Switch
            checked={draft.fulfilledActive}
            disabled={!draft.on}
            onChange={(v) => setDraft({ ...draft, fulfilledActive: v })}
            label="Keep AltasGoods Fulfilled listings live"
            description="Fulfilment centres keep shipping your stored inventory while you are away"
          />
          <div className="flex gap-3 rounded-xl bg-ink-50 px-4 py-3 text-[13px] text-ink-700">
            <CalendarOff size={17} className="mt-0.5 shrink-0 text-ink-500" aria-hidden="true" />
            You still need to dispatch the {openOrders} open orders before their dispatch by dates. Holiday mode stops new orders only.
          </div>
        </div>
      </Card>
      <SaveBar
        show={dirty}
        onDiscard={discard}
        onSave={() => {
          save();
          toast.show(draft.on ? "Holiday mode scheduled." : "Holiday mode is off.");
        }}
      />
      {toast.node}
    </>
  );
}

/* ------------------------------ Return address --------------------------- */

export function ReturnAddressForm({ initial }: { initial: { label: string; line: string; contact: string } }) {
  const { draft, setDraft, dirty, save, discard } = useDraft({ ...initial, autoApprove: true });
  const toast = useToast();
  return (
    <>
      <Card>
        <CardHeader title="Return address" description="Where customer returns and RTO packages are delivered" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Label" htmlFor="ra-label">
            <Input id="ra-label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </Field>
          <Field label="Contact" htmlFor="ra-contact">
            <Input id="ra-contact" value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} />
          </Field>
          <Field label="Address" htmlFor="ra-line" className="sm:col-span-2">
            <Textarea id="ra-line" value={draft.line} onChange={(e) => setDraft({ ...draft, line: e.target.value })} className="min-h-16" />
          </Field>
          <div className="sm:col-span-2">
            <Switch
              checked={draft.autoApprove}
              onChange={(v) => setDraft({ ...draft, autoApprove: v })}
              label="Auto-approve out-of-policy returns under ₹500"
              description="Saves you reviewing low-value requests; you can still grade and claim when they come back"
            />
          </div>
        </div>
      </Card>
      <SaveBar
        show={dirty}
        onDiscard={discard}
        onSave={() => {
          save();
          toast.show("Return settings saved.");
        }}
      />
      {toast.node}
    </>
  );
}
