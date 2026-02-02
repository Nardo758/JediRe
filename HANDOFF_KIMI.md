# Handoff to Kimi - Visual Design & UI Mockups

**Date:** February 2, 2026  
**Project:** JediRe - Real Estate Intelligence Platform  
**Phase:** Visual Design & UI Mockups  
**Estimated Time:** 1-2 days

---

## Your Mission

Create high-fidelity visual designs for JediRe's user interface, transforming ASCII wireframes into production-ready mockups.

**What's already done (by Claude):**
- ✅ ASCII wireframes (functional layouts)
- ✅ Feature specifications
- ✅ User flow documentation
- ✅ Basic design system notes

**What you need to create:**
- High-fidelity UI mockups (Figma/Sketch/Adobe XD)
- Complete design system
- Component library designs
- Icon set
- Responsive layouts
- Interactive prototypes (optional)

---

## Project Context

### What is JediRe?

A real estate intelligence platform for investors and developers that:
- Automatically extracts properties from emails using AI
- Matches properties against user-defined criteria
- Visualizes deals on interactive maps
- Manages deal pipelines (Lead → Qualified → Analyzing → Closed)
- Enables team collaboration on deals

### Target Users

**Primary:** Real estate investors and developers
- Age: 30-55
- Tech-savvy but not developers
- Need efficiency and data density
- Value speed and accuracy
- Work on mobile and desktop

**Secondary:** Real estate analysts and brokers
- Supporting role
- Need collaboration features
- Review and approve deals

### Tone & Personality

- **Professional** - This is serious business software
- **Efficient** - No fluff, information-dense
- **Intelligent** - AI-powered, sophisticated
- **Trustworthy** - Handling important financial data
- **Modern** - Contemporary tech aesthetic

**Not:**
- Playful or cute
- Overly minimal (needs data density)
- Consumer-app casual
- Corporate stiff

**Think:** Bloomberg Terminal meets Notion (data-dense but modern)

---

## Reference Materials

### ASCII Wireframes to Transform

**Location:** `/home/leon/clawd/jedire/frontend/WIREFRAMES.md`

**8 screens to design:**
1. User Preferences Settings Page (desktop)
2. Email Extraction Review Modal - Detail View
3. Email Extraction Review Modal - List View
4. Main Dashboard with Map + Pipeline
5. Property Details Panel
6. Notification Dropdown
7. Mobile Dashboard View
8. Mobile Email Review Modal

---

## Design System to Create

### 1. Color Palette

**Pipeline Stage Colors (already defined):**
- Lead: `#94a3b8` (Slate 400 - Gray)
- Qualified: `#60a5fa` (Blue 400)
- Analyzing: `#fbbf24` (Amber 400)
- Offer Made: `#fb923c` (Orange 400)
- Under Contract: `#a78bfa` (Purple 400)
- Closed: `#34d399` (Emerald 400)

**UI Colors (you define):**
- Primary: (Main brand color - suggest something professional)
- Secondary: (Accent color)
- Success: `#10b981` (Green)
- Warning: `#f59e0b` (Orange)
- Error/Danger: `#ef4444` (Red)
- Info: `#3b82f6` (Blue)

**Neutrals (suggest palette):**
- Background: (Light mode)
- Surface: (Cards, panels)
- Border: (Dividers)
- Text primary:
- Text secondary:
- Text disabled:

**Dark mode (optional):**
- Design system should support dark mode if possible

### 2. Typography

**Recommendations:**
- **Headings:** Inter, SF Pro Display, or similar geometric sans
- **Body:** Inter, SF Pro Text, or Roboto
- **Data/Numbers:** JetBrains Mono, SF Mono, or Roboto Mono
- **Map labels:** System font stack (performance)

**Type scale:**
- Display: 32px-48px (page titles)
- H1: 24px-32px (section headers)
- H2: 20px-24px (subsections)
- H3: 16px-18px (card titles)
- Body: 14px-16px (main text)
- Small: 12px-14px (labels, captions)
- Tiny: 10px-12px (metadata)

