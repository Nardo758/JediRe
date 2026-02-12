# Triage System - Frontend Integration Guide

Quick guide for frontend developers integrating the auto-triage system.

---

## API Endpoints

### 1. Get Triage Result

```typescript
GET /api/v1/deals/:dealId/triage
```

**Response:**
```typescript
interface TriageResult {
  dealId: string;
  score: number;              // 0-50 range
  status: 'Hot' | 'Warm' | 'Watch' | 'Pass';
  metrics: {
    locationSignals: {
      score: number;          // 0-15
      tradeArea: string | null;
      marketStrength: number; // 0-1
      proximityScore: number; // 0-1
    };
    marketSignals: {
      score: number;          // 0-15
      rentGrowth: number;
      populationGrowth: number;
      jobGrowth: number;
      trendVerdict: string;
    };
    propertySignals: {
      score: number;          // 0-20
      propertyCount: number;
      avgRent: number;
      avgOccupancy: number;
      qualityScore: number;   // 0-1
    };
  };
  strategies: string[];
  risks: string[];
  recommendations: string[];
  tradeAreaId: string | null;
  geocoded: {
    lat: number | null;
    lng: number | null;
    municipality: string | null;
    state: string | null;
  };
  triagedAt: string; // ISO timestamp
}
```

### 2. Manually Trigger Triage

```typescript
POST /api/v1/deals/:dealId/triage
```

Same response as GET endpoint. Use this if auto-triage failed or user wants to refresh.

---

## UI Components

### Deal Card - Triage Badge

Show triage status as a badge on deal cards:

```tsx
interface DealCard {
  id: string;
  name: string;
  triage_status: 'Hot' | 'Warm' | 'Watch' | 'Pass' | null;
  triage_score: number | null;
}

function TriageBadge({ status, score }: { status: string; score: number }) {
  const config = {
    Hot: { icon: '🔥', color: 'red', label: 'Hot' },
    Warm: { icon: '☀️', color: 'orange', label: 'Warm' },
    Watch: { icon: '👀', color: 'yellow', label: 'Watch' },
    Pass: { icon: '❌', color: 'gray', label: 'Pass' },
  };

  const { icon, color, label } = config[status] || {};

  return (
    <div className={`badge badge-${color}`}>
      <span>{icon}</span>
      <span>{label}</span>
      <span className="score">{score}/50</span>
    </div>
  );
}
```

### Triage Details Panel

Full triage result display:

```tsx
function TriagePanel({ dealId }: { dealId: string }) {
  const { data: triage, isLoading } = useQuery(
    ['triage', dealId],
    () => fetch(`/api/v1/deals/${dealId}/triage`).then(r => r.json())
  );

  if (isLoading) return <Skeleton />;
  if (!triage) return <EmptyState message="Not yet triaged" />;

  return (
    <div className="triage-panel">
      {/* Header */}
      <div className="triage-header">
        <h2>Triage Analysis</h2>
        <TriageBadge status={triage.status} score={triage.score} />
      </div>

      {/* Score Breakdown */}
      <div className="score-breakdown">
        <h3>Score Breakdown ({triage.score}/50)</h3>
        <ScoreBar label="Location" value={triage.metrics.locationSignals.score} max={15} />
        <ScoreBar label="Market" value={triage.metrics.marketSignals.score} max={15} />
        <ScoreBar label="Property" value={triage.metrics.propertySignals.score} max={20} />
      </div>

      {/* Strategies */}
      <div className="strategies">
        <h3>Recommended Strategies</h3>
        <ul>
          {triage.strategies.map((s, i) => (
            <li key={i}>✅ {s}</li>
          ))}
        </ul>
      </div>

      {/* Risks */}
      {triage.risks.length > 0 && (
        <div className="risks">
          <h3>Risk Flags</h3>
          <ul>
            {triage.risks.map((r, i) => (
              <li key={i}>⚠️ {r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      <div className="recommendations">
        <h3>Next Steps</h3>
        <ul>
          {triage.recommendations.map((r, i) => (
            <li key={i}>💡 {r}</li>
          ))}
        </ul>
      </div>

      {/* Metadata */}
      <div className="metadata">
        <small>
          Triaged {new Date(triage.triagedAt).toLocaleString()}
        </small>
      </div>
    </div>
  );
}
```

