/**
 * Writes the OpenAPI contract to packages/openapi/openapi.json. Run with
 * `npm run openapi` (SWC loader, so decorator metadata is available).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp, openApiDocument } from "./app.js";

const out = fileURLToPath(new URL("../../../packages/openapi/openapi.json", import.meta.url));
const app = await createApp({ logger: false });
const doc = openApiDocument(app);
mkdirSync(new URL("../../../packages/openapi/", import.meta.url), { recursive: true });
writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
await app.close();
console.log(`OpenAPI written to ${out}: ${Object.keys(doc.paths).length} paths`);