**Weights:**
- Bold: 700 (headings, emphasis)
- Semibold: 600 (subheadings)
- Medium: 500 (labels, buttons)
- Regular: 400 (body text)

### 3. Spacing System

**Base unit:** 4px

**Scale:**
- XS: 4px (tight spacing)
- S: 8px (compact)
- M: 16px (standard)
- L: 24px (generous)
- XL: 32px (sections)
- 2XL: 48px (major breaks)

**Component padding:**
- Buttons: 12px vertical, 20px horizontal
- Input fields: 10px vertical, 12px horizontal
- Cards: 16px-24px all sides
- Modals: 24px-32px all sides

### 4. Border Radius

**Suggestions:**
- Small: 4px (buttons, inputs)
- Medium: 8px (cards, dropdowns)
- Large: 12px (modals, images)
- Full: 9999px (pills, avatars)

### 5. Shadows

**Elevation system:**
- Flat: none (inline elements)
- Low: subtle shadow (cards)
- Medium: noticeable shadow (dropdowns)
- High: strong shadow (modals, tooltips)
- Overlay: backdrop blur + shadow (modals)

**Example:**
```css
/* Low */
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

/* Medium */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

/* High */
box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
```

---

## Screen-by-Screen Requirements

### 1. User Preferences Settings Page

**Layout:** Two-column (sidebar + main content)

**Key elements:**
- Left sidebar: Settings navigation (highlight "Preferences")
- Main area: Form with 9 sections
- Sticky save button at bottom
- Visual hierarchy between sections
- Clear dividers

**Specific design needs:**

**Asset Types Section:**
- Checkbox grid (3-4 columns on desktop)
- Clear, scannable options
- Visual icons for each property type?
  - Multifamily: 🏢
  - Land: 🌳
  - ALF: 🏥
  - etc.

**Vintage Dropdown:**
- Clean select with clear options
- "1990 or newer", "1980 or newer", etc.

**Geography Section:**
- Interactive US map (design this!)
  - States fill with color when selected
  - Click to select/deselect
  - Visual indication of selected states
- OR: State checkboxes organized by region
  - Collapsible regions (South, Southwest, West, etc.)
  - Each region shows count of selected states

**Unit Count + Price Range:**
- Dual number inputs with labels
- Preset buttons below (pill-style)
- Clear, readable numbers with formatting

**Automation Settings:**
- Radio button group with descriptions
- Slider for confidence threshold
  - Visual indicator at 80%
  - Percentage label moves with thumb

**Save/Cancel:**
- Prominent save button (primary color)
- Cancel is secondary/ghost style

### 2. Email Extraction Review Modal - Detail View

**Layout:** Centered modal (800px width), overlay backdrop

**Key elements:**

**Header:**
- "Property Review (1 of 5)" title
- Close button (X) top-right
- Clean, minimal

**Property Card:**
- Address as prominent headline
- Property details in 2-column grid
  - Type, Units, Year, Price
  - Cap Rate, Occupancy, Sqft
- Clean, scannable layout
- Icons for each field (optional)?

**Match Score:**
- Large percentage display (85%)
- Progress bar visual
  - Gradient from gray to green
  - 85% filled
- List of match reasons below
  - ✓ green checkmarks for matches
  - ✗ red X for mismatches (if any)
- Clean, easy-to-scan list

**Mini Map:**
- Small embedded map (300x200px)
- Property pin centered
- Subtle, not distracting
- Clean frame/border

**Email Context:**
- Collapsed by default (just from/subject)
- Expandable to show full email
- Secondary visual treatment (lighter bg?)

**Action Buttons:**
- Three buttons, full width of modal
- [Skip] - ghost/outline style
- [❌ Reject] - danger/red
- [✅ Add to Map] - primary/success
- Clear visual hierarchy

**Navigation:**
- Previous/Next arrows
- Page indicator (1/5) between them
- Bottom of modal
- Keyboard hint icons?

### 3. Email Extraction Review Modal - List View

**Layout:** Taller modal (900px width, full height)

**Key elements:**

