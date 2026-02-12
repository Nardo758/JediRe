# Traveloure UI Components - Implementation Guide

## 🎨 Component Structure

### 1. VariantCard Component

```jsx
// components/itinerary/VariantCard.jsx
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function VariantCard({ variant, isRecommended }) {
  return (
    <div className={`variant-card ${isRecommended ? 'recommended' : ''}`}>
      {isRecommended && (
        <span className="recommended-badge">✨ Recommended</span>
      )}
      
      {/* Header */}
      <div className="card-header">
        <Badge variant={variant.type === 'ai' ? 'ai-optimized' : 'your-plan'}>
          {variant.type === 'ai' ? '🤖 AI Optimized' : 'Your Plan'}
        </Badge>
        <h2 className="card-title">{variant.title}</h2>
        <p className="card-subtitle">{variant.description}</p>
      </div>

      {/* Metrics */}
      <div className="metrics-section">
        <div className="total-cost">${variant.totalCost}</div>
        <MetricsGrid metrics={variant.metrics} />
      </div>

      {/* Improvements */}
      {variant.improvements && (
        <ImprovementsSection improvements={variant.improvements} />
      )}

      {/* Methodology */}
      {variant.methodologyNote && (
        <MethodologySection note={variant.methodologyNote} />
      )}

      {/* Activities Preview */}
      <ActivitiesPreview activities={variant.previewActivities} />

      {/* Actions */}
      <div className="card-actions">
        <Button variant="primary" onClick={() => handleBook(variant)}>
          Book Now
        </Button>
        <Button variant="secondary" onClick={() => handleExpertReview(variant)}>
          Expert Review
        </Button>
        {variant.type === 'ai' && (
          <Button variant="ghost" onClick={() => handleViewFull(variant)}>
            View Full Plan
          </Button>
        )}
      </div>
    </div>
  );
}
```

### 2. MetricsGrid Component

```jsx
// components/itinerary/MetricsGrid.jsx
export function MetricsGrid({ metrics }) {
  return (
    <div className="metrics-grid">
      <Metric 
        icon="⏱️" 
        label="Active Time" 
        value={`${metrics.activeHours} hours`} 
      />
      <Metric 
        icon="💪" 
        label="Intensity" 
        value={metrics.physicalIntensity} 
      />
      <Metric 
        icon="⭐" 
        label="Avg Rating" 
        value={metrics.averageRating} 
      />
      <Metric 
        icon="🚗" 
        label="Travel Time" 
        value={`${metrics.travelTime} min`} 
      />
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="metric">
      <span className="metric-icon">{icon}</span>
      <div className="metric-content">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
      </div>
    </div>
  );
}
```

### 3. ImprovementsSection Component

```jsx
// components/itinerary/ImprovementsSection.jsx
export function ImprovementsSection({ improvements }) {
  const iconMap = {
    saves_money: '💰',
    better_rating: '⭐',
    more_time: '⏰',
    less_travel: '🚗',
    better_flow: '✨'
  };

  return (
    <div className="improvements-section">
      <h3 className="section-title">Why it's better</h3>
      {improvements.map((improvement, idx) => (
        <div key={idx} className="improvement">
          <span className="improvement-icon">
            {iconMap[improvement.type]}
          </span>
          <span>{improvement.description}</span>
        </div>
      ))}
    </div>
  );
}
```

### 4. FullItineraryView Component

```jsx
// components/itinerary/FullItineraryView.jsx
export function FullItineraryView({ itinerary }) {
  return (
    <div className="itinerary-full">
      {/* Header */}
      <ItineraryHeader 
        title={itinerary.title}
        totalCost={itinerary.totalCost}
        duration={itinerary.days.length}
        type={itinerary.optimizationType}
      />

      {/* Packages */}
      <PackagesSection 
        transportPackage={itinerary.transportPackage}
        accommodationPackage={itinerary.accommodationPackage}
      />

      {/* Timeline */}
      <TimelineSection days={itinerary.days} />
    </div>
  );
}
```

### 5. DayCard Component

