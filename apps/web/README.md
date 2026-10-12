# AltasGoods web

Every AltasGoods web workspace (storefront, My Account, AltasGoods Control, Care Desk, Hub Console) in one Next.js 16 app.

```bash
npm install
echo "ALTASGOODS_API_URL=http://localhost:4000" > .env.local
npm run dev        # http://localhost:3000, start at /portals
npm run build      # production build
npm run lint
npm test           # unit tests
npm run test:e2e   # Playwright, against a running API on the sandbox and simulated courier
npm run api:types  # regenerate src/lib/api/schema.d.ts after the API contract changes
```

Read `../../docs/architecture/frontend-conventions.md` before adding screens. Screens on the API load through `src/lib/api`; the rest still render the sample data in `src/lib/mock`, which is deterministic and anchored to 1 Oct 2026 so every render agrees. The root README lists which screens are which.
