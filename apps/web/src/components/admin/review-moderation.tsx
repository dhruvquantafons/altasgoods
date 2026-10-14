"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, MessageSquareReply } from "lucide-react";
import { moderateReview } from "@/app/actions/admin-system";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";

/** Publish or hide a review, and reply publicly as AltasGoods. */
export function ReviewModeration({ id, slug, status, reply, adminNote }: { id: string; slug: string; status: "PENDING" | "PUBLISHED" | "HIDDEN"; reply: string | null; adminNote: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"reply" | "hide" | null>(null);
  const [text, setText] = useState("");

  const run = async (change: Parameters<typeof moderateReview>[1], done: string) => {
    setBusy(true);
    const r = await moderateReview(id, change, slug);
    setBusy(false);
    if (!r.ok) return toast.show(r.error);
    setDialog(null);
    toast.show(done);
    router.refresh();
  };

  return (
    <>
      {status !== "PUBLISHED" && (
        <Button size="xs" icon={Eye} disabled={busy} onClick={() => run({ status: "PUBLISHED" }, "Published on the product page")}>
          Publish
        </Button>
      )}
      {status !== "HIDDEN" && (
        <Button
          size="xs"
          variant="ghost"
          icon={EyeOff}
          disabled={busy}
          onClick={() => {
            setText(adminNote ?? "");
            setDialog("hide");
          }}
        >
          Hide
        </Button>
      )}
      <Button
        size="xs"
        variant="ghost"
        icon={MessageSquareReply}
        onClick={() => {
          setText(reply ?? "");
          setDialog("reply");
        }}
      >
        {reply ? "Edit reply" : "Reply"}
      </Button>
      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        size="sm"
        title={dialog === "hide" ? "Hide this review?" : "Reply as AltasGoods"}
        description={dialog === "hide" ? "It comes off the product page and out of the product's rating. The customer still sees it in their account." : "Shown under the review on the product page."}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            {dialog === "reply" && reply && (
              <Button variant="ghost" disabled={busy} onClick={() => run({ reply: null }, "Reply removed")}>
                Remove reply
              </Button>
            )}
            <Button
              variant={dialog === "hide" ? "danger" : "primary"}
              disabled={busy || (dialog === "reply" && !text.trim())}
              onClick={() => (dialog === "hide" ? run({ status: "HIDDEN", adminNote: text.trim() || null }, "Review hidden") : run({ reply: text.trim() }, "Reply posted"))}
            >
              {dialog === "hide" ? "Hide review" : "Post reply"}
            </Button>
          </>
        }
      >
        <Field label={dialog === "hide" ? "Why (for the team)" : "Reply"} htmlFor="rm-text" hint={dialog === "hide" ? "Optional, never shown to customers" : undefined}>
          <Textarea id="rm-text" className="min-h-20" maxLength={dialog === "hide" ? 500 : 1000} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </Modal>
      {toast.node}
    </>
  );
}
