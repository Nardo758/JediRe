# Claude Code Prompt: Regulatory Market Research Section

Read these files first:
1. `frontend/src/components/zoning/tabs/BoundaryAndZoningTab.tsx` — find Section 2 "Nearby Entitlement Activity" (starts line 507). Read the full section including the type cards, AI insights, common rezone transitions, and the `fetchNearbyEntitlements` function (line 107). Note the API call: `GET /api/v1/deals/${dealId}/nearby-entitlements`
2. `frontend/src/components/zoning/tabs/DevelopmentCapacityTab.tsx` — find the "Market Reality Check" section (starts around line 830). Read through line 1130. Note the data comes from `densityBenchmarks` state which is fetched from `GET /api/v1/deals/${dealId}/density-benchmarks`. Note the project data fields: projectName, address, landAcres, unitCount, densityAchieved, farAchieved, lotCoverageAchieved, entitlementType, zoningFrom, zoningTo, stories, buildingSf, ordinanceUrl, sourceUrl, docketNumber, similarityScore
3. Read the `docLinks` helper function in DevelopmentCapacityTab (around line 882) — it renders ordinance PDF links, source URL links, and docket number badges per project row

Now make these changes:

## STEP 1: Create the combined component

Create `frontend/src/components/zoning/tabs/RegulatoryMarketResearch.tsx`. This is a self-contained component that replaces both the "Nearby Entitlement Activity" section from Tab 1 AND the "Market Reality Check" section from Tab 2.

Props:
```typescript
interface RegulatoryMarketResearchProps {
  dealId: string;
  currentZoningCode?: string;   // user's confirmed zoning code — used to highlight matching rows
  municipality?: string;
}
```

On mount, fetch BOTH APIs in parallel:
```typescript
const [entitlements, setEntitlements] = useState<any>(null);
const [benchmarks, setBenchmarks] = useState<any>(null);
const [searchQuery, setSearchQuery] = useState('');
const [activeFilter, setActiveFilter] = useState<string | null>(null);

useEffect(() => {
  if (!dealId) return;
  Promise.all([
    apiClient.get(`/api/v1/deals/${dealId}/nearby-entitlements`).catch(() => null),
    apiClient.get(`/api/v1/deals/${dealId}/density-benchmarks`).catch(() => null),
  ]).then(([entRes, benchRes]) => {
    setEntitlements(entRes?.data?.data || null);
    setBenchmarks(benchRes?.data?.data || benchRes?.data || null);
  });
}, [dealId]);
```

## STEP 2: Build the unified project list

Merge both data sources into one array of records. The benchmark projects already have the right fields. The entitlement records may need normalization. Create a unified record type:

```typescript
interface RegulatoryRecord {
  id: string;
  projectName: string;
  address: string;
  zoningCode: string;        // the base zoning code this project was filed under
  zoningFrom: string | null; // for rezonings: the original code
  zoningTo: string | null;   // for rezonings: the target code
  entitlementType: string;   // rezone | cup | variance | by_right | site_plan
  approved: boolean | null;
  unitCount: number | null;
  densityAchieved: number | null;
  farAchieved: number | null;
  lotCoverageAchieved: number | null;
  stories: number | null;
  buildingSf: number | null;
  landAcres: number | null;
  similarityScore: number | null;
  timelineMonths: number | null;
  ordinanceUrl: string | null;
  sourceUrl: string | null;
  docketNumber: string | null;
  isUpzone: boolean;         // derived: does zoningTo have higher density than zoningFrom?
  matchesUserCode: boolean;  // derived: does zoningCode match currentZoningCode?
}
```

Build this array from both sources. De-duplicate by address + entitlementType (if a project appears in both datasets, merge the fields, preferring the benchmark version since it has more detail).

## STEP 3: Layout the section

The section has this structure:

```
┌──────────────────────────────────────────────────────────────┐
│ 🔬 REGULATORY MARKET RESEARCH                               │
│    Entitlement activity in [municipality] — X records        │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🔍 [Search: rezones, upzones, CUPs, code, address...]   │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ [All] [Rezones] [Upzones] [Variances] [CUPs] [By-Right]    │ ← quick filter chips
│                                                              │
│ [If active filter, show removable chip: "Showing: Rezones ×"]│
│                                                              │
│ ┌ AI Insights (if available) ────────────────────────────┐  │
│ │ 📈 Trend: "85% of rezonings approved in last 3 years"  │  │
│ │ 💡 Opportunity: "Your code has 3x rezone success rate"  │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌ Summary Stats Bar ─────────────────────────────────────┐  │
│ │ Avg Density: 42.1 / 109 u/ac (39%)                    │  │
│ │ Avg FAR: 1.8 / 3.2 (56%)                              │  │
│ │ Avg Lot Cov: 62% / 85% (73%)                          │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌ Best Comparable (if available) ─────────────────────────┐ │
│ │ 92% match · Midtown Crossing · 2.1 ac · 196 units      │ │
│ │ 93.3 u/ac · FAR 2.8 · Rezone · Ordinance PDF ↗        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌ Project Table ──────────────────────────────────────────┐ │
│ │ # │ Project      │ Lot  │ Units │ Density │ Path │ Docs│ │
│ │ 1 │ Buckhead Cr  │ 3.2a │ 320   │ 100.0   │RZONE │ 📄🔗│ │
│ │ 2 │ West End Sq  │ 1.8a │ 142   │ 78.9    │CUP   │ 📄  │ │
│ │ ...show 5 by default, "Show all X" button              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌ Common Rezone Transitions ──────────────────────────────┐ │
│ │ MRC-1 → MRC-3  │ 8 projects │ 78% approved │ 9 mo avg │ │
│ │ MRC-2 → MRC-5  │ 3 projects │ 67% approved │ 14 mo    │ │
│ │ [YOUR CODE highlighted if it appears in any transition] │ │
│ └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## STEP 4: Implement search and filtering

The search input at the top accepts free text. On each keystroke (debounced 300ms), parse the query:

```typescript
function parseSearchQuery(query: string, records: RegulatoryRecord[]): RegulatoryRecord[] {
  const q = query.toLowerCase().trim();
  if (!q) return records;

  // Keyword-based filters
  if (q === 'rezones' || q === 'rezone' || q === 'rezonings') {
    return records.filter(r => r.entitlementType === 'rezone');
  }
  if (q === 'upzones' || q === 'upzone' || q === 'upzonings') {
    return records.filter(r => r.isUpzone);
  }
  if (q === 'variances' || q === 'variance') {
    return records.filter(r => r.entitlementType === 'variance');
  }
  if (q === 'cup' || q === 'cups' || q === 'conditional use' || q === 'conditional') {
    return records.filter(r => r.entitlementType === 'cup');
  }
  if (q === 'by-right' || q === 'by right' || q === 'site plan' || q === 'site plans') {
    return records.filter(r => r.entitlementType === 'by_right' || r.entitlementType === 'site_plan');
  }
  if (q === 'approved') {
    return records.filter(r => r.approved === true);
  }
  if (q === 'denied' || q === 'rejected') {
    return records.filter(r => r.approved === false);
  }

  // Unit count filters: "100+ units", ">200 units", "over 50 units"
  const unitMatch = q.match(/(?:>|over|above|\+)\s*(\d+)\s*unit/i);
  if (unitMatch) {
    const threshold = parseInt(unitMatch[1]);
    return records.filter(r => r.unitCount != null && r.unitCount >= threshold);
  }

  // Zoning code filter: if the query looks like a zoning code (2-8 chars, has letters and possibly numbers/dashes)
  const codeMatch = q.match(/^[a-z]{1,3}[-]?\d?[-]?[a-z]?$/i);
  if (codeMatch) {
    const code = q.toUpperCase();
    return records.filter(r =>
      r.zoningCode?.toUpperCase().includes(code) ||
      r.zoningFrom?.toUpperCase().includes(code) ||
      r.zoningTo?.toUpperCase().includes(code)
    );
  }

  // Free text search: search across project name, address, docket number
  return records.filter(r =>
    r.projectName?.toLowerCase().includes(q) ||
    r.address?.toLowerCase().includes(q) ||
    r.docketNumber?.toLowerCase().includes(q) ||
    r.zoningCode?.toLowerCase().includes(q) ||
    r.zoningFrom?.toLowerCase().includes(q) ||
    r.zoningTo?.toLowerCase().includes(q)
  );
}
```

The quick-filter chips ([All] [Rezones] [Upzones] [Variances] [CUPs] [By-Right]) set `activeFilter` state. When a chip is active, it filters the records AND populates the search input with the keyword (so the user can see what's filtering). Clicking "All" or the × on the active chip clears the filter.

When a filter is active, ALSO filter the Common Rezone Transitions table:
- "Rezones" / "Upzones" → show the transitions table (it's all rezonings)
- "Variances" / "CUPs" / "By-Right" → hide the transitions table (not relevant)
- "All" → show everything

## STEP 5: Documentation per row

Every project row MUST show all available document links. Reuse the `docLinks` pattern from the existing Market Reality Check:

```tsx
function DocLinks({ record }: { record: RegulatoryRecord }) {
  return (
    <div className="flex items-center gap-1.5">
      {record.ordinanceUrl && (
        <a href={record.ordinanceUrl} target="_blank" rel="noopener noreferrer"
           className="text-red-500 hover:text-red-700" title="Ordinance PDF">
          <FileText className="w-3.5 h-3.5" />
        </a>
      )}
      {record.sourceUrl && (
        <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer"
           className="text-blue-500 hover:text-blue-700" title="Source / Case File">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
      {record.docketNumber && (
        <span className="text-[8px] font-mono text-gray-500 bg-gray-100 px-1 py-0.5 rounded"
              title={`Docket: ${record.docketNumber}`}>
          {record.docketNumber}
        </span>
      )}
      {!record.ordinanceUrl && !record.sourceUrl && !record.docketNumber && (
        <span className="text-[8px] text-gray-300">no docs</span>
      )}
    </div>
  );
}
```

In the Common Rezone Transitions table, if a transition has an `exampleOrdinanceUrl`, show it as a link. This is already in the entitlement activity data.

## STEP 6: Highlight the user's zoning code

Anywhere the user's `currentZoningCode` appears in the data:
- In the project table: rows where `zoningCode` or `zoningFrom` matches get a subtle blue left-border and "YOUR CODE" badge
- In the transitions table: rows where `fromCode` or `toCode` matches get highlighted
- In the stats bar: if we have enough matching projects, show "X projects in YOUR code (GC)" as a sub-stat

## STEP 7: Remove old sections and mount the new one

In `BoundaryAndZoningTab.tsx`:
- Remove the entire Section 2 "Nearby Entitlement Activity" block (lines ~507-680)
- Remove the `nearbyEntitlements` state, `nearbyLoading` state, `fetchNearbyEntitlements` function, and the `nearbyProjectsExpanded` state
- Remove any `useEffect` or `useCallback` that references these
- Keep Section 1 (Parcel Detection) and Section 3 (Zoning Verification) intact

In `DevelopmentCapacityTab.tsx`:
- Remove the entire "Market Reality Check" section (the block starting around line 830 with the `densityBenchmarks` rendering through line ~1130)
- Remove the `densityBenchmarks` state, `loadingBenchmarks` state, and the fetch call for density-benchmarks
- KEEP the `allDisplayProjects` and `mrcCodes` logic if it's used elsewhere in the file. If it's ONLY used by Market Reality Check, remove it too
- Import and mount the new `RegulatoryMarketResearch` component AFTER the entitlement comparison and constraint matrix sections:

```tsx
import RegulatoryMarketResearch from './RegulatoryMarketResearch';

// ... inside the render, after the Zoning Constraint Matrix section:
<RegulatoryMarketResearch
  dealId={dealId}
  currentZoningCode={profile?.base_district_code || undefined}
  municipality={profile?.municipality || undefined}
/>
```

## STEP 8: Style

Use the same Tailwind patterns as the rest of DevelopmentCapacityTab:
- Section header: `text-sm font-semibold text-gray-800` with a teal icon
- Cards: `bg-white rounded-lg border border-gray-200`
- Table: `text-[10px]` with `bg-gray-50` header row
- Quick filter chips: `text-[10px] px-2 py-1 rounded-full border` with active state using `bg-teal-50 text-teal-700 border-teal-200`
- Search input: standard `text-xs border border-gray-200 rounded-lg px-3 py-2` with a search icon

Build and verify:
1. Tab 1 no longer shows the Nearby Entitlement Activity section
2. Tab 2 shows "Regulatory Market Research" below the constraint matrix
3. The default view shows all records with summary stats and transitions
4. Typing "rezones" in the search bar filters to rezone records only
5. Clicking "Upzones" chip shows only density-increasing transitions
6. Every project row has document links (or "no docs" if none available)
7. The user's zoning code is highlighted wherever it appears
