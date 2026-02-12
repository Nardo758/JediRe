# Migration 017: Deal State Machine

**Status:** ✅ Ready for Review  
**Date:** 2026-02-09  
**Author:** Subagent (state-machine-schema)

---

## Overview

This migration adds a complete state machine workflow to the JEDI RE platform, enabling deals to progress through defined stages with quality gates, audit trails, and user notifications.

---

## Files Delivered

### 1. **017_deal_state_machine.sql** (Migration File)
The actual database migration that creates:
- Enhanced `deals` table with state machine columns
- `state_transitions` table for audit trail
- `deal_notifications` table for user alerts
- `state_machine_config` reference table
- Helper functions for state management
- Triggers for automatic logging

**To Apply:**
```bash
psql -U jedire_app -d jedire_db -f 017_deal_state_machine.sql
```

---

### 2. **017_STATE_MACHINE_DOCS.md** (Full Documentation)
Comprehensive documentation including:
- Schema changes and table structures
- State machine definition (10 states)
- Quality gates explanation
- Helper function reference
- Usage examples and SQL queries
- Performance considerations
- Testing checklist
- Rollback plan

**Read this for:** Implementation details, API usage, examples

---

### 3. **017_ERD.md** (Entity Relationship Diagram)
Visual representation of:
- Table relationships
- JSONB field structures
- State flow diagrams
- Index strategy
- Common query patterns

**Read this for:** Understanding schema relationships, query optimization

---

### 4. **017_README.md** (This File)
Quick reference and navigation guide

---

## Quick Start

### 1. Review Current Schema
```bash
# Check existing migrations
ls -la /home/leon/clawd/jedire/backend/migrations/

# Key related migrations:
# - 030_deal_centric_schema.sql (base deals table)
# - 005_deal_categorization.sql (deal categories)
```

### 2. Apply Migration
```bash
# Backup first!
pg_dump jedire_db > backup_pre_migration_017.sql

# Apply migration
psql -U jedire_app -d jedire_db -f 017_deal_state_machine.sql

# Verify
psql -U jedire_app -d jedire_db -c "\d deals"
psql -U jedire_app -d jedire_db -c "\d state_transitions"
psql -U jedire_app -d jedire_db -c "\d deal_notifications"
```

### 3. Test Functions
```sql
-- Get unread notifications (should return empty initially)
SELECT * FROM get_unread_notifications('user-uuid');

-- Transition a test deal
SELECT transition_deal_state(
  (SELECT id FROM deals LIMIT 1),
  'UNDERWRITING',
  'Testing state transition',
  (SELECT user_id FROM deals LIMIT 1),
  '{}'::jsonb
);

-- Check transition history
SELECT * FROM get_deal_state_history((SELECT id FROM deals LIMIT 1));
```

---

## State Machine at a Glance

### States (10 Total)

1. **SIGNAL_INTAKE** → Entry point, basic validation
2. **TRIAGE** → Prioritization and fit assessment
3. **INTELLIGENCE_ASSEMBLY** → Market research and comps
4. **UNDERWRITING** → Financial analysis
5. **DEAL_PACKAGING** → Investment memo prep
6. **EXECUTION** → Active deal pursuit
7. **POST_CLOSE** → Closed deal management
8. **MARKET_NOTE** → Intelligence tracking only
9. **STALLED** → Temporarily paused
10. **ARCHIVED** → Final state, inactive

### Key Features

✅ **Audit Trail:** Every state change logged in `state_transitions`  
✅ **Quality Gates:** JSONB tracking of checkpoints per state  
✅ **Notifications:** Automatic user alerts on state changes  
✅ **Flexible Metadata:** State-specific data stored in JSONB  
✅ **Scoring:** Signal confidence (0-100) and triage score (0-50)  
✅ **Helper Functions:** Easy state management via SQL functions  

---

## Schema Changes Summary

### New Columns on `deals`
- `state` VARCHAR(50) - Current workflow state
- `state_data` JSONB - State-specific metadata
- `quality_gates` JSONB - Gate status tracking
- `signal_confidence` INT - 0-100 signal quality
- `triage_score` INT - 0-50 priority score

### New Tables
- `state_transitions` - Complete audit trail (1:N with deals)
- `deal_notifications` - User notification queue (1:N with deals)
- `state_machine_config` - State definitions and rules (reference)

### New Functions
- `transition_deal_state()` - Move deal to new state with logging
- `get_deal_state_history()` - Retrieve transition history
- `get_unread_notifications()` - Fetch user notifications
- `mark_notification_read()` - Update notification status

