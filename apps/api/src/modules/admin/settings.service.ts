import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DB } from "../../common/tokens.js";
import type { Db, Tx } from "../../db/client.js";
import { storeSettings, users } from "../../db/schema.js";
import { DEFAULT_SETTINGS, settingsPlaceholders, settingsSchema, type StoreSettings } from "./admin.schemas.js";
import { AuditService } from "./audit.service.js";

const ROW = "store";
/** Short enough that every API instance picks up a change within seconds. */
const CACHE_MS = 15_000;

/** Fills in anything a stored version lacks (a group added after it was saved) from the defaults. */
function withDefaults(stored: unknown): StoreSettings {
  const s = (stored ?? {}) as Partial<Record<keyof StoreSettings, object>>;
  const merged = Object.fromEntries(
    (Object.keys(DEFAULT_SETTINGS) as (keyof StoreSettings)[]).map((k) => [k, { ...DEFAULT_SETTINGS[k], ...(s[k] ?? {}) }]),
  );
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

/** Flattens two versions into "group.field" changes, for the audit log. */
function changedFields(before: StoreSettings, after: StoreSettings) {
  const out: Record<string, [unknown, unknown]> = {};
  for (const group of Object.keys(after) as (keyof StoreSettings)[]) {
    const a = after[group] as Record<string, unknown>;
    const b = before[group] as Record<string, unknown>;
    for (const field of Object.keys(a)) if (JSON.stringify(a[field]) !== JSON.stringify(b[field])) out[`${group}.${field}`] = [b[field] ?? null, a[field]];
  }
  return out;
}

/**
 * The store settings, cached in memory. After the first load a read never
 * waits on the database: a copy older than CACHE_MS is returned at once and
 * refreshed in the background, one refresh at a time. This matters because
 * callers read settings inside their own transactions; a read that took a
 * second pool connection while holding one could starve the pool. A first
 * (cold) read inside a transaction goes through that transaction's connection.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger("Settings");
  private cache: { value: StoreSettings; at: number } | null = null;
  /** The one load in progress, shared by everyone who waits on it. */
  private inflight: Promise<StoreSettings> | null = null;
  /** Bumped on save, so a load that started before it does not put the old value back. */
  private generation = 0;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Pass `tx` when calling inside a transaction. */
  async get(tx?: Tx): Promise<StoreSettings> {
    const cached = this.cache;
    if (cached) {
      if (Date.now() - cached.at >= CACHE_MS && !this.inflight) this.load().catch((e: Error) => this.logger.warn(`Settings not refreshed: ${e.message}`));
      return cached.value;
    }
    return tx ? this.read(tx, this.generation) : this.load();
  }

  /** Loads through the pool, single flight. */
  private load(): Promise<StoreSettings> {
    if (this.inflight) return this.inflight;
    const p = this.read(this.db, this.generation).finally(() => {
      if (this.inflight === p) this.inflight = null;
    });
    this.inflight = p;
    return p;
  }

  private async read(db: Tx, generation: number) {
    const [row] = await db.select({ value: storeSettings.value }).from(storeSettings).where(eq(storeSettings.id, ROW));
    const value = withDefaults(row?.value);
    if (generation === this.generation) this.cache = { value, at: Date.now() };
    return value;
  }

  /** The settings with who saved them last, for the admin form. */
  async detail() {
    const value = await this.get();
    const [row] = await this.db
      .select({ updatedAt: storeSettings.updatedAt, name: users.name, email: users.email })
      .from(storeSettings)
      .leftJoin(users, eq(users.id, storeSettings.updatedBy))
      .where(eq(storeSettings.id, ROW));
    return { ...value, placeholders: settingsPlaceholders(value), updatedAt: row?.updatedAt.toISOString() ?? null, updatedBy: row ? (row.name ?? row.email ?? null) : null };
  }

  async update(actorId: string, next: StoreSettings) {
    // what is saved now, not a cached copy, for the audit diff
    const before = await this.read(this.db, this.generation);
    await this.db
      .insert(storeSettings)
      .values({ id: ROW, value: next, updatedBy: actorId })
      .onConflictDoUpdate({ target: storeSettings.id, set: { value: next, updatedBy: actorId, updatedAt: new Date() } });
    // this instance sees the change at once; others within CACHE_MS plus one read
    this.generation++;
    this.cache = null;
    this.inflight = null;
    const changes = changedFields(before, next);
    const names = Object.keys(changes);
    if (names.length) await this.audit.log({ id: actorId }, "settings.update", { type: "settings", id: ROW }, `Changed ${names.length === 1 ? names[0] : `${names.length} settings`}`, changes);
    return this.detail();
  }
}
