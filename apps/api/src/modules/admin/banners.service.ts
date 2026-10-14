import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { notFound, unprocessable } from "../../common/errors.js";
import type { Clock } from "../../common/infra.module.js";
import { CLOCK, DB } from "../../common/tokens.js";
import type { Db } from "../../db/client.js";
import { banners } from "../../db/schema.js";
import type { bannerInput, bannerPatch } from "./banners.schemas.js";

type Banner = typeof banners.$inferSelect;

/** The storefront CMS: homepage hero slides and promo tiles. */
@Injectable()
export class BannersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private showing(b: Banner, now = this.clock.now()) {
    return b.active && (!b.startsAt || b.startsAt <= now) && (!b.endsAt || b.endsAt > now);
  }

  private view(b: Banner) {
    const { createdAt: _created, ...rest } = b;
    return { ...rest, startsAt: b.startsAt?.toISOString() ?? null, endsAt: b.endsAt?.toISOString() ?? null, updatedAt: b.updatedAt.toISOString(), showing: this.showing(b) };
  }

  async list() {
    const rows = await this.db.select().from(banners).orderBy(asc(banners.placement), asc(banners.sortOrder), asc(banners.createdAt));
    return rows.map((b) => this.view(b));
  }

  /** What the homepage shows now, in order. */
  async storefront() {
    const now = this.clock.now();
    const rows = (await this.db.select().from(banners).where(eq(banners.active, true)).orderBy(asc(banners.sortOrder), asc(banners.createdAt))).filter((b) => this.showing(b, now));
    const pick = ({ id, eyebrow, title, body, ctaLabel, href, image, alt, align, theme, position }: Banner) => ({ id, eyebrow, title, body, ctaLabel, href, image, alt, align, theme, position });
    return { hero: rows.filter((b) => b.placement === "HERO").map(pick), promo: rows.filter((b) => b.placement === "PROMO").map(pick) };
  }

  async create(input: z.infer<typeof bannerInput>) {
    // new banners go last in their placement
    const [last] = await this.db.select({ max: sql<number>`coalesce(max(${banners.sortOrder}), -1)` }).from(banners).where(eq(banners.placement, input.placement));
    const [b] = await this.db
      .insert(banners)
      .values({ ...input, sortOrder: Number(last?.max ?? -1) + 1, startsAt: input.startsAt ? new Date(input.startsAt) : null, endsAt: input.endsAt ? new Date(input.endsAt) : null })
      .returning();
    return this.view(b!);
  }

  async update(id: string, patch: z.infer<typeof bannerPatch>) {
    const [before] = await this.db.select().from(banners).where(eq(banners.id, id));
    if (!before) throw notFound("Banner");
    const startsAt = patch.startsAt === undefined ? before.startsAt : patch.startsAt ? new Date(patch.startsAt) : null;
    const endsAt = patch.endsAt === undefined ? before.endsAt : patch.endsAt ? new Date(patch.endsAt) : null;
    if (startsAt && endsAt && endsAt <= startsAt) throw unprocessable("BAD_WINDOW", "The end has to be after the start");
    const [b] = await this.db.update(banners).set({ ...patch, startsAt, endsAt }).where(eq(banners.id, id)).returning();
    return { before: this.view(before), after: this.view(b!) };
  }

  async remove(id: string) {
    const [b] = await this.db.delete(banners).where(eq(banners.id, id)).returning();
    if (!b) throw notFound("Banner");
    return this.view(b);
  }

  /** Puts a placement's banners in the given order; every banner of that placement must be listed. */
  async reorder(placement: "HERO" | "PROMO", ids: string[]) {
    const current = await this.db.select({ id: banners.id }).from(banners).where(eq(banners.placement, placement));
    if (current.length !== ids.length || current.some((c) => !ids.includes(c.id))) throw unprocessable("BAD_ORDER", "List every banner in this placement exactly once");
    await this.db.transaction(async (tx) => {
      for (const [i, id] of ids.entries()) await tx.update(banners).set({ sortOrder: i }).where(and(eq(banners.id, id), eq(banners.placement, placement)));
    });
    return this.list();
  }
}
