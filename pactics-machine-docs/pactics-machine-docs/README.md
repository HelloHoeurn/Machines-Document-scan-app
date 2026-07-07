# PACTICS Machine Documents — Modular Refactor

A no-build, ES-modules refactor of the original single-file app. Deploys as
plain static files (Cloudflare Pages / GitHub Pages) — **no bundler required**,
which keeps the drag-and-drop deploy workflow intact.

## 1. Breakdown analysis (shared components found in the original)

| Concern | Original functions (single file) | New home |
|---|---|---|
| Header (brand, Scan, Set name, language) | `refreshWho`, `openName`, `toggleLang` | `components/*` + `main.js` chrome wiring |
| Top navigation (Machines / Dashboard / Print QR) | inline `#topnav` | `public/index.html` + `router.js` |
| **Dashboard** (KPI tiles, health chip, due workbench, bars, recent) | `loadDashboard`, `renderDashboard`, `dueFiltered`, `renderDueTable`, `markDone`, `ym` | **`components/dashboard.js`, `components/dueTable.js`, `data/maintenance.js` — DONE** |
| Machine list + search | `renderList`, `openMachine` | `components/machineList.js` (stub) |
| Passport: documents / parts / tasks | `loadDocs`,`renderDocs`,`renderParts`,`renderTasks`,`buildCheckGrid`,`openTask`… | `components/machinePassport.js` (stub) |
| QR scanner | `openScanner`,`startScan`,`startDecodeLoop`,`findByScan`… | `components/qrScanner.js` (stub) |
| QR label printing | `initQrPrint`,`renderQrLabels`… | `components/qrPrint.js` (stub) |
| CSV / Excel export | `partsRows`,`maintRows`,`toCSV`,`download` | `components/exports.js` + `utils/format.js` — DONE |
| i18n (EN/KM) | `I18N`, `TX`, `applyLang` | `i18n/` — DONE |
| Supabase access | `sb`, inline queries | `supabaseClient.js` + `data/*` |

## 2. State management

All shared state moved out of scattered globals into a tiny observable
**store** (`src/js/store.js`): `machines`, `current`, `dash{maint,parts}`,
`due{…}`, `who`, `lang`. Components call `store.get()`, mutate with
`store.set(patch)` / `store.patch(slice, partial)`, and may `store.subscribe()`
to re-render. The Dashboard vertical is the reference implementation — e.g.
clicking a KPI tile does `store.patch('due', { state })` then re-renders.
`who` and `lang` persist to `localStorage` exactly as before.

## 3. Folder structure

```
pactics-machine-docs/
├─ public/
│  └─ index.html            # entry: semantic HTML5 shell, links CSS, loads main.js (module)
├─ src/
│  ├─ styles/               # extracted from the single <style> block
│  │  ├─ tokens.css         #   :root design tokens
│  │  ├─ base.css           #   reset, layout, typography
│  │  ├─ components.css     #   header, nav, buttons, cards, tables, modals
│  │  ├─ dashboard.css      #   KPI tiles, health chip, due workbench, bars
│  │  └─ app.combined.css   #   verbatim fallback (use alone if the split needs tuning)
│  ├─ js/
│  │  ├─ main.js            # bootstrap
│  │  ├─ config.js          # Supabase keys, table names, CHECK_ITEMS, caps
│  │  ├─ supabaseClient.js  # single client (ESM from CDN)
│  │  ├─ store.js           # observable state
│  │  ├─ router.js          # view switching + gotoMachine
│  │  ├─ icons.js           # inline SVG set
│  │  ├─ utils/             # dom, dates, format, toast
│  │  ├─ data/              # machines (done), maintenance (done), parts/documents (stub)
│  │  ├─ components/        # dashboard+dueTable+exports (done); list/passport/scanner/qrPrint (stub)
│  │  └─ i18n/              # dictionary (verbatim) + en/km + runtime
│  └─ assets/               # (icons are inline; no binary assets yet)
└─ README.md
```

## Run locally

ES modules need HTTP (not `file://`). From the project root:

```bash
python3 -m http.server 8080
# open http://localhost:8080/public/index.html
```

## Deploy (unchanged workflow)

Upload the project to Cloudflare Pages / GitHub Pages. Set the output/root so
`public/index.html` is served (or move `public/` contents to the site root).
No build command needed.

## What's done vs. to port

- **Done & runnable against Supabase:** foundation (config, client, store, utils,
  i18n), the whole **Dashboard** vertical, and CSV/Excel export.
- **Stubs with exact source line refs:** machine list, passport (docs/parts/tasks),
  QR scanner, QR print. Each stub header lists the original functions to move and
  the pattern to follow. These can be ported one vertical at a time without
  touching the live single-file app, which keeps running until you cut over.
