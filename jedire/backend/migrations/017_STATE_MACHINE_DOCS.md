# Deal State Machine - Schema Documentation

**Migration:** 017_deal_state_machine.sql  
**Date:** 2026-02-09  
**Purpose:** Add workflow state machine support to the JEDI RE platform

---

## Overview

This migration adds a comprehensive state machine to track deals through their lifecycle, from initial signal intake through closing and post-close management. The implementation includes:

- State tracking and validation
- State transition audit trail
- Quality gate tracking per state
- User notifications for state changes
- Helper functions for state management

---

## Database Schema Changes

### 1. Enhanced `deals` Table

**New Columns:**

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| `state` | VARCHAR(50) | Current workflow state | Enum check, indexed |
| `state_data` | JSONB | State-specific metadata | GIN indexed |
| `quality_gates` | JSONB | Quality gate status | GIN indexed |
| `signal_confidence` | INTEGER | Signal quality score | 0-100 |
| `triage_score` | INTEGER | Prioritization score | 0-50 |

**Indexes:**
- `idx_deals_state` - Fast filtering by state
- `idx_deals_signal_confidence` - Sort by confidence
- `idx_deals_triage_score` - Sort by priority
- `idx_deals_state_data` - JSONB queries on state metadata
- `idx_deals_quality_gates` - JSONB queries on gate status

---

### 2. New `state_transitions` Table

Audit trail for all state changes.

**Schema:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `deal_id` | UUID | Reference to deals table |
| `from_state` | VARCHAR(50) | Previous state (NULL for initial) |
| `to_state` | VARCHAR(50) | New state |
| `reason` | TEXT | Human-readable transition reason |
| `user_id` | UUID | User who triggered transition |
| `metadata` | JSONB | Additional context (quality gates, scores) |
| `transitioned_at` | TIMESTAMP | When transition occurred |

**Indexes:**
- `idx_state_transitions_deal_id` - Get history for a deal
- `idx_state_transitions_from_state` - Query by source state
- `idx_state_transitions_to_state` - Query by destination state
- `idx_state_transitions_user_id` - User activity tracking
- `idx_state_transitions_transitioned_at` - Chronological queries
- `idx_state_transitions_metadata` - JSONB queries

**Use Cases:**
- View complete deal history
- Track user activity across deals
- Analyze state transition patterns
- Audit quality gate decisions

---

### 3. New `deal_notifications` Table

User notifications for deal events.

**Schema:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `deal_id` | UUID | Related deal |
| `user_id` | UUID | Notification recipient |
| `type` | VARCHAR(50) | Notification category |
| `message` | TEXT | Human-readable message |
| `read` | BOOLEAN | Read status |
| `metadata` | JSONB | Additional context (links, actions) |
| `created_at` | TIMESTAMP | When notification was created |
| `read_at` | TIMESTAMP | When notification was read |

**Indexes:**
- `idx_deal_notifications_deal_id` - Notifications for a deal
- `idx_deal_notifications_user_id` - User's notifications
- `idx_deal_notifications_read` - Filter unread notifications
- `idx_deal_notifications_type` - Group by notification type
- `idx_deal_notifications_created_at` - Chronological order

**Notification Types:**
- `state_change` - Deal moved to new state
- `quality_gate_failed` - Required quality gate not met
- `quality_gate_passed` - Required quality gate met
- `task_due` - Task approaching due date
- `assignment` - Deal assigned to user
- `mention` - User mentioned in comment

---

### 4. New `state_machine_config` Table

Reference data for state definitions.

**Schema:**

| Column | Type | Description |
|--------|------|-------------|
| `state` | VARCHAR(50) | State identifier (PK) |
| `display_name` | VARCHAR(100) | Human-readable name |
| `description` | TEXT | State description |
| `color` | VARCHAR(20) | UI color (hex) |
| `icon` | VARCHAR(50) | Icon name |
| `quality_gates` | TEXT[] | Required quality gates |
| `next_states` | TEXT[] | Allowed transitions |
| `sort_order` | INTEGER | Display order |

**Seed Data:** Pre-populated with 10 states (see State Machine Definition below)

---

## State Machine Definition

### State Flow Diagram

