# Traveloure Itinerary Design - Complete Code Reference

## 📁 Files Created

1. **Full HTML Mockup (Interactive):**
   - Location: `/home/leon/clawd/canvas/traveloure-itinerary-mockup.html`
   - 1354 lines of complete working HTML/CSS/JS
   - Open in browser to see the design

2. **React Components Guide:**
   - Location: `/home/leon/clawd/TRAVELOURE_UI_COMPONENTS.md`
   - Component structure for implementation

3. **Framework Document:**
   - Location: `/home/leon/clawd/TRAVELOURE_ITINERARY_FRAMEWORK.md`
   - Complete system specification

---

## 🎨 Key CSS Code Behind the Design

### Color System

```css
:root {
  /* Primary Colors */
  --color-primary: #3b82f6;      /* Blue */
  --color-success: #10b981;      /* Green - Budget */
  --color-premium: #8b5cf6;      /* Purple */
  --color-warning: #f59e0b;      /* Amber */
  
  /* Backgrounds */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f9fafb;
  --color-bg-muted: #f3f4f6;
  
  /* Text */
  --color-text: #111827;
  --color-text-muted: #6b7280;
  
  /* Borders */
  --color-border: #e5e7eb;
  
  /* Status Colors */
  --color-ai-optimized: #dbeafe;
  --color-your-plan: #fef3c7;
  --color-methodology: #f0fdf4;
  --color-flow-note: #fef3c7;
  --color-ai-note: #eff6ff;
}
```

### Variant Card Styles

```css
.variant-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.variant-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 50px rgba(0,0,0,0.2);
}

.variant-card.recommended {
  border: 3px solid #10b981;
  position: relative;
}

.recommended-badge {
  position: absolute;
  top: 16px;
  left: 16px;
  background: #10b981;
  color: white;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  z-index: 10;
}
```

### Card Header Styles

```css
.card-header {
  padding: 24px;
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  border-bottom: 2px solid #e5e7eb;
}

.card-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  color: #111827;
}

.card-subtitle {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.6;
}
```

### Badge Styles

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.badge.ai-optimized {
  background: #dbeafe;
  color: #1e40af;
}

.badge.your-plan {
  background: #fef3c7;
  color: #92400e;
}

.badge.new {
  background: #dbeafe;
  color: #1e40af;
}

.badge.in-app {
  background: #dcfce7;
  color: #166534;
}
```

### Metrics Section

```css
.metrics-section {
  padding: 24px;
  border-bottom: 2px solid #f3f4f6;
}

.total-cost {
  font-size: 42px;
  font-weight: 700;
  color: #10b981;
  margin-bottom: 16px;
}

.total-cost.budget {
  color: #10b981;
}

.total-cost.premium {
  color: #8b5cf6;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.metric {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: #f9fafb;
  border-radius: 8px;
}

.metric-icon {
  font-size: 18px;
}

.metric-label {
  font-size: 11px;
  color: #6b7280;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.metric-value {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}
```

### Improvements Section (Yellow Box)

```css
.improvements-section {
  padding: 20px 24px;
  background: #fef3c7;
  border-bottom: 2px solid #fde68a;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #92400e;
  margin-bottom: 12px;
}

.improvement {
  display: flex;
  align-items: start;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #78350f;
}

.improvement-icon {
  font-size: 16px;
  margin-top: 2px;
}
```

### Methodology Section (Green Box)

```css
.methodology-section {
  padding: 20px 24px;
  background: #f0fdf4;
  border-bottom: 2px solid #bbf7d0;
}

.methodology-note {
  font-size: 14px;
  font-style: italic;
  color: #166534;
  line-height: 1.6;
}
```

### Activity Items

```css
.activity-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 8px;
  background: #f9fafb;
  border-radius: 8px;
  border-left: 3px solid #3b82f6;
}

.activity-day {
  background: white;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}

.activity-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.activity-price {
  font-size: 16px;
  font-weight: 700;
  color: #10b981;
}
```

### Button Styles

```css
.btn {
  flex: 1;
  padding: 14px 24px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
  transform: translateY(-2px);
}

.btn-secondary {
  background: white;
  color: #3b82f6;
  border: 2px solid #3b82f6;
}

.btn-secondary:hover {
  background: #eff6ff;
}

.btn-ghost {
  background: transparent;
  color: #6b7280;
  border: 2px solid #e5e7eb;
}

