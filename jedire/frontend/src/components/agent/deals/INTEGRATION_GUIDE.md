# Deal Pipeline Integration Guide

Quick start guide for integrating the Deal Pipeline into your JEDI RE Agent Dashboard.

## 🚀 Quick Start (5 minutes)

### Step 1: Add to Router

In your `App.tsx` or router configuration:

```tsx
import { DealPipeline } from '@/components/agent/deals';

// If using React Router:
<Route path="/agent/deals" element={<DealPipeline />} />

// Or as a standalone page:
function DealsPage() {
  return (
    <div className="h-screen">
      <DealPipeline apiBaseUrl="/api/agent" />
    </div>
  );
}
```

### Step 2: Verify Dependencies

Already installed:
- ✅ `@dnd-kit/core`
- ✅ `@dnd-kit/sortable`
- ✅ `@dnd-kit/utilities`
- ✅ `lucide-react`
- ✅ `date-fns`
- ✅ `tailwindcss`

### Step 3: Backend API Endpoints

Ensure these endpoints exist:

```
GET    /api/agent/deals           # List all deals
POST   /api/agent/deals           # Create deal
PATCH  /api/agent/deals/:id       # Update deal (including stage)
DELETE /api/agent/deals/:id       # Archive deal
POST   /api/agent/deals/:id/notes # Add note
GET    /api/agent/clients         # List clients for dropdown
```

### Step 4: Database Schema

Ensure your `deals` table has these fields:

```sql
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  property_address TEXT NOT NULL,
  deal_type VARCHAR(10) CHECK (deal_type IN ('buyer', 'seller', 'both')),
  stage VARCHAR(20) CHECK (stage IN ('lead', 'qualified', 'under_contract', 'closed', 'lost')),
  deal_value DECIMAL(12,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  commission_estimate DECIMAL(12,2) GENERATED ALWAYS AS (deal_value * commission_rate / 100) STORED,
  expected_close_date DATE,
  actual_close_date DATE,
  priority VARCHAR(10) CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  stage_changed_at TIMESTAMP DEFAULT NOW()
);

-- For days in stage calculation
CREATE OR REPLACE FUNCTION calculate_days_in_stage(stage_changed_at TIMESTAMP)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(DAY FROM NOW() - stage_changed_at)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Add index for performance
CREATE INDEX idx_deals_user_id ON deals(user_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_client_id ON deals(client_id);
```

### Step 5: Backend Route Example (Express.js)