```jsx
// components/itinerary/DayCard.jsx
export function DayCard({ day }) {
  return (
    <div className="day-card">
      {/* Day Header */}
      <div className="day-header">
        <div className="day-title-row">
          <span className="day-number">Day {day.dayNumber}</span>
          <div>
            <div className="day-date">{formatDate(day.date)}</div>
            <div className="day-location">📍 {day.location}</div>
          </div>
          {day.theme && (
            <span className="day-theme">{day.theme}</span>
          )}
        </div>
        <DayMetrics metrics={day} />
      </div>

      {/* Flow Note */}
      {day.flowNotes?.length > 0 && (
        <FlowNote text={day.flowNotes[0]} />
      )}

      {/* Activities */}
      <ActivityTimeline activities={day.activities} />
    </div>
  );
}
```

### 6. ActivityCard Component

```jsx
// components/itinerary/ActivityCard.jsx
export function ActivityCard({ activity }) {
  return (
    <div className="activity-card">
      {/* Time Marker */}
      <TimeMarker time={activity.startTime} icon={getActivityIcon(activity.type)} />

      {/* Content */}
      <div className="activity-content">
        <div className="activity-type">{activity.type}</div>
        <h3 className="activity-content-title">{activity.title}</h3>
        <p className="activity-description">{activity.description}</p>

        {/* Travel Info */}
        {activity.location?.travelTimeFromPrevious > 0 && (
          <TravelInfo time={activity.location.travelTimeFromPrevious} />
        )}

        {/* Provider Badge */}
        {activity.provider && (
          <ProviderBadge provider={activity.provider} />
        )}

        {/* Badges */}
        <BadgeRow>
          {activity.isNewActivity && <Badge variant="new">New</Badge>}
          {activity.isInApp && <Badge variant="in-app">In-App</Badge>}
          <Badge>{activity.bookingType}</Badge>
        </BadgeRow>

        {/* AI Note */}
        {activity.methodologyNote && (
          <AINote text={activity.methodologyNote} />
        )}

        {/* Footer */}
        <ActivityFooter 
          price={activity.price}
          bookingStatus={activity.bookingStatus}
          onBook={() => handleBook(activity)}
        />
      </div>

      {/* Image */}
      {activity.images?.[0] && (
        <img 
          className="activity-image" 
          src={activity.images[0]} 
          alt={activity.title}
        />
      )}
    </div>
  );
}
```

---

## 🎨 CSS/Tailwind Classes

### Color Palette

```css
/* Primary Colors */
--color-primary: #3b82f6;      /* Blue */
--color-success: #10b981;      /* Green - Budget */
--color-premium: #8b5cf6;      /* Purple */
--color-warning: #f59e0b;      /* Amber */

/* UI Colors */
--color-bg-primary: #ffffff;
--color-bg-secondary: #f9fafb;
--color-bg-muted: #f3f4f6;
--color-border: #e5e7eb;
--color-text: #111827;
--color-text-muted: #6b7280;

/* Status Colors */
--color-ai-optimized: #dbeafe;   /* Light blue */
--color-your-plan: #fef3c7;      /* Light amber */
--color-methodology: #f0fdf4;    /* Light green */
--color-flow-note: #fef3c7;      /* Light amber */
--color-ai-note: #eff6ff;        /* Light blue */
```

### Tailwind Classes (for reference)

```jsx
// Card Variants
<div className="rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">

// Metrics
<div className="grid grid-cols-2 gap-3">
  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">

// Badges
<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">

// Buttons
<button className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all hover:-translate-y-0.5">

// Improvements Section
<div className="p-5 bg-amber-50 border-b-2 border-amber-200">

// Methodology Section
<div className="p-5 bg-green-50 border-b-2 border-green-200">

// Activity Timeline
<div className="grid grid-cols-[80px_1fr_200px] gap-5 p-5 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 transition-all">
```

---

## 📱 Mobile Responsive Styles

```css
/* Mobile Breakpoints */
@media (max-width: 768px) {
  .variants-grid {
    grid-template-columns: 1fr;
  }

  .activity-card {
    grid-template-columns: 1fr;
  }

  .activity-image {
    width: 100%;
    height: 200px;
  }

  .itinerary-header {
    flex-direction: column;
    text-align: center;
  }

  .packages-section {
    grid-template-columns: 1fr;
  }

  .day-title-row {
    flex-wrap: wrap;
  }

  .day-theme {
    margin-left: 0;
    margin-top: 8px;
  }
}
```

---

## 🔧 Helper Functions

```javascript
// utils/itinerary.js

export function getActivityIcon(type) {
  const icons = {
    'accommodation': '🏨',
    'activity': '🎭',
    'meal': '🍽️',
    'transport': '🚗',
    'break': '☕'
  };
  return icons[type] || '📍';
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function calculateDuration(startTime, endTime) {
  const start = new Date(`1970-01-01T${startTime}`);
  const end = new Date(`1970-01-01T${endTime}`);
  const diff = (end - start) / 1000 / 60; // minutes
  
  if (diff >= 60) {
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${diff}m`;
}