.btn-ghost:hover {
  background: #f9fafb;
}
```

---

## 🗓️ Full Itinerary View Styles

### Header

```css
.itinerary-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.itinerary-title {
  font-size: 32px;
  font-weight: 700;
}

.itinerary-cost {
  font-size: 36px;
  font-weight: 700;
}
```

### Package Cards

```css
.packages-section {
  padding: 30px;
  background: #f9fafb;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.package-card {
  background: white;
  padding: 20px;
  border-radius: 12px;
  border: 2px solid #e5e7eb;
}

.package-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.package-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
}

.package-cost {
  font-size: 24px;
  font-weight: 700;
  color: #3b82f6;
}
```

### Day Card

```css
.day-card {
  margin-bottom: 30px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}

.day-header {
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  padding: 20px;
  border-bottom: 2px solid #e5e7eb;
}

.day-number {
  background: #3b82f6;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 16px;
  font-weight: 700;
}

.day-date {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.day-theme {
  background: #fef3c7;
  color: #92400e;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  margin-left: auto;
}
```

### Flow Note (Yellow Callout)

```css
.flow-note {
  background: #fef3c7;
  border-left: 4px solid #fbbf24;
  padding: 12px 16px;
  margin: 16px 20px;
  border-radius: 8px;
  display: flex;
  align-items: start;
  gap: 10px;
}

.flow-note-icon {
  font-size: 18px;
  margin-top: 2px;
}

.flow-note-text {
  font-size: 14px;
  color: #92400e;
  line-height: 1.5;
}
```

### Activity Card (Timeline View)

```css
.activity-card {
  display: grid;
  grid-template-columns: 80px 1fr 200px;
  gap: 20px;
  padding: 20px;
  margin-bottom: 16px;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.activity-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.time-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.time-marker-time {
  font-size: 18px;
  font-weight: 700;
  color: #3b82f6;
}

.time-marker-icon {
  font-size: 28px;
}
```

### AI Note (Blue Callout)

```css
.ai-note {
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
  padding: 10px 12px;
  margin-top: 12px;
  border-radius: 6px;
  display: flex;
  align-items: start;
  gap: 8px;
}

.ai-note-icon {
  font-size: 16px;
  margin-top: 2px;
}

.ai-note-text {
  font-size: 13px;
  color: #1e40af;
  line-height: 1.5;
}
```

### Travel Info

```css
.travel-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #f59e0b;
  font-weight: 600;
  margin-bottom: 8px;
}
```

### Provider Badge

```css
.provider-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #f9fafb;
  border-radius: 20px;
  margin-bottom: 12px;
}

