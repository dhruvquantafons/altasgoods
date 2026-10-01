"use client";

import { useState } from "react";
import { CircleCheck, Flag, MessageSquareReply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/interactive";

/** Public response to seller feedback; sellers can respond once. */
export function FeedbackResponse({ id, canRemove }: { id: string; canRemove: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const toast = useToast();
  if (sent)
    return (
      <div className="mt-3 rounded-lg border-l-2 border-brand-300 bg-brand-50/40 px-3 py-2 text-[13px] text-ink-700">
        <span className="block text-xs font-medium text-brand-700">Your public response</span>
        {sent}
      </div>
    );
  return (
    <div className="mt-3">
      {open ? (
        <div className="flex flex-col gap-2">
          <Textarea aria-label={`Response to feedback ${id}`} value={text} onChange={(e) => setText(e.target.value)} className="min-h-20" placeholder="Thank the customer and say what you changed. You can respond once, and it is public." />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={text.trim().length < 10}
              onClick={() => {
                setSent(text.trim());
                toast.show("Response published under the feedback.");
              }}
            >
              Publish response
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="secondary" icon={MessageSquareReply} onClick={() => setOpen(true)}>
            Respond publicly
          </Button>
          {canRemove && (
            <Button size="xs" variant="ghost" icon={Flag} onClick={() => toast.show("Removal request sent. BluBuy reviews it against the feedback policy within 48 hours.")}>
              Request removal
            </Button>
          )}
        </div>
      )}
      {toast.node}
    </div>
  );
}

/** Inline answer box for a customer question; answers are moderated before publishing. */
export function AnswerQuestion({ id }: { id: string }) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const toast = useToast();
  if (done)
    return (
      <p className="mt-3 flex items-center gap-1.5 text-[13px] text-success-700">
        <CircleCheck size={15} aria-hidden="true" /> Answer submitted. It appears on the product page after moderation, usually within a few hours.
      </p>
    );
  return (
    <div className="mt-3 flex flex-col gap-2">
      <Textarea aria-label={`Answer to question ${id}`} value={text} onChange={(e) => setText(e.target.value)} className="min-h-16" placeholder="Answer factually. Do not include links, phone numbers or promotions." />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-500">Answered by Apex Retail (seller)</p>
        <Button
          size="sm"
          disabled={text.trim().length < 5}
          onClick={() => {
            setDone(true);
            toast.show("Answer submitted for moderation.");
          }}
        >
          Post answer
        </Button>
      </div>
      {toast.node}
    </div>
  );
}

export function ReportReview({ id }: { id: string }) {
  const toast = useToast();
  return (
    <>
      <Button size="xs" variant="ghost" icon={Flag} onClick={() => toast.show(`Review ${id} reported. BluBuy checks it against the review policy.`)}>
        Report
      </Button>
      {toast.node}
    </>
  );
}
