import { Mail } from "lucide-react";

/** Applications go by email to the store's contact address; nothing is collected on the site. */
export function ApplyForm({ roleTitle, email }: { roleTitle: string; email: string }) {
  const href = `mailto:${email}?subject=${encodeURIComponent(`Application: ${roleTitle}`)}`;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-ink-600">
        Email your resume (PDF) and, if you like, a LinkedIn or portfolio link to <span className="font-medium text-ink-900">{email}</span> with the role in the
        subject line.
      </p>
      <a
        href={href}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        <Mail size={16} aria-hidden="true" /> Email your application
      </a>
    </div>
  );
}
