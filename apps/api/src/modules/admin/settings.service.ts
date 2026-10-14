import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DB } from "../../common/tokens.js";
import type { Db } from "../../db/client.js";
import { storeSettings, users } from "../../db/schema.js";
import { DEFAULT_SETTINGS, settingsSchema, type StoreSettings } from "./admin.schemas.js";
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

@Injectable()
export class SettingsService {
  private cache: { value: StoreSettings; at: number } | null = null;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async get(): Promise<StoreSettings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const [row] = await this.db.select({ value: storeSettings.value }).from(storeSettings).where(eq(storeSettings.id, ROW));
    const value = withDefaults(row?.value);
    this.cache = { value, at: Date.now() };
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
    return { ...value, updatedAt: row?.updatedAt.toISOString() ?? null, updatedBy: row ? (row.name ?? row.email ?? null) : null };
  }

  async update(actorId: string, next: StoreSettings) {
    const before = await this.get();
    await this.db
      .insert(storeSettings)
      .values({ id: ROW, value: next, updatedBy: actorId })
      .onConflictDoUpdate({ target: storeSettings.id, set: { value: next, updatedBy: actorId, updatedAt: new Date() } });
    this.cache = null;
    const changes = changedFields(before, next);
    const names = Object.keys(changes);
    if (names.length) await this.audit.log({ id: actorId }, "settings.update", { type: "settings", id: ROW }, `Changed ${names.length === 1 ? names[0] : `${names.length} settings`}`, changes);
    return this.detail();
  }
}
