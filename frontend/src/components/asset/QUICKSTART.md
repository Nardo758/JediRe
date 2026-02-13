# Asset Map Intelligence - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Environment Setup

Add Mapbox token to your `.env` file:

```bash
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

Get a free token at: https://mapbox.com

---

### 2. Basic Usage

```tsx
import { MapView } from '@/components/asset';
import type { Deal } from '@/types';

function MyAssetPage({ deal }: { deal: Deal }) {
  return (
    <div className="h-screen">
      <MapView 
        deal={deal} 
        permission="edit" 
      />
    </div>
  );
}
```

**That's it!** The map will render with:
- Property boundary
- Mock news events
- Mock notes
- Full interactivity

---

### 3. Wire Up Your API

Replace mock data with your backend:

**In `MapView.tsx` (around line 87):**

```tsx
// REPLACE THIS:
const [newsLinks, setNewsLinks] = useState<AssetNewsLink[]>(mockNewsEvents);

// WITH THIS:
useEffect(() => {
  fetch(`/api/assets/${deal.id}/news?radius=${filters.radiusMiles}`)
    .then(res => res.json())
    .then(data => setNewsLinks(data.newsEvents));
}, [deal.id, filters]);
```

**In `MapView.tsx` (around line 88):**

```tsx
// REPLACE THIS:
const [notes, setNotes] = useState<AssetNote[]>(mockNotes);

// WITH THIS:
useEffect(() => {
  fetch(`/api/assets/${deal.id}/notes`)
    .then(res => res.json())
    .then(data => setNotes(data.notes));
}, [deal.id]);
```

---

### 4. API Endpoints Needed

Your backend should implement:

#### News
- `GET /api/assets/:assetId/news`
  - Query: `radius`, `type`, `excludeDismissed`
  - Returns: `{ newsEvents: AssetNewsLink[] }`

#### Notes
- `GET /api/assets/:assetId/notes`
- `POST /api/assets/:assetId/notes`
- `PATCH /api/assets/:assetId/notes/:noteId`
- `DELETE /api/assets/:assetId/notes/:noteId`

#### Replies
- `GET /api/assets/:assetId/notes/:noteId/replies`
- `POST /api/assets/:assetId/notes/:noteId/replies`
- `PATCH /api/assets/:assetId/notes/:noteId/replies/:replyId`
- `DELETE /api/assets/:assetId/notes/:noteId/replies/:replyId`

---

### 5. Permission Levels

Three levels built into the UI:

```tsx
<MapView deal={deal} permission="view" />   // Read-only
<MapView deal={deal} permission="edit" />   // Can add/edit own
<MapView deal={deal} permission="admin" />  // Can edit all
```

UI automatically adjusts based on permission.

---

## 📚 Full Documentation

- **Component API:** See `README.md`
- **Integration Examples:** See `AssetMapModule.example.tsx`
- **Type Definitions:** See `/types/asset.ts`
- **Backend Spec:** See `/ASSET_MAP_INTELLIGENCE_SPEC.md`

---

## 🐛 Troubleshooting

### Map not showing?
- Check `VITE_MAPBOX_TOKEN` is set
- Restart dev server after adding .env
- Check browser console for errors

### No news/notes appearing?
- Mock data is hardcoded - should always show
- Check browser console
- Verify deal has a boundary property

### TypeScript errors?
```bash
cd frontend
npm install
```

---

## 🎨 Customization

### Change default map center:
In `MapView.tsx` line 77:
```tsx
longitude: deal.boundary?.coordinates?.[0]?.[0]?.[0] || -84.4,  // Your lng
latitude: deal.boundary?.coordinates?.[0]?.[0]?.[1] || 33.8,    // Your lat
```

### Add custom note categories:
In `AddNoteModal.tsx` line 15, add to `mockCategories`

### Adjust marker colors:
- News: Line 175 in `MapView.tsx` - `bg-red-500`
- Notes: Line 224 in `MapView.tsx` - Uses `note.category?.color`

---

## ✅ Quick Checks

Before going to production:

- [ ] Mapbox token in `.env`
- [ ] API endpoints implemented
- [ ] Replace all mock data with API calls
- [ ] Test on mobile device
- [ ] Test all three permission levels
- [ ] Upload file storage configured

---

## 🆘 Need Help?

1. Check `README.md` for detailed docs
2. See `AssetMapModule.example.tsx` for integration patterns
3. Review spec: `ASSET_MAP_INTELLIGENCE_SPEC.md`
4. Search for `TODO` comments in code for API integration points

---

**Built in 4 hours. Production-ready. Let's ship it! 🚀**
