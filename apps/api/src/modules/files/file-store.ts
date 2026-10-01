import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DB } from "../../common/tokens.js";
import type { Db } from "../../db/client.js";
import { files } from "../../db/schema.js";

/**
 * Where uploaded bytes live. Postgres today; object storage (S3 with KMS
 * encryption and short lived signed URLs) replaces it behind the same shape.
 */
export interface FileStore {
  put(content: Buffer, mimeType: string): Promise<string>;
  get(id: string): Promise<{ content: Buffer; mimeType: string } | null>;
  remove(id: string): Promise<void>;
}

@Injectable()
export class PostgresFileStore implements FileStore {
  constructor(@Inject(DB) private readonly db: Db) {}

  async put(content: Buffer, mimeType: string) {
    const sha256 = createHash("sha256").update(content).digest("hex");
    const [row] = await this.db.insert(files).values({ content, mimeType, sizeBytes: content.length, sha256 }).returning({ id: files.id });
    return row!.id;
  }

  async get(id: string) {
    const [row] = await this.db.select({ content: files.content, mimeType: files.mimeType }).from(files).where(eq(files.id, id));
    return row ?? null;
  }

  async remove(id: string) {
    await this.db.delete(files).where(eq(files.id, id));
  }
}

/** The real type of an upload, from its first bytes; the browser's claim is not trusted. */
export function sniffMime(buf: Buffer): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
}
