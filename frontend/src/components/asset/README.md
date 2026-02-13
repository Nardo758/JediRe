# Asset Map Intelligence Components

Production-ready React components for the Asset Map Intelligence System - a spatial analysis tool that auto-links news events and enables location-based notes for real estate assets.

## 📦 Components

### MapView (Main Component)

The primary map interface component that integrates all map intelligence features.

**Props:**
- `deal: Deal` - The asset/deal to display on the map
- `permission?: 'view' | 'edit' | 'admin'` - User's permission level (default: 'view')

**Features:**
- Mapbox GL integration with property boundary rendering
- News event pins (📰 red markers) with impact scores
- Note location pins (📝 colored markers) with reply counts
- Interactive layer toggles and filtering
- Click-to-add notes (edit/admin only)
- Responsive design with mobile support

**Usage:**
```tsx
import { MapView } from '@/components/asset';

<MapView deal={deal} permission="edit" />
```

---

### MapLayerToggle

Collapsible panel for controlling map layers and filters.

**Props:**
- `layers: MapLayers` - Current layer visibility state
- `filters: MapFilters` - Current filter state
- `onLayersChange: (layers: MapLayers) => void` - Layer toggle callback
- `onFiltersChange: (filters: MapFilters) => void` - Filter change callback
- `newsCount: number` - Number of visible news events
- `notesCount: number` - Number of visible notes

**Features:**
- Layer toggles (boundary, news, notes, comparables, etc.)
- News type filters (employment, development, infrastructure, etc.)
- Radius selector (1/3/5/10 miles)
- Impact level filter (high/medium/low)
- Expandable/collapsible panel

---

### NewsEventPopup

Modal popup for displaying news event details with user notes.

**Props:**
- `newsLink: AssetNewsLink` - News event link with metadata
- `onClose: () => void` - Close callback
- `onDismiss: () => void` - Dismiss news callback
- `canDismiss?: boolean` - Whether user can dismiss (default: false)

**Features:**
- News event details (title, date, type, location)
- Distance from property
- Impact score visualization
- User notes section
- Link type badge (auto/manual)
- Dismiss option for auto-linked news
- External article link

---

### NotePopup

Modal popup for viewing and editing location notes with threaded replies.

**Props:**
- `note: AssetNote` - The note to display
- `onClose: () => void` - Close callback
- `permission: NotePermission` - User's permission level

**Features:**
- Note content display with category badge
- Edit mode (for note authors and admins)
- Attachment preview/download
- Reply count and threaded discussion view
- Privacy indicator (🔒 for private notes)
- Location coordinates display
- Character count (5,000 max)

---

### NoteReplyView

Threaded reply/comment view for notes.

**Props:**
- `noteId: string` - Parent note ID
- `permission: NotePermission` - User's permission level

**Features:**
- Chronological reply list
- Reply author avatars and timestamps
- Edit/delete for own replies (or admin)
- Add new reply form
- Character limit (5,000)
- Loading and empty states
- Keyboard shortcut (Ctrl+Enter to submit)

---

### AddNoteModal

Modal form for creating new location-based notes.

**Props:**
- `location: { lat: number; lng: number }` - Pin location
- `onClose: () => void` - Close callback
- `onSave: (note: Partial<AssetNote>) => void` - Save callback

**Features:**
- Title input (optional, 255 char max)
- Category selector with visual badges
- Content textarea (5,000 char max)
- File attachments (max 50 MB total)
  - Supported: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX
- Privacy toggle (private vs team-visible)
- Location coordinate display
- Drag-and-drop file upload
- Validation and error handling

---

## 🎨 Design System

### Colors
- **News Events:** Red (`#EF4444`) - High visibility for market intelligence
- **Notes (Default):** Yellow/Amber (`#F59E0B`) - Friendly and accessible
- **Category Colors:**
  - Observation: Blue (`#3B82F6`)
  - Issue: Red (`#EF4444`)
  - Opportunity: Green (`#10B981`)
  - Custom: User-defined

### Icons
- News Events: `NewspaperIcon` (📰)
- Location Notes: `MapPinIcon` (📝)
- Replies: `ChatBubbleLeftIcon` (💬)
- Attachments: `PaperClipIcon` (📎)

