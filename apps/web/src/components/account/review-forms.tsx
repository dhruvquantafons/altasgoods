"use client";

import { useEffect, useState } from "react";
import { Camera, CircleCheck, ImageIcon, MessageCircleQuestion, Pencil, Star, X } from "lucide-react";
import { ProductImage } from "@/components/commerce/product-image";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";

const WORDS = ["", "Poor", "Below average", "Average", "Good", "Excellent"];

function StarPicker({ value, onChange, size = 28, label }: { value: number; onChange: (v: number) => void; size?: number; label: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}, ${WORDS[n]}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="rounded-md p-0.5 transition-transform hover:scale-110"
        >
          <Star size={size} strokeWidth={1.5} className={n <= shown ? "text-accent-400" : "text-ink-300"} fill={n <= shown ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export interface ReviewProduct {
  slug: string;
  title: string;
  image: string;
}

/** Write or edit a product review. Reviews go to moderation before they are published. */
export function WriteReview({
  product,
  autoOpen,
  inline,
  edit,
}: {
  product: ReviewProduct;
  autoOpen?: boolean;
  /** show a row of stars that opens the form with that rating */
  inline?: boolean;
  edit?: { rating: number; title: string; body: string };
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(edit?.rating ?? 0);
  const [title, setTitle] = useState(edit?.title ?? "");
  const [body, setBody] = useState(edit?.body ?? "");
  const [photos, setPhotos] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!autoOpen) return;
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, [autoOpen]);

  const errors = {
    rating: rating === 0 ? "Choose a star rating." : "",
    body: body.trim().length < 20 ? "Write at least 20 characters so other shoppers find it useful." : "",
  };
  const valid = !errors.rating && !errors.body;

  return (
    <>
      {inline ? (
        <StarPicker
          size={22}
          value={rating}
          label={`Rate ${product.title}`}
          onChange={(v) => {
            setRating(v);
            setOpen(true);
          }}
        />
      ) : (
        <Button size="sm" variant={edit ? "ghost" : "secondary"} icon={edit ? Pencil : Star} onClick={() => setOpen(true)}>
          {edit ? "Edit" : "Write a review"}
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setTouched(false);
        }}
        size="lg"
        title={done ? "Thanks for your review" : edit ? "Edit your review" : "Write a review"}
        footer={
          done ? (
            <Button
              onClick={() => {
                setOpen(false);
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setTouched(true);
                  if (valid) setDone(true);
                }}
              >
                Submit review
              </Button>
            </>
          )
        }
      >
        {done ? (
          <div className="flex flex-col items-center py-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success-50 text-success-600">
              <CircleCheck size={26} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <p className="mt-4 text-[15px] font-semibold text-ink-900">Your review is with our moderators</p>
            <p className="mt-1.5 max-w-sm text-sm text-ink-600">It usually goes live within 48 hours. We will let you know once it is published.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <ProductImage src={product.image} alt="" size={48} rounded="md" />
              <p className="line-clamp-2 text-[13.5px] font-medium text-ink-900">{product.title}</p>
            </div>
            <div>
              <p className="text-[13px] font-medium text-ink-700">Overall rating</p>
              <div className="mt-1.5 flex items-center gap-3">
                <StarPicker value={rating} onChange={setRating} label="Overall rating" />
                <span className="text-[13px] font-medium text-ink-600">{WORDS[rating]}</span>
              </div>
              {touched && errors.rating && <p className="mt-1 text-xs text-danger-600">{errors.rating}</p>}
            </div>
            <Field label="Title" htmlFor="rv-title" hint="Optional">
              <Input id="rv-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Sum it up in a few words" />
            </Field>
            <Field label="Your review" htmlFor="rv-body" error={touched && errors.body ? errors.body : undefined} hint={`${body.trim().length} of at least 20 characters`}>
              <Textarea id="rv-body" className="min-h-32" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="What did you like or dislike? How have you used it?" aria-invalid={Boolean(touched && errors.body)} />
            </Field>
            <div>
              <p className="text-[13px] font-medium text-ink-700">Photos</p>
              <div className="mt-2 flex flex-wrap gap-2.5">
                {photos.map((p) => (
                  <div key={p} className="relative flex size-16 items-center justify-center rounded-lg border border-line bg-ink-50 text-ink-400">
                    <ImageIcon size={18} aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => setPhotos((ps) => ps.filter((x) => x !== p))}
                      className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full border border-line bg-white text-ink-500"
                      aria-label={`Remove ${p}`}
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <button
                    type="button"
                    onClick={() => setPhotos((ps) => [...ps, `photo-${ps.length + 1}.jpg`])}
                    className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-line-strong text-ink-500 hover:border-brand-400 hover:text-brand-700"
                  >
                    <Camera size={17} aria-hidden="true" />
                    <span className="text-[10px] font-medium">Add</span>
                  </button>
                )}
              </div>
            </div>
            <p className="rounded-lg bg-ink-50 px-3.5 py-3 text-xs leading-relaxed text-ink-600">
              Keep it about the product. Delivery feedback has its own place on the order page. No phone numbers, links or personal details. We never
              offer anything in return for a review.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Ask a question about a product. */
export function AskQuestion({ products }: { products: ReviewProduct[] }) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(products[0]?.slug ?? "");
  const [q, setQ] = useState("");
  const [done, setDone] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" icon={MessageCircleQuestion} onClick={() => setOpen(true)}>
        Ask a question
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setDone(false);
          setQ("");
        }}
        title={done ? "Question posted" : "Ask a question"}
        description={done ? undefined : "Our team, the brand and verified buyers can answer."}
        footer={
          done ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={q.trim().length < 10} onClick={() => setDone(true)}>
                Post question
              </Button>
            </>
          )
        }
      >
        {done ? (
          <p className="text-sm text-ink-600">We will notify you when someone answers. Questions are checked before they appear, usually within a few hours.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-700">Product</legend>
              <div className="flex flex-col gap-2">
                {products.map((p) => (
                  <label key={p.slug} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2", slug === p.slug ? "border-brand-500 bg-brand-50" : "border-line")}>
                    <input type="radio" name="q-product" className="size-4 accent-brand-600" checked={slug === p.slug} onChange={() => setSlug(p.slug)} />
                    <ProductImage src={p.image} alt="" size={32} rounded="md" />
                    <span className="truncate text-[13px] text-ink-800">{p.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Your question" htmlFor="q-text" hint="At least 10 characters">
              <Textarea id="q-text" value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} placeholder="For example, does it come with a wall charger?" />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
