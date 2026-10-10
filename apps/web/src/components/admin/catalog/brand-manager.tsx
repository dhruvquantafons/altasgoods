"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { deleteBrand, saveBrand } from "@/app/actions/admin-catalog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Modal, useToast } from "@/components/ui/interactive";
import { EmptyState } from "@/components/ui/misc";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { AdminBrand } from "@/lib/api/types";

/** The brands products can be filed under. */
export function BrandManager({ brands }: { brands: AdminBrand[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<{ id: string | null; name: string } | null>(null);
  const [removing, setRemoving] = useState<AdminBrand | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = brands.filter((b) => b.name.toLowerCase().includes(filter.trim().toLowerCase()));

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const r = await saveBrand(editing.id, editing.name.trim());
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setEditing(null);
    toast.show(editing.id ? "Brand renamed" : "Brand added");
    router.refresh();
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError(null);
    const r = await deleteBrand(removing.id);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setRemoving(null);
    toast.show("Brand deleted");
    router.refresh();
  }

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <Input aria-label="Filter brands" placeholder="Filter brands" inputSize="sm" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full sm:w-64" />
          <Button
            size="sm"
            icon={Plus}
            onClick={() => {
              setError(null);
              setEditing({ id: null, name: "" });
            }}
          >
            Add brand
          </Button>
        </div>
        {shown.length === 0 ? (
          <EmptyState icon={Tags} title={brands.length ? "No brands match" : "No brands yet"} description={brands.length ? "Try a different name." : "Add the brands you stock."} />
        ) : (
          <TableContainer>
            <Table>
              <THead className="border-t-0">
                <TR>
                  <TH>Brand</TH>
                  <TH align="right">Products</TH>
                  <TH align="right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {shown.map((b) => (
                  <TR key={b.id}>
                    <TD>
                      <p className="text-[13px] font-medium text-ink-900">{b.name}</p>
                      <p className="font-mono text-xs text-ink-500">{b.slug}</p>
                    </TD>
                    <TD align="right" className="tabular-nums">
                      {b.productCount}
                    </TD>
                    <TD align="right">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Rename ${b.name}`}
                        onClick={() => {
                          setError(null);
                          setEditing({ id: b.id, name: b.name });
                        }}
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${b.name}`}
                        onClick={() => {
                          setError(null);
                          setRemoving(b);
                        }}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Rename brand" : "Add brand"}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={busy || !editing?.name.trim()} onClick={save}>
              {editing?.id ? "Save" : "Add brand"}
            </Button>
          </>
        }
      >
        {editing && (
          <Field label="Name" htmlFor="brand-name" required error={error ?? undefined}>
            <Input id="brand-name" value={editing.name} maxLength={60} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </Field>
        )}
      </Modal>

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Delete ${removing?.name ?? "brand"}?`}
        description="Brands that products still use cannot be deleted."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Keep
            </Button>
            <Button variant="danger" disabled={busy} onClick={remove}>
              Delete
            </Button>
          </>
        }
      >
        {error && (
          <p role="alert" className="text-[13px] text-danger-700">
            {error}
          </p>
        )}
      </Modal>
      {toast.node}
    </>
  );
}
