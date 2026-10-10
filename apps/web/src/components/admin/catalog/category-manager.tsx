"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCategory, saveCategory } from "@/app/actions/admin-catalog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { EmptyState } from "@/components/ui/misc";
import type { AdminCategory } from "@/lib/api/types";

type Draft = { id: string | null; name: string; icon: string; subcategories: string };
const blank: Draft = { id: null, name: "", icon: "", subcategories: "" };

/** Categories and their subcategories, as shown in the store's menus and filters. */
export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<AdminCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (d: Draft) => {
    setError(null);
    setDraft(d);
  };

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    const subcategories = draft.subcategories
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const r = await saveCategory(draft.id, { name: draft.name.trim(), icon: draft.icon.trim() || null, subcategories });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDraft(null);
    toast.show(draft.id ? "Category saved" : "Category added. It shows in the store menu now.");
    router.refresh();
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError(null);
    const r = await deleteCategory(removing.id);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setRemoving(null);
    toast.show("Category deleted");
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" icon={Plus} onClick={() => open(blank)}>
          Add category
        </Button>
      </div>
      {categories.length === 0 ? (
        <Card>
          <EmptyState icon={Layers} title="No categories yet" description="Add a category, then its subcategories, before adding products." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((c) => (
            <Card key={c.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-ink-900">{c.name}</h3>
                  <p className="font-mono text-xs text-ink-500">/c/{c.slug}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Edit ${c.name}`}
                    onClick={() => open({ id: c.id, name: c.name, icon: c.icon ?? "", subcategories: c.subcategories.map((s) => s.name).join("\n") })}
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${c.name}`}
                    onClick={() => {
                      setError(null);
                      setRemoving(c);
                    }}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-[13px] text-ink-600">
                {c.productCount} {c.productCount === 1 ? "product" : "products"}
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {c.subcategories.map((s) => (
                  <li key={s.id} className="rounded-full bg-ink-50 px-2.5 py-1 text-xs text-ink-700 ring-1 ring-line">
                    {s.name} <span className="text-ink-400">{s.productCount}</span>
                  </li>
                ))}
                {c.subcategories.length === 0 && <li className="text-xs text-ink-500">No subcategories</li>}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit category" : "Add category"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button disabled={busy || !draft?.name.trim()} onClick={save}>
              {draft?.id ? "Save" : "Add category"}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            {error && (
              <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-[13px] text-danger-700">
                {error}
              </p>
            )}
            <Field label="Name" htmlFor="cat-name" required hint={draft.id ? "The store address stays the same when you rename" : "The store address is made from the name"}>
              <Input id="cat-name" value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Menu icon" htmlFor="cat-icon" hint="Optional icon name from lucide.dev, for example Sofa or Shirt">
              <Input id="cat-icon" value={draft.icon} maxLength={40} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />
            </Field>
            <Field label="Subcategories" htmlFor="cat-subs" hint="One per line, in menu order. A subcategory that products use cannot be removed until they move.">
              <Textarea id="cat-subs" rows={7} value={draft.subcategories} onChange={(e) => setDraft({ ...draft, subcategories: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name ?? "category"}?`}
        description="Its subcategories are deleted with it. Categories that still have products cannot be deleted."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Keep
            </Button>
            <Button variant="danger" disabled={busy} onClick={remove}>
              Delete
            </Button>
          </>
        }
      >
        {error && (
          <p role="alert" className="text-[13px] text-danger-700">
            {error}
          </p>
        )}
      </Modal>
      {toast.node}
    </>
  );
}
