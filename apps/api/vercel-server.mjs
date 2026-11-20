// Vercel entrypoint. Vercel runs `npm run build:vercel` first, which bundles the API
// (src/vercel.ts) into one ES module at dist/vercel/main.mjs; this file re-exports
// its default export, the Express app, which Vercel calls for each request.
// A single .mjs bundle is needed because Vercel would otherwise load the compiled
// files as CommonJS and fail on `import`. Not used anywhere else (see npm start).
export { default } from "./dist/vercel/main.mjs";
