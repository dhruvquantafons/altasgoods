"use client";

import { useId, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, Switch, useToast } from "@/components/ui/interactive";

const MONEY_ROLES = ["Finance Manager", "Finance Executive", "Super Admin", "Operations Admin"];

/** Invite a staff member to AltasGoods Control with a role, scope and MFA. */
export function InviteMember({ roles }: { roles: { id: string; name: string; scope: string }[] }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[1]?.id ?? roles[0]!.id);
  const [mfa, setMfa] = useState(true);
  const { show, node } = useToast();
  const role = roles.find((r) => r.id === roleId)!;
  const money = MONEY_ROLES.includes(role.name);
  const emailError = email && !/^[a-z0-9._-]+@blubuy\.in$/i.test(email) ? "Use a blubuy.in work email" : undefined;
  const valid = name.trim().length > 1 && email && !emailError;

  return (
    <>
      <Button icon={UserPlus} size="sm" onClick={() => setOpen(true)}>
        Invite member
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invite a team member"
        description="They get an email to set a password and enrol MFA. Access starts only after the invite is accepted."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!valid}
              onClick={() => {
                setOpen(false);
                show(`Invite sent to ${email}`);
                setName("");
                setEmail("");
              }}
            >
              Send invite
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required htmlFor={`${id}-n`}>
              <Input id={`${id}-n`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Menon" />
            </Field>
            <Field label="Work email" required htmlFor={`${id}-e`} error={emailError}>
              <Input id={`${id}-e`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@altasgoods.in" aria-invalid={Boolean(emailError)} />
            </Field>
          </div>
          <Field label="Role" htmlFor={`${id}-r`} hint={`Default scope: ${role.scope}`}>
            <Select id={`${id}-r`} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Scope" htmlFor={`${id}-s`} hint="Category managers and moderators can be limited to categories">
            <Select id={`${id}-s`} defaultValue="global">
              <option value="global">All of AltasGoods</option>
              <option value="electronics">Electronics, Mobiles and Appliances</option>
              <option value="fashion">Fashion and Beauty</option>
              <option value="home">Home, Grocery and Books</option>
            </Select>
          </Field>
          <div className="rounded-xl border border-line px-4 py-3">
            <Switch checked={mfa || money} onChange={setMfa} disabled={money} label="Require multi-factor authentication" description={money ? "Always on for roles that can move money or change settings." : "Strongly recommended for every Control user."} />
          </div>
          <Field label="Note to the invitee" htmlFor={`${id}-m`}>
            <Textarea id={`${id}-m`} className="min-h-16" placeholder="Welcome to the catalog team." />
          </Field>
        </div>
      </Modal>
      {node}
    </>
  );
}
