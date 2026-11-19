"use client";

import { useState } from "react";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { deletePress, deleteRole, reorderRoles, savePress, saveRole } from "@/app/actions/admin-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, Switch, useToast } from "@/components/ui/interactive";
import type { ContentPress, ContentRole } from "@/lib/api/admin-content";
import { formatDate } from "@/lib/utils";
import { ConfirmRemove, fromLines, Lane, MoveButtons, slugOf, toLines, useAction } from "./bits";

const today = () => new Date().toISOString().slice(0, 10);

function RoleEditor({ role, readOnly, onClose, onSaved }: { role?: ContentRole; readOnly: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const [title, setTitle] = useState(role?.title ?? "");
  const [slug, setSlug] = useState(role?.slug ?? "");
  const [team, setTeam] = useState(role?.team ?? "");
  const [location, setLocation] = useState(role?.location ?? "");
  const [type, setType] = useState<"Full time" | "Contract">((role?.type as "Full time" | "Contract") ?? "Full time");
  const [experience, setExperience] = useState(role?.experience ?? "");
  const [posted, setPosted] = useState(role?.posted ?? today());
  const [summary, setSummary] = useState(role?.summary ?? "");
  const [resp, setResp] = useState(fromLines(role?.responsibilities ?? []));
  const [req, setReq] = useState(fromLines(role?.requirements ?? []));
  const [nice, setNice] = useState(fromLines(role?.niceToHave ?? []));
  const [published, setPublished] = useState(role?.published ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    const r = await saveRole(role?.slug ?? null, {
      slug: role?.slug ?? slug.trim(),
      title: title.trim(),
      team: team.trim(),
      location: location.trim(),
      type,
      experience: experience.trim(),
      posted,
      summary: summary.trim(),
      responsibilities: toLines(resp),
      requirements: toLines(req),
      niceToHave: toLines(nice),
      published,
    });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return toast.show(r.error);
    }
    onSaved(role ? "Role saved" : "Role added");
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={role ? `Edit ${role.title}` : "New role"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button onClick={save} disabled={busy || !title.trim() || !team.trim() || !location.trim() || (!role && !slug.trim())}>
              {busy ? "Saving" : "Save"}
            </Button>
          )}
        </>
      }
    >
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="rl-title" required error={errors.title} className="sm:col-span-2">
          <Input
            id="rl-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!role && (!slug || slug === slugOf(title))) setSlug(slugOf(e.target.value));
            }}
          />
        </Field>
        <Field label="Web address" htmlFor="rl-slug" required error={errors.slug} hint={role ? "Cannot change after the role is made" : "Shows as /careers/your-address"}>
          <Input id="rl-slug" value={slug} disabled={!!role} onChange={(e) => setSlug(e.target.value)} />
        </Field>
        <Field label="Team" htmlFor="rl-team" required error={errors.team}>
          <Input id="rl-team" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Engineering" />
        </Field>
        <Field label="Location" htmlFor="rl-loc" required error={errors.location}>
          <Input id="rl-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bengaluru, hybrid" />
        </Field>
        <Field label="Type" htmlFor="rl-type">
          <Select id="rl-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option>Full time</option>
            <option>Contract</option>
          </Select>
        </Field>
        <Field label="Experience" htmlFor="rl-exp" error={errors.experience}>
          <Input id="rl-exp" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="5+ years" />
        </Field>
        <Field label="Posted on" htmlFor="rl-posted" error={errors.posted}>
          <Input id="rl-posted" type="date" value={posted} onChange={(e) => setPosted(e.target.value)} />
        </Field>
        <Field label="Summary" htmlFor="rl-sum" error={errors.summary} className="sm:col-span-2">
          <Textarea id="rl-sum" className="min-h-16" maxLength={500} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </Field>
        <Field label="What you will do" htmlFor="rl-resp" hint="One point per line" error={errors.responsibilities} className="sm:col-span-2">
          <Textarea id="rl-resp" value={resp} onChange={(e) => setResp(e.target.value)} />
        </Field>
        <Field label="What we are looking for" htmlFor="rl-req" hint="One point per line" error={errors.requirements} className="sm:col-span-2">
          <Textarea id="rl-req" value={req} onChange={(e) => setReq(e.target.value)} />
        </Field>
        <Field label="Nice to have" htmlFor="rl-nice" hint="One point per line, optional" error={errors.niceToHave} className="sm:col-span-2">
          <Textarea id="rl-nice" className="min-h-16" value={nice} onChange={(e) => setNice(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Switch checked={published} onChange={setPublished} label="Open for applications on the storefront" />
        </div>
      </fieldset>
      {toast.node}
    </Modal>
  );
}