```
┌─────────────────┐
│ SIGNAL_INTAKE   │──┐
└─────────────────┘  │
         │           │
         ▼           │
┌─────────────────┐  │
│    TRIAGE       │◄─┼─────┐
└─────────────────┘  │     │
    │     │          │     │
    │     └──────────┼──►┌─────────────────┐
    │                │   │  MARKET_NOTE    │
    │                │   └─────────────────┘
    ▼                │           │
┌─────────────────┐  │           │
│ INTELLIGENCE_   │  │           │
│   ASSEMBLY      │  │           │
└─────────────────┘  │           │
         │           │           │
         ▼           │           │
┌─────────────────┐  │           │
│  UNDERWRITING   │  │           │
└─────────────────┘  │           │
         │           │           │
         ▼           │           │
┌─────────────────┐  │           │
│ DEAL_PACKAGING  │  │           │
└─────────────────┘  │           │
         │           │           │
         ▼           │           │
┌─────────────────┐  │           │
│   EXECUTION     │  │           │
└─────────────────┘  │           │
         │           │           │
         ▼           │           │
┌─────────────────┐  │           │
│   POST_CLOSE    │  │           │
└─────────────────┘  │           │
         │           │           │
         └───────────┼───────────┘
                     │
      ┌──────────────┼──────────┐
      │              ▼          │
┌─────────────┐  ┌─────────┐   │
│   STALLED   │  │ARCHIVED │◄──┘
└─────────────┘  └─────────┘
      │              ▲
      └──────────────┘
```

### States

1. **SIGNAL_INTAKE** (Gray `#94a3b8`)
   - Entry point for all new deals
   - Basic validation required
   - Next: TRIAGE, ARCHIVED

2. **TRIAGE** (Blue `#3b82f6`)
   - Evaluate priority and fit
   - Assign triage_score (0-50)
   - Quality gates: priority_score, fit_assessment
   - Next: INTELLIGENCE_ASSEMBLY, MARKET_NOTE, ARCHIVED

3. **INTELLIGENCE_ASSEMBLY** (Purple `#8b5cf6`)
   - Gather market data and comps
   - Build property context
   - Quality gates: comp_data, market_context
   - Next: UNDERWRITING, STALLED

4. **UNDERWRITING** (Amber `#f59e0b`)
   - Financial modeling
   - Risk assessment
   - Quality gates: financial_model, risk_assessment
   - Next: DEAL_PACKAGING, STALLED

5. **DEAL_PACKAGING** (Pink `#ec4899`)
   - Investment memo preparation
   - Materials assembly
   - Quality gates: investment_memo, materials_complete
   - Next: EXECUTION, STALLED

6. **EXECUTION** (Green `#10b981`)
   - Active deal pursuit
   - LOI, due diligence, closing
   - Quality gates: loi_submitted, due_diligence_complete
   - Next: POST_CLOSE, ARCHIVED

7. **POST_CLOSE** (Teal `#14b8a6`)
   - Deal closed
   - Ongoing asset management
   - Next: ARCHIVED

8. **MARKET_NOTE** (Indigo `#6366f1`)
   - Intelligence tracking only
   - Not actively pursued
   - Next: TRIAGE, ARCHIVED

9. **STALLED** (Red `#ef4444`)
   - Temporarily paused
   - Can resume to any previous state
   - Next: TRIAGE, INTELLIGENCE_ASSEMBLY, UNDERWRITING, ARCHIVED

10. **ARCHIVED** (Slate `#64748b`)
    - Final state
    - Deal no longer active
    - No exits

---

## Quality Gates

Quality gates are checkpoints that must be met before moving to the next state.

### Structure

```json
{
  "basic_validation": {
    "status": "passed",
    "checked_at": "2026-02-09T10:00:00Z",
    "checked_by": "user-uuid",
    "notes": "All required fields present"
  },
  "priority_score": {
    "status": "pending",
    "checked_at": null,
    "checked_by": null
  }
}
```

**Status Values:**
- `pending` - Not yet evaluated
- `passed` - Requirements met
- `failed` - Requirements not met
- `waived` - Manually bypassed

### Quality Gates by State

| State | Required Gates |
|-------|----------------|
| SIGNAL_INTAKE | basic_validation |
| TRIAGE | priority_score, fit_assessment |
| INTELLIGENCE_ASSEMBLY | comp_data, market_context |
| UNDERWRITING | financial_model, risk_assessment |
| DEAL_PACKAGING | investment_memo, materials_complete |
| EXECUTION | loi_submitted, due_diligence_complete |
| POST_CLOSE | (none) |
| MARKET_NOTE | (none) |
| STALLED | (none) |
| ARCHIVED | (none) |

