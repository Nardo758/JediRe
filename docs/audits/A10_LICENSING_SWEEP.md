# A10 Licensing Sweep Report

**Date:** 2026-06-30  
**SHA:** `056ca3348` (master)  
**Scope:** Backend, frontend, Python dependencies, vendor code, secrets posture  

---

## 1. Project-Level License Status

| Item | Status | Detail |
|------|--------|--------|
| Root LICENSE file | ❌ **MISSING** | No `LICENSE`, `LICENSE.md`, `LICENSE.txt`, or `COPYING` at repository root |
| Backend `package.json` license field | ❌ **NOT SET** | `"license"` field absent |
| Frontend `package.json` license field | ❌ **NOT SET** | `"license"` field absent |
| `pyproject.toml` license | ❌ **NOT SET** | No `license` field in `[project]` |
| Proprietary code headers | ❌ **NOT SET** | No copyright/license headers in source files |

**Recommendation:** Add a root `LICENSE` file (e.g., proprietary, MIT, Apache-2.0) and set `license` fields in all package manifests. If proprietary, add a short header to key source files.

---

## 2. Dependency License Analysis

### 2.1 Backend Dependencies (`backend/package.json` — 75 deps)

| Package | License | Notes |
|---------|---------|-------|
| `stripe` | MIT | SDK is MIT; Stripe service terms apply to API usage |
| `twilio` | MIT | SDK is MIT; Twilio service terms apply |
| `@anthropic-ai/sdk` | MIT | SDK is MIT; Anthropic API terms apply |
| `openai` | MIT | SDK is MIT; OpenAI API terms apply |
| `firebase-admin` | Apache-2.0 | Firebase service terms apply |
| `googleapis` | Apache-2.0 | Google Cloud service terms apply |
| `replicate` | MIT | Replicate API is commercial |
| `yahoo-finance2` | MIT | Yahoo Finance ToS apply; scraping may violate terms |
| `inngest` | MIT | Inngest cloud service terms apply |
| `kafkajs` | MIT | Kafka infrastructure licensing is separate (Apache-2.0) |
| `tesseract.js` | Apache-2.0 | OCR engine; Apache-2.0 |
| `pdfkit` | MIT | PDF generation |
| `xlsx` | Apache-2.0 | SheetJS community edition (Apache-2.0) |
| `drizzle-orm` | Apache-2.0 | ORM |
| `zod` | MIT | Validation |
| `apollo-server-express` | MIT | ⚠️ **v3 is deprecated** (EOL Sept 2024); should migrate to v4 or `@apollo/server` |
| `multer` | MIT | ⚠️ **v2.0.2** is old (current is v1.4.5 or v2.0.2? Actually v1.4.5 is LTS, v2 is beta) |
| `passport` | MIT | Authentication |
| `jsonwebtoken` | MIT | JWT |
| `bcryptjs` | MIT | Password hashing |
| `pg` | MIT | PostgreSQL driver |
| `winston` | MIT | Logging |
| `helmet` | MIT | Security headers |
| `cors` | MIT | CORS |
| `express` | MIT | Web framework |
| `dotenv` | MIT | Env vars |
| `uuid` | MIT | UUID generation |
| `axios` | MIT | HTTP client |
| `csv-parse` | MIT | CSV parsing |
| `decimal.js` | MIT | Decimal arithmetic |
| `joi` | BSD-3 | Validation |
| `xml2js` | MIT | XML parsing |
| `cheerio` | MIT | HTML parsing |
| `adm-zip` | MIT | ZIP handling |
| `node-cron` | MIT | Cron jobs |
| `node-schedule` | MIT | Scheduling |
| `mime-types` | MIT | MIME types |
| `socket.io` | MIT | WebSocket |
| `@aws-sdk/client-s3` | Apache-2.0 | AWS SDK |
| `@tavily/core` | MIT | Tavily search API |
| `@turf/*` | MIT | Geo utilities |

**Copyleft (GPL/AGPL/LGPL) dependencies:** **None detected** by name heuristic.

**Deprecated/EOL packages:**
- `apollo-server-express@3.12.0` — Apollo Server v3 reached end-of-life in October 2024. Should migrate to `@apollo/server` v4.

### 2.2 Frontend Dependencies (`frontend/package.json` — 23 deps + 17 devDeps)

| Package | License | Notes |
|---------|---------|-------|
| `mapbox-gl` | **Proprietary / Commercial** | ⚠️ Mapbox GL JS v2+ is proprietary. Requires Mapbox token. Free tier has usage limits; commercial terms apply above limits. |
| `@mapbox/mapbox-gl-draw` | BSD-3 | Mapbox plugin |
| `@mapbox/point-geometry` | ISC | Mapbox utility |
| `react-map-gl` | MIT | Mapbox React wrapper |
| `xlsx` | Apache-2.0 | SheetJS community edition |
| `jspdf` | MIT | PDF generation |
| `three` | MIT | 3D library |
| `@react-three/drei` | MIT | Three.js helpers |
| `@react-three/fiber` | MIT | Three.js React renderer |
| `recharts` | MIT | Charts |
| `socket.io-client` | MIT | WebSocket client |
| `zustand` | MIT | State management |
| `axios` | MIT | HTTP client |
| `date-fns` | MIT | Date utilities |
| `tailwind-merge` | MIT | Tailwind utility |
| `lucide-react` | ISC | Icons |
| `supercluster` | ISC | Map clustering |
| `@dnd-kit/*` | MIT | Drag and drop |
| `@headlessui/react` | MIT | UI components |
| `@heroicons/react` | MIT | Icons |
| `@turf/turf` | MIT | Geo utilities |
| `react` | MIT | React |
| `react-dom` | MIT | React DOM |
| `react-router-dom` | MIT | Router |
| `class-variance-authority` | MIT | UI utility |
| `clsx` | MIT | CSS utility |

