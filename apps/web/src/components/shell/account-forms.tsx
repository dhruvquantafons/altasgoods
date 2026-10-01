"use client";

import { useState, type FormEvent } from "react";
import { Laptop, LogOut, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch, useToast } from "@/components/ui/interactive";

export interface StaffPerson {
  name: string;
  role: string;
  email: string;
  phone: string;
  team: string;
  location: string;
  memberSince: string;
  userId: string;
}

/** Editable profile details. Mock only: saves to local state and confirms. */
export function ProfileForm({ person }: { person: StaffPerson }) {
  const [form, setForm] = useState({ name: person.name, phone: person.phone, location: person.location });
  const [dirty, setDirty] = useState(false);
  const toast = useToast();
  const update = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setDirty(true);
  };
  function save(e: FormEvent) {
    e.preventDefault();
    setDirty(false);
    toast.show("Profile saved");
  }
  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" htmlFor="pf-name">
        <Input id="pf-name" value={form.name} onChange={update("name")} autoComplete="name" />
      </Field>
      <Field label="Work email" htmlFor="pf-email" hint="Managed by your administrator">
        <Input id="pf-email" value={person.email} disabled />
      </Field>
      <Field label="Mobile number" htmlFor="pf-phone" hint="Used for sign in codes">
        <Input id="pf-phone" value={form.phone} onChange={update("phone")} inputMode="tel" autoComplete="tel" />
      </Field>
      <Field label="Work location" htmlFor="pf-loc">
        <Input id="pf-loc" value={form.location} onChange={update("location")} />
      </Field>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" disabled={!dirty}>
          Save changes
        </Button>
        {dirty && (
          <Button
            variant="ghost"
            onClick={() => {
              setForm({ name: person.name, phone: person.phone, location: person.location });
              setDirty(false);
            }}
          >
            Discard
          </Button>
        )}
      </div>
      {toast.node}
    </form>
  );
}

const SESSIONS = [
  { id: "s1", device: "Chrome on macOS", place: "Bengaluru, Karnataka", when: "Active now", current: true, mobile: false },
  { id: "s2", device: "BluBuy app on Android", place: "Bengaluru, Karnataka", when: "2 hours ago", current: false, mobile: true },
  { id: "s3", device: "Edge on Windows", place: "Mumbai, Maharashtra", when: "Yesterday, 6:42 pm", current: false, mobile: false },
];

/** Signed-in devices with per-session and global sign out. */
export function SessionsList() {
  const [sessions, setSessions] = useState(SESSIONS);
  const [twoStep, setTwoStep] = useState(true);
  const toast = useToast();
  return (
    <div className="flex flex-col gap-6">
      <Switch
        label="Two-step sign in"
        description="Ask for a code from your authenticator app after the SMS code on new devices."
        checked={twoStep}
        onChange={(v) => {
          setTwoStep(v);
          toast.show(v ? "Two-step sign in turned on" : "Two-step sign in turned off");
        }}
      />
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-900">Where you are signed in</p>
          {sessions.length > 1 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSessions((s) => s.filter((x) => x.current));
                toast.show("Signed out of all other devices");
              }}
            >
              Sign out other devices
            </Button>
          )}
        </div>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {sessions.map((s) => {
            const Icon = s.mobile ? Smartphone : Laptop;
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Icon size={18} strokeWidth={1.8} className="shrink-0 text-ink-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
                    {s.device}
                    {s.current && (
                      <Badge tone="success" size="sm">
                        This device
                      </Badge>
                    )}
                  </p>
                  <p className="text-xs text-ink-500">
                    {s.place}, {s.when}
                  </p>
                </div>
                {!s.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={LogOut}
                    onClick={() => {
                      setSessions((x) => x.filter((y) => y.id !== s.id));
                      toast.show(`Signed out of ${s.device}`);
                    }}
                  >
                    Sign out
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {toast.node}
    </div>
  );
}

/** Notification channels and display preferences. */
export function PreferencesForm({ topics }: { topics: { key: string; label: string; description: string }[] }) {
  const [prefs, setPrefs] = useState<Record<string, { email: boolean; push: boolean; sms: boolean }>>(
    Object.fromEntries(topics.map((t, i) => [t.key, { email: true, push: i < 2, sms: i === 0 }])),
  );
  const [dirty, setDirty] = useState(false);
  const toast = useToast();
  const toggle = (key: string, ch: "email" | "push" | "sms") => (v: boolean) => {
    setPrefs((p) => ({ ...p, [key]: { ...p[key]!, [ch]: v } }));
    setDirty(true);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDirty(false);
        toast.show("Preferences saved");
      }}
      className="flex flex-col gap-8"
    >
      <section>
        <h3 className="text-sm font-semibold text-ink-900">Notifications</h3>
        <p className="mt-0.5 text-[13px] text-ink-500">Choose how you hear about each kind of update.</p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-ink-50 text-xs text-ink-500">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Update</th>
                <th className="w-20 px-2 py-2.5 font-medium">Email</th>
                <th className="w-20 px-2 py-2.5 font-medium">Push</th>
                <th className="w-20 px-2 py-2.5 font-medium">SMS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {topics.map((t) => (
                <tr key={t.key}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900">{t.label}</p>
                    <p className="text-xs text-ink-500">{t.description}</p>
                  </td>
                  {(["email", "push", "sms"] as const).map((ch) => (
                    <td key={ch} className="px-2 py-3 text-center">
                      <span className="inline-flex">
                        <Switch checked={prefs[t.key]![ch]} onChange={toggle(t.key, ch)} ariaLabel={`${t.label} by ${ch}`} />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h3 className="text-sm font-semibold text-ink-900 sm:col-span-2">Display</h3>
        <Field label="Language" htmlFor="pr-lang">
          <Select id="pr-lang" defaultValue="en" onChange={() => setDirty(true)}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </Select>
        </Field>
        <Field label="Table density" htmlFor="pr-density">
          <Select id="pr-density" defaultValue="comfortable" onChange={() => setDirty(true)}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </Select>
        </Field>
        <Field label="Time zone" htmlFor="pr-tz" hint="All times in BluBuy are shown in IST">
          <Input id="pr-tz" value="India Standard Time (UTC+5:30)" disabled />
        </Field>
        <Field label="Daily summary email" htmlFor="pr-digest">
          <Select id="pr-digest" defaultValue="8" onChange={() => setDirty(true)}>
            <option value="off">Off</option>
            <option value="8">Every morning at 8 am</option>
            <option value="18">Every evening at 6 pm</option>
          </Select>
        </Field>
      </section>

      <div>
        <Button type="submit" disabled={!dirty}>
          Save preferences
        </Button>
      </div>
      {toast.node}
    </form>
  );
}
