/**
 * Vercel entry (bundled by `npm run build:vercel`, loaded by vercel-server.mjs).
 * Instead of listening on a port, it hands Vercel the Express app that Nest runs
 * on, and Vercel calls it for each request. Everywhere else the API starts from
 * main.ts with app.listen().
 */
import { createApp } from "./app.js";

const app = await createApp();
// runs the lifecycle hooks (database, content defaults, email check) that listen() would
await app.init();

export default app.getHttpAdapter().getInstance();
