# Replit Backend Routes Fix

## Problem
Three route files have broken database imports:
- `marketResearch.routes.ts`
- `apartmentMarket.routes.ts` 
- `trafficPrediction.routes.ts` (if pushed)

They're trying to import: `import { pool } from '../../database';`

---

## Solution

### Option 1: Fix Database Export (Recommended)

**Check your database file structure:**

```typescript
// If you have: backend/src/database.ts
// Make sure it exports pool:

import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Or if using Supabase:
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Create pool-like wrapper for compatibility
export const pool = {
  query: async (text: string, params?: any[]) => {
    // Supabase doesn't use pool.query, so wrap it
    // This is a simplified version - you may need to adapt
    return { rows: [] }; // Placeholder
  }
};
```

### Option 2: Update Import Paths in Route Files

If your database is exported differently, update all three files:

**Find and replace in:**
- `backend/src/api/rest/marketResearch.routes.ts`
- `backend/src/api/rest/apartmentMarket.routes.ts`
- `backend/src/api/rest/trafficPrediction.routes.ts`

**Replace:**
```typescript
import { pool } from '../../database';
```

**With:** (whatever your actual db export is)
```typescript
import { db } from '../../config/database';
// or
import pool from '../../db/connection';
// or
import { supabase } from '../../lib/supabase';
```

Then update all `pool.query()` calls to match your DB client.

---

## Step-by-Step Fix

### 1. Check Database Location

```bash
# In Replit terminal
ls backend/src/ | grep -E 'database|db|config'
```

Find where your database connection is defined.

### 2. Check Database Export

```bash
# Look at the export
cat backend/src/database.ts
# or
cat backend/src/db/connection.ts
# or
cat backend/src/config/database.ts
```

### 3. Update Route Imports

Once you know the correct import path, update the three route files.

### 4. Wire Up Routes in Server

**In `backend/src/index.ts` or `backend/src/server.ts`:**

```typescript
// Add these imports
import marketResearchRoutes from './api/rest/marketResearch.routes';
import apartmentMarketRoutes from './api/rest/apartmentMarket.routes';
import trafficPredictionRoutes from './api/rest/trafficPrediction.routes';

// Wire up routes (after other middleware)
app.use('/api/market-research', marketResearchRoutes);
app.use('/api/apartment-market', apartmentMarketRoutes);
app.use('/api/traffic', trafficPredictionRoutes);
```

### 5. Test Endpoints

```bash
# Test market research endpoint
curl http://localhost:3000/api/market-research/status/SOME_DEAL_ID

# Should return 404 or status info (not 500 error)
```

---

## Quick Diagnostic

**Run this in Replit terminal:**

```bash
# Check if routes are causing crashes
cd backend
grep -r "from '../../database'" src/api/rest/

# Check what your actual database export is
grep -r "export.*pool\|export.*db" src/ --include="*.ts"
```

---

## If Using Supabase (Most Likely)

Your Replit project probably uses Supabase. Here's a compatibility wrapper:

**Create: `backend/src/database.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

// PostgreSQL pool-compatible wrapper
export const pool = {
  async query(text: string, params: any[] = []) {
    // Convert PostgreSQL parameterized query to Supabase
    // This is a simple pass-through - you may need to enhance
    
    // For SELECT queries
    if (text.trim().toUpperCase().startsWith('SELECT')) {
      // Extract table name (simplified)
      const match = text.match(/FROM\s+(\w+)/i);
      if (match) {
        const table = match[1];
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        return { rows: data || [] };
      }
    }
    
    // For INSERT queries
    if (text.trim().toUpperCase().startsWith('INSERT')) {
      // Parse and handle insert
      // This is complex - you may want to refactor routes to use Supabase directly
      throw new Error('INSERT queries need to be converted to Supabase syntax');
    }
    
    // Fallback
    return { rows: [] };
  }
};

// Also export supabase for direct use
export { supabase };
```

**Better Approach:** Refactor routes to use Supabase directly instead of raw SQL.

---

## Alternative: Disable Routes Temporarily

If you want the app to work now and fix routes later:

**Comment out in `backend/src/index.ts`:**

```typescript
// TODO: Fix database imports
// import marketResearchRoutes from './api/rest/marketResearch.routes';
// app.use('/api/market-research', marketResearchRoutes);
```

This way they won't crash the server, but features won't work until fixed.

---

## Testing After Fix

Once routes are connected:

### 1. Test Market Research
```bash
curl -X POST http://localhost:3000/api/market-research/generate/DEAL_ID
```

### 2. Test Apartment Market
```bash
curl http://localhost:3000/api/apartment-market/search?city=Austin&state=TX
```

### 3. Test Traffic Prediction
```bash
curl -X POST http://localhost:3000/api/traffic/predict/PROPERTY_ID
```

---

## Need Help?

If you get stuck, share:
1. Output of: `ls backend/src/ -R | grep -E 'database|db'`
2. First 20 lines of your database file
3. Error messages from Replit console

I can provide exact fix based on your setup!

---

**Status:** Routes exist but not connected  
**Priority:** Medium (app works without them, but features missing)  
**Time to fix:** 5-10 minutes once database export is confirmed
