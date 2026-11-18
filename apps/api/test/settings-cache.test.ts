import { afterAll, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { createDb } from "../src/db/client.js";
import type { AuditService } from "../src/modules/admin/audit.service.js";
import { SettingsService } from "../src/modules/admin/settings.service.js";

/** A pool of one connection: a read that needs a second one while a transaction holds it can never get it. */
const { db, pool } = createDb(env().TEST_DATABASE_URL, { max: 1, connectionTimeoutMillis: 2_000 });
afterAll(() => pool.end());
const service = () => new SettingsService(db, {} as AuditService);
const makeStale = (s: SettingsService) => {
  (s as unknown as { cache: { at: number } }).cache.at = 0;
};

describe("settings cache", () => {
  it("returns a stale copy at once inside a transaction and refreshes it afterwards", async () => {
    const s = service();
    const first = await s.get();
    makeStale(s);
    const select = vi.spyOn(db, "select");
    const inside = await db.transaction(async () => s.get());
    expect(inside).toEqual(first);
    // the refresh ran in the background, once, when the connection came free
    await vi.waitFor(() => expect((s as unknown as { cache: { at: number } }).cache.at).toBeGreaterThan(0));
    expect(select).toHaveBeenCalledTimes(1);
    select.mockRestore();
  });

  it("reads a cold cache through the caller's transaction", async () => {
    const s = service();
    const value = await db.transaction(async (tx) => s.get(tx));
    expect(value.tax).toBeDefined();
    // cached for the next caller
    const select = vi.spyOn(db, "select");
    await s.get();
    expect(select).not.toHaveBeenCalled();
    select.mockRestore();
  });

  it("loads a cold cache once for callers that arrive together", async () => {
    const s = service();
    const select = vi.spyOn(db, "select");
    const all = await Promise.all(Array.from({ length: 5 }, () => s.get()));
    expect(new Set(all).size).toBe(1);
    expect(select).toHaveBeenCalledTimes(1);
    select.mockRestore();
  });
});