/** Open roles on the Careers page. */
export function CareersEditor({ roles, canEdit }: { roles: ContentRole[]; canEdit: boolean }) {
  const { run, busy, toast, router } = useAction();
  const [editing, setEditing] = useState<ContentRole | "new" | null>(null);
  const [removing, setRemoving] = useState<ContentRole | null>(null);
  const move = (i: number, by: -1 | 1) => {
    const slugs = roles.map((r) => r.slug);
    [slugs[i], slugs[i + by]] = [slugs[i + by]!, slugs[i]!];
    void run(() => reorderRoles(slugs), "Order saved");
  };
  return (
    <Lane title="Open roles" description="Shown on /careers in this order. Hidden roles stay here but are not on the storefront." onAdd={canEdit ? () => setEditing("new") : undefined} addLabel="Add role">
      <ol className="divide-y divide-line">
        {roles.map((r, i) => (
          <li key={r.slug} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-ink-900">{r.title}</p>
              <p className="truncate text-xs text-ink-500">
                {r.team}, {r.location}, posted {formatDate(r.posted)}
              </p>
              <Badge tone={r.published ? "success" : "neutral"} size="sm" dot className="mt-1">
                {r.published ? "Open" : "Hidden"}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {canEdit && <MoveButtons index={i} count={roles.length} busy={busy} label={r.title} onMove={(by) => move(i, by)} />}
              {canEdit && (
                <Button
                  size="xs"
                  variant="ghost"
                  icon={r.published ? EyeOff : Eye}
                  disabled={busy}
                  onClick={() => run(() => saveRole(r.slug, { ...r, published: !r.published }), r.published ? "Role hidden" : "Role open")}
                >
                  {r.published ? "Hide" : "Open"}
                </Button>
              )}
              <Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEditing(r)} aria-label={`${canEdit ? "Edit" : "View"} ${r.title}`}>
                {canEdit ? "Edit" : "View"}
              </Button>
              {canEdit && (
                <Button size="xs" variant="ghost" icon={Trash2} onClick={() => setRemoving(r)} aria-label={`Remove ${r.title}`}>
                  Remove
                </Button>
              )}
            </div>
          </li>
        ))}
        {roles.length === 0 && <li className="px-5 py-6 text-[13px] text-ink-500">No roles yet. The Careers page says there are none open.</li>}
      </ol>
      {editing && <RoleEditor role={editing === "new" ? undefined : editing} readOnly={!canEdit} onClose={() => setEditing(null)} onSaved={(m) => { toast.show(m); router.refresh(); }} />}
      {removing && (
        <ConfirmRemove
          title={`Remove "${removing.title}"?`}
          description="It leaves the Careers page straight away. Hide it instead to keep the text."
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            const r = removing;
            setRemoving(null);
            await run(() => deleteRole(r.slug), "Role removed");
          }}
        />
      )}
      {toast.node}
    </Lane>
  );
}

function PressForm({ item, readOnly, onClose, onSaved }: { item?: ContentPress; readOnly: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [slug, setSlug] = useState(item?.slug ?? "");
  const [date, setDate] = useState(item?.date ?? today());
  const [category, setCategory] = useState(item?.category ?? "Company");
  const [summary, setSummary] = useState(item?.summary ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    const r = await savePress(item?.slug ?? null, { slug: item?.slug ?? slug.trim(), date, title: title.trim(), summary: summary.trim(), category: category.trim() });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return toast.show(r.error);
    }
    onSaved(item ? "Release saved" : "Release added");
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={item ? "Edit press release" : "New press release"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button onClick={save} disabled={busy || !title.trim() || (!item && !slug.trim())}>
              {busy ? "Saving" : "Save"}
            </Button>
          )}
        </>
      }
    >
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field label="Headline" htmlFor="pr-title" required error={errors.title} className="sm:col-span-2">
          <Input
            id="pr-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!item && (!slug || slug === slugOf(title))) setSlug(slugOf(e.target.value));
            }}
          />
        </Field>
        <Field label="Web address" htmlFor="pr-slug" required error={errors.slug} hint={item ? "Cannot change" : "Lowercase letters, numbers and hyphens"}>
          <Input id="pr-slug" value={slug} disabled={!!item} onChange={(e) => setSlug(e.target.value)} />
        </Field>
        <Field label="Date" htmlFor="pr-date" error={errors.date}>
          <Input id="pr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Category" htmlFor="pr-cat" error={errors.category} className="sm:col-span-2">
          <Input id="pr-cat" list="pr-cats" value={category} onChange={(e) => setCategory(e.target.value)} />
          <datalist id="pr-cats">
            {["Company", "Customers", "Logistics", "Sellers"].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Summary" htmlFor="pr-sum" error={errors.summary} className="sm:col-span-2">
          <Textarea id="pr-sum" maxLength={500} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </Field>
      </fieldset>
      {toast.node}
    </Modal>
  );
}

/** Press releases. The first one leads the Press page. */
export function PressList({ items, canEdit }: { items: ContentPress[]; canEdit: boolean }) {
  const { run, busy, toast, router } = useAction();
  const [editing, setEditing] = useState<ContentPress | "new" | null>(null);
  const [removing, setRemoving] = useState<ContentPress | null>(null);
  return (
    <Lane title="Press releases" description="The first release leads the Press page. A new one goes to the top." onAdd={canEdit ? () => setEditing("new") : undefined} addLabel="Add release">
      <ol className="divide-y divide-line">
        {items.map((p) => (
          <li key={p.slug} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-ink-900">{p.title}</p>
              <p className="truncate text-xs text-ink-500">
                {p.category}, {formatDate(p.date)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEditing(p)} aria-label={`${canEdit ? "Edit" : "View"} ${p.title}`}>
                {canEdit ? "Edit" : "View"}
              </Button>
              {canEdit && (
                <Button size="xs" variant="ghost" icon={Trash2} onClick={() => setRemoving(p)} aria-label={`Remove ${p.title}`}>
                  Remove
                </Button>
              )}
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="px-5 py-6 text-[13px] text-ink-500">No releases yet.</li>}
      </ol>
      {editing && <PressForm item={editing === "new" ? undefined : editing} readOnly={!canEdit} onClose={() => setEditing(null)} onSaved={(m) => { toast.show(m); router.refresh(); }} />}
      {removing && (
        <ConfirmRemove
          title={`Remove "${removing.title}"?`}
          description="It leaves the Press page straight away."
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            const r = removing;
            setRemoving(null);
            await run(() => deletePress(r.slug), "Release removed");
          }}
        />
      )}
      {toast.node}
    </Lane>
  );
}