### Score Bar Component

```tsx
function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const percentage = (value / max) * 100;
  const color = percentage >= 80 ? 'green' : percentage >= 60 ? 'yellow' : 'red';

  return (
    <div className="score-bar">
      <div className="score-bar-label">
        <span>{label}</span>
        <span className="score-value">{value}/{max}</span>
      </div>
      <div className="score-bar-track">
        <div 
          className={`score-bar-fill ${color}`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

---

## Polling for Auto-Triage

After creating a deal, poll for triage completion:

```typescript
import { useQuery } from '@tanstack/react-query';

function useDealTriage(dealId: string) {
  return useQuery(
    ['triage', dealId],
    async () => {
      const res = await fetch(`/api/v1/deals/${dealId}/triage`);
      if (res.status === 404) return null; // Not yet triaged
      return res.json();
    },
    {
      refetchInterval: (data) => {
        // Stop polling once we have data
        return data ? false : 2000; // Poll every 2 seconds
      },
      retry: 3,
    }
  );
}

// Usage
function DealPage({ dealId }: { dealId: string }) {
  const { data: triage, isLoading } = useDealTriage(dealId);

  if (isLoading) {
    return <Spinner text="Running triage analysis..." />;
  }

  return (
    <div>
      {triage && <TriagePanel dealId={dealId} />}
    </div>
  );
}
```

---

## Pipeline View - Filter by Triage Status

Add filter buttons to pipeline view:

```tsx
function PipelineView() {
  const [triageFilter, setTriageFilter] = useState<string | null>(null);

  const { data: deals } = useQuery(['deals', triageFilter], () =>
    fetch(`/api/v1/deals?triageStatus=${triageFilter || 'all'}`).then(r => r.json())
  );

  return (
    <div>
      <div className="filters">
        <button onClick={() => setTriageFilter(null)}>All</button>
        <button onClick={() => setTriageFilter('Hot')}>🔥 Hot</button>
        <button onClick={() => setTriageFilter('Warm')}>☀️ Warm</button>
        <button onClick={() => setTriageFilter('Watch')}>👀 Watch</button>
        <button onClick={() => setTriageFilter('Pass')}>❌ Pass</button>
      </div>

      <DealGrid deals={deals} />
    </div>
  );
}
```

**Note:** You'll need to add query param support to the backend `deals.controller.ts`:

```typescript
// In deals.controller.ts
@Get()
async findAll(@Request() req, @Query() query: DealQueryDto) {
  return this.dealsService.findAll(req.user.userId, query);
}

// Update DealQueryDto to include triageStatus filter
```

---

## Mobile/Responsive Considerations

### Compact Triage Badge

For mobile:

```tsx
function CompactTriageBadge({ status, score }: { status: string; score: number }) {
  const icon = {
    Hot: '🔥',
    Warm: '☀️',
    Watch: '👀',
    Pass: '❌',
  }[status];

  return (
    <div className="compact-badge" title={`${status}: ${score}/50`}>
      <span className="icon">{icon}</span>
      <span className="score">{score}</span>
    </div>
  );
}
```

### Bottom Sheet on Mobile

Show triage details in a bottom sheet instead of a sidebar:

```tsx
import { Sheet } from '@/components/ui/sheet';