**Copyleft (GPL/AGPL/LGPL) dependencies:** **None detected**.

### 2.3 Python Dependencies (`pyproject.toml` — 1 dep)

| Package | License | Notes |
|---------|---------|-------|
| `openpyxl` | MIT / PSF | Excel file handling (Python Software Foundation license) |

---

## 3. Commercial API Dependencies (Service Terms Apply)

These SDKs are permissively licensed (MIT/Apache) but the **underlying services have commercial terms** that must be complied with:

| Service | SDK | Terms Risk | Notes |
|---------|-----|-----------|-------|
| **Stripe** | `stripe` | Medium | Payment processing; PCI compliance obligations |
| **Mapbox** | `mapbox-gl` | **High** | ⚠️ Proprietary license for GL JS v2+. Free tier: 50K loads/month. Exceeding requires paid plan. |
| **Twilio** | `twilio` | Medium | SMS/voice; per-message pricing |
| **OpenAI** | `openai` | Medium | API usage pricing; content policy compliance |
| **Anthropic** | `@anthropic-ai/sdk` | Medium | API usage pricing; content policy compliance |
| **Firebase** | `firebase-admin` | Low | Google Cloud terms; pay-as-you-go for high usage |
| **Google Cloud** | `googleapis` | Low | Google Cloud terms |
| **Replicate** | `replicate` | Low | API pricing for model inference |
| **Yahoo Finance** | `yahoo-finance2` | **Medium** | ⚠️ Yahoo Finance Terms of Service prohibit scraping for commercial use. This is a legal risk, not a license risk. |
| **Inngest** | `inngest` | Low | Cloud pricing for high volume |
| **Tavily** | `@tavily/core` | Low | Search API pricing |
| **AWS S3** | `@aws-sdk/client-s3` | Low | AWS service terms |

**Mapbox concern:** `mapbox-gl@3.20.0` is the proprietary v2+ branch. The frontend has `VITE_MAPBOX_TOKEN` and backend uses `MAPBOX_ACCESS_TOKEN` / `MAPBOX_TOKEN` / `VITE_MAPBOX_TOKEN`. All access is token-based (no hardcoded keys). Ensure the Mapbox account is on the correct pricing tier for expected usage.

**Yahoo Finance concern:** `yahoo-finance2` scrapes Yahoo Finance data. Yahoo's ToS explicitly prohibit commercial use of scraped data. This is a **legal risk** that should be reviewed by counsel if the app uses Yahoo data for commercial deal analysis.

---

## 4. Secrets Posture

| Check | Status | Detail |
|-------|--------|--------|
| Hardcoded API keys in source | ✅ **CLEAN** | All keys use `process.env.*` or `import.meta.env.*` |
| Keys in .env.example files | ✅ **CLEAN** | `.env.example` files only have empty placeholders |
| Keys in .env.replit files | ✅ **CLEAN** | `.env.replit` files only have empty placeholders (no real keys) |
| GitHub token in shell history | ⚠️ **NOTED** | GitHub PAT was used for `git push` via shell command; may be in shell history. Rotate if concerned. |
| Stripe keys | ✅ **CLEAN** | All use `process.env.STRIPE_SECRET_KEY` |
| Mapbox tokens | ✅ **CLEAN** | All use `process.env.MAPBOX_ACCESS_TOKEN` / `import.meta.env.VITE_MAPBOX_TOKEN` |
| Twilio keys | ✅ **CLEAN** | All use `process.env.TWILIO_*` |
| OpenAI/Anthropic keys | ✅ **CLEAN** | All use `process.env.OPENAI_API_KEY` / `process.env.ANTHROPIC_API_KEY` |
| Firebase credentials | ✅ **CLEAN** | Uses `process.env.FIREBASE_*` or service account file path |
| AWS credentials | ✅ **CLEAN** | Uses AWS SDK default credential chain |

---

## 5. Vendor Code

| Vendor | Location | License | Notes |
|--------|----------|---------|-------|
| `vendor/ladder/` | `vendor/ladder/` | Unknown | Contains `.github/workflows/`, `build.js`, `README.md`. No LICENSE file visible. Needs review. |

**Recommendation:** Audit `vendor/ladder/` for a LICENSE file or license declaration. If it's third-party code without a clear license, it may be a copyright risk.

---

## 6. Deprecated/EOL Dependencies

| Package | Current | Latest | Risk | Action |
|---------|---------|--------|------|--------|
| `apollo-server-express` | 3.12.0 | 4.x (via `@apollo/server`) | Medium | Migrate to Apollo Server v4 |
| `multer` | 2.0.2 | 1.4.5 (LTS) or 2.0.2 | Low | v2 is beta/LTS unclear; verify if v1.4.5 is needed |

---

## 7. Summary & Priorities

| Priority | Item | Action |
|----------|------|--------|
| **P1** | Add root LICENSE file | Pick a license (proprietary, MIT, Apache-2.0, etc.) and add it |
| **P1** | Set `license` field in `package.json` files | Add `"license": "..."` to both manifests |
| **P2** | Review `mapbox-gl` commercial terms | Ensure Mapbox account tier matches expected usage |
| **P2** | Review Yahoo Finance ToS | Legal review of `yahoo-finance2` scraping for commercial use |
| **P2** | Audit `vendor/ladder/` license | Add LICENSE or document origin/permission |
| **P3** | Migrate `apollo-server-express` to v4 | EOL dependency; technical debt |
| **P3** | Add copyright headers to key files | Optional, but good practice for proprietary code |
| **P3** | Rotate GitHub PAT if in shell history | The token used for push may be in bash history |

---

*END OF A10 LICENSING SWEEP*