---

## Helper Functions

### `transition_deal_state()`

Transition a deal to a new state with full audit trail.

**Parameters:**
- `p_deal_id` (UUID) - Deal to transition
- `p_to_state` (VARCHAR) - Destination state
- `p_reason` (TEXT) - Human-readable reason
- `p_user_id` (UUID) - User triggering transition
- `p_metadata` (JSONB) - Additional context

**Returns:** BOOLEAN (success)

**Side Effects:**
1. Updates `deals.state`
2. Inserts `state_transitions` record
3. Creates `deal_notifications` entry
4. Logs to `deal_activity`

**Example:**
```sql
SELECT transition_deal_state(
  'deal-uuid-123',
  'UNDERWRITING',
  'All comps gathered, ready for financial analysis',
  'user-uuid-456',
  '{"quality_gates": {"comp_data": "passed", "market_context": "passed"}}'::jsonb
);
```

---

### `get_deal_state_history()`

Retrieve complete state transition history for a deal.

**Parameters:**
- `p_deal_id` (UUID)

**Returns:** TABLE with columns:
- `from_state` (VARCHAR)
- `to_state` (VARCHAR)
- `reason` (TEXT)
- `user_id` (UUID)
- `transitioned_at` (TIMESTAMP)
- `metadata` (JSONB)

**Example:**
```sql
SELECT * FROM get_deal_state_history('deal-uuid-123');
```

---

### `get_unread_notifications()`

Get all unread notifications for a user.

**Parameters:**
- `p_user_id` (UUID)

**Returns:** TABLE with columns:
- `id` (UUID)
- `deal_id` (UUID)
- `deal_name` (VARCHAR)
- `type` (VARCHAR)
- `message` (TEXT)
- `created_at` (TIMESTAMP)
- `metadata` (JSONB)

**Example:**
```sql
SELECT * FROM get_unread_notifications('user-uuid-456');
```

---

### `mark_notification_read()`

Mark a notification as read.

**Parameters:**
- `p_notification_id` (UUID)

**Returns:** BOOLEAN (success)

**Example:**
```sql
SELECT mark_notification_read('notification-uuid-789');
```

---

## Triggers

### `trigger_auto_log_state_change`

Automatically logs state transitions when `deals.state` is updated directly (not via `transition_deal_state()`).

**Fires:** AFTER UPDATE on `deals` table  
**Condition:** `OLD.state IS DISTINCT FROM NEW.state`

**Purpose:** Ensure all state changes are captured, even when bypassing the helper function.

---

## Migration Behavior

### Existing Deals

All existing deals are set to **TRIAGE** state with:
- `signal_confidence = 50` (mid-range default)
- `state_data` includes migration flag
- Initial state transition logged as "Migrated from legacy system"

**Rationale:** Existing deals have already passed initial intake, so starting at TRIAGE is appropriate.

### New Deals

New deals should start at **SIGNAL_INTAKE** and progress through the workflow normally.

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                           DEALS                             │
├─────────────────────────────────────────────────────────────┤
│ id (PK)                                                     │
│ user_id (FK → users)                                        │
│ name                                                        │
│ boundary (GEOMETRY)                                         │
│ project_type                                                │
│ status                                                      │
│ deal_category                                               │
│ development_type                                            │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ STATE MACHINE (Migration 017)                        │   │
│ │ • state VARCHAR(50)                                  │   │
│ │ • state_data JSONB                                   │   │
│ │ • quality_gates JSONB                                │   │
│ │ • signal_confidence INT                              │   │
│ │ • triage_score INT                                   │   │
│ └──────────────────────────────────────────────────────┘   │
│ created_at, updated_at                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│   STATE_TRANSITIONS     │         │  DEAL_NOTIFICATIONS     │
├─────────────────────────┤         ├─────────────────────────┤
│ id (PK)                 │         │ id (PK)                 │
│ deal_id (FK → deals)    │         │ deal_id (FK → deals)    │
│ from_state              │         │ user_id (FK → users)    │
│ to_state                │         │ type                    │
│ reason                  │         │ message                 │
│ user_id (FK → users)    │         │ read                    │
│ metadata (JSONB)        │         │ metadata (JSONB)        │
│ transitioned_at         │         │ created_at              │
└─────────────────────────┘         │ read_at                 │
                                    └─────────────────────────┘

