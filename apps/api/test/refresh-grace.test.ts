import { describe, expect, it } from "vitest";
import { openGrace, sealGrace } from "../src/modules/auth/tokens.service.js";

const entry = { sessionId: "00000000-0000-0000-0000-000000000001", accessToken: "at", refreshToken: "rt", grants: { staff: [] } };
const hash = "a".repeat(64);
const parts = (sealed: string) => sealed.split(".").map((p) => Buffer.from(p, "base64url"));
const join = (bufs: Buffer[]) => bufs.map((b) => b.toString("base64url")).join(".");

describe("grace cache sealing", () => {
  it("opens what it sealed, for the same token only", () => {
    const sealed = sealGrace(entry, hash);
    expect(openGrace(sealed, hash)).toEqual(entry);
    expect(openGrace(sealed, "b".repeat(64))).toBeNull();
  });

  it("refuses a truncated tag, even one that is a prefix of the real one", () => {
    const [iv, tag, body] = parts(sealGrace(entry, hash));
    expect(openGrace(join([iv!, tag!.subarray(0, 8), body!]), hash)).toBeNull();
    expect(openGrace(join([iv!, tag!.subarray(0, 4), body!]), hash)).toBeNull();
  });

  it("refuses an IV that is not 12 bytes, and anything malformed", () => {
    const [iv, tag, body] = parts(sealGrace(entry, hash));
    expect(openGrace(join([iv!.subarray(0, 8), tag!, body!]), hash)).toBeNull();
    expect(openGrace(join([Buffer.concat([iv!, Buffer.alloc(4)]), tag!, body!]), hash)).toBeNull();
    expect(openGrace("not-sealed", hash)).toBeNull();
    expect(openGrace(`${join([iv!, tag!, body!])}.extra`, hash)).toBeNull();
  });
});
