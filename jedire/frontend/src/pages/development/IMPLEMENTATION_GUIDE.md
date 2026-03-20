# Implementation Guide: Project Timeline Module

## Quick Start (5 Minutes)

### Step 1: Add Route
Open your main routing file (e.g., `App.tsx` or `routes/index.tsx`):

```typescript
import { ProjectTimelinePage } from './pages/development/ProjectTimelinePage';

// Add to your routes
<Route 
  path="/development/:dealId/timeline" 
  element={<ProjectTimelinePage />} 
/>
```

### Step 2: Add Navigation Link
In your `DealDetailPage.tsx` or navigation component:

```typescript
import { Link } from 'react-router-dom';

<Link to={`/development/${dealId}/timeline`}>
  📊 View Project Timeline
</Link>
```

### Step 3: Test
Navigate to: `http://localhost:3000/development/123/timeline`

**That's it!** The component includes mock data and will render immediately.

---

## Full Integration (30 Minutes)

### 1. Create API Endpoints

**Backend (Node.js/Express example):**

```javascript
// routes/development.js
const express = require('express');
const router = express.Router();

// Get development timeline
router.get('/api/v1/deals/:dealId/development/timeline', async (req, res) => {
  const { dealId } = req.params;
  
  try {
    const timeline = await DevelopmentService.getTimeline(dealId);
    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update milestone
router.put('/api/v1/deals/:dealId/milestones/:milestoneId', async (req, res) => {
  const { dealId, milestoneId } = req.params;
  const updates = req.body;
  
  try {
    const milestone = await DevelopmentService.updateMilestone(dealId, milestoneId, updates);
    res.json({
      success: true,
      data: milestone
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
```

### 2. Create Data Hooks

**Create: `/hooks/useDevelopmentTimeline.ts`**

