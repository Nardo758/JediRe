# 📝 Ready-to-Deploy Code Snippets

**Quick Reference:** Copy-paste these exact code blocks into Replit

---

## 1️⃣ **Fix: clawdbot-webhooks.routes.ts (Line ~220)**

**Find this code:**
```typescript
const propertiesResult = await pool.query(`
  SELECT 
    dp.id,
    dp.property_id as "propertyId",
    CONCAT_WS(', ', p.address_line1, p.address_line2) as address,
    p.city,
    p.state_code as state,
    p.zip_code as "zipCode"
  FROM deal_properties dp
  LEFT JOIN properties p ON p.id = dp.property_id
  WHERE dp.deal_id = $1
  ORDER BY dp.created_at
`, [deal.id]);
```

**Replace with:**
```typescript
const propertiesResult = await pool.query(`
  SELECT 
    dp.id,
    dp.property_id as "propertyId",
    p.address as address,
    p.lat,
    p.lng,
    p.zoning_code
  FROM deal_properties dp
  LEFT JOIN properties p ON p.id = dp.property_id
  WHERE dp.deal_id = $1
  ORDER BY dp.created_at
`, [deal.id]);
```

---

## 2️⃣ **Add: 6 New Clawdbot Commands (clawdbot-webhooks.routes.ts, Line ~400)**

**Find this line:**
```typescript
      default:
        return res.status(400).json({ error: 'Bad Request', message: `Unknown command: ${command}` });
```

**Insert BEFORE the `default:` case:**

```typescript
      case 'get_zoning_profile': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const zoningResult = await pool.query(`
          SELECT 
            zp.*,
            zd.name as district_name,
            zd.max_far,
            zd.max_height_ft,
            zd.max_units_per_acre,
            zd.min_parking_per_unit,
            zd.uses_permitted,
            zd.uses_conditional
          FROM zoning_profiles zp
          LEFT JOIN zoning_districts zd ON zd.code = zp.zoning_code
          WHERE zp.deal_id = $1
          ORDER BY zp.created_at DESC
          LIMIT 1
        `, [params.dealId]).catch(() => ({ rows: [] }));

        if (zoningResult.rows.length === 0) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'No zoning profile found for this deal. Create one first.',
          });
        }

        result = {
          zoningProfile: zoningResult.rows[0]
        };
        break;
      }

      case 'get_market_intelligence': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const marketResult = await pool.query(`
          SELECT 
            market_intelligence
          FROM deal_data
          WHERE deal_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `, [params.dealId]).catch(() => ({ rows: [] }));

        if (marketResult.rows.length === 0 || !marketResult.rows[0].market_intelligence) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'No market intelligence found for this deal. Run analysis first.',
          });
        }

        result = {
          marketIntelligence: marketResult.rows[0].market_intelligence
        };
        break;
      }

      case 'get_design': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const designResult = await pool.query(`
          SELECT 
            id,
            total_units,
            total_rentable_sf,
            stories,
            parking_spaces,
            amenity_sf,
            unit_mix,
            created_at,
            updated_at
          FROM design_3d_models
          WHERE deal_id = $1
          ORDER BY updated_at DESC
          LIMIT 1
        `, [params.dealId]).catch(() => ({ rows: [] }));

        if (designResult.rows.length === 0) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'No 3D design found for this deal. Create one first.',
          });
        }

        result = {
          design: designResult.rows[0]
        };
        break;
      }

      case 'get_proforma': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const proformaResult = await pool.query(`
          SELECT 
            *
          FROM deal_financial_models
          WHERE deal_id = $1 AND model_type = 'pro_forma'
          ORDER BY created_at DESC
          LIMIT 1
        `, [params.dealId]).catch(() => ({ rows: [] }));

        if (proformaResult.rows.length === 0) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'No pro forma found for this deal. Create one first.',
          });
        }

        result = {
          proforma: proformaResult.rows[0]
        };
        break;
      }

      case 'get_capital_structure': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const capitalResult = await pool.query(`
          SELECT 
            *
          FROM capital_structures
          WHERE deal_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `, [params.dealId]).catch(() => ({ rows: [] }));

        if (capitalResult.rows.length === 0) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'No capital structure found for this deal. Create one first.',
          });
        }

        result = {
          capitalStructure: capitalResult.rows[0]
        };
        break;
      }

      case 'update_deal': {
        if (!params?.dealId) {
          return res.status(400).json({ error: 'Bad Request', message: 'dealId parameter is required' });
        }

        const allowedUpdates = ['budget', 'target_units', 'timeline_start', 'timeline_end', 'status', 'description'];
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        for (const field of allowedUpdates) {
          if (params[field] !== undefined) {
            updates.push(`${field} = $${paramIndex}`);
            values.push(params[field]);
            paramIndex++;
          }
        }

        if (updates.length === 0) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'No valid fields to update',
          });
        }

        updates.push('updated_at = NOW()');
        values.push(params.dealId);

        const updateResult = await pool.query(`
          UPDATE deals
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `, values);

        if (updateResult.rows.length === 0) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Deal not found',
          });
        }

        result = {
          message: 'Deal updated successfully',
          deal: updateResult.rows[0]
        };
        break;
      }
```