function MobileTriageSheet({ dealId, isOpen, onClose }) {
  const { data: triage } = useDealTriage(dealId);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <Sheet.Content>
        <TriagePanel dealId={dealId} />
      </Sheet.Content>
    </Sheet>
  );
}
```

---

## Loading States

### Skeleton for Triage Panel

```tsx
function TriageSkeleton() {
  return (
    <div className="triage-skeleton">
      <div className="skeleton-header" />
      <div className="skeleton-score-bars">
        <div className="skeleton-bar" />
        <div className="skeleton-bar" />
        <div className="skeleton-bar" />
      </div>
      <div className="skeleton-list" />
    </div>
  );
}
```

### Empty State

```tsx
function TriageEmptyState({ dealId }: { dealId: string }) {
  const [isTriaging, setIsTriaging] = useState(false);

  const triggerTriage = async () => {
    setIsTriaging(true);
    await fetch(`/api/v1/deals/${dealId}/triage`, { method: 'POST' });
    // Refetch will happen automatically via query invalidation
  };

  return (
    <div className="empty-state">
      <p>This deal hasn't been triaged yet.</p>
      <button onClick={triggerTriage} disabled={isTriaging}>
        {isTriaging ? 'Analyzing...' : 'Run Triage Analysis'}
      </button>
    </div>
  );
}
```

---

## Notifications

Show toast notification when triage completes:

```tsx
import { toast } from 'sonner';

function useTriageNotification(dealId: string) {
  const { data: triage } = useDealTriage(dealId);

  useEffect(() => {
    if (triage) {
      const statusEmoji = {
        Hot: '🔥',
        Warm: '☀️',
        Watch: '👀',
        Pass: '❌',
      }[triage.status];

      toast.success(
        `Triage Complete: ${statusEmoji} ${triage.status} (${triage.score}/50)`,
        {
          description: triage.recommendations[0],
          action: {
            label: 'View Details',
            onClick: () => {
              // Navigate to triage panel
            },
          },
        }
      );
    }
  }, [triage]);
}
```

---

## Styling Examples

### CSS for Triage Badge

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
}

.badge-red {
  background-color: #fee2e2;
  color: #dc2626;
}

.badge-orange {
  background-color: #ffedd5;
  color: #ea580c;
}

.badge-yellow {
  background-color: #fef3c7;
  color: #ca8a04;
}

.badge-gray {
  background-color: #f3f4f6;
  color: #6b7280;
}

.score {
  opacity: 0.8;
  font-size: 0.75rem;
}
```

### Score Bar CSS

```css
.score-bar {
  margin-bottom: 1rem;
}

.score-bar-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.score-bar-track {
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 9999px;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.score-bar-fill.green {
  background-color: #22c55e;
}

.score-bar-fill.yellow {
  background-color: #eab308;
}

.score-bar-fill.red {
  background-color: #ef4444;
}
```

---

## Data Fetching Hooks

### Complete React Query Setup

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetch triage result
export function useDealTriage(dealId: string) {
  return useQuery({
    queryKey: ['triage', dealId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/deals/${dealId}/triage`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch triage');
      
      return res.json();
    },
    refetchInterval: (data) => (data ? false : 2000), // Poll until data
  });
}

// Manually trigger triage
export function useTriageDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dealId: string) => {
      const res = await fetch(`/api/v1/deals/${dealId}/triage`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!res.ok) throw new Error('Failed to trigger triage');
      return res.json();
    },
    onSuccess: (data, dealId) => {
      // Invalidate deal queries to refetch with new triage data
      queryClient.invalidateQueries({ queryKey: ['triage', dealId] });
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
    },
  });
}
```

---

## Quick Start Checklist

Frontend integration checklist:

- [ ] Add `TriageBadge` component to deal cards
- [ ] Create `TriagePanel` component for detailed view
- [ ] Implement polling with `useDealTriage` hook
- [ ] Add filter buttons to pipeline view
- [ ] Show toast notification on triage completion
- [ ] Handle loading/empty states
- [ ] Add mobile-responsive layout
- [ ] Test with different triage statuses (Hot/Warm/Watch/Pass)
- [ ] Style score bars with appropriate colors
- [ ] Add "Re-run Triage" button for manual refresh

---

## Support

Questions? Check:
- Backend docs: `backend/docs/TRIAGE_SYSTEM.md`
- API endpoint tests: `backend/src/deals/deals.controller.spec.ts` (if exists)
- Service implementation: `backend/src/services/DealTriageService.ts`