```typescript
// routes/agent/deals.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { query } from '../database/connection';

const router = Router();

// GET /api/agent/deals
router.get('/deals', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        d.*,
        c.name as client_name,
        calculate_days_in_stage(d.stage_changed_at) as days_in_stage
      FROM deals d
      JOIN clients c ON d.client_id = c.id
      WHERE d.user_id = $1
      ORDER BY d.created_at DESC`,
      [req.user.userId]
    );
    
    res.json({ deals: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

// POST /api/agent/deals
router.post('/deals', requireAuth, async (req, res) => {
  const {
    clientId,
    propertyAddress,
    dealType,
    dealValue,
    commissionRate,
    expectedCloseDate,
    priority,
    notes
  } = req.body;

  try {
    const result = await query(
      `INSERT INTO deals (
        user_id, client_id, property_address, deal_type,
        stage, deal_value, commission_rate, expected_close_date,
        priority, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *,
        (SELECT name FROM clients WHERE id = $2) as client_name,
        0 as days_in_stage`,
      [
        req.user.userId,
        clientId,
        propertyAddress,
        dealType,
        'lead', // Default stage
        dealValue,
        commissionRate,
        expectedCloseDate,
        priority || 'medium',
        notes
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

// PATCH /api/agent/deals/:id
router.patch('/deals/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Build dynamic UPDATE query
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    const setClause = fields
      .map((field, i) => `${field} = $${i + 2}`)
      .join(', ');
    
    // If stage is being updated, also update stage_changed_at
    let extraFields = '';
    if (updates.stage) {
      extraFields = ', stage_changed_at = NOW(), updated_at = NOW()';
    } else {
      extraFields = ', updated_at = NOW()';
    }

    const result = await query(
      `UPDATE deals 
       SET ${setClause}${extraFields}
       WHERE id = $1 AND user_id = $${fields.length + 2}
       RETURNING *,
         (SELECT name FROM clients WHERE id = deals.client_id) as client_name,
         calculate_days_in_stage(stage_changed_at) as days_in_stage`,
      [id, ...values, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

// DELETE /api/agent/deals/:id
router.delete('/deals/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      'DELETE FROM deals WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

// POST /api/agent/deals/:id/notes
router.post('/deals/:id/notes', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  try {
    // Add to activity log (if you have an activities table)
    await query(
      `INSERT INTO deal_activities (deal_id, user_id, type, description)
       VALUES ($1, $2, 'note_added', $3)`,
      [id, req.user.userId, note]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// GET /api/agent/clients
router.get('/clients', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, phone, type FROM clients WHERE user_id = $1',
      [req.user.userId]
    );
    
    res.json({ clients: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

export default router;
```

### Step 6: Mount Routes in Main App

```typescript
// server.ts or app.ts
import agentDealsRoutes from './routes/agent/deals';

app.use('/api/agent', agentDealsRoutes);
```

## 🎨 Customization Examples

### Change Colors

Edit `DealPipeline.tsx`:

```tsx
const stageConfig: Record<DealStage, { label: string; color: string }> = {
  lead: { label: 'Lead', color: 'bg-purple-100 border-purple-300' },
  qualified: { label: 'Qualified', color: 'bg-indigo-100 border-indigo-300' },
  // ... etc
};
```

### Add Custom Fields

1. Add fields to Deal type in `types/index.ts`:
```tsx
export interface Deal {
  // ... existing fields
  estimatedCloseDate?: string;
  leadSource?: string;
}
```

2. Update DealForm to include new fields
3. Update backend schema and queries

### Change Default Sort

In `DealPipeline.tsx`:

```tsx
const [filters, setFilters] = useState<DealFiltersState>({
  stages: [],
  dealTypes: [],
  priorities: [],
  sortBy: 'priority', // Changed from 'date'
  sortOrder: 'desc',
});
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Create a new deal
- [ ] Edit an existing deal
- [ ] Drag a deal to a different stage
- [ ] Filter deals by client
- [ ] Filter deals by deal type
- [ ] Sort deals by value
- [ ] Click a deal to view details
- [ ] Add a note to a deal
- [ ] Archive a deal
- [ ] Test on mobile (responsive)

### Sample Test Data

```sql
-- Insert sample client
INSERT INTO clients (id, user_id, name, email, type)
VALUES 
  ('c1', 'your-user-id', 'John Smith', 'john@example.com', 'buyer'),
  ('c2', 'your-user-id', 'Jane Doe', 'jane@example.com', 'seller');

-- Insert sample deals
INSERT INTO deals (
  user_id, client_id, property_address, deal_type, stage,
  deal_value, commission_rate, priority
) VALUES 
  ('your-user-id', 'c1', '123 Oak St, Austin, TX', 'buyer', 'lead', 450000, 3, 'high'),
  ('your-user-id', 'c2', '456 Elm St, Austin, TX', 'seller', 'qualified', 600000, 2.5, 'medium');
```

## 📱 Mobile Responsiveness

The current implementation is optimized for desktop. For mobile support:

**Option 1: Horizontal Scroll**
- Already works! The pipeline scrolls horizontally on mobile
- Each column is 320px (80rem)

**Option 2: Switch to List View** (future enhancement)
```tsx
const isMobile = window.innerWidth < 768;

return isMobile ? <DealListView deals={deals} /> : <DealPipeline deals={deals} />;
```

## 🔐 Security Considerations

1. **Authentication**: Ensure JWT tokens are properly validated
2. **Authorization**: Users should only see their own deals
3. **SQL Injection**: Use parameterized queries (already done in examples)
4. **XSS**: React handles this automatically with JSX escaping
5. **CORS**: Configure backend to only allow your frontend domain

## 🚨 Troubleshooting

### "Module not found: @/types"
**Solution**: Verify `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Drag and drop not working
**Solution**: Ensure unique IDs for all deals. Check browser console for errors.

### API 401 Unauthorized
**Solution**: Verify token is stored in localStorage:
```javascript
localStorage.setItem('token', 'your-jwt-token');
```

### Stage not updating after drag
**Solution**: Check backend PATCH endpoint returns updated deal with new `daysInStage` value.

## 📚 Next Steps

1. ✅ Install dependencies
2. ✅ Create frontend components
3. ⬜ Set up backend API endpoints
4. ⬜ Set up database schema
5. ⬜ Test with sample data
6. ⬜ Deploy to production

## 🎉 You're Done!

Navigate to `/agent/deals` in your app and you should see the full kanban board!

For questions or issues, refer to the main [README.md](./README.md).
