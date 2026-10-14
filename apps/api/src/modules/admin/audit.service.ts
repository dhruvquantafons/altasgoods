import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, ilike, isNotNull, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { DB } from "../../common/tokens.js";
import type { Db } from "../../db/client.js";
import { auditEvents, users } from "../../db/schema.js";
import type { auditQuery } from "./admin.schemas.js";

/** Whoever made the change: a signed-in staff member, or the system for automatic work. */
export type AuditActor = { id: string } | "system";

/** Fields that differ between two versions, as { field: [before, after] }. Unchanged fields are left out. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>, fields: (keyof T)[] = Object.keys(after) as (keyof T)[]) {
  const out: Record<string, [unknown, unknown]> = {};
  for (const f of fields) {
    if (!(f in after)) continue;
    if (JSON.stringify(before[f]) !== JSON.stringify(after[f])) out[f as string] = [before[f] ?? null, after[f] ?? null];
  }
  return out;
}

/**
 * The record of who changed what in AltasGoods Control. Writing an entry
 * never fails the change it describes: a broken log line is logged, not thrown.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async log(actor: AuditActor, action: string, entity: { type: string; id?: string | null }, summary: string, changes?: Record<string, [unknown, unknown]>) {
    try {
      let actorId: string | null = null;
      let actorName = "System";
      if (actor !== "system") {
        const [u] = await this.db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, actor.id));
        actorId = actor.id;
        actorName = u?.name ?? u?.email ?? "Staff";
      }
      await this.db.insert(auditEvents).values({
        actorId,
        actorName,
        action,
        entityType: entity.type,
        entityId: entity.id ?? null,
        summary,
        changes: changes && Object.keys(changes).length ? changes : null,
      });
    } catch (e) {
      console.error(`Audit entry not written (${action}): ${(e as Error).message}`);
    }
  }

  async list(q: z.infer<typeof auditQuery>) {
    const filters: SQL[] = [];
    if (q.q) filters.push(ilike(auditEvents.summary, `%${q.q}%`));
    if (q.action) filters.push(q.action.includes(".") ? eq(auditEvents.action, q.action) : ilike(auditEvents.action, `${q.action}.%`));
    if (q.entityType) filters.push(eq(auditEvents.entityType, q.entityType));
    if (q.entityId) filters.push(eq(auditEvents.entityId, q.entityId));
    if (q.actorId) filters.push(eq(auditEvents.actorId, q.actorId));
    const where = filters.length ? and(...filters) : undefined;
    const [rows, [total], actors] = await Promise.all([
      this.db
        .select()
        .from(auditEvents)
        .where(where)
        .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      this.db.select({ n: count() }).from(auditEvents).where(where),
      this.db.selectDistinct({ id: auditEvents.actorId, name: auditEvents.actorName }).from(auditEvents).where(isNotNull(auditEvents.actorId)),
    ]);
    return {
      items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      total: total?.n ?? 0,
      page: q.page,
      pageSize: q.pageSize,
      actors: actors.filter((a): a is { id: string; name: string } => !!a.id),
    };
  }
}

