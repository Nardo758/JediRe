# Create Deal Page - Step Order Update

## IMPORTANT: Step Order Changed

**Original Flow:**
1. Category + Type
2. Location (Address, Trade Area, Boundary)
3. Details (Name, Description)

**NEW Flow (per Leon's request):**
1. **Setup:** Category + Type
2. **Details:** Name + Description  
3. **Location:** Address → Trade Area → Boundary

## Reasoning

Address should be **last** so it flows naturally into map interaction:
- User defines WHAT the deal is first (category, type, name)
- Then defines WHERE it is (address, trade area, boundary)
- Address entry → map shows location → trade area definition → boundary drawing
- All location work happens together, near the map

## Implementation Notes

- Progressive reveal still applies
- Trade Area and Boundary still optional
- Map stays on right (60% width) throughout
- Address triggers map to center on location
- Then user can immediately define trade area or draw boundary

This keeps all map-related work in one continuous flow.
