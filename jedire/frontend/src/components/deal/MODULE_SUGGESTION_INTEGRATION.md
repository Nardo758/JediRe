# Module Suggestion Modal - Integration Guide

## Overview

The Module Suggestion Modal displays recommended modules to users after they create a deal, based on the deal type and investment strategy. It shows which modules are included in their subscription and offers premium add-ons.

## Components Created

### 1. `/utils/moduleSuggestions.ts`

**Purpose:** Mapping logic for deal types/strategies → recommended modules

**Key Functions:**
- `getRecommendedModules(dealType, strategy)` - Returns array of recommended module slugs
- `MODULE_SUGGESTIONS` - Mapping object with all combinations
- `MODULE_METADATA` - Display information for each module

**Example:**
```typescript
import { getRecommendedModules } from '@/utils/moduleSuggestions';

const modules = getRecommendedModules('multifamily', 'value-add');
// Returns: ['financial-modeling-pro', 'strategy-arbitrage', 'dd-checklist', ...]
```

### 2. `/components/deal/ModuleSuggestionModal.tsx`

**Purpose:** UI component that displays module suggestions

**Props:**
```typescript
interface ModuleSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: string;
  dealType: string;        // e.g., 'multifamily'
  dealStrategy: string;    // e.g., 'value-add'
  userBundle?: 'flipper' | 'developer' | 'portfolio-manager';
  userModules?: ModuleName[]; // Individual subscribed modules
}
```

**Features:**
- ✅ Shows included vs paid modules
- ✅ Pre-selects included modules
- ✅ Bulk activation
- ✅ Persistent dismissal (localStorage)
- ✅ Responsive design
- ✅ Accessibility (ESC to close, focus trap ready)

## Integration Points

### A. DealPage.tsx (Current Implementation)

Shows modal on page load if not dismissed:

```typescript
import { ModuleSuggestionModal } from '../components/deal/ModuleSuggestionModal';

// In component:
const [showModuleSuggestions, setShowModuleSuggestions] = useState(false);

useEffect(() => {
  if (dealId) {
    const dismissed = localStorage.getItem(`deal-${dealId}-suggestions-dismissed`);
    if (!dismissed) {
      setTimeout(() => setShowModuleSuggestions(true), 800);
    }
  }
}, [dealId]);

// In render:
<ModuleSuggestionModal
  isOpen={showModuleSuggestions}
  onClose={() => setShowModuleSuggestions(false)}
  dealId={deal.id}
  dealType={deal.type}
  dealStrategy={deal.strategy}
  userBundle="flipper" // TODO: Get from user context
  userModules={[]} // TODO: Get from user context
/>
```

### B. CreateDealModal.tsx (Recommended)

Trigger after successful deal creation:

```typescript
import { ModuleSuggestionModal } from './ModuleSuggestionModal';

// Add state:
const [showSuggestions, setShowSuggestions] = useState(false);
const [createdDealId, setCreatedDealId] = useState<string | null>(null);

// In handleSubmit:
const handleSubmit = async () => {
  try {
    const result = await createDeal({ ...dealData });
    
    // Store created deal ID and show suggestions
    setCreatedDealId(result.id);
    setShowSuggestions(true);
    
    // Don't close modal yet - let suggestions show first
  } catch (err) {
    setError(err.message);
  }
};

// Handle suggestions close:
const handleSuggestionsClose = () => {
  setShowSuggestions(false);
  handleClose(); // Close main create modal
  onDealCreated?.(createdDealId);
  
  // Redirect to deal view
  navigate(`/deals/${createdDealId}/view`);
};

// In render (after main modal content):
{createdDealId && (
  <ModuleSuggestionModal
    isOpen={showSuggestions}
    onClose={handleSuggestionsClose}
    dealId={createdDealId}
    dealType={dealCategory}
    dealStrategy={developmentType}
    userBundle={userBundle} // From user context
    userModules={userModules}
  />
)}
```

## User Subscription Context

To fully integrate, you need to provide user subscription info. Create a context:

```typescript
// contexts/UserSubscriptionContext.tsx
interface UserSubscriptionContextType {
  bundle?: 'flipper' | 'developer' | 'portfolio-manager';
  modules: ModuleName[];
  loading: boolean;
}

export const useUserSubscription = () => {
  const context = useContext(UserSubscriptionContext);
  // Fetch from API or store
  return context;
};

// Usage in components:
const { bundle, modules } = useUserSubscription();

<ModuleSuggestionModal
  userBundle={bundle}
  userModules={modules}
  // ...
/>
```

## API Endpoints

The modal expects these endpoints:

### 1. Toggle Module (PATCH)
```
PATCH /api/v1/modules/:slug/toggle

Body:
{
  "deal_id": "123",
  "is_enabled": true
}

Response:
{
  "success": true,
  "data": { ... }
}
```

### 2. Get User Subscription (GET)
```
GET /api/v1/users/me/subscription

Response:
{
  "bundle": "flipper",
  "modules": ["financial-modeling-pro", ...],
  "expires_at": "2025-12-31"
}
```

## LocalStorage Keys

- `deal-{dealId}-suggestions-dismissed` - Set to 'true' when user dismisses modal
- Prevents modal from showing again for that specific deal

## Styling

Uses existing Tailwind classes and animations:
- `.animate-fade-in` - Modal overlay fade in
- Button components from `/components/shared/Button.tsx`
- Matches existing modal styles (CreateDealModal, PropertyDetailModal)

## Testing Checklist

- [ ] Modal shows on deal creation
- [ ] Modal shows on deal page load (first time only)
- [ ] Included modules are pre-selected
- [ ] Paid modules show pricing
- [ ] Bulk activation works
- [ ] Skip button dismisses permanently
- [ ] ESC key closes modal
- [ ] Click outside closes modal (TODO: add onClickOutside)
- [ ] Mobile responsive
- [ ] Loading states work
- [ ] Error states display correctly

## Future Enhancements

1. **Click Outside to Close:** Add overlay click handler
2. **Module Marketplace:** Link "Add Module" to subscription flow
3. **Smart Recommendations:** ML-based suggestions
4. **A/B Testing:** Track conversion rates
5. **Onboarding Tour:** Highlight key modules for first-time users
6. **Bundle Upsell:** Suggest bundle if user selects multiple paid modules

## Example Deal Type Mappings

```typescript
// Some example combinations in MODULE_SUGGESTIONS:
'multifamily-value-add' → financial-modeling-pro, strategy-arbitrage, dd-checklist...
'office-development' → development-budget, timeline, zoning-analysis...
'retail-ground-up' → development-budget, traffic-analysis, supply-pipeline...
'land-development' → entitlements, zoning-analysis, environmental...
```

Add more mappings as needed in `/utils/moduleSuggestions.ts`.

## Questions?

See `ModuleSuggestionModal.tsx` for full component implementation and inline documentation.
