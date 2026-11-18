"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteFaq, deleteTopic, reorderFaqs, reorderTopics, saveFaq, saveTopic } from "@/app/actions/admin-content";
import { NamedIcon, ICON_NAMES } from "@/components/store/icons";
import { Prose } from "@/components/store/prose";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import type { ContentFaq, ContentTopic } from "@/lib/api/admin-content";
import { ConfirmRemove, Lane, MoveButtons, useAction } from "./bits";

function FaqEditor({ faq, groups, readOnly, onClose, onSaved }: { faq?: ContentFaq; groups: string[]; readOnly: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const [group, setGroup] = useState(faq?.group ?? groups[0] ?? "");
  const [q, setQ] = useState(faq?.q ?? "");
  const [a, setA] = useState(faq?.a ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    const r = await saveFaq(faq?.id ?? null, { group: group.trim(), q: q.trim(), a: a.trim() });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return toast.show(r.error);
    }
    onSaved(faq ? "Question saved" : "Question added");
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={faq ? "Edit question" : "New question"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button onClick={save} disabled={busy || !q.trim() || !a.trim() || !group.trim()}>
              {busy ? "Saving" : "Save"}
            </Button>
          )}
        </>
      }
    >
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Group" htmlFor="fq-group" required error={errors.group} hint="Questions with the same group are labelled alike">
            <Input id="fq-group" list="fq-groups" value={group} onChange={(e) => setGroup(e.target.value)} />
            <datalist id="fq-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>
          <Field label="Question" htmlFor="fq-q" required error={errors.q}>
            <Input id="fq-q" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Answer (Markdown)" htmlFor="fq-a" required error={errors.a} hint="**bold**, - lists, [links](/policies/returns)">
            <Textarea id="fq-a" className="min-h-40 font-mono text-[13px]" value={a} onChange={(e) => setA(e.target.value)} />
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-700">Preview</p>
            <div className="min-h-40 rounded-lg border border-line bg-white p-4">{a.trim() ? <Prose markdown={a} /> : <p className="text-[13px] text-ink-400">Nothing to preview yet.</p>}</div>
          </div>
        </div>
      </fieldset>
      {toast.node}
    </Modal>
  );
}

function TopicEditor({ topic, readOnly, onClose, onSaved }: { topic?: ContentTopic; readOnly: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const [title, setTitle] = useState(topic?.title ?? "");
  const [body, setBody] = useState(topic?.body ?? "");
  const [icon, setIcon] = useState(topic?.icon ?? "Package");
  const [href, setHref] = useState(topic?.href ?? "/policies/");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    const r = await saveTopic(topic?.id ?? null, { title: title.trim(), body: body.trim(), icon, href: href.trim() });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return toast.show(r.error);
    }
    onSaved(topic ? "Topic saved" : "Topic added");
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={topic ? "Edit help topic" : "New help topic"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button onClick={save} disabled={busy || !title.trim() || !href.trim()}>
              {busy ? "Saving" : "Save"}
            </Button>
          )}
        </>
      }
    >
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        <Field label="Title" htmlFor="tp-title" required error={errors.title}>
          <Input id="tp-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Short description" htmlFor="tp-body" error={errors.body}>
          <Input id="tp-body" value={body} maxLength={200} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label="Links to" htmlFor="tp-href" required error={errors.href} hint="A storefront path such as /policies/returns">
          <Input id="tp-href" value={href} onChange={(e) => setHref(e.target.value)} />
        </Field>
        <Field label="Icon" htmlFor="tp-icon" error={errors.icon}>
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <NamedIcon name={icon} size={19} />
            </span>
            <Select id="tp-icon" className="flex-1" value={icon} onChange={(e) => setIcon(e.target.value)}>
              {ICON_NAMES.map((n) => (
                <option key={n}>{n}</option>
              ))}
              {!ICON_NAMES.includes(icon) && <option>{icon}</option>}
            </Select>
          </div>
        </Field>
      </fieldset>
      {toast.node}
    </Modal>
  );
}