**Toggle:** Top-right switch between List/Detail views
- Clear icons: 📋 List | 📄 Detail

**Property List:**
- Each item is a compact card (100-120px height)
- Contains:
  - Address (bold, 16px)
  - Property type • Units • Price (14px, gray)
  - Match score bar + percentage
  - Quick match indicators (✓✓✓✗ inline)
  - Three action buttons (Details, Reject, Add)

**Spacing:**
- 12px between cards
- Clean dividers
- Scannable layout

**Bulk Actions:**
- Bottom bar with:
  - "Add All High Matches (3)" - success button
  - "Reject All Low (1)" - danger button
- Fixed to bottom of modal

### 4. Main Dashboard with Map + Pipeline

**Layout:** Full-screen app layout

**Top navigation:**
- Logo + app name (left)
- Search bar (center)
- Notification bell with badge (right)
- User avatar + dropdown (right)

**Left sidebar:**
- Dashboard, Maps, Inbox, Analytics, Settings
- List of maps
- Active map highlighted
- Clean, minimal icons

**Main content:**

**Top widget:**
- "Pending Property Reviews" card
- Prominent, attention-grabbing
- Count + "Review Now" button
- Dismissible?

**Map section:**
- Large interactive map
- Property pins clustered by location
- On hover: property name + price
- Layer toggles in bottom-left corner
- Zoom controls bottom-right

**Pipeline section (below map):**
- Kanban-style board
- 6 columns (Lead, Qualified, Analyzing, Offer, Contract, Closed)
- Each column:
  - Header with stage name + count
  - Stage color bar at top
  - Property cards stacked vertically
  - Scrollable if many cards

**Property cards in pipeline:**
- Compact (200px wide, 120px tall)
- Property name (bold)
- Price • Units (or key metrics)
- Source icon (📧 email or 🔍 manual)
- Drag handle (implied, not prominent)

### 5. Property Details Panel

**Layout:** Right slide-in panel or modal (400-500px width)

**Structure:**
- Header: Address + close button
- Photo/street view placeholder (if available)
- Property details section
  - Key/value pairs
  - Clear labels
  - Clean alignment
- Source information section
  - Email icon + from/subject
  - Date received
  - "View Full Email" link
- Pipeline status section
  - Current stage with dot indicator
  - Progress timeline visual
  - "Move to Next Stage" button
- Notes section (collapsible)
- Deal intel section (collapsible)
- Action buttons at bottom
  - Delete (danger, left)
  - Edit, Analyze (right)

### 6. Notification Dropdown

**Layout:** Dropdown from top-right bell icon (350px width)

**Structure:**
- Header: "Notifications" + Mark All Read + Close
- List of notifications
  - Each notification:
    - Icon (left)
    - Title (bold, 14px)
    - Message (regular, 13px)
    - Time (gray, 12px)
    - Unread indicator (blue dot?)
    - Action button (if applicable)
  - Dividers between notifications
- "View All" link at bottom

**Notification types (design each):**
- ✅ Property auto-added (success)
- 🟡 Properties need review (warning)
- 📧 Emails scanned (info)
- 👥 Collaboration proposal (info)

### 7. Mobile Dashboard View

**Layout:** Single column, full width

**Top bar:**
- Hamburger menu (left)
- JediRe logo/name (center)
- Notifications badge (right)

**Pending reviews widget:**
- Full-width card
- Tappable "Review Now" button

**Map:**
- Full-width, 300-400px height
- Pinch to zoom
- Tap pin for details

**View toggle:**
- [Map] [Pipeline] [List] pills
- Below map, above content

**Pipeline (mobile):**
- Horizontal scroll stages
- Or: Accordion (tap stage to expand)
- Property cards stacked in each stage

### 8. Mobile Email Review Modal

**Layout:** Full-screen modal

**Structure:**
- Header: Title + page count + X button
- Swipe indicator at top
- Property details (simplified)
- Match score with bar
- Mini map (optional, takes space)
- Email context (collapsed)
- Three action buttons (stacked, full width)
  - Large, touch-friendly (48px height)