### New Triggers
- `trigger_auto_log_state_change` - Auto-log direct state updates

---

## Migration Behavior

### Existing Deals
All existing deals are automatically:
- Set to **TRIAGE** state (assumed past initial intake)
- Given default `signal_confidence = 50`
- Tagged with migration metadata in `state_data`
- Logged with initial transition record

### New Deals
Should start at **SIGNAL_INTAKE** and progress normally through workflow.

---

## Integration Points

### Frontend Integration
```javascript
// Get deal with state
GET /api/deals/:id
{
  "id": "uuid",
  "name": "123 Main Street",
  "state": "UNDERWRITING",
  "signal_confidence": 75,
  "triage_score": 42,
  "quality_gates": {
    "comp_data": {"status": "passed"},
    "market_context": {"status": "passed"}
  }
}

// Transition state
POST /api/deals/:id/transition
{
  "to_state": "DEAL_PACKAGING",
  "reason": "Underwriting complete, ready to package",
  "metadata": {
    "quality_gates": {
      "financial_model": "passed",
      "risk_assessment": "passed"
    }
  }
}

// Get notifications
GET /api/users/:id/notifications?unread=true
```

### Backend Integration
```typescript
// Use helper function
await db.query(`
  SELECT transition_deal_state(
    $1::uuid,
    $2::varchar,
    $3::text,
    $4::uuid,
    $5::jsonb
  )
`, [dealId, toState, reason, userId, metadata]);

// Or direct update (triggers auto-logging)
await db.query(`
  UPDATE deals
  SET state = $1,
      state_data = state_data || $2::jsonb,
      quality_gates = quality_gates || $3::jsonb
  WHERE id = $4
`, [toState, stateData, qualityGates, dealId]);
```

---

## Performance Notes

### Optimized Queries
✅ State filtering: `idx_deals_state`  
✅ Priority sorting: `idx_deals_triage_score`  
✅ JSONB queries: GIN indexes on `state_data` and `quality_gates`  
✅ Audit trail: Composite index on `state_transitions`  
✅ Notifications: `(user_id, read, created_at)` for unread queries  

### Query Examples
```sql
-- Fast: Uses idx_deals_state + idx_deals_triage_score
SELECT * FROM deals 
WHERE state = 'TRIAGE' 
ORDER BY triage_score DESC 
LIMIT 10;

-- Fast: Uses idx_state_transitions_deal_id
SELECT * FROM get_deal_state_history('deal-uuid');

-- Fast: Uses idx_deal_notifications_user_id + idx_deal_notifications_read
SELECT * FROM get_unread_notifications('user-uuid');
```

---

## Testing Checklist

Before deploying to production:

- [ ] Verify migration applies cleanly
- [ ] Check existing deals migrated to TRIAGE
- [ ] Test `transition_deal_state()` function
- [ ] Test state change auto-logging
- [ ] Test notification creation
- [ ] Test quality gate updates
- [ ] Run EXPLAIN ANALYZE on key queries
- [ ] Test with large dataset (>1000 deals)
- [ ] Verify foreign key cascades work correctly
- [ ] Test rollback procedure (on dev environment)

---

## Rollback

If needed, see **017_STATE_MACHINE_DOCS.md** section "Rollback Plan" for complete rollback script.

**⚠️ Warning:** Rollback will delete all state transition history and notifications.

---

## Next Steps

1. **Review migration files**
   - Read `017_STATE_MACHINE_DOCS.md` for full details
   - Review `017_ERD.md` for schema relationships

2. **Apply to dev environment**
   - Test migration on development database
   - Verify all functions work as expected

3. **Frontend implementation**
   - Add state machine UI components
   - Implement state transition controls
   - Show quality gate status
   - Display notifications

4. **Backend API**
   - Add state transition endpoints
   - Add notification endpoints
   - Add state analytics endpoints

5. **Monitoring**
   - Track average time in each state
   - Monitor quality gate pass/fail rates
   - Alert on stalled deals

---

## Questions?

- **Schema details:** See `017_STATE_MACHINE_DOCS.md`
- **Relationships:** See `017_ERD.md`
- **SQL file:** See `017_deal_state_machine.sql`
- **Implementation examples:** All docs include SQL examples

---

## Summary

✅ **Migration file:** `017_deal_state_machine.sql` (14KB)  
✅ **Documentation:** `017_STATE_MACHINE_DOCS.md` (21KB)  
✅ **ERD:** `017_ERD.md` (16KB)  
✅ **Total:** 3 files, 51KB of deliverables

**Ready for review and application to development environment.**

---

**Migration 017: Deal State Machine** ✅