┌─────────────────────────┐
│ STATE_MACHINE_CONFIG    │
├─────────────────────────┤
│ state (PK)              │
│ display_name            │
│ description             │
│ color                   │
│ icon                    │
│ quality_gates (TEXT[])  │
│ next_states (TEXT[])    │
│ sort_order              │
└─────────────────────────┘
```

**Relationships:**
- `deals` → `state_transitions` (1:N) - One deal has many transitions
- `deals` → `deal_notifications` (1:N) - One deal generates many notifications
- `users` → `state_transitions` (1:N) - One user triggers many transitions
- `users` → `deal_notifications` (1:N) - One user receives many notifications
- `state_machine_config` (reference only) - Standalone lookup table

---

## Usage Examples

### Example 1: Create New Deal with State

```sql
-- Insert new deal at SIGNAL_INTAKE
INSERT INTO deals (
  user_id,
  name,
  boundary,
  project_type,
  state,
  signal_confidence,
  state_data
) VALUES (
  'user-uuid-123',
  '123 Main Street Acquisition',
  ST_GeomFromText('POLYGON(...)', 4326),
  'multifamily',
  'SIGNAL_INTAKE',
  75,
  '{"source": "email", "initial_notes": "Strong cash flow potential"}'::jsonb
);

-- Log initial state
INSERT INTO state_transitions (deal_id, from_state, to_state, reason, user_id)
VALUES (
  'new-deal-uuid',
  NULL,
  'SIGNAL_INTAKE',
  'Initial signal received from broker email',
  'user-uuid-123'
);
```

---

### Example 2: Transition Through Workflow

```sql
-- Move from SIGNAL_INTAKE to TRIAGE
SELECT transition_deal_state(
  'deal-uuid',
  'TRIAGE',
  'Basic validation passed, ready for prioritization',
  'user-uuid',
  '{"quality_gates": {"basic_validation": "passed"}}'::jsonb
);

-- Update triage score
UPDATE deals
SET triage_score = 42,
    state_data = state_data || '{"priority_factors": ["good_location", "strong_cap_rate"]}'::jsonb
WHERE id = 'deal-uuid';

-- Move to INTELLIGENCE_ASSEMBLY
SELECT transition_deal_state(
  'deal-uuid',
  'INTELLIGENCE_ASSEMBLY',
  'High priority (score: 42), proceeding to research phase',
  'user-uuid',
  '{"triage_score": 42}'::jsonb
);
```

---

### Example 3: Handle Stalled Deal

```sql
-- Move to STALLED
SELECT transition_deal_state(
  'deal-uuid',
  'STALLED',
  'Waiting for seller to provide financials',
  'user-uuid',
  '{"stall_reason": "missing_financials", "follow_up_date": "2026-03-01"}'::jsonb
);

-- Later, resume from STALLED
SELECT transition_deal_state(
  'deal-uuid',
  'UNDERWRITING',
  'Financials received, resuming analysis',
  'user-uuid',
  '{"resume_reason": "financials_received"}'::jsonb
);
```

---

### Example 4: Query Deals by State

```sql
-- Get all deals in underwriting
SELECT id, name, triage_score, signal_confidence
FROM deals
WHERE state = 'UNDERWRITING'
ORDER BY triage_score DESC;

-- Get deals needing attention (high priority, stuck in early stages)
SELECT id, name, state, triage_score, created_at
FROM deals
WHERE state IN ('TRIAGE', 'INTELLIGENCE_ASSEMBLY')
  AND triage_score > 40
  AND created_at < NOW() - INTERVAL '7 days'
ORDER BY triage_score DESC;
```

---

### Example 5: Check Quality Gates

```sql
-- Check quality gate status for a deal
SELECT 
  id,
  name,
  state,
  quality_gates,
  quality_gates->>'comp_data' as comp_data_status,
  quality_gates->>'market_context' as market_context_status
FROM deals
WHERE id = 'deal-uuid';

-- Update quality gate
UPDATE deals
SET quality_gates = jsonb_set(
  quality_gates,
  '{comp_data}',
  '{"status": "passed", "checked_at": "2026-02-09T15:30:00Z", "checked_by": "user-uuid"}'::jsonb
)
WHERE id = 'deal-uuid';
```

---

### Example 6: Notification Management

```sql
-- Get user's unread notifications
SELECT * FROM get_unread_notifications('user-uuid');

