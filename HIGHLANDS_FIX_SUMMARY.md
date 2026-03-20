# Highlands Deal Fix Summary

## Issue
The "Highlands at Satellite" deal is **not showing up in Assets Owned** page.

### Root Cause
The deal was created **without a `user_id`** (probably via script/seed), so the `/grid/owned` endpoint filters it out:

```sql
WHERE d.user_id = $1 
  AND d.deal_category = 'portfolio' 
  AND d.status = 'closed_won'
```

**Highlands has:**
- ✅ `dealCategory: "portfolio"`
- ✅ `status: "closed_won"`  
- ❌ **Missing `user_id`**

---

## Solutions Implemented

### 1. ✅ "Add Asset" Button EXISTS
Location: `frontend/src/pages/AssetsOwnedPage.tsx` line ~1095

```tsx
<button onClick={() => navigate('/deals/create', { state: { dealCategory: 'portfolio' } })}>
  + Add Asset
</button>
```

Works correctly - navigates to deal creation with portfolio category.

### 2. ✅ User ID Assignment Works
Location: `backend/src/api/rest/inline-deals.routes.ts` line ~134

```typescript
INSERT INTO deals (user_id, name, ...)
VALUES ($1, $2, ...)  // $1 = req.user!.userId from auth token
```

**All new deals created via UI get proper user_id assignment.**

### 3. ❌ Highlands Fix (NEEDS MANUAL ACTION)

Created fix endpoint: `POST /api/v1/admin/fix-highlands`

**Code committed and pushed:**
- `backend/src/api/rest/fix-highlands.route.ts`
- Registered in `backend/src/api/rest/index.ts`

---

## To Fix Highlands Now

### Option A: Via Replit Database Query Tab
1. Open Replit project: https://replit.com/@Nardo758/JediRe
2. Click **Database** tab
3. Click **Query**
4. Paste and run:

```sql
UPDATE deals 
SET user_id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
WHERE name = 'Highlands at Satellite'
RETURNING id, name, user_id, status, deal_category;
```

### Option B: Via Fix Endpoint (after Replit restart)
1. Restart the Replit server (to load the new route)
2. Run:

```bash
curl -X POST "https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/admin/fix-highlands" \
  -H "Authorization: Bearer 69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6"
```

### Option C: Via Replit Shell
1. Open Replit Shell
2. Run:

```bash
cd /home/runner/JediRe
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT id FROM users LIMIT 1').then(u => {
  pool.query('UPDATE deals SET user_id = \$1 WHERE name = \\'Highlands at Satellite\\' RETURNING *', [u.rows[0].id])
    .then(r => { console.log('✅ Fixed:', r.rows[0]); pool.end(); })
    .catch(e => { console.error(e); pool.end(); });
});
"
```

---

## Verification
After running the fix, verify by:

1. Going to `/assets-owned` in the UI
2. Highlands should appear in the list
3. Should show up in rankings and all tabs

---

## Files Changed
- ✅ `backend/src/api/rest/fix-highlands.route.ts` (NEW)
- ✅ `backend/src/api/rest/index.ts` (registered route)
- ✅ `backend/src/scripts/fix-highlands-user.ts` (script version)
- ✅ Committed to master branch

## Commits
- bd090656: Add user_id fix endpoint for Highlands deal
- 7648af97: Register fix-highlands route
