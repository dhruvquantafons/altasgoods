"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteReview } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Modal, useToast } from "@/components/ui/interactive";

export function DeleteReviewButton({ id, slug, productTitle }: { id: string; slug: string; productTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <>
      <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setOpen(true)} aria-label={`Delete your review of ${productTitle}`}>
        Delete
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Delete your review?"
        description={`Your review of ${productTitle} comes off the product page. You can write a new one later.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await deleteReview(id, slug);
                setBusy(false);
                if (!r.ok) return toast.show(r.error);
                setOpen(false);
                toast.show("Review deleted");
                router.refresh();
              }}
            >
              Delete review
            </Button>
          </>
        }
      >
        <span />
      </Modal>
      {toast.node}
    </>
  );
}
