# Custom Strategy Builder - User Guide

## Overview

The Custom Strategy Builder enables users to create, save, and manage custom investment strategies tailored to their specific investment approach. These strategies can be applied to property types and integrated seamlessly into financial modeling workflows.

## Features

### 1. **Create Custom Strategies**
- Define strategy name and description
- Set hold period parameters (min/max years)
- Choose exit type (Sale, Refinance, 1031 Exchange, Cap Rate, Hold Indefinitely)
- Add custom metrics (user-defined key-value pairs)
- Set default financial assumptions

### 2. **Apply to Property Types**
- Link strategies to one or more property types
- Set as default strategy for specific property types
- Override assumptions per property type

### 3. **Manage Strategies**
- Edit existing custom strategies
- Delete strategies
- Duplicate strategies (built-in or custom)
- Export strategies as JSON

### 4. **Integration**
- Custom strategies appear in strategy selector with "Custom" badge
- Use in financial models like built-in strategies
- Track usage analytics across deals

---

## User Flow

### Creating a New Strategy

1. Navigate to **Settings → Property Types & Strategies**
2. Click **"Create Custom Strategy"** button
3. Fill out the strategy form:
   - **Basic Information**: Name and description
   - **Investment Timeline**: Hold period and exit type
   - **Custom Metrics**: Add any custom tracking metrics
   - **Financial Assumptions**: Set default assumptions (optional)
   - **Property Types**: Select which property types to apply to
4. Click **"Create Strategy"** to save

### Editing a Strategy

1. In the strategies list, click the **Edit** icon (pencil)
2. Modify any fields
3. Click **"Update Strategy"** to save changes

### Duplicating a Strategy

1. Click the **Duplicate** icon (copy)
2. The modal opens with pre-filled data
3. Modify the name (required) and any other fields
4. Click **"Create Strategy"** to save the duplicate

### Applying to Property Types

When creating or editing a strategy:
1. In the **"Apply to Property Types"** section, check the property types
2. Optionally check **"Set as default strategy"** to make it the default for selected types
3. Strategies will automatically be suggested when creating deals of those types

### Exporting a Strategy

1. Click the **Export** icon (download arrow)
2. A JSON file will be downloaded with the strategy configuration
3. Use this for backup or sharing (future feature)

---

## API Reference

### Endpoints

#### Create Strategy
```http
POST /api/v1/custom-strategies
Content-Type: application/json

{
  "name": "Aggressive Value-Add",
  "description": "Short-term value-add strategy",
  "holdPeriodMin": 3,
  "holdPeriodMax": 5,
  "exitType": "sale",
  "customMetrics": {
    "target_irr": "20%",
    "renovation_budget": "$50k/unit"
  },
  "defaultAssumptions": {
    "rent_growth_pct": 4.5,
    "vacancy_pct": 5.0,
    "exit_cap_rate_pct": 5.5
  }
}
```

#### List User's Strategies
```http
GET /api/v1/custom-strategies
```

#### Get Strategy by ID
```http
GET /api/v1/custom-strategies/:id
```

#### Update Strategy
```http
PUT /api/v1/custom-strategies/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description"
}
```

#### Delete Strategy
```http
DELETE /api/v1/custom-strategies/:id
```

#### Duplicate Strategy
```http
POST /api/v1/custom-strategies/:id/duplicate
Content-Type: application/json

{
  "newName": "Copy of Strategy"
}
```

#### Apply to Property Types
```http
POST /api/v1/custom-strategies/:id/apply-to-type
Content-Type: application/json

{
  "propertyTypes": ["multifamily", "retail"],
  "setAsDefault": true,
  "propertyTypeOverrides": {
    "multifamily": {
      "vacancy_pct": 6.0
    }
  }
}
```

#### Remove from Property Type
```http
DELETE /api/v1/custom-strategies/:id/property-types/:propertyType
```

#### Export Strategy
```http
POST /api/v1/custom-strategies/:id/export
Content-Type: application/json

{
  "format": "json"
}
```

#### Get Default Strategy for Property Type
```http
GET /api/v1/custom-strategies/property-types/:propertyType/default
```

---

## Database Schema

### `custom_strategies`
```sql
id UUID PRIMARY KEY
user_id UUID (FK → users)
name VARCHAR(200)
description TEXT
hold_period_min INTEGER
hold_period_max INTEGER (nullable)
exit_type VARCHAR(100)
custom_metrics JSONB
default_assumptions JSONB
is_template BOOLEAN
is_public BOOLEAN
source_strategy_id UUID (FK → custom_strategies)
created_at TIMESTAMP
updated_at TIMESTAMP
```

### `user_property_type_strategies`
```sql
id UUID PRIMARY KEY
user_id UUID (FK → users)
custom_strategy_id UUID (FK → custom_strategies)
property_type VARCHAR(100)
is_default BOOLEAN
property_type_overrides JSONB
created_at TIMESTAMP
updated_at TIMESTAMP
```

