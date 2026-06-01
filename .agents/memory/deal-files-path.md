---
name: deal_files local path convention
description: How to resolve deal_files.file_path to an absolute path on disk for script access
---

The `deal_files` table stores uploaded files with a `file_path` column that is a relative path.

**Rule:** `file_path` is relative to the backend's `process.cwd()`, which is the `backend/` directory (e.g. `/home/runner/workspace/backend`).

**Why:** The backend server starts from the `backend/` directory. Multer disk storage uses `path.join(process.cwd(), ...)` to write files. So the resulting path in the DB is like `uploads/deals/{dealId}/{filename}`.

**How to apply:** In any script under `backend/scripts/`, resolve the absolute path as:
```ts
const BACKEND_ROOT = path.resolve(__dirname, '..');  // backend/scripts → backend/
const absolutePath = path.join(BACKEND_ROOT, file.file_path);
```
Do NOT use `../../..` from `__dirname` — that goes to `/home/runner` not the workspace.

The files are NOT in R2 by default; they live on disk unless the upload route explicitly writes to R2 (archive routes do, deal-file routes do not).