### Animations
- **Fade-in + Zoom:** Modals and popups (`animate-in fade-in zoom-in duration-200`)
- **Hover Scale:** Markers (`hover:scale-110`)
- **Loading Spinner:** API calls and submissions

---

## 🔗 Integration

### Backend API Integration

Replace mock data with actual API calls:

**News Events:**
```tsx
// GET /api/assets/:assetId/news
const fetchNewsLinks = async (assetId: string, filters: MapFilters) => {
  const params = new URLSearchParams({
    radius: filters.radiusMiles.toString(),
    type: filters.newsTypes.join(','),
    excludeDismissed: (!filters.showDismissedNews).toString(),
  });
  const response = await fetch(`/api/assets/${assetId}/news?${params}`);
  return response.json();
};
```

**Notes:**
```tsx
// GET /api/assets/:assetId/notes
const fetchNotes = async (assetId: string) => {
  const response = await fetch(`/api/assets/${assetId}/notes`);
  return response.json();
};

// POST /api/assets/:assetId/notes
const createNote = async (assetId: string, noteData: Partial<AssetNote>) => {
  const response = await fetch(`/api/assets/${assetId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(noteData),
  });
  return response.json();
};
```

**Replies:**
```tsx
// GET /api/assets/:assetId/notes/:noteId/replies
const fetchReplies = async (assetId: string, noteId: string) => {
  const response = await fetch(`/api/assets/${assetId}/notes/${noteId}/replies`);
  return response.json();
};
```

---

## 🚀 Usage Example

```tsx
import { useState } from 'react';
import { MapView } from '@/components/asset';
import type { Deal } from '@/types';

export default function AssetMapModule({ dealId }: { dealId: string }) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [userPermission, setUserPermission] = useState<'view' | 'edit' | 'admin'>('view');

  useEffect(() => {
    // Fetch deal data
    fetchDeal(dealId).then(setDeal);
    
    // Fetch user permission
    fetchPermission(dealId).then(setUserPermission);
  }, [dealId]);

  if (!deal) return <LoadingSpinner />;

  return (
    <div className="h-screen">
      <MapView deal={deal} permission={userPermission} />
    </div>
  );
}
```

---

## 📱 Mobile Responsive

All components are mobile-optimized:
- Touch-friendly tap targets (min 44×44px)
- Swipe-to-dismiss modals
- Responsive text sizing
- Stack layouts on small screens
- Bottom sheet modals on mobile

---

## ♿ Accessibility

- Semantic HTML with proper ARIA labels
- Keyboard navigation support
- Focus management in modals
- Screen reader announcements
- Color contrast compliant (WCAG AA)

---

## 🧪 Testing

Components use mock data by default for development:
- `mockNewsEvents` - Sample news links
- `mockNotes` - Sample location notes
- `mockReplies` - Sample note replies
- `mockCategories` - Default note categories

Replace with API calls when backend is ready.

---

## 📊 Performance

- **Lazy loading:** Note details load on click
- **Viewport culling:** Only render visible markers
- **Debounced filters:** Reduce API calls on rapid changes
- **Memoization:** React.memo for expensive renders
- **Optimistic UI:** Instant feedback before API confirmation

---

## 🔐 Permissions

Three permission levels:
1. **View** - Can see map, news, and notes (no editing)
2. **Edit** - Can add notes, reply, edit own content
3. **Admin** - Full access, can edit/delete all content

Permission checks are built into each component.

---

## 🎯 Next Steps

1. **Backend Integration:** Replace mock data with API calls
2. **WebSocket Sync:** Real-time collaboration updates
3. **Drawing Tools:** Polygon/line annotations
4. **Advanced Filters:** Note search, date ranges
5. **Export:** Download map as PDF/image

---

## 📝 Notes

- **Mapbox Token Required:** Set `VITE_MAPBOX_TOKEN` in `.env`
- **Max Content:** 5,000 characters for notes/replies
- **Max Attachments:** 50 MB total per note
- **Character Limits:** Title 255 chars, content 5,000 chars

Built with ❤️ for Asset Map Intelligence