- Previous/Next at bottom

---

## Icon Set to Create

**Property types:**
- Multifamily (building)
- Land (tree/field)
- ALF (medical cross/building)
- Memory Care
- Retail (shopping)
- Office (desk)
- Industrial (factory)
- Mixed-Use
- Hospitality (hotel)
- Self-Storage
- Mobile Home Park
- Student Housing

**UI icons:**
- Map pin
- Email/inbox
- Notification bell
- Settings gear
- User avatar
- Search
- Plus (add)
- Edit (pencil)
- Delete (trash)
- Close (X)
- Checkmark
- Arrow (left/right/up/down)
- Expand/collapse
- More (three dots)

**Style:** Choose consistent icon style
- Outlined vs filled?
- Line weight?
- Corner style?

**Suggestions:**
- Heroicons (outline)
- Phosphor icons
- Custom designed

---

## Deliverables Checklist

### Design Files

- [ ] Figma/Sketch/XD file with all screens
- [ ] Component library (buttons, inputs, cards, etc.)
- [ ] Design system documentation
- [ ] Icon set (SVG exports)
- [ ] Color palette (hex codes)
- [ ] Typography specs (font names, sizes, weights)

### Mockups (High-Fidelity)

- [ ] 1. User Preferences Settings Page (desktop, 1440px)
- [ ] 2. Email Review Modal - Detail View (800px modal)
- [ ] 3. Email Review Modal - List View (900px modal)
- [ ] 4. Main Dashboard with Map + Pipeline (1440px)
- [ ] 5. Property Details Panel (400-500px panel)
- [ ] 6. Notification Dropdown (350px dropdown)
- [ ] 7. Mobile Dashboard (375px - iPhone)
- [ ] 8. Mobile Email Review Modal (375px - iPhone)

### Additional Screens (if time permits)

- [ ] Empty states (no maps, no properties, etc.)
- [ ] Loading states (skeleton screens)
- [ ] Error states (failed to load, network error)
- [ ] Success confirmations (property added, etc.)

### Interactive Prototype (optional)

- [ ] Clickable prototype showing:
  - Navigation between screens
  - Modal open/close
  - Button hover states
  - Form interactions
  - Pipeline drag-and-drop (if designed)

### Responsive Breakpoints

- [ ] Desktop: 1440px (primary)
- [ ] Tablet: 768px-1024px (nice to have)
- [ ] Mobile: 375px (iPhone SE)
- [ ] Mobile large: 414px (iPhone Pro Max)

---

## Design Inspiration

**Similar products to reference:**
- Airtable (data density + modern UI)
- Notion (clean, organized, collaborative)
- Linear (speed, efficiency, keyboard shortcuts)
- Monday.com (kanban, pipeline views)
- Figma (professional tools, clean interface)
- Bloomberg Terminal (data-dense, professional)

**Maps:**
- Mapbox GL JS default styles
- Google Maps (clean, minimal)
- Property pins should be clear, not cluttered

**Real estate specific:**
- Zillow (property cards)
- Redfin (search filters)
- CoStar (commercial real estate data)
- Reonomy (property intelligence)

---

## Technical Constraints

**Map integration:**
- Will use Mapbox GL JS
- Design custom pin markers (SVG icons)
- Popup tooltips on hover
- Cluster markers when zoomed out

**Frontend framework:**
- React + TypeScript
- Tailwind CSS for styling
- Radix UI or Headless UI for components
- Design should be Tailwind-friendly

**Icon system:**
- SVG icons (not icon fonts)
- Inline or sprite sheet
- Size: 16px, 20px, 24px variants

**Performance:**
- Keep images optimized
- Use system fonts when possible
- Avoid heavy animations
- Design for fast rendering

---

## Brand Guidelines (if creating logo)

**Logo elements (optional):**
- Name: JediRe (Jedi Real Estate)
- Could incorporate:
  - Map pin
  - Real estate building
  - Intelligence/AI element
  - Professional, not playful
- Colors: Match your primary palette
- Wordmark or icon+wordmark?

