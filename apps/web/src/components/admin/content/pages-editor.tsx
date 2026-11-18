"use client";

import { useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { deletePage, reorderPages, savePage, setPagePublished } from "@/app/actions/admin-content";
import { Prose } from "@/components/store/prose";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal, Switch, useToast } from "@/components/ui/interactive";
import type { ContentPage } from "@/lib/api/admin-content";
import { formatDate } from "@/lib/utils";
import { ConfirmRemove, Lane, MoveButtons, slugOf, useAction } from "./bits";

type SectionForm = { key: number; id?: string; heading: string; body: string };

/** Keys the editor puts on sections while editing, so React keeps each one's text box when they move. */
let lastKey = 0;
const newKey = () => ++lastKey;

const MARKDOWN_HELP = "Markdown: **bold**, - bullet lists, 1. numbered steps, | tables | like | this |, > quotes, [links](/policies/returns). Raw HTML is not shown.";

function PageEditor({ page, others, readOnly, onClose, onSaved }: { page?: ContentPage; others: ContentPage[]; readOnly: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [title, setTitle] = useState(page?.title ?? "");
  const [nav, setNav] = useState(page?.nav ?? "");
  const [summary, setSummary] = useState(page?.summary ?? "");
  const [published, setPublished] = useState(page?.published ?? true);
  const [related, setRelated] = useState<string[]>(page?.related ?? []);
  const [sections, setSections] = useState<SectionForm[]>(() => (page?.sections ?? []).map((s) => ({ key: newKey(), ...s })));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const patch = (k: number, change: Partial<SectionForm>) => setSections((all) => all.map((s) => (s.key === k ? { ...s, ...change } : s)));
  const move = (i: number, by: -1 | 1) =>
    setSections((all) => {
      const copy = [...all];
      [copy[i], copy[i + by]] = [copy[i + by]!, copy[i]!];
      return copy;
    });

  const save = async () => {
    setBusy(true);
    const r = await savePage(page?.slug ?? null, {
      slug: page?.slug ?? slug.trim(),
      kind: page?.kind ?? "policy",
      title: title.trim(),
      nav: nav.trim() || title.trim(),
      summary: summary.trim(),
      published,
      related,
      sections: sections.map((s) => ({ ...(s.id ? { id: s.id } : {}), heading: s.heading.trim(), body: s.body })),
    });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      return toast.show(r.error);
    }
    onSaved(page ? "Page saved" : "Page added");
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={page ? `Edit ${page.title}` : "New policy page"}
      description="Each section has a heading and Markdown text. The preview shows what shoppers will see."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button onClick={save} disabled={busy || !title.trim() || (!page && !slug.trim())}>
              {busy ? "Saving" : "Save"}
            </Button>
          )}
        </>
      }
    >
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="pg-title" required error={errors.title}>
            <Input
              id="pg-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!page && !slug) setSlug(slugOf(e.target.value));
              }}
            />
          </Field>
          <Field label="Short name" htmlFor="pg-nav" error={errors.nav} hint="Used in menus and breadcrumbs">
            <Input id="pg-nav" value={nav} onChange={(e) => setNav(e.target.value)} />
          </Field>
          <Field label="Web address" htmlFor="pg-slug" required error={errors.slug} hint={page ? "The address cannot change after the page is made" : "Lowercase letters, numbers and hyphens. Shows as /policies/your-address"}>
            <Input id="pg-slug" value={slug} disabled={!!page} onChange={(e) => setSlug(e.target.value)} />
          </Field>
          <div className="flex items-end pb-1">
            <Switch checked={published} onChange={setPublished} label="Published on the storefront" />
          </div>
          <Field label="Summary" htmlFor="pg-summary" error={errors.summary} hint="Shown under the title and on policy cards" className="sm:col-span-2">
            <Textarea id="pg-summary" className="min-h-16" maxLength={400} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </Field>
        </div>

        {others.length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink-700">Related policies</legend>
            <div className="flex flex-wrap gap-2">
              {others.map((o) => {
                const on = related.includes(o.slug);
                return (
                  <label key={o.slug} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-[13px] ${on ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line-strong text-ink-700"}`}>
                    <input type="checkbox" className="sr-only" checked={on} onChange={() => setRelated((r) => (on ? r.filter((x) => x !== o.slug) : [...r, o.slug]))} />
                    {o.nav}
                  </label>
                );
              })}
            </div>
            {errors.related && <p className="mt-1 text-xs text-danger-600">{errors.related}</p>}
          </fieldset>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-900">Sections ({sections.length} of 30)</h3>
            <Button size="sm" variant="secondary" icon={Plus} disabled={sections.length >= 30} onClick={() => setSections((s) => [...s, { key: newKey(), heading: "", body: "" }])}>
              Add section
            </Button>
          </div>
          {errors.sections && <p className="text-xs text-danger-600">{errors.sections}</p>}
          {sections.length === 0 && <p className="rounded-xl border border-dashed border-line-strong p-4 text-[13px] text-ink-500">No sections yet. Add one to start writing.</p>}
          {sections.map((s, i) => (
            <div key={s.key} className="rounded-xl border border-line p-4">
              <div className="flex items-end gap-2">
                <Field label={`Section ${i + 1} heading`} htmlFor={`pg-h-${s.key}`} className="flex-1">
                  <Input id={`pg-h-${s.key}`} value={s.heading} onChange={(e) => patch(s.key, { heading: e.target.value })} />
                </Field>
                <MoveButtons index={i} count={sections.length} label={s.heading || `section ${i + 1}`} onMove={(by) => move(i, by)} />
                <Button size="xs" variant="ghost" icon={Trash2} onClick={() => setSections((all) => all.filter((x) => x.key !== s.key))} aria-label={`Remove section ${i + 1}`} />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field label="Text (Markdown)" htmlFor={`pg-b-${s.key}`} hint={`${s.body.length.toLocaleString("en-IN")} of 20,000 characters`}>
                  <Textarea id={`pg-b-${s.key}`} className="min-h-48 font-mono text-[13px]" value={s.body} onChange={(e) => patch(s.key, { body: e.target.value })} />
                </Field>
                <div>
                  <p className="mb-1.5 text-[13px] font-medium text-ink-700">Preview</p>
                  <div className="min-h-48 rounded-lg border border-line bg-white p-4" aria-label={`Preview of section ${i + 1}`}>
                    {s.body.trim() ? <Prose markdown={s.body} /> : <p className="text-[13px] text-ink-400">Nothing to preview yet.</p>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <p className="text-xs text-ink-500">{MARKDOWN_HELP}</p>
        </div>
      </fieldset>
      {toast.node}
    </Modal>
  );
}

/** Policies and other pages: a list in storefront order, with a section editor for each. */
export function PagesEditor({ pages, canEdit }: { pages: ContentPage[]; canEdit: boolean }) {
  const { run, busy, toast, router } = useAction();
  const [editing, setEditing] = useState<ContentPage | "new" | null>(null);
  const [removing, setRemoving] = useState<ContentPage | null>(null);

  const move = (i: number, by: -1 | 1) => {
    const slugs = pages.map((p) => p.slug);
    [slugs[i], slugs[i + by]] = [slugs[i + by]!, slugs[i]!];
    void run(() => reorderPages(slugs), "Order saved");
  };

  return (
    <Lane title="Policies and pages" description="Listed at /policies in this order. The Help centre links to each one." onAdd={canEdit ? () => setEditing("new") : undefined} addLabel="Add page">
      <ol className="divide-y divide-line">
        {pages.map((p, i) => (
          <li key={p.slug} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-ink-900">{p.title}</p>
              <p className="truncate text-xs text-ink-500">
                /policies/{p.slug}, {p.sections.length} sections, updated {formatDate(p.updatedAt)}
                {p.updatedBy ? ` by ${p.updatedBy}` : ""}
              </p>
              <Badge tone={p.published ? "success" : "neutral"} size="sm" dot className="mt-1">
                {p.published ? "Published" : "Hidden"}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {canEdit && <MoveButtons index={i} count={pages.length} busy={busy} label={p.title} onMove={(by) => move(i, by)} />}
              {canEdit && (
                <Button size="xs" variant="ghost" icon={p.published ? EyeOff : Eye} disabled={busy} onClick={() => run(() => setPagePublished(p.slug, !p.published), p.published ? "Hidden from the storefront" : "Published")}>
                  {p.published ? "Hide" : "Publish"}
                </Button>
              )}
              <Button size="xs" variant="ghost" icon={Pencil} onClick={() => setEditing(p)} aria-label={`${canEdit ? "Edit" : "View"} ${p.title}`}>
                {canEdit ? "Edit" : "View"}
              </Button>
              {canEdit && (
                <Button size="xs" variant="ghost" icon={Trash2} onClick={() => setRemoving(p)} aria-label={`Delete ${p.title}`}>
                  Delete
                </Button>
              )}
            </div>
          </li>
        ))}
        {pages.length === 0 && <li className="px-5 py-6 text-[13px] text-ink-500">No pages yet.</li>}
      </ol>
      {editing && (
        <PageEditor
          page={editing === "new" ? undefined : editing}
          others={pages.filter((p) => editing === "new" || p.slug !== editing.slug)}
          readOnly={!canEdit}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            toast.show(m);
            router.refresh();
          }}
        />
      )}
      {removing && (
        <ConfirmRemove
          title={`Delete "${removing.title}"?`}
          description="The page disappears from the storefront and from other pages' related lists. Hide it instead to keep the text."
          confirmLabel="Delete"
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            const p = removing;
            setRemoving(null);
            await run(() => deletePage(p.slug), "Page deleted");
          }}
        />
      )}
      {toast.node}
    </Lane>
  );
}
