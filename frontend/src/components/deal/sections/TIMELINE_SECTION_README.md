# Timeline Section - Dual-Mode Timeline & Milestones

## Overview
The Timeline Section provides comprehensive project and operational timeline tracking with dual-mode support for both acquisition and performance phases.

## Features

### 🎯 Dual-Mode Support
- **Acquisition Mode**: Deal milestones, closing timeline, critical path items
- **Performance Mode**: Operational milestones, lease expirations, capex schedule

### 📊 Quick Stats (5 Cards)
**Acquisition Mode:**
- Days to Close
- Milestones Complete
- Upcoming Deadlines
- Critical Path Items
- Overall Progress

**Performance Mode:**
- Days Since Acquisition
- Active Milestones
- Leases Expiring (next 90 days)
- Capex Projects
- Performance Score

### 📅 Timeline Visualizations

#### Timeline View (Gantt-Style)
- Visual timeline with milestones plotted on date axis
- "Today" marker showing current position
- Color-coded milestone markers:
  - ✅ **Green**: Completed
  - 🔄 **Blue**: In Progress
  - 📅 **Gray**: Upcoming
  - ⚠️ **Yellow**: At Risk
  - 🚨 **Red**: Overdue
- Hover tooltips with milestone details
- Critical path highlighting

#### List View (Grouped)
- **In Progress**: Current active milestones
- **Upcoming**: Future milestones and deadlines
- **Completed**: Historical milestones (collapsible)
- Detailed milestone cards with:
  - Title & description
  - Status indicator
  - Date & days until/overdue
  - Owner/responsible party
  - Notes & dependencies
  - Completion progress

### ⏰ Upcoming Deadlines Panel
- Next 30/60/90 day deadlines
- Priority levels: Critical, High, Medium, Low
- Color-coded by urgency
- Progress tracking (completion %)
- Category & owner information

### 🎯 Critical Path Items
- Highlights milestones that could impact closing/operations
- Shows dependencies between tasks
- Identifies bottlenecks and risks

### 📈 Progress Overview
- Overall completion percentage
- Status breakdown:
  - Completed count
  - In Progress count
  - Upcoming count
  - At Risk count
  - Overdue count

## Data Structure

### TimelineStat
```typescript
interface TimelineStat {
  label: string;
  value: string | number;
  icon: string;
  format?: 'days' | 'percentage' | 'number' | 'text';
  subtext?: string;
  status?: 'success' | 'warning' | 'danger' | 'info';
}
```

### Milestone
```typescript
interface Milestone {
  id: string;
  title: string;
  date: string;
  status: 'completed' | 'in-progress' | 'upcoming' | 'overdue' | 'at-risk';
  category: 'critical' | 'standard' | 'optional';
  description?: string;
  owner?: string;
  daysUntil?: number;
  completedDate?: string;
  notes?: string;
  dependencies?: string[];
}
```

### DeadlineItem
```typescript
interface DeadlineItem {
  id: string;
  title: string;
  date: string;
  daysUntil: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  status: 'upcoming' | 'due-soon' | 'overdue';
  owner: string;
  completionPercent?: number;
}
```

## Usage

### Basic Implementation
```tsx
import { TimelineSection } from './components/deal/sections';

function DealPage({ deal }) {
  return (
    <div>
      <TimelineSection deal={deal} />
    </div>
  );
}
```

### Mock Data Examples

#### Acquisition Milestones
- Initial Offer Submitted
- Letter of Intent Executed
- Earnest Money Deposited
- Phase I Environmental Ordered
- Property Inspection Complete
- Rent Roll Analysis
- Title Report Received
- Initial Underwriting Model
- Lender Term Sheet
- Survey Complete
- Phase I Environmental Clear
- Tenant Estoppels Received
- Loan Application Submitted
- Property Appraisal
- Loan Approval
- Purchase Agreement Executed
- Final Walk-Through
- Closing

#### Performance Milestones
- Property Acquisition Closed
- Property Management Transition
- Roof Replacement
- Parking Lot Resurfacing
- Rent Increases
- HVAC System Upgrade
- Unit Renovations
- Amenity Upgrades
- Lease Renewals
- Capex Projects
- Annual Inspections

## UI Components

### Main Components
1. **QuickStatsGrid**: 5-stat summary cards
2. **TimelineView**: Gantt-style visualization
3. **ListView**: Grouped milestone list
4. **GanttTimeline**: Visual timeline with date markers
5. **MilestoneCard**: Detailed milestone display
6. **UpcomingDeadlinesCard**: Next 90-day deadlines

### Sub-Components
- **StatusBadge**: Color-coded status indicators
- **MilestoneGroup**: Collapsible milestone grouping
- **ProgressOverview**: Overall completion tracking

## Filters & Views

### Filter Options
- **All**: Show all milestones
- **Critical**: Only critical path items
- **Upcoming**: Only future/in-progress items

### View Modes
- **Timeline View**: Gantt-style horizontal timeline
- **List View**: Grouped list with details

## Color Coding

### Status Colors
- 🟢 **Green**: Completed, On Track
- 🔵 **Blue**: In Progress, Active
- 🟡 **Yellow**: At Risk, Warning
- 🔴 **Red**: Overdue, Critical
- ⚪ **Gray**: Upcoming, Pending

### Priority Colors
- 🔴 **Red**: Critical priority
- 🟠 **Orange**: High priority
- 🟡 **Yellow**: Medium priority
- ⚪ **Gray**: Low priority

## Integration Points

### Required Hooks
- `useDealMode`: Determines acquisition vs performance mode

### Data Sources
- `timelineMockData.ts`: Mock data for both modes
- Future: API endpoints for real-time milestone data

## Responsive Design
- **Mobile**: Single column, stacked cards
- **Tablet**: 2-3 column grid
- **Desktop**: Full 5-column stat grid, wide timeline

## Future Enhancements
- [ ] Real-time milestone updates
- [ ] Email notifications for approaching deadlines
- [ ] Drag-and-drop milestone rescheduling
- [ ] Milestone dependencies visualization
- [ ] Export to MS Project / Google Calendar
- [ ] Team collaboration comments on milestones
- [ ] Automated milestone creation from templates
- [ ] Critical path analysis tools
- [ ] Resource allocation tracking
- [ ] Milestone templates by property type

## File Structure
```
/components/deal/sections/
  TimelineSection.tsx         # Main component (30KB)
/data/
  timelineMockData.ts          # Mock data (15KB)
/hooks/
  useDealMode.ts               # Mode detection hook
```

## Performance Notes
- Timeline calculations are memoized for performance
- Large milestone lists (100+) render efficiently
- Gantt view optimized for date range calculations
- List view uses collapsible sections to reduce initial render

## Accessibility
- Keyboard navigation support
- ARIA labels on interactive elements
- Screen reader friendly status indicators
- High contrast color schemes

---

**Created**: February 12, 2024  
**Author**: JEDI RE Development Team  
**Version**: 1.0.0  
**Status**: ✅ Ready for Integration
