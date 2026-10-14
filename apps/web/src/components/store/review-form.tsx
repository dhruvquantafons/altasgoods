"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PenLine, Star } from "lucide-react";
import { createReview, updateReview } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

const WORDS = ["", "Poor", "Not great", "Okay", "Good", "Excellent"];

/** Write or edit a review: stars, a title and optional text. */
export function ReviewButton({
  productId,
  slug,
  productTitle,
  existing,
  label = "Write a review",
  variant = "secondary",
  size = "sm",
  autoOpen = false,
}: {
  productId: string;
  slug: string;
  productTitle: string;
  existing?: { id: string; rating: number; title: string; body: string };
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "xs" | "sm" | "md";
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const save = async () => {
    if (!rating) return setError("Choose a star rating");
    if (title.trim().length < 3) return setError("Give your review a short title");
    setError("");
    setBusy(true);
    const draft = { rating, title: title.trim(), body: body.trim() };
    const r = existing ? await updateReview(existing.id, slug, draft) : await createReview(productId, slug, draft);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setOpen(false);
    toast.show(r.data.status === "PUBLISHED" ? "Thank you, your review is live" : "Thank you, your review will appear once it is checked");
    router.refresh();
  };

  const shown = hover || rating;
  return (
    <>
      <Button variant={variant} size={size} icon={PenLine} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={existing ? "Edit your review" : "Write a review"}
        description={productTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving" : existing ? "Save review" : "Post review"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink-700">Your rating</legend>
            <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  aria-pressed={rating === n}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                  className="rounded p-0.5"
                >
                  <Star size={28} className={cn(n <= shown ? "fill-accent-400 text-accent-400" : "text-ink-300")} aria-hidden="true" />
                </button>
              ))}
              <span className="ml-2 text-[13px] text-ink-600">{WORDS[shown]}</span>
            </div>
          </fieldset>
          <Field label="Title" htmlFor="rv-title" required>
            <Input id="rv-title" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The most important thing in a few words" />
          </Field>
          <Field label="Your review" htmlFor="rv-body" hint="Optional. What did you like or dislike? How are you using it?">
            <Textarea id="rv-body" className="min-h-28" maxLength={3000} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger-600">{error}</p>}
        </div>
      </Modal>
      {toast.node}
    </>
  );
}
