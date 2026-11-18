"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, CircleCheck, Copy, KeyRound, Mail, MoreHorizontal, Pencil, RefreshCw, Trash2, UserPlus, Users } from "lucide-react";
import { addStaff, removeStaff, resendInvite, setStaffEnabled, setStaffRoles, type StaffRoles } from "@/app/actions/admin-staff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Radio } from "@/components/ui/input";
import { MenuItem, Modal, Popover, useToast } from "@/components/ui/interactive";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { StaffMember } from "@/lib/api/admin-system";
import { STAFF_ROLE_HINT, STAFF_ROLE_LABEL } from "@/lib/api/staff";
import { formatDate, formatDateTime } from "@/lib/utils";

const ROLES = Object.keys(STAFF_ROLE_LABEL) as StaffRoles;
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** 14 characters without look-alikes (no 0/O, 1/l/I), easy to read out or type from a note. */
function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Something to pass on by hand: an invite link (when no email went out) or a temporary password. */
type Handover = { title: string; description: string; label: string; value: string };

function CopyField({ id, label, value }: { id: string; label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex gap-2">
        <Input id={id} readOnly value={value} onFocus={(e) => e.currentTarget.select()} className="font-mono text-[13px]" />
        <Button
          variant="secondary"
          icon={Copy}
          onClick={async () => {
            await navigator.clipboard.writeText(value).catch(() => undefined);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </Field>
  );
}

function RolePicker({ value, onChange, lockSuper }: { value: string[]; onChange: (roles: string[]) => void; lockSuper?: boolean }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-[13px] font-medium text-ink-800">Roles</legend>
      {ROLES.map((r) => (
        <Checkbox
          key={r}
          label={STAFF_ROLE_LABEL[r]}
          description={r === "SUPER_ADMIN" && lockSuper ? "You cannot take this role from yourself" : STAFF_ROLE_HINT[r]}
          checked={value.includes(r)}
          disabled={r === "SUPER_ADMIN" && lockSuper}
          onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))}
        />
      ))}
    </fieldset>
  );
}

function AddStaffButton({ onHandover, toast }: { onHandover: (h: Handover) => void; toast: (m: string) => void }) {
  const router = useRouter();
  const blank = { name: "", email: "", roles: [] as string[], mode: "invite" as "invite" | "password", tempPassword: "" };
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = "Enter their full name";
    if (!validEmail(f.email)) e.email = "Enter a valid email address";
    if (!f.roles.length) e.roles = "Pick at least one role";
    if (f.mode === "password" && f.tempPassword.length < 8) e.tempPassword = "Use at least 8 characters";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const base = { name: f.name.trim(), email: f.email.trim(), roles: f.roles as StaffRoles };
    const r = await addStaff(f.mode === "invite" ? { ...base, mode: "invite" } : { ...base, mode: "password", tempPassword: f.tempPassword });
    setBusy(false);
    if (!r.ok && r.code === "INVITE_NOT_SENT") {
      // the staff member is saved; the list shows the invite as not sent, with Resend invite
      setOpen(false);
      router.refresh();
      return toast(r.error);
    }
    if (!r.ok) return setErrors({ ...(r.fields ?? {}), form: r.error });
    setOpen(false);
    router.refresh();
    const who = base.name;
    if (f.mode === "password") {
      onHandover({ title: `${who} is added`, description: "Give them this temporary password in person or over a call, not by email. They choose their own when they first sign in.", label: "Temporary password", value: f.tempPassword });
    } else if (r.data?.inviteLink) {
      onHandover({ title: `${who} is added`, description: "Email is not set up here, so no invite went out. Send them this link yourself. It works once and expires in 72 hours.", label: "Invite link", value: r.data.inviteLink });
    } else {
      toast(`Invite sent to ${base.email}`);
    }
  };

  return (
    <>
      <Button
        icon={UserPlus}
        onClick={() => {
          setF(blank);
          setErrors({});
          setOpen(true);
        }}
      >
        Add staff
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a staff member"
        description="An existing shopper account with this email keeps its orders and gets the roles."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Adding" : f.mode === "invite" ? "Add and send invite" : "Add staff member"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="st-name" error={errors.name}>
              <Input id="st-name" value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} aria-invalid={!!errors.name} />
            </Field>
            <Field label="Email" htmlFor="st-email" error={errors.email}>
              <Input id="st-email" type="email" value={f.email} maxLength={120} onChange={(e) => setF({ ...f, email: e.target.value })} aria-invalid={!!errors.email} />
            </Field>
          </div>
          <div>
            <RolePicker value={f.roles} onChange={(roles) => setF({ ...f, roles })} />
            {errors.roles && <p className="mt-2 text-xs text-danger-600">{errors.roles}</p>}
          </div>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-[13px] font-medium text-ink-800">How they sign in</legend>
            <Radio name="st-mode" checked={f.mode === "invite"} onChange={() => setF({ ...f, mode: "invite" })} label="Email an invite" description="They get a link to choose their own password. It expires in 72 hours." />
            <Radio
              name="st-mode"
              checked={f.mode === "password"}
              onChange={() => setF({ ...f, mode: "password", tempPassword: f.tempPassword || generatePassword() })}
              label="Set a temporary password"
              description="You hand it over yourself. They must change it before they can work."
            />
          </fieldset>
          {f.mode === "password" && (
            <Field label="Temporary password" htmlFor="st-temp" error={errors.tempPassword} hint="At least 8 characters">
              <div className="flex gap-2">
                <Input id="st-temp" value={f.tempPassword} maxLength={128} onChange={(e) => setF({ ...f, tempPassword: e.target.value })} className="font-mono text-[13px]" aria-invalid={!!errors.tempPassword} />
                <Button variant="secondary" icon={RefreshCw} onClick={() => setF({ ...f, tempPassword: generatePassword() })}>
                  Generate
                </Button>
              </div>
            </Field>
          )}
          {errors.form && <p className="text-xs text-danger-600">{errors.form}</p>}
        </div>
      </Modal>
    </>
  );
}

