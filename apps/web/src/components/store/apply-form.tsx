"use client";

import { useState, type FormEvent } from "react";
import { CircleCheck, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";

/** Job application form. Mock only: validates and shows a confirmation. */
export function ApplyForm({ roleTitle }: { roleTitle: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  if (submitted)
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-2xl border border-success-100 bg-success-50 p-6">
        <CircleCheck size={24} className="text-success-600" aria-hidden="true" />
        <p className="text-[15px] font-semibold text-ink-900">Application received</p>
        <p className="text-sm leading-relaxed text-ink-600">
          Thank you for applying for {roleTitle}. We review every application and will reply within 7 days, whatever the outcome.
        </p>
      </div>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Full name" htmlFor="apply-name" required>
        <Input id="apply-name" name="name" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="apply-email" required>
        <Input id="apply-email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Mobile number" htmlFor="apply-phone" required>
        <Input id="apply-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="10 digit mobile number" required />
      </Field>
      <Field label="LinkedIn or portfolio link" htmlFor="apply-link">
        <Input id="apply-link" name="link" type="url" placeholder="https://" />
      </Field>
      <Field label="Resume" htmlFor="apply-resume" hint="PDF, up to 5 MB" required>
        <label
          htmlFor="apply-resume"
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong bg-ink-50/60 px-3 py-3 text-sm text-ink-600 hover:border-ink-400"
        >
          <Paperclip size={16} className="text-ink-400" aria-hidden="true" />
          <span className="truncate">{file ?? "Choose a file"}</span>
          <input id="apply-resume" name="resume" type="file" accept="application/pdf" required className="sr-only" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
        </label>
      </Field>
      <Field label="Anything you would like us to know" htmlFor="apply-note">
        <Textarea id="apply-note" name="note" rows={4} />
      </Field>
      <Checkbox name="consent" required label="I agree to BluBuy storing my application for up to 12 months for hiring purposes." />
      <Button type="submit" size="lg" className="mt-1 w-full">
        Submit application
      </Button>
    </form>
  );
}
