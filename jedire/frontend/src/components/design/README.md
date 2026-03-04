# Comprehensive Design Dashboard Documentation

## Overview

The Design Dashboard is a production-ready workspace that combines 2D mapping, 3D building design, competition analysis, traffic research, and market intelligence into a unified interface.

## Architecture

### Core Components

1. **Enhanced Design3DPage** (`Design3DPage.enhanced.tsx`)
   - Main dashboard container
   - Manages layout state and data flow
   - Handles saving and navigation

2. **State Management** (`DesignDashboardStore.ts`)
   - Zustand store with persistence
   - Centralized state for all dashboard features
   - LocalStorage integration for data persistence

### Layout Components

1. **CollapsiblePanel** - Animated sidebars with toggle controls
2. **BottomPanel** - Tabbed bottom drawer for data tables
3. **MapModeSelector** - Switch between 2D, 3D, Satellite, and Split views
4. **MapLayerControls** - Toggle map layers visibility

### Feature Panels

#### Left Sidebar (4 Panels)

1. **SubjectPropertyPanel**
   - Draw/edit property boundaries
   - Edit parcel details (APN, zoning, acres)
   - Configure zoning requirements (height, FAR, setbacks)
   - Calculate site statistics

2. **CompetitionPanel**
   - Add/remove competing properties
   - Filter by units, distance, occupancy
   - Toggle visibility on map
   - View summary statistics
   - Import from CoStar/Apartments.com (placeholder)

3. **TrafficPanel**
   - Add traffic generators (employers, retail, transit)
   - Calculate traffic scores
   - Toggle heat map visualization
   - Analyze by generator type
   - Generate detailed reports

4. **ResearchPanel**
   - Search permits, market data, news
   - Categorized tabs (permit, market, news, demographic)
   - Quick search suggestions
   - Save and manage research items
   - External data source links

#### Right Sidebar

1. **3D Design Controls**
   - Unit mix configuration
   - Building height slider
   - Parking spaces and type
   - Real-time metrics display

2. **FinancialSummaryPanel**
   - Automatic financial calculations
   - Construction cost estimates
   - Revenue and NOI projections
   - Return on cost analysis
   - Per-unit metrics
   - Send to financial model integration

#### Bottom Panel (3 Tables)

1. **CompetitionTable**
   - Sortable property data
   - Average calculations
   - Action buttons (visibility, locate)

2. **TrafficDataTable**
   - Generator details with icons
   - Impact visualization
   - Score-based sorting

3. **MarketTrendsTable**
   - Key market metrics
   - Trend indicators
   - Category grouping
   - Data source attribution

### Map Integration

1. **MapView Component**
   - Mapbox GL JS integration
   - Layer management
   - Property boundary drawing
   - Marker popups
   - Style switching

2. **Layer System**
   - Subject Property
   - Zoning Envelope
   - Competition markers
   - Traffic heat map
   - POI layer
   - Transit layer
   - Demographics layer

## Usage

### Basic Setup

1. Replace the existing Design3DPage import:
```typescript
// In your routes file
import { Design3DPageEnhanced as Design3DPage } from './pages/Design3DPage.enhanced';
```

2. Set Mapbox token in environment:
```env
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

### Key Features

#### Map Modes
- **2D Planning**: Traditional map for property planning
- **3D Design**: Three-dimensional building editor
- **Satellite**: Aerial imagery view
- **Split View**: Side-by-side 2D and 3D

#### Data Persistence
- Subject property boundaries
- Competition properties
- Traffic generators
- Layer visibility preferences

#### Real-time Sync
- Metrics update automatically
- 2D/3D views stay synchronized
- Financial calculations update instantly

### Keyboard Shortcuts
- `G` - Toggle grid
- `M` - Toggle measurements
- `Ctrl+Z` - Undo
- `Ctrl+Shift+Z` - Redo
- `Esc` - Cancel drawing

## API Integration Points

### Current Integrations
- Deal data loading
- Design saving/loading
- Metrics calculation

### Future Integrations
1. **Property Data**
   - County assessor API
   - Zoning database
   - Parcel geometry services

2. **Competition Data**
   - CoStar API
   - Apartments.com scraping
   - Rent comparison services

3. **Traffic Data**
   - Google Places API
   - Transit agency APIs
   - Employment databases

4. **Research**
   - Permit databases
   - News aggregation
   - Census/demographic APIs

## Performance Optimizations

1. **Lazy Loading**
   - Panels load on demand
   - Tables virtualized for large datasets

2. **Memoization**
   - Heavy calculations cached
   - React.memo on expensive components

3. **Debouncing**
   - Map updates debounced
   - Search queries throttled

## Responsive Design

- Minimum screen width: 1280px
- Collapsible panels for space management
- Touch-friendly controls for tablets
- Optimized for desktop power users

## Future Enhancements

1. **AI Integration**
   - Qwen API for design generation
   - Image-to-3D terrain modeling
   - Natural language property search

2. **Advanced Analytics**
   - Market prediction models
   - Competition scoring algorithms
   - Traffic impact calculations

3. **Collaboration**
   - Multi-user editing
   - Comment threads
   - Version control

4. **Export Options**
   - PDF reports
   - Excel data export
   - CAD file generation

## Troubleshooting

### Common Issues

1. **Map not loading**
   - Check Mapbox token
   - Verify network connectivity
   - Clear browser cache

2. **3D Performance**
   - Update graphics drivers
   - Enable hardware acceleration
   - Reduce quality settings

3. **Data not persisting**
   - Check localStorage limits
   - Verify browser settings
   - Clear corrupted data

### Debug Mode

Add `?debug=true` to URL for:
- Performance metrics
- State inspection
- Console logging
- Layer boundaries

## Component Tree

```
Design3DPage (Enhanced)
├── Header
│   ├── Navigation
│   ├── Save Controls
│   └── Settings
├── Main Content
│   ├── Left Sidebar (CollapsiblePanel)
│   │   ├── Panel Tabs
│   │   └── Active Panel Content
│   ├── Center View
│   │   ├── MapView (2D/Satellite)
│   │   ├── Building3DEditor (3D)
│   │   ├── MapLayerControls
│   │   └── MapModeSelector
│   └── Right Sidebar (CollapsiblePanel)
│       ├── 3D Design Controls
│       ├── Real-time Metrics
│       └── FinancialSummaryPanel
└── Bottom Panel
    ├── Tab Navigation
    └── Active Table Component
```

## Best Practices

1. **State Management**
   - Use store actions for all updates
   - Keep component state minimal
   - Leverage persistence wisely

2. **Performance**
   - Virtualize long lists
   - Debounce expensive operations
   - Use React.memo strategically

3. **User Experience**
   - Provide loading states
   - Show helpful empty states
   - Add keyboard shortcuts
   - Include tooltips

4. **Code Quality**
   - Type everything with TypeScript
   - Extract reusable components
   - Write unit tests for logic
   - Document complex algorithms