/** The Help centre: its topic cards and its frequently asked questions. */
export function HelpEditor({ faqs, topics, canEdit }: { faqs: ContentFaq[]; topics: ContentTopic[]; canEdit: boolean }) {
  const { run, busy, toast, router } = useAction();
  const [faq, setFaq] = useState<ContentFaq | "new" | null>(null);
  const [topic, setTopic] = useState<ContentTopic | "new" | null>(null);
  const [removing, setRemoving] = useState<{ kind: "faq" | "topic"; id: string; name: string } | null>(null);
  const groups = Array.from(new Set(faqs.map((f) => f.group)));

  const moveFaq = (i: number, by: -1 | 1) => {
    const ids = faqs.map((f) => f.id);
    [ids[i], ids[i + by]] = [ids[i + by]!, ids[i]!];
    void run(() => reorderFaqs(ids), "Order saved");
  };
  const moveTopic = (i: number, by: -1 | 1) => {
    const ids = topics.map((t) => t.id);
    [ids[i], ids[i + by]] = [ids[i + by]!, ids[i]!];
    void run(() => reorderTopics(ids), "Order saved");
  };

  return (
    <div className="flex flex-col gap-6">
      <Lane title="Help topics" description="The cards at the top of the Help centre" onAdd={canEdit ? () => setTopic("new") : undefined} addLabel="Add topic">
        <ol className="divide-y divide-line">
          {topics.map((t, i) => (
            <li key={t.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <NamedIcon name={t.icon} size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-ink-900">{t.title}</p>
                <p className="truncate text-xs text-ink-500">
                  {t.body ? `${t.body}, ` : ""}links to {t.href}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {canEdit && <MoveButtons index={i} count={topics.length} busy={busy} label={t.title} onMove={(by) => moveTopic(i, by)} />}
                <Button size="xs" variant="ghost" icon={Pencil} onClick={() => setTopic(t)} aria-label={`${canEdit ? "Edit" : "View"} ${t.title}`}>
                  {canEdit ? "Edit" : "View"}
                </Button>
                {canEdit && (
                  <Button size="xs" variant="ghost" icon={Trash2} onClick={() => setRemoving({ kind: "topic", id: t.id, name: t.title })} aria-label={`Remove ${t.title}`}>
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
          {topics.length === 0 && <li className="px-5 py-6 text-[13px] text-ink-500">No topics yet.</li>}
        </ol>
      </Lane>

      <Lane title="Frequently asked questions" description="Shown in this order on the Help centre, and searchable there" onAdd={canEdit ? () => setFaq("new") : undefined} addLabel="Add question">
        <ol className="divide-y divide-line">
          {faqs.map((f, i) => (
            <li key={f.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-ink-500">{f.group}</p>
                <p className="truncate text-[13.5px] font-medium text-ink-900">{f.q}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {canEdit && <MoveButtons index={i} count={faqs.length} busy={busy} label={f.q} onMove={(by) => moveFaq(i, by)} />}
                <Button size="xs" variant="ghost" icon={Pencil} onClick={() => setFaq(f)} aria-label={`${canEdit ? "Edit" : "View"} ${f.q}`}>
                  {canEdit ? "Edit" : "View"}
                </Button>
                {canEdit && (
                  <Button size="xs" variant="ghost" icon={Trash2} onClick={() => setRemoving({ kind: "faq", id: f.id, name: f.q })} aria-label={`Remove ${f.q}`}>
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
          {faqs.length === 0 && <li className="px-5 py-6 text-[13px] text-ink-500">No questions yet.</li>}
        </ol>
      </Lane>

      {faq && <FaqEditor faq={faq === "new" ? undefined : faq} groups={groups} readOnly={!canEdit} onClose={() => setFaq(null)} onSaved={(m) => { toast.show(m); router.refresh(); }} />}
      {topic && <TopicEditor topic={topic === "new" ? undefined : topic} readOnly={!canEdit} onClose={() => setTopic(null)} onSaved={(m) => { toast.show(m); router.refresh(); }} />}
      {removing && (
        <ConfirmRemove
          title={`Remove "${removing.name}"?`}
          description="It disappears from the Help centre straight away."
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            const r = removing;
            setRemoving(null);
            await run(() => (r.kind === "faq" ? deleteFaq(r.id) : deleteTopic(r.id)), "Removed");
          }}
        />
      )}
      {toast.node}
    </div>
  );
}