.provider-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.rating {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #f59e0b;
}
```

### Activity Image

```css
.activity-image {
  width: 200px;
  height: 200px;
  border-radius: 12px;
  object-fit: cover;
}
```

---

## 📱 Mobile Responsive Code

```css
@media (max-width: 768px) {
  /* Variant cards stack */
  .variants-grid {
    grid-template-columns: 1fr;
  }

  /* Activity cards become single column */
  .activity-card {
    grid-template-columns: 1fr;
  }

  /* Images take full width */
  .activity-image {
    width: 100%;
    height: 200px;
  }

  /* Header stacks vertically */
  .itinerary-header {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  /* Tabs stack */
  .tabs {
    flex-direction: column;
  }

  /* Packages stack */
  .packages-section {
    grid-template-columns: 1fr;
  }

  /* Day theme wraps */
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

## 🎨 Gradient Backgrounds

```css
/* Page background */
body {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Card headers */
.card-header {
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
}

/* Itinerary header */
.itinerary-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Day header */
.day-header {
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
}
```

---

## 🔧 Key Animations

```css
/* Hover lift effect */
.variant-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 50px rgba(0,0,0,0.2);
}

/* Button hover */
.btn-primary:hover {
  background: #2563eb;
  transform: translateY(-2px);
}

/* Activity card hover */
.activity-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

/* Icon button hover */
.icon-btn:hover {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

/* Tab transition */
.tab {
  transition: all 0.3s ease;
}

.tab:hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.5);
}
```

---

## 🗂️ Grid Layouts

```css
/* Variant cards grid */
.variants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 24px;
}

/* Metrics grid (2 columns) */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

/* Packages grid (auto-fit) */
.packages-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

/* Activity card grid (3 columns: time, content, image) */
.activity-card {
  display: grid;
  grid-template-columns: 80px 1fr 200px;
  gap: 20px;
}
```

---

## 🎯 Flexbox Layouts

```css
/* Day title row */
.day-title-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* Activity item */
.activity-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Activity left section */
.activity-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

/* Provider badge */
.provider-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* Card actions */
.card-actions {
  display: flex;
  gap: 12px;
}
```

---

## 📏 Spacing Scale

```css
/* Consistent spacing */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 12px;
--space-lg: 16px;
--space-xl: 24px;
--space-2xl: 32px;
--space-3xl: 48px;

/* Border radius */
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-2xl: 20px;
--radius-full: 9999px;
```

---

## 🔤 Typography Scale

```css
/* Font sizes */
--text-xs: 11px;
--text-sm: 13px;
--text-base: 14px;
--text-lg: 16px;
--text-xl: 18px;
--text-2xl: 24px;
--text-3xl: 32px;
--text-4xl: 42px;

/* Font weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* Line heights */
--leading-tight: 1.2;
--leading-normal: 1.5;
--leading-relaxed: 1.6;
```

---

## 🎨 Shadow Scale

```css
/* Box shadows */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
--shadow-xl: 0 10px 40px rgba(0,0,0,0.15);
--shadow-2xl: 0 15px 50px rgba(0,0,0,0.2);

/* Text shadow */
--text-shadow: 0 2px 10px rgba(0,0,0,0.2);
```

---

## 📦 Complete Component Example

```html
<!-- Variant Card Example -->
<div class="variant-card recommended">
  <span class="recommended-badge">✨ Recommended</span>
  
  <!-- Header -->
  <div class="card-header">
    <div class="badge-row">
      <span class="badge ai-optimized">🤖 AI Optimized</span>
    </div>
    <h2 class="card-title">Budget Optimizer</h2>
    <p class="card-subtitle">A cost-effective itinerary focusing on free and low-cost activities.</p>
  </div>

  <!-- Metrics -->
  <div class="metrics-section">
    <div class="total-cost budget">$80</div>
    <div class="metrics-grid">
      <div class="metric">
        <span class="metric-icon">⏱️</span>
        <div class="metric-content">
          <div class="metric-label">Active Time</div>
          <div class="metric-value">18 hours</div>
        </div>
      </div>
      <!-- More metrics... -->
    </div>
  </div>

  <!-- Improvements -->
  <div class="improvements-section">
    <h3 class="section-title">Why it's better</h3>
    <div class="improvement">
      <span class="improvement-icon">💰</span>
      <span>Saves $1,702 (95.5% less than premium)</span>
    </div>
  </div>

  <!-- Methodology -->
  <div class="methodology-section">
    <div class="methodology-note">
      "Saves 25% on costs by prioritizing free attractions and budget dining while maintaining a fulfilling Paris experience."
    </div>
  </div>

  <!-- Activities Preview -->
  <div class="activities-preview">
    <div class="activity-item">
      <div class="activity-left">
        <span class="activity-day">Day 2</span>
        <span class="activity-title">Breakfast: Poilâne</span>
        <div class="activity-badges">
          <span class="activity-badge new">New</span>
          <span class="activity-badge in-app">In-App</span>
        </div>
      </div>
      <span class="activity-price">$15</span>
    </div>
  </div>

  <!-- Actions -->
  <div class="card-actions">
    <button class="btn btn-primary">Book Now</button>
    <button class="btn btn-secondary">Expert Review</button>
    <button class="btn btn-ghost">View Full Plan</button>
  </div>
</div>
```

---

## 🚀 Quick Start Implementation

### 1. Copy Base Styles
```bash
# Copy the CSS variables and base styles from the HTML file
```

### 2. Build Component Structure
```jsx
// Start with the basic card component
<VariantCard data={budgetItinerary} isRecommended={true} />
```

### 3. Add Interactivity
```javascript
// Handle clicks, hovers, and state changes
function handleBook(variant) {
  // Navigate to booking flow
}
```

### 4. Connect to Backend
```javascript
// Fetch itinerary data from API
const itinerary = await fetch('/api/itineraries/123').then(r => r.json());
```

---

**All files are ready to use!** 🚀

Open the HTML file in your browser to see the full interactive design.