```typescript
import { useState, useEffect } from 'react';
import { PhaseTimeline, DevelopmentMilestone, TeamMember } from '@/pages/development/ProjectTimelinePage';

interface DevelopmentTimelineData {
  phases: PhaseTimeline[];
  milestones: DevelopmentMilestone[];
  team: TeamMember[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useDevelopmentTimeline = (dealId: string): DevelopmentTimelineData => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/v1/deals/${dealId}/development/timeline`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch timeline');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Timeline fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [dealId]);

  return {
    phases: data?.phases || [],
    milestones: data?.milestones || [],
    team: data?.team || [],
    loading,
    error,
    refetch: fetchTimeline,
  };
};
```

### 3. Update ProjectTimelinePage to Use Real Data

Replace mock data initialization:

```typescript
export const ProjectTimelinePage: React.FC = () => {
  const { dealId } = useParams();
  const navigate = useNavigate();
  
  // Replace mockPhases, mockTeam, etc. with:
  const { phases, team, loading, error, refetch } = useDevelopmentTimeline(dealId!);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading development timeline...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-600">Error: {error}</p>
          <button 
            onClick={refetch}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  // Rest of component remains the same...
};
```

### 4. Database Schema (PostgreSQL example)

```sql
-- Development phases table
CREATE TABLE development_phases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  phase VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  progress INTEGER DEFAULT 0,
  budget_planned DECIMAL(15,2),
  budget_actual DECIMAL(15,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Development milestones table
CREATE TABLE development_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  phase_id UUID REFERENCES development_phases(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_date DATE NOT NULL,
  actual_date DATE,
  status VARCHAR(20) NOT NULL,
  is_critical BOOLEAN DEFAULT FALSE,
  progress INTEGER DEFAULT 0,
  owner VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Milestone dependencies table
CREATE TABLE milestone_dependencies (
  milestone_id UUID REFERENCES development_milestones(id),
  depends_on_milestone_id UUID REFERENCES development_milestones(id),
  PRIMARY KEY (milestone_id, depends_on_milestone_id)
);

-- Development team table
CREATE TABLE development_team (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Team phase assignments table
CREATE TABLE team_phase_assignments (
  team_member_id UUID REFERENCES development_team(id),
  phase_id UUID REFERENCES development_phases(id),
  PRIMARY KEY (team_member_id, phase_id)
);

-- Create indexes
CREATE INDEX idx_phases_deal_id ON development_phases(deal_id);
CREATE INDEX idx_milestones_deal_id ON development_milestones(deal_id);
CREATE INDEX idx_milestones_phase_id ON development_milestones(phase_id);
CREATE INDEX idx_milestones_status ON development_milestones(status);
CREATE INDEX idx_team_deal_id ON development_team(deal_id);
```

---

## Integration with Existing Modules

### 1. Link from Pipeline/Deals Page

```typescript
// In DealsPage.tsx or PipelinePage.tsx
import { useNavigate } from 'react-router-dom';

const DealCard = ({ deal }: { deal: Deal }) => {
  const navigate = useNavigate();
  
  return (
    <div className="deal-card">
      {/* ...existing card content... */}
      
      {deal.type === 'development' && (
        <button
          onClick={() => navigate(`/development/${deal.id}/timeline`)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded"
        >
          📊 View Timeline
        </button>
      )}
    </div>
  );
};
```

### 2. Integrate with Pipeline3DProgress

```typescript
// In ProjectTimelinePage.tsx, update the 3D Progress Modal:

import { Pipeline3DProgress } from '@/components/pipeline/Pipeline3DProgress';

{show3DProgress && (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
    <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">3D Construction Progress</h2>
        <button
          onClick={() => setShow3DProgress(false)}
          className="text-gray-400 hover:text-gray-600 text-2xl"
        >
          ×
        </button>
      </div>
      <div className="p-6">
        <Pipeline3DProgress 
          dealId={dealId!}
          onProgressUpdate={(progress) => {
            // Update construction phase milestones based on 3D progress
            console.log('3D Progress updated:', progress);
            refetch(); // Refetch timeline data
          }}
        />
      </div>
    </div>
  </div>
)}
```

### 3. Link to Documents Module

```typescript
// Add document links to milestones
interface MilestoneWithDocs extends DevelopmentMilestone {
  documents?: {
    id: string;
    name: string;
    type: string;
    url: string;
  }[];
}

// In MilestoneCard component:
{milestone.documents && milestone.documents.length > 0 && (
  <div className="mt-3 pt-3 border-t border-gray-200">
    <h5 className="text-xs font-medium text-gray-700 mb-2">📄 Documents</h5>
    <div className="space-y-1">
      {milestone.documents.map(doc => (
        <a
          key={doc.id}
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700"
        >
          <span>📎</span>
          <span>{doc.name}</span>
        </a>
      ))}
    </div>
  </div>
)}
```

### 4. Financial Module Integration

```typescript
// Update budget when financial changes occur
export const syncBudgetWithFinancial = async (dealId: string, phaseId: string, newBudget: number) => {
  await fetch(`/api/v1/deals/${dealId}/phases/${phaseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      budget: { actual: newBudget }
    })
  });
};

// In FinancialPage.tsx, add callback:
const handleBudgetUpdate = async (phase: string, amount: number) => {
  // Update financial records
  await updateFinancialRecord(dealId, phase, amount);
  
  // Sync with development timeline
  await syncBudgetWithFinancial(dealId, phase, amount);
};
```

---

## Permissions & Access Control

```typescript
// Add permission checks
export const ProjectTimelinePage: React.FC = () => {
  const { dealId } = useParams();
  const { user, hasPermission } = useAuth();
  
  // Check if user can view development timeline
  if (!hasPermission('development:view')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-gray-600">
            You don't have permission to view development timelines.
          </p>
        </div>
      </div>
    );
  }
  
  // Check if user can edit
  const canEdit = hasPermission('development:edit');
  
  // Rest of component...
};
```

---

## Notifications & Alerts

```typescript
// Set up milestone deadline notifications
export const setupMilestoneAlerts = async (dealId: string) => {
  const milestones = await fetchMilestones(dealId);
  
  milestones.forEach(milestone => {
    if (milestone.daysUntil && milestone.daysUntil <= 7 && milestone.status !== 'completed') {
      // Send notification
      sendNotification({
        type: 'milestone-deadline',
        title: `Milestone Due Soon: ${milestone.title}`,
        message: `Due in ${milestone.daysUntil} days`,
        dealId,
        milestoneId: milestone.id,
        recipients: [milestone.owner],
      });
    }
  });
};

// Schedule daily cron job
// crontab: 0 9 * * * node scripts/checkMilestoneDeadlines.js
```

---

## Testing

### Unit Tests (Jest/React Testing Library)

```typescript
// __tests__/ProjectTimelinePage.test.tsx
import { render, screen } from '@testing-library/react';
import { ProjectTimelinePage } from '../ProjectTimelinePage';
import { BrowserRouter } from 'react-router-dom';

describe('ProjectTimelinePage', () => {
  it('renders timeline with all phases', () => {
    render(
      <BrowserRouter>
        <ProjectTimelinePage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Land Acquisition')).toBeInTheDocument();
    expect(screen.getByText('Design & Entitlements')).toBeInTheDocument();
    expect(screen.getByText('Construction')).toBeInTheDocument();
  });
  
  it('displays critical path items', () => {
    render(
      <BrowserRouter>
        <ProjectTimelinePage />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Critical Path Analysis')).toBeInTheDocument();
  });
  
  it('shows budget summary', () => {
    render(
      <BrowserRouter>
        <ProjectTimelinePage />
      </BrowserRouter>
    );
    
    // Switch to budget view
    const budgetTab = screen.getByText('💰 Budget');
    budgetTab.click();
    
    expect(screen.getByText('Total Budget')).toBeInTheDocument();
  });
});
```

---

## Performance Optimization

### 1. Code Splitting
```typescript
// Lazy load the component
const ProjectTimelinePage = lazy(() => import('./pages/development/ProjectTimelinePage'));

<Route 
  path="/development/:dealId/timeline" 
  element={
    <Suspense fallback={<LoadingSpinner />}>
      <ProjectTimelinePage />
    </Suspense>
  } 
/>
```

### 2. Data Caching
```typescript
// Use React Query for caching
import { useQuery } from 'react-query';

export const useDevelopmentTimeline = (dealId: string) => {
  return useQuery(
    ['development-timeline', dealId],
    () => fetchTimelineData(dealId),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  );
};
```

### 3. Virtualization for Large Lists
```typescript
// If you have 100+ milestones, use virtualization
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={milestones.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <MilestoneCard milestone={milestones[index]} compact />
    </div>
  )}
</FixedSizeList>
```

---

## Deployment Checklist

- [ ] Database migrations applied
- [ ] API endpoints deployed and tested
- [ ] Frontend build includes new component
- [ ] Routes configured correctly
- [ ] Permissions set up
- [ ] Notifications configured
- [ ] Error logging enabled
- [ ] Performance monitoring active
- [ ] User documentation updated
- [ ] Team trained on new features

---

## Troubleshooting

### Issue: Timeline not loading
**Solution:** Check browser console for API errors. Verify backend endpoint is accessible.

### Issue: Dates display incorrectly
**Solution:** Ensure date strings are in ISO format (YYYY-MM-DD). Check timezone settings.

### Issue: 3D Progress modal not opening
**Solution:** Verify Pipeline3DProgress component is imported correctly. Check for JavaScript errors.

### Issue: Budget calculations incorrect
**Solution:** Verify budget data types (should be numbers, not strings). Check variance calculation formula.

---

## Support & Resources

- **Design Doc:** `/home/leon/clawd/jedire/DEV_OPERATIONS_MODULES_DESIGN.md`
- **Component README:** `./ProjectTimelinePage.README.md`
- **Route Examples:** `./routes.example.tsx`
- **Related Components:**
  - Pipeline3DProgress: `/components/pipeline/Pipeline3DProgress.tsx`
  - TimelineSection: `/components/deal/sections/TimelineSection.tsx`

For additional help, contact the development team or create an issue in the project repository.