---

## 3️⃣ **Fix: admin.routes.ts (Line ~220)**

**Find this code:**
```typescript
const dealsResult = await query(`
  SELECT d.id, d.name, d.address, d.city, d.state, d.status, d.user_id, d.created_at, d.updated_at,
    u.email as user_email,
    (SELECT count(*) FROM development_scenarios WHERE deal_id = d.id) as scenario_count,
    (SELECT count(*) FROM development_scenarios WHERE deal_id = d.id AND is_active = true) as active_scenarios
  FROM deals d
  LEFT JOIN users u ON u.id = d.user_id
  ${whereClause}
  ORDER BY d.updated_at DESC
  LIMIT $${params.length + 1} OFFSET $${params.length + 2}
`, [...params, limit, offset]);
```

**Replace with:**
```typescript
const dealsResult = await query(`
  SELECT d.id, d.name, d.address, d.status, d.user_id, d.created_at, d.updated_at, d.project_type, d.budget, d.target_units,
    u.email as user_email,
    (SELECT count(*) FROM development_scenarios WHERE deal_id = d.id) as scenario_count,
    (SELECT count(*) FROM development_scenarios WHERE deal_id = d.id AND is_active = true) as active_scenarios
  FROM deals d
  LEFT JOIN users u ON u.id = d.user_id
  ${whereClause}
  ORDER BY d.updated_at DESC
  LIMIT $${params.length + 1} OFFSET $${params.length + 2}
`, [...params, limit, offset]);
```

---

## 4️⃣ **Fix: admin.routes.ts (Line ~847)**

**Find this code:**
```typescript
const deal = await query(`SELECT id, name, address, city, state, created_at, updated_at FROM deals WHERE id = $1`, [req.params.id]);
```

**Replace with:**
```typescript
const deal = await query(`SELECT id, name, address, created_at, updated_at FROM deals WHERE id = $1`, [req.params.id]);
```

---

## ✅ **DEPLOYMENT CHECKLIST**

1. [ ] Open Replit project
2. [ ] Apply fix #1 (clawdbot-webhooks.routes.ts line 220)
3. [ ] Apply fix #2 (clawdbot-webhooks.routes.ts line 400 - add 6 commands)
4. [ ] Apply fix #3 (admin.routes.ts line 220)
5. [ ] Apply fix #4 (admin.routes.ts line 847)
6. [ ] Save all files
7. [ ] Click "Stop" button
8. [ ] Click "Run" button
9. [ ] Wait for server startup (~30 sec)
10. [ ] Test: `curl /api/v1/clawdbot/health`
11. [ ] Test: Update deal command (see TESTING section below)

---

## 🧪 **TESTING AFTER DEPLOYMENT**

**Test 1: Health Check**
```bash
curl "https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/clawdbot/health"
```
Expected: `{"status":"healthy", ...}`

---

**Test 2: Update Deal**
```bash
curl -X POST "https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/clawdbot/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6" \
  -d '{
    "command": "update_deal",
    "params": {
      "dealId": "e044db04-439b-4442-82df-b36a840f2fd8",
      "budget": 78000000,
      "target_units": 300,
      "timeline_start": "2026-04-01",
      "timeline_end": "2028-12-31"
    },
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```
Expected: `{"success":true, "result": {"message": "Deal updated successfully", ...}}`

---

**Test 3: Get Deal (Verify No Schema Errors)**
```bash
curl -X POST "https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/api/v1/clawdbot/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 69295404e382acd00de4facdaa053fd20ae0a1cf15dc63c0b8a55cffc0e088b6" \
  -d '{
    "command": "get_deal",
    "params": {"dealId": "e044db04-439b-4442-82df-b36a840f2fd8"},
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```
Expected: Full deal JSON (not "column p.address_line2 does not exist")

---

## 🎯 **NEXT STEPS AFTER FIXES DEPLOY**

1. ✅ All schema errors fixed
2. ✅ 6 new Clawdbot commands available
3. 🔄 **NOW:** Populate missing deal data (budget, parcel ID, lot size)
4. 🔄 **THEN:** Re-run full automated workflow
5. 🔄 **FINALLY:** Generate all 5 deliverables (PDF, sensitivity, deep dive, LOI, pitch deck)

---

**Deployment Time:** ~5 minutes  
**Complexity:** Low (copy-paste + restart)  
**Risk:** Minimal (all changes are additive or bug fixes)

🚀 **Ready to deploy!**
