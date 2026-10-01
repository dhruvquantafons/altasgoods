import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../../db/client.js";
import { addresses } from "../../db/schema.js";
import { notFound, unprocessable } from "../../common/errors.js";
import { DB } from "../../common/tokens.js";
import { addressBody, addressPatch } from "./commerce.schemas.js";

const MAX_ADDRESSES = 20;

@Injectable()
export class AddressesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  list(userId: string) {
    return this.db
      .select({ id: addresses.id, name: addresses.name, phone: addresses.phone, line1: addresses.line1, line2: addresses.line2, landmark: addresses.landmark, city: addresses.city, state: addresses.state, pincode: addresses.pincode, type: addresses.type, isDefault: addresses.isDefault })
      .from(addresses)
      .where(and(eq(addresses.userId, userId), isNull(addresses.deletedAt)))
      .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
  }

  async get(userId: string, id: string) {
    const [row] = await this.db.select().from(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId), isNull(addresses.deletedAt)));
    if (!row) throw notFound("Address");
    return row;
  }

  async create(userId: string, body: z.infer<typeof addressBody>) {
    const existing = await this.list(userId);
    if (existing.length >= MAX_ADDRESSES) throw unprocessable("ADDRESS_LIMIT", `You can save up to ${MAX_ADDRESSES} addresses. Remove one to add another.`);
    const makeDefault = body.isDefault || existing.length === 0;
    return this.db.transaction(async (tx) => {
      if (makeDefault) await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
      const [row] = await tx.insert(addresses).values({ ...body, userId, isDefault: makeDefault }).returning();
      return row!;
    });
  }

  async update(userId: string, id: string, patch: z.infer<typeof addressPatch>) {
    await this.get(userId, id);
    return this.db.transaction(async (tx) => {
      if (patch.isDefault) await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
      const [row] = await tx.update(addresses).set(patch).where(eq(addresses.id, id)).returning();
      return row!;
    });
  }

  async remove(userId: string, id: string) {
    const row = await this.get(userId, id);
    await this.db.update(addresses).set({ deletedAt: new Date(), isDefault: false }).where(eq(addresses.id, id));
    if (row.isDefault) {
      const [next] = await this.list(userId);
      if (next) await this.db.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
    }
  }
}