type Dialog = { kind: "roles" | "disable" | "enable" | "remove"; member: StaffMember } | null;

/** The staff table with add, edit roles, disable or enable, remove and resend invite. For Super Admins. */
export function StaffManager({ members, meId }: { members: StaffMember[]; meId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [handover, setHandover] = useState<Handover | null>(null);

  const open = (kind: NonNullable<Dialog>["kind"], member: StaffMember) => {
    setDialog({ kind, member });
    setRoles(member.roles);
    setError("");
  };
  const close = () => setDialog(null);
  const name = (m: StaffMember) => m.name ?? m.email;

  const confirm = async () => {
    if (!dialog) return;
    const { kind, member } = dialog;
    if (kind === "roles" && !roles.length) return setError("Pick at least one role");
    setBusy(true);
    const r =
      kind === "roles"
        ? await setStaffRoles(member.id, roles as StaffRoles)
        : kind === "remove"
          ? await removeStaff(member.id)
          : await setStaffEnabled(member.id, kind === "enable");
    setBusy(false);
    if (!r.ok) return setError(r.error);
    close();
    router.refresh();
    toast.show(
      kind === "roles" ? `Roles saved for ${name(member)}` : kind === "remove" ? `${name(member)} is no longer staff` : kind === "enable" ? `${name(member)} can sign in again` : `${name(member)} is disabled and signed out`,
    );
  };

  const resend = async (m: StaffMember) => {
    const r = await resendInvite(m.id);
    if (!r.ok) return toast.show(r.error);
    router.refresh();
    if (r.data?.inviteLink) {
      setHandover({ title: "New invite link", description: `Email is not set up here, so nothing went out. Send ${name(m)} this link yourself. The earlier link no longer works.`, label: "Invite link", value: r.data.inviteLink });
    } else toast.show(`New invite sent to ${m.email}. The earlier link no longer works`);
  };

  const copy = {
    disable: { title: "Disable", body: "They are signed out everywhere and cannot sign in until you enable them again. Their roles are kept.", button: "Disable" },
    enable: { title: "Enable", body: "They can sign in again with their roles.", button: "Enable" },
    remove: { title: "Remove", body: "Every staff role is taken away and they are signed out. Their account stays, as a shopper, so the audit log still names them.", button: "Remove from staff" },
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <AddStaffButton onHandover={setHandover} toast={toast.show} />
      </div>
      <Card>
        {members.length === 0 ? (
          <EmptyState icon={Users} title="No staff yet" description="Add the people who run the store." />
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Staff member</TH>
                  <TH>Roles</TH>
                  <TH>Status</TH>
                  <TH className="hidden lg:table-cell">Last active</TH>
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {members.map((m) => {
                  const me = m.id === meId;
                  return (
                    <TR key={m.id}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <Avatar name={name(m)} size="sm" />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium text-ink-900">
                              {m.name ?? "No name"}
                              {me && <span className="ml-1.5 text-xs font-normal text-ink-500">(you)</span>}
                            </span>
                            <span className="block truncate text-xs text-ink-500">{m.email}</span>
                          </span>
                        </div>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1.5">
                          {m.roles.map((r) => (
                            <Badge key={r} size="sm" tone={r === "SUPER_ADMIN" ? "brand" : "neutral"}>
                              {STAFF_ROLE_LABEL[r] ?? r}
                            </Badge>
                          ))}
                        </div>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge size="sm" dot tone={m.status === "ACTIVE" ? "success" : "danger"}>
                            {m.status === "ACTIVE" ? "Active" : "Disabled"}
                          </Badge>
                          {m.invitePending && (
                            <Badge size="sm" tone="info" icon={Mail}>
                              Invite sent
                            </Badge>
                          )}
                          {m.inviteNotSent && (
                            <Badge size="sm" tone="danger" icon={Mail}>
                              Invite not sent, resend
                            </Badge>
                          )}
                          {m.mustChangePassword && (
                            <Badge size="sm" tone="warning" icon={KeyRound}>
                              Must change password
                            </Badge>
                          )}
                        </div>
                      </TD>
                      <TD className="hidden text-[13px] text-ink-500 lg:table-cell">{m.lastActiveAt ? formatDateTime(m.lastActiveAt) : `Added ${formatDate(m.createdAt)}`}</TD>
                      <TD align="right">
                        <Popover
                          trigger={() => (
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name(m)}`}>
                              <MoreHorizontal size={16} />
                            </Button>
                          )}
                        >
                          {(closeMenu) => (
                            <>
                              <MenuItem icon={<Pencil size={15} aria-hidden="true" />} onClick={() => (closeMenu(), open("roles", m))}>
                                Edit roles
                              </MenuItem>
                              {m.status === "ACTIVE" && (
                                <MenuItem icon={<Mail size={15} aria-hidden="true" />} onClick={() => (closeMenu(), resend(m))}>
                                  {m.invitePending || m.inviteNotSent ? "Resend invite" : "Send a set password link"}
                                </MenuItem>
                              )}
                              {!me &&
                                (m.status === "ACTIVE" ? (
                                  <MenuItem icon={<Ban size={15} aria-hidden="true" />} onClick={() => (closeMenu(), open("disable", m))}>
                                    Disable
                                  </MenuItem>
                                ) : (
                                  <MenuItem icon={<CircleCheck size={15} aria-hidden="true" />} onClick={() => (closeMenu(), open("enable", m))}>
                                    Enable
                                  </MenuItem>
                                ))}
                              {!me && (
                                <MenuItem danger icon={<Trash2 size={15} aria-hidden="true" />} onClick={() => (closeMenu(), open("remove", m))}>
                                  Remove from staff
                                </MenuItem>
                              )}
                            </>
                          )}
                        </Popover>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Modal
        open={!!dialog}
        onClose={close}
        size={dialog?.kind === "roles" ? "md" : "sm"}
        title={dialog ? (dialog.kind === "roles" ? `Roles for ${name(dialog.member)}` : `${copy[dialog.kind].title} ${name(dialog.member)}?`) : ""}
        description={dialog ? (dialog.kind === "roles" ? "Taking a role away signs them out, so it stops working at once." : copy[dialog.kind].body) : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button variant={dialog?.kind === "remove" || dialog?.kind === "disable" ? "danger" : "primary"} onClick={confirm} disabled={busy}>
              {busy ? "Saving" : dialog ? (dialog.kind === "roles" ? "Save roles" : copy[dialog.kind].button) : ""}
            </Button>
          </>
        }
      >
        {dialog?.kind === "roles" && <RolePicker value={roles} onChange={setRoles} lockSuper={dialog.member.id === meId && dialog.member.roles.includes("SUPER_ADMIN")} />}
        {error && <p className="mt-3 text-xs text-danger-600">{error}</p>}
      </Modal>

      <Modal
        open={!!handover}
        onClose={() => setHandover(null)}
        title={handover?.title ?? ""}
        description={handover?.description}
        footer={<Button onClick={() => setHandover(null)}>Done</Button>}
      >
        {handover && <CopyField id="st-handover" label={handover.label} value={handover.value} />}
      </Modal>
      {toast.node}
    </>
  );
}
