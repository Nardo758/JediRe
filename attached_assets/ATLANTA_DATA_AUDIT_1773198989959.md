# Atlanta Development - Data Audit Report
**Deal ID:** `e044db04-439b-4442-82df-b36a840f2fd8`  
**Date:** 2026-03-10  

---

## 🔴 CRITICAL MISMATCHES

### 1. Acres Field
| Source | Value | Status |
|--------|-------|--------|
| `deals.acres` (DB) | `30.83253686542621` | ❌ WRONG (latitude coordinate) |
| `deals.description` | `4.81-acre BeltLine site` | ✅ CORRECT |
| Expected | `4.81` | |

**Root Cause:** During deal creation or import, the latitude coordinate was stored in the `acres` field instead of the actual lot size.

**Fix:**
```sql
UPDATE deals SET acres = 4.81 WHERE id = 'e044db04-439b-4442-82df-b36a840f2fd8';
```

---

### 2. Property Data Incomplete
| Field | Value | Status |
|-------|-------|--------|
| `properties.lat` | `null` | ❌ MISSING |
| `properties.lng` | `null` | ❌ MISSING |
| `properties.state` | `null` | ❌ MISSING |
| `properties.zipCode` | `null` | ❌ MISSING |
| `properties.city` | `Georgia 30324` | ❌ WRONG (contains state + zip, not city) |
| `properties.parcel_id` | `null` | ❌ MISSING |
| `properties.lot_size_acres` | `null` | ❌ MISSING |
| `properties.land_cost` | `null` | ❌ MISSING |
| `properties.zoning_code` | `null` | ❌ MISSING |

**Root Cause:** Address parsing failed - city field contains "Georgia 30324" instead of "Atlanta". Property fields not populated from municipal API.

**Fix:**
```sql
UPDATE properties SET 
  city = 'Atlanta',
  state = 'GA',
  zipCode = '30324',
  lat = 33.7896,
  lng = -84.3658,
  parcel_id = '17-0087-0001',  -- Need to look up actual parcel
  lot_size_acres = 4.81,
  zoning_code = 'MRC-2-C'
WHERE id = '2da147dd-c2f5-4fe5-a864-d1f24ac835a1';
```

---

## 🟡 DATA PROPAGATION ISSUES

### 3. Zoning Data Not Connected
| Module | Zoning Code | Max Units | FAR | Max Stories |
|--------|-------------|-----------|-----|-------------|
| Deal Description | MRC-2-C | 313 | 4.0 | 5 |
| Properties Table | `null` | - | - | - |
| Zoning Module | ? | ? | ? | ? |
| Overview Display | `—` | 300u | 2.0 | 6 |

**Root Cause:** Municipal API data (MRC-2-C zoning) exists in description but never populated to properties table or zoning module.

---

### 4. Units Mismatch
| Source | Units | Status |
|--------|-------|--------|
| `deals.targetUnits` | 300 | User input |
| Description (zoning max) | 313 | Municipal data |
| Overview display | 300 | |

**Note:** Not necessarily wrong - user may have intentionally targeted fewer units than zoning allows. But should show zoning max vs target.

---

## 🟢 CORRECT DATA

| Field | Value | Source |
|-------|-------|--------|
| `deals.name` | Atlanta Development | User input |
| `deals.budget` | $78,000,000 | User input |
| `deals.targetUnits` | 300 | User input |
| `deals.address` | 1950 Piedmont Circle NE, Atlanta, GA 30324 | User input |
| `deals.projectType` | multifamily | User input |
| `deals.status` | active | System |

---

## 📋 RECOMMENDED FIXES

### Immediate (Database)
```sql
-- 1. Fix acres
UPDATE deals SET acres = 4.81 
WHERE id = 'e044db04-439b-4442-82df-b36a840f2fd8';

-- 2. Fix property data
UPDATE properties SET 
  city = 'Atlanta',
  state = 'GA', 
  zip_code = '30324',
  lat = 33.7896,
  lng = -84.3658,
  lot_size_acres = 4.81,
  zoning_code = 'MRC-2-C',
  land_cost = NULL  -- Unknown, user should input
WHERE deal_id = 'e044db04-439b-4442-82df-b36a840f2fd8';
```

### Code Fixes Needed
1. **Address Parser** - Fix city/state/zip parsing from full address string
2. **Deal Import** - Don't store coordinates in acres field
3. **Municipal API Integration** - Auto-populate zoning fields from API response
4. **Validation on Save** - Check for obviously wrong values (acres > 100 = coordinate)

---

## 🔄 DATA FLOW DIAGRAM

```
DEAL CREATION                    MUNICIPAL API
     │                                │
     ▼                                ▼
┌─────────────┐              ┌─────────────────┐
│ deals table │              │ Zoning Module   │
│ • name ✓    │              │ • MRC-2-C       │
│ • budget ✓  │              │ • FAR 4.0       │
│ • acres ❌   │◄─── NOT ───►│ • Max 313 units │
│ • target ✓  │   CONNECTED  │ • 5 stories     │
└─────────────┘              └─────────────────┘
     │                                │
     ▼                                │
┌─────────────────┐                   │
│ properties      │◄──── NOT ─────────┘
│ • lat/lng ❌    │      POPULATED
│ • zoning ❌     │
│ • lot_size ❌   │
└─────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│ FRONTEND (Overview, Financial, etc) │
│ Shows: ❌ wrong acres, ❌ missing   │
│        zoning, ❌ fallback values   │
└─────────────────────────────────────┘
```

---

## 📊 MODULES AFFECTED

| Module | Impact | Fix Priority |
|--------|--------|--------------|
| Overview | Shows "—" for lot size, wrong zoning | HIGH |
| Site + Zoning | Missing zoning constraints | HIGH |
| 3D Design | Can't calculate buildable area | HIGH |
| Financial | TDC/unit wrong if using bad acres | HIGH |
| Development Capacity | Wrong density calculations | HIGH |
| Unit Mix | Using fallback instead of zoning max | MEDIUM |