**Favicon:**
- Simple, recognizable at 16x16px
- Works on light and dark backgrounds

---

## Accessibility Requirements

**Design must support:**

**Color contrast:**
- WCAG AA minimum (4.5:1 for text)
- WCAG AAA preferred (7:1 for text)
- Check all text/background combinations

**Touch targets:**
- Minimum 44x44px (iOS) or 48x48px (Material)
- Adequate spacing between interactive elements

**Focus states:**
- Visible focus indicators for keyboard nav
- Don't rely on color alone

**Text sizing:**
- Readable at default sizes
- Supports browser zoom (up to 200%)

**Alt text considerations:**
- Design meaningful icon labels
- Ensure icons have text alternatives

---

## File Organization

**Suggested Figma structure:**
```
JediRe Design System
├── 📄 Cover
├── 🎨 Design System
│   ├── Colors
│   ├── Typography
│   ├── Spacing
│   ├── Shadows
│   ├── Icons
│   └── Components
├── 🖥️ Desktop Screens
│   ├── 1. Preferences Settings
│   ├── 2. Review Modal - Detail
│   ├── 3. Review Modal - List
│   ├── 4. Main Dashboard
│   ├── 5. Property Details
│   └── 6. Notifications
├── 📱 Mobile Screens
│   ├── 7. Mobile Dashboard
│   └── 8. Mobile Review Modal
└── 🔄 Flows (interactive prototype)
```

---

## Export Requirements

### For developers:

**Screen mockups:**
- PNG exports at 2x (Retina)
- 1440px width for desktop
- 375px width for mobile

**Design specs:**
- CSS variables for colors
- Font stack with fallbacks
- Spacing values in rem/px
- Shadow CSS values

**Icons:**
- SVG exports (individual files)
- Optimized with SVGO
- Consistent viewBox (e.g., 0 0 24 24)

**Component specs:**
- Dimensions (width, height, padding)
- States (default, hover, active, disabled, focus)
- Variants (primary, secondary, danger, etc.)

---

## Timeline

**Day 1:**
- Morning: Design system (colors, typography, components)
- Afternoon: Desktop mockups (Preferences, Review Modal, Dashboard)

**Day 2:**
- Morning: Desktop mockups (Property Details, Notifications)
- Afternoon: Mobile mockups + responsive variants

**Polish & Export:**
- Interactive prototype (if time)
- Export all assets
- Documentation

---

## Questions to Resolve

**Logo:**
- Create new logo or use text-only?
- Any existing brand colors to match?

**Dark mode:**
- Required or optional?
- If required, design both themes

**Map style:**
- Light or dark base map?
- Custom Mapbox style or standard?

**Photography:**
- Property photos placeholder style?
- Use real examples or abstract?

---

## When Complete

**Deliverables:**
1. Design file link (Figma public link preferred)
2. PNG exports in `/design/mockups/`
3. SVG icons in `/design/icons/`
4. Design system doc in `/design/DESIGN_SYSTEM.md`
5. CSS/Tailwind config in `/design/tailwind.config.js` (if possible)

**Commit message:**
```bash
git add design/
git commit -m "[Kimi] Complete visual design & mockups

- High-fidelity mockups for all 8 screens
- Complete design system (colors, typography, spacing)
- Icon set (24 custom SVG icons)
- Responsive layouts (desktop + mobile)
- Interactive prototype

Figma link: [your-link-here]"

git push origin master
```

**Notify Leon and Claude:**
- Share Figma link
- Highlight key design decisions
- Any questions that came up
- Ready for developer handoff

---

## Inspiration & References

**Color palettes:**
- Tailwind CSS colors (great defaults)
- Radix Colors (accessible by design)
- Material Design colors

**Design systems to study:**
- Atlassian Design System
- Shopify Polaris
- IBM Carbon
- Microsoft Fluent

**Real estate platforms:**
- Zillow, Redfin, CoStar (for property card design)
- Buildout (commercial real estate)
- Reonomy (property intelligence)

---

**Create something beautiful and functional!** 🎨

**Questions?** Tag Leon or Claude in your commits.
