"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { archiveProduct, deleteProduct, restoreProduct } from "@/app/actions/admin-catalog";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Modal, useToast } from "@/components/ui/interactive";

type Ask = "archive" | "delete" | null;

/** Archive or restore a product, or delete one that was never ordered. */
export function ProductLifecycle({ id, title, archived }: { id: string; title: string; archived: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setAsk(null);
    setError(null);
  };

  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string, then?: () => void) {
    setBusy(true);
    setError(null);
    const r = await action();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    close();
    toast.show(done);
    if (then) then();
    else router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader title={archived ? "Archived" : "Archive or delete"} description={archived ? "Hidden from the store, search, carts and wishlists. Orders and reviews are kept." : undefined} />
        <CardBody className="space-y-3">
          {archived ? (
            <>
              <p className="text-[13px] text-ink-600">Restoring brings it back switched off. Make it live from the product page when you are ready.</p>
              <Button variant="secondary" icon={ArchiveRestore} disabled={busy} onClick={() => run(() => restoreProduct(id), "Restored. It is switched off until you put it on sale.")}>
                Restore
              </Button>
            </>
          ) : (
            <>
              <p className="text-[13px] text-ink-600">Archiving takes it out of the store and keeps its orders. A product that was never ordered can be deleted for good.</p>
              <Button variant="secondary" icon={Archive} onClick={() => setAsk("archive")}>
                Archive
              </Button>
            </>
          )}
          <Button variant="danger" icon={Trash2} onClick={() => setAsk("delete")}>
            Delete permanently
          </Button>
        </CardBody>
      </Card>

      <Modal
        open={ask === "archive"}
        onClose={close}
        title="Archive this product?"
        description={`${title} will leave the store, search, carts and wishlists. You can restore it later.`}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Keep it
            </Button>
            <Button disabled={busy} onClick={() => run(() => archiveProduct(id), "Archived")}>
              {busy ? "Archiving" : "Archive"}
            </Button>
          </>
        }
      >
        {error && <p role="alert" className="text-[13px] text-danger-700">{error}</p>}
      </Modal>

      <Modal
        open={ask === "delete"}
        onClose={close}
        title="Delete this product for good?"
        description={`${title} and its photos, reviews and wishlist entries are removed, and it comes out of any sale. This cannot be undone. If it has orders, archive it instead.`}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => run(() => deleteProduct(id), "Product deleted", () => router.push("/admin/catalog"))}>
              {busy ? "Deleting" : "Delete"}
            </Button>
          </>
        }
      >
        {error && <p role="alert" className="text-[13px] text-danger-700">{error}</p>}
      </Modal>
      {toast.node}
    </>
  );
}
