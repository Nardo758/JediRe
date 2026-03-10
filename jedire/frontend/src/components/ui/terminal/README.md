# Terminal UI Components

Bloomberg Terminal-inspired UI components for data-dense property intelligence displays.

## Theme

The `TerminalTheme` object provides a consistent dark color palette and typography.

```tsx
import { TerminalTheme as T } from '@/components/ui/terminal';

<div style={{ background: T.bg.panel, color: T.text.primary }}>
  Content
</div>
```

## Components

### Badge

Small label with colored background and border.

```tsx
import { Badge } from '@/components/ui/terminal';

<Badge color={T.text.green}>ACTIVE</Badge>
<Badge color={T.text.amber} bg="#00000099">$250K</Badge>
```

**Props:**
- `children`: ReactNode
- `color?`: string (default: T.text.amber)
- `bg?`: string (default: color15)
- `border?`: string (default: color40)

### SectionHeader

Panel header with title, optional subtitle, icon, and action.

```tsx
import { SectionHeader } from '@/components/ui/terminal';

<SectionHeader 
  title="PROPERTY VITALS" 
  subtitle="M01 · Core Metrics"
  icon="◈" 
  borderColor={T.text.cyan}
  action={<Badge>LIVE</Badge>}
/>
```

**Props:**
- `title`: string
- `subtitle?`: string
- `icon?`: string (emoji/symbol)
- `borderColor?`: string (default: T.text.amber)
- `action?`: ReactNode

### DataRow

Key-value row for displaying metrics.

```tsx
import { DataRow } from '@/components/ui/terminal';

<DataRow label="Occupancy" value="93.5%" color={T.text.green} />
<DataRow label="NOI" value="$2.68M" sub="/yr" />
```

**Props:**
- `label`: string
- `value`: string | number
- `sub?`: string (subscript/unit)
- `color?`: string
- `mono?`: boolean (default: true)

### MiniBar

Small horizontal progress bar.

```tsx
import { MiniBar } from '@/components/ui/terminal';

<MiniBar value={75} max={100} color={T.text.green} width={80} />
```

**Props:**
- `value`: number
- `max`: number
- `color?`: string (default: T.text.cyan)
- `width?`: number (default: 60)

### MiniSparkline

Inline line chart for trends.

```tsx
import { MiniSparkline } from '@/components/ui/terminal';

<MiniSparkline 
  data={[100, 105, 110, 108, 115]} 
  color={T.text.green}
  width={80}
  height={20}
/>
```

**Props:**
- `data`: number[]
- `color?`: string (default: T.text.green)
- `width?`: number (default: 60)
- `height?`: number (default: 16)

### ScoreRing

Circular progress indicator with score label.

```tsx
import { ScoreRing } from '@/components/ui/terminal';

<ScoreRing score={82} size={72} label="JEDI" />
```

**Props:**
- `score`: number (0-100)
- `size?`: number (default: 72)
- `strokeWidth?`: number (default: 5)
- `label?`: string (default: "JEDI")

**Colors by score:**
- 80+: green
- 65-79: amber
- 50-64: orange
- <50: red

### PhotoGallery

Photo carousel with thumbnails and lightbox.

```tsx
import { PhotoGallery } from '@/components/ui/terminal';

const photos = [
  { id: 1, url: "/img1.jpg", label: "Exterior" },
  { id: 2, url: "/img2.jpg", label: "Pool" },
  // ...
];

<PhotoGallery photos={photos} placeholderMode={false} />
```

**Props:**
- `photos`: Array<{ id: string | number; url?: string; label?: string; color?: string }>
- `placeholderMode?`: boolean (default: false) - show architectural placeholders instead of images

## Utilities

```tsx
import { formatCompact, formatFull, formatPercent } from '@/components/ui/terminal/utils';

formatCompact(1_500_000);  // "$1.5M"
formatFull(1_500_000);     // "$1,500,000"
formatPercent(5.234);      // "5.2%"
```

## Typography

The theme includes custom font stacks. Add these to your app's global CSS:

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
```

## Example Layout

```tsx
import { 
  TerminalTheme as T, 
  SectionHeader, 
  DataRow, 
  Badge,
  ScoreRing 
} from '@/components/ui/terminal';

<div style={{ background: T.bg.panel, border: `1px solid ${T.border.subtle}`, borderRadius: 2 }}>
  <SectionHeader 
    title="PERFORMANCE" 
    icon="▲" 
    borderColor={T.text.green}
    action={<Badge color={T.text.green}>LIVE</Badge>}
  />
  <DataRow label="Occupancy" value="93.5%" color={T.text.green} />
  <DataRow label="NOI" value="$2.68M" sub="/yr" />
  <div style={{ padding: 10, display: 'flex', justifyContent: 'center' }}>
    <ScoreRing score={82} />
  </div>
</div>
```
