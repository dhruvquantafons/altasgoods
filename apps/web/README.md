# AltasGoods web

Every AltasGoods web workspace (storefront, account, Seller Hub, AltasGoods Control, Hub Console, Care Desk) in one Next.js 16 app.

```bash
npm install
npm run dev      # http://localhost:3000, start at /portals
npm run build    # production build
npm run lint
```

Read `../../docs/architecture/frontend-conventions.md` before adding screens. The data layer in `src/lib/mock` is deterministic and anchored to 1 Oct 2026 so every render agrees; it maps one to one to the planned API (see `../../docs/architecture/system-architecture.md`).