### `custom_strategy_usage`
```sql
id UUID PRIMARY KEY
custom_strategy_id UUID (FK → custom_strategies)
deal_id UUID (FK → deals)
used_in_context VARCHAR(100)
property_type VARCHAR(100)
irr_pct DECIMAL(6,3)
coc_year_5 DECIMAL(6,3)
npv DECIMAL(15,2)
used_at TIMESTAMP
```

### `custom_strategy_exports`
```sql
id UUID PRIMARY KEY
custom_strategy_id UUID (FK → custom_strategies)
user_id UUID (FK → users)
export_format VARCHAR(50)
export_data JSONB
exported_at TIMESTAMP
```

---

## Frontend Components

### `CustomStrategyModal.tsx`
Location: `frontend/src/components/settings/CustomStrategyModal.tsx`

**Props:**
```typescript
interface CustomStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (strategy: any) => void;
  editStrategy?: any; // Edit mode
  duplicateFrom?: any; // Duplicate mode
}
```

**Features:**
- Create/edit/duplicate strategies
- Multi-step form with validation
- Property type multi-select
- Custom metrics builder
- Financial assumptions inputs

### `CustomStrategiesList.tsx`
Location: `frontend/src/components/settings/CustomStrategiesList.tsx`

**Features:**
- List all user's custom strategies
- CRUD operations (Create, Read, Update, Delete)
- Duplicate strategies
- Export as JSON
- View property type assignments
- Usage statistics

---

## Integration Points

### 1. **Strategy Selector**
Custom strategies appear alongside built-in strategies in:
- Deal creation flow
- Financial modeling tools
- Scenario generation
- Strategy analysis comparison

**Badge:** Custom strategies show a purple "Custom" badge to distinguish from built-in strategies.

### 2. **Property Type Assignment**
When creating a deal:
1. Select property type (e.g., Multifamily)
2. System checks for default custom strategy for that type
3. Auto-populate strategy selector with default (if set)
4. User can override with any other strategy

### 3. **Financial Modeling**
Custom strategies integrate with:
- Pro forma generation
- Scenario analysis
- Strategy comparison tools
- Risk scoring

**Assumptions Flow:**
1. Strategy's `default_assumptions` → Base assumptions
2. Property type `property_type_overrides` → Type-specific adjustments
3. User manual overrides → Final values

### 4. **Usage Tracking**
Every time a custom strategy is used:
- Record in `custom_strategy_usage` table
- Track IRR, CoC, NPV results
- Enable analytics: "Your 'Aggressive Value-Add' strategy averages 18% IRR across 12 deals"

---

## Best Practices

### Naming Strategies
- **Good:** "5-Year Value-Add Exit", "Long-Term Core Hold", "Quick Flip (12-18mo)"
- **Avoid:** "Strategy 1", "My Strategy", "Test"

### Custom Metrics
Use for strategy-specific KPIs:
- Target IRR range
- Renovation budget per unit
- Exit cap rate target
- Minimum cash-on-cash return
- Max leverage ratio

### Default Assumptions
Set conservative defaults that can be overridden:
- Rent growth: Market average
- Vacancy: Higher than optimistic
- Exit cap: Current + 25-50 bps
- CapEx reserves: 5-10% of gross income

### Property Type Mapping
- Map strategies to compatible property types only
- Set defaults for your primary focus areas
- Create type-specific strategy variants (e.g., "Value-Add Multifamily" vs "Value-Add Retail")

---

## Future Enhancements

### Phase 2 (Future)
- **Import Strategies**: Upload JSON files
- **Share Strategies**: Share with team members
- **Strategy Templates**: Public marketplace of community strategies
- **Performance Analytics**: Detailed reporting on strategy outcomes
- **AI-Suggested Strategies**: ML-powered strategy recommendations based on deal characteristics

### Phase 3 (Future)
- **Strategy Versioning**: Track changes over time
- **Strategy Backtesting**: Apply historical data to validate strategies
- **Collaborative Editing**: Multi-user strategy development
- **Strategy Packages**: Bundle multiple strategies for different scenarios

---

## Troubleshooting

### Strategy Not Appearing in Selector
- **Check**: Is it applied to the correct property type?
- **Check**: Is the deal's property type matching the strategy's assigned types?

### Cannot Delete Strategy
- **Reason**: Strategy is currently in use by active deals
- **Solution**: Remove strategy from deals first, or archive instead

### Duplicate Name Error
- **Reason**: Strategy names must be unique per user
- **Solution**: Choose a different name or append version number

### Export Download Not Working
- **Check**: Browser popup blocker settings
- **Solution**: Allow popups for the application domain

---

## Support

For issues or feature requests:
- Create issue in project repository
- Contact support team
- Check community forums for tips and examples

---

**Version:** 1.0.0  
**Last Updated:** 2026-02-19  
**Component:** Investment Strategy Module