export function formatPrice(price, currency = 'USD') {
  if (price === 0) return 'Free';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(price);
}
```

---

## 🗂️ Data Structure Examples

```typescript
// types/itinerary.ts

interface TraveloureItinerary {
  id: string;
  title: string;
  optimizationType: 'your_plan' | 'budget' | 'premium';
  totalCost: number;
  
  metrics: {
    totalDays: number;
    activeHours: number;
    relaxationHours: number;
    travelTime: number;
    physicalIntensity: 'low' | 'moderate' | 'high';
    averageRating: number;
    flowScore: number;
    balanceScore: number;
    valueScore: number;
  };
  
  improvements?: {
    type: 'saves_money' | 'better_rating' | 'more_time' | 'less_travel' | 'better_flow';
    description: string;
    metric: string;
  }[];
  
  methodologyNote?: string;
  
  days: ItineraryDay[];
  
  transportPackage?: TransportPackage;
  accommodationPackage?: AccommodationPackage;
}

interface ItineraryDay {
  dayNumber: number;
  date: string;
  location: string;
  theme?: string;
  
  activities: ItineraryActivity[];
  
  dailyCost: number;
  activeHours: number;
  travelTime: number;
  physicalIntensity: 'low' | 'moderate' | 'high';
  
  flowNotes?: string[];
}

interface ItineraryActivity {
  id: string;
  type: 'accommodation' | 'activity' | 'meal' | 'transport' | 'break';
  title: string;
  description: string;
  
  startTime: string;
  endTime: string;
  duration: number;
  
  location: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    distanceFromPrevious?: number;
    travelTimeFromPrevious?: number;
  };
  
  price: number;
  currency: string;
  isEstimated: boolean;
  bookingType: 'instant' | 'request' | 'external' | 'expert_assisted';
  
  provider?: {
    id: string;
    name: string;
    rating: number;
    reviewCount: number;
    verifiedProvider: boolean;
  };
  
  physicalIntensity: 'rest' | 'light' | 'moderate' | 'high' | 'intense';
  culturalValue: number;
  
  isNewActivity?: boolean;
  isInApp?: boolean;
  
  methodologyNote?: string;
  optimizationReason?: string;
  
  images: string[];
  
  bookingStatus: 'not_booked' | 'pending' | 'confirmed' | 'cancelled';
}
```

---

## 🚀 Implementation Checklist

### Phase 1: Core Components
- [ ] Create base UI component library (Button, Badge, Card)
- [ ] Build VariantCard component
- [ ] Build MetricsGrid component
- [ ] Build ImprovementsSection component
- [ ] Build MethodologySection component

### Phase 2: Timeline Components
- [ ] Build FullItineraryView component
- [ ] Build DayCard component
- [ ] Build ActivityCard component
- [ ] Build TimeMarker component
- [ ] Build FlowNote component
- [ ] Build AINote component

### Phase 3: Package Components
- [ ] Build PackagesSection component
- [ ] Build TransportPackageCard component
- [ ] Build AccommodationPackageCard component

### Phase 4: Polish
- [ ] Add mobile responsive styles
- [ ] Implement hover states & animations
- [ ] Add loading states
- [ ] Add empty states
- [ ] Integrate with backend API

### Phase 5: Testing
- [ ] Test on desktop
- [ ] Test on mobile
- [ ] Test with different data scenarios
- [ ] Test booking flow integration

---

## 🎨 Design Tokens (for design system)

```javascript
// tokens/colors.js
export const colors = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#10b981',
    600: '#059669',
  },
  warning: {
    50: '#fef3c7',
    100: '#fde68a',
    500: '#f59e0b',
    600: '#d97706',
  },
  purple: {
    500: '#8b5cf6',
    600: '#7c3aed',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    600: '#6b7280',
    900: '#111827',
  },
};

// tokens/spacing.js
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
};

// tokens/typography.js
export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '42px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};
```

---

**Ready to implement!** 🚀

This gives you:
1. Complete React component structure
2. Reusable sub-components
3. TypeScript type definitions
4. CSS styling reference
5. Helper functions
6. Mobile responsive design
7. Implementation checklist

Start with the basic components and build up from there!
