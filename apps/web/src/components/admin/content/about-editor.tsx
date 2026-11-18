"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { saveAbout } from "@/app/actions/admin-content";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import type { ContentAbout } from "@/lib/api/admin-content";
import { formatDateTime } from "@/lib/utils";
import { Lane, useAction } from "./bits";

type Doc = Pick<ContentAbout, "numbers" | "principles" | "milestones" | "offices">;

/** Moves an item in a list. */
function swap<T>(list: T[], i: number, by: -1 | 1) {
  const copy = [...list];
  [copy[i], copy[i + by]] = [copy[i + by]!, copy[i]!];
  return copy;
}

/** A repeatable group of rows: each row is a few fields, with move and remove buttons. */
function Rows<T extends Record<string, string>>({
  title,
  description,
  rows,
  fields,
  blank,
  max,
  readOnly,
  onChange,
  noun,
}: {
  title: string;
  description: string;
  rows: T[];
  fields: { key: keyof T & string; label: string; long?: boolean }[];
  blank: T;
  max: number;
  readOnly: boolean;
  onChange: (rows: T[]) => void;
  noun: string;
}) {
  const edit = (i: number, key: string, value: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  return (
    <Lane title={title} description={description} onAdd={readOnly || rows.length >= max ? undefined : () => onChange([...rows, { ...blank }])} addLabel={`Add ${noun}`}>
      <ol className="divide-y divide-line">
        {rows.map((row, i) => (
          <li key={i} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-start">
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <label key={f.key} className={f.long ? "sm:col-span-2" : ""}>
                  <span className="mb-1 block text-xs font-medium text-ink-600">{f.label}</span>
                  {f.long ? (
                    <Textarea className="min-h-16" disabled={readOnly} value={row[f.key]} onChange={(e) => edit(i, f.key, e.target.value)} aria-label={`${noun} ${i + 1} ${f.label}`} />
                  ) : (
                    <Input disabled={readOnly} value={row[f.key]} onChange={(e) => edit(i, f.key, e.target.value)} aria-label={`${noun} ${i + 1} ${f.label}`} />
                  )}
                </label>
              ))}
            </div>
            {!readOnly && (
              <div className="flex items-center gap-1">
                <Button size="xs" variant="ghost" icon={ArrowUp} disabled={i === 0} onClick={() => onChange(swap(rows, i, -1))} aria-label={`Move ${noun} ${i + 1} up`} />
                <Button size="xs" variant="ghost" icon={ArrowDown} disabled={i === rows.length - 1} onClick={() => onChange(swap(rows, i, 1))} aria-label={`Move ${noun} ${i + 1} down`} />
                <Button size="xs" variant="ghost" icon={Trash2} onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove ${noun} ${i + 1}`} />
              </div>
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="px-5 py-6 text-[13px] text-ink-500">None. This block is empty on the About page.</li>}
      </ol>
    </Lane>
  );
}

/** The About page: key numbers, principles, milestones and offices, saved together. */
export function AboutEditor({ about, canEdit }: { about: ContentAbout; canEdit: boolean }) {
  const { run, busy, toast } = useAction();
  const [doc, setDoc] = useState<Doc>({ numbers: about.numbers, principles: about.principles, milestones: about.milestones, offices: about.offices });
  const set = <K extends keyof Doc>(k: K, v: Doc[K]) => setDoc((d) => ({ ...d, [k]: v }));
  const readOnly = !canEdit;

  return (
    <div className="flex flex-col gap-6">
      <Rows
        title="Key numbers"
        description="The figures at the top of the About page and on the Press page (up to 8)"
        rows={doc.numbers}
        fields={[
          { key: "value", label: "Figure" },
          { key: "label", label: "What it counts" },
        ]}
        blank={{ value: "", label: "" }}
        max={8}
        noun="number"
        readOnly={readOnly}
        onChange={(v) => set("numbers", v)}
      />
      <Rows
        title="What we stand for"
        description="Principle cards (up to 8). Each gets an icon in turn."
        rows={doc.principles}
        fields={[
          { key: "title", label: "Title" },
          { key: "body", label: "Text", long: true },
        ]}
        blank={{ title: "", body: "" }}
        max={8}
        noun="principle"
        readOnly={readOnly}
        onChange={(v) => set("principles", v)}
      />
      <Rows
        title="Our journey"
        description="Milestones, oldest first (up to 12)"
        rows={doc.milestones}
        fields={[
          { key: "date", label: "When" },
          { key: "title", label: "Title" },
          { key: "body", label: "Text", long: true },
        ]}
        blank={{ date: "", title: "", body: "" }}
        max={12}
        noun="milestone"
        readOnly={readOnly}
        onChange={(v) => set("milestones", v)}
      />
      <Rows
        title="Where we work"
        description="Offices (up to 12)"
        rows={doc.offices}
        fields={[
          { key: "city", label: "City" },
          { key: "note", label: "What happens there" },
          { key: "address", label: "Address", long: true },
        ]}
        blank={{ city: "", note: "", address: "" }}
        max={12}
        noun="office"
        readOnly={readOnly}
        onChange={(v) => set("offices", v)}
      />
      {canEdit && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-500">{about.updatedAt ? `Last saved ${formatDateTime(about.updatedAt)}` : "Not saved yet"}</p>
          <Button disabled={busy} onClick={() => run(() => saveAbout(doc), "About page saved")}>
            {busy ? "Saving" : "Save the About page"}
          </Button>
        </div>
      )}
      {toast.node}
    </div>
  );
}