-- Mark notification as read
SELECT mark_notification_read('notification-uuid');

-- Create custom notification
INSERT INTO deal_notifications (deal_id, user_id, type, message, metadata)
VALUES (
  'deal-uuid',
  'user-uuid',
  'quality_gate_failed',
  'Comp data quality gate failed: insufficient comparable properties',
  '{"required": 5, "found": 2, "gate": "comp_data"}'::jsonb
);
```

---

## Performance Considerations

### Indexes

All critical query paths are indexed:
- State filtering: `idx_deals_state`
- Sorting by priority: `idx_deals_triage_score`, `idx_deals_signal_confidence`
- JSONB queries: GIN indexes on `state_data` and `quality_gates`
- Audit trail: Indexes on `state_transitions` for deal history
- Notifications: Composite index on `(user_id, read, created_at)`

### Query Optimization

**Good:**
```sql
-- Uses idx_deals_state
SELECT * FROM deals WHERE state = 'UNDERWRITING';

-- Uses idx_deals_state + idx_deals_triage_score
SELECT * FROM deals 
WHERE state = 'TRIAGE' 
ORDER BY triage_score DESC 
LIMIT 10;
```

**Avoid:**
```sql
-- Full table scan on JSONB
SELECT * FROM deals WHERE state_data->>'priority' = 'high';

-- Use extracted column instead
ALTER TABLE deals ADD COLUMN priority VARCHAR(20) GENERATED ALWAYS AS (state_data->>'priority') STORED;
CREATE INDEX idx_deals_priority ON deals(priority);
```

---

## Testing Checklist

- [ ] All states are in constraint check
- [ ] State transitions trigger audit logging
- [ ] Notifications are created on state change
- [ ] Quality gates can be updated via JSONB operations
- [ ] `transition_deal_state()` function works end-to-end
- [ ] Existing deals migrated to TRIAGE state
- [ ] Indexes improve query performance (use EXPLAIN ANALYZE)
- [ ] User can view state history for a deal
- [ ] User can see unread notifications
- [ ] Marking notification as read updates timestamp

---

## Future Enhancements

1. **State Transition Validation**
   - Enforce `next_states` from `state_machine_config`
   - Prevent invalid transitions via trigger

2. **Quality Gate Automation**
   - Auto-check quality gates based on data availability
   - Trigger notifications when gates fail

3. **SLA Tracking**
   - Add `expected_duration` to states
   - Alert when deals stay in state too long

4. **Bulk Operations**
   - Function to transition multiple deals at once
   - Batch notification creation

5. **Webhooks**
   - External notifications on state changes
   - Integration with Slack, email, etc.

6. **State Analytics**
   - Average time in each state
   - Conversion rates between states
   - Bottleneck identification

---

## Rollback Plan

If migration needs to be rolled back:

```sql
-- Drop new tables
DROP TABLE IF EXISTS state_machine_config CASCADE;
DROP TABLE IF EXISTS deal_notifications CASCADE;
DROP TABLE IF EXISTS state_transitions CASCADE;

-- Drop new columns
ALTER TABLE deals DROP COLUMN IF EXISTS state;
ALTER TABLE deals DROP COLUMN IF EXISTS state_data;
ALTER TABLE deals DROP COLUMN IF EXISTS quality_gates;
ALTER TABLE deals DROP COLUMN IF EXISTS signal_confidence;
ALTER TABLE deals DROP COLUMN IF EXISTS triage_score;

-- Drop functions
DROP FUNCTION IF EXISTS transition_deal_state;
DROP FUNCTION IF EXISTS get_deal_state_history;
DROP FUNCTION IF EXISTS get_unread_notifications;
DROP FUNCTION IF EXISTS mark_notification_read;
DROP FUNCTION IF EXISTS auto_log_state_change;

-- Drop trigger
DROP TRIGGER IF EXISTS trigger_auto_log_state_change ON deals;
```

**Warning:** This will delete all state transition history and notifications.

---

## Support

For questions or issues with this migration:
- Review this documentation
- Check existing deals for examples
- Query `state_machine_config` for reference data
- Examine `state_transitions` for audit trail

---

**Migration 017 Complete** ✅
