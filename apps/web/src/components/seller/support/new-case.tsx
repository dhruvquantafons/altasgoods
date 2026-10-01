"use client";

import { useState } from "react";
import { Paperclip, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";

/** Open a support case with BluBuy Seller Support. */
export function NewCase({ categories }: { categories: { key: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(categories[0]!.key);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState(0);
  const toast = useToast();
  const valid = subject.trim().length >= 8 && body.trim().length >= 20;

  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>
        Create case
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Create a support case"
        description="Seller Support replies within 24 hours and resolves most cases within 5 business days."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!valid}
              onClick={() => {
                setOpen(false);
                setSubject("");
                setBody("");
                setFiles(0);
                toast.show("Case TK204521904 created. You will hear from Seller Support within 24 hours.");
              }}
            >
              Submit case
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Topic" htmlFor="nc-cat" required>
            <Select id="nc-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" htmlFor="nc-ref" hint="Order item, BSIN, return, shipment or statement ID">
            <Input id="nc-ref" placeholder="BB-261001-76786-01" className="font-mono" />
          </Field>
          <Field label="Subject" htmlFor="nc-subject" required className="sm:col-span-2" hint={subject && subject.trim().length < 8 ? "Add a few more words" : undefined}>
            <Input id="nc-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="For example: Fee charged twice on one order item" />
          </Field>
          <Field label="What happened" htmlFor="nc-body" required className="sm:col-span-2" hint="Include dates, amounts and what you expected">
            <Textarea id="nc-body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-28" />
          </Field>
          <div className="sm:col-span-2">
            <Button size="sm" variant="secondary" icon={Paperclip} onClick={() => setFiles((f) => f + 1)}>
              Attach a file
            </Button>
            <span className="ml-3 text-xs text-ink-500">{files ? `${files} ${files === 1 ? "file" : "files"} attached` : "PDF, JPG or PNG up to 10 MB"}</span>
          </div>
        </div>
      </Modal>
      {toast.node}
    </>
  );
}
