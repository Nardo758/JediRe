# JediRe Frontend Setup Guide

## 🚀 Quick Start (5 minutes)

### 1. Install Dependencies

```bash
cd /home/leon/clawd/jedire/frontend
npm install
```

### 2. Get Mapbox Token

1. Go to https://mapbox.com
2. Sign up for free account
3. Navigate to Account → Tokens
4. Copy your default public token

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6InlvdXJ0b2tlbiJ9.xxxxxx
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### 4. Start Development Server

```bash
npm run dev
```

Open http://localhost:3000 🎉

---

## 🛠️ Development Without Backend

If you don't have the backend running yet, you can still develop the frontend with mock data.

### Option 1: Mock API Responses

Edit `src/services/api.ts`:

```typescript
// Add at the top
const MOCK_MODE = true;

export const propertyAPI = {
  search: async (query: string) => {
    if (MOCK_MODE) {
      return {
        properties: mockProperties, // See below
        total: 10,
        page: 1,
        pageSize: 20,
      };
    }
    // Real API call...
  },
  // ...
};

// Mock data
const mockProperties = [
  {
    id: '1',
    address: '123 Main St, Miami, FL',
    coordinates: { lat: 25.7617, lng: -80.1918 },
    opportunityScore: 85,
    municipality: 'Miami',
    districtCode: 'R-3',
    districtName: 'Multi-Family Residential',
    lotSizeSqft: 8000,
    currentUse: 'Single Family',
    zoning: {
      districtCode: 'R-3',
      districtName: 'Multi-Family Residential',
      maxUnits: 4,
      maxGfaSqft: 3200,
      maxHeightFt: 35,
      maxStories: 3,
      parkingRequired: 8,
      setbacks: { frontFt: 10, rearFt: 15, sideFt: 5 },
      reasoning: 'Strong development potential with favorable zoning.',
      confidence: 'high',
    },
    supply: {
      activeListings: 45,
      daysOnMarket: 32,
      absorptionRate: 0.15,
      inventoryTrend: 'decreasing',
      comparableProperties: 12,
      medianPrice: 450000,
      reasoning: 'Low inventory with high demand.',
    },
    cashFlow: {
      estimatedRent: 3600,
      operatingExpenses: 1200,
      netOperatingIncome: 28800,
      capRate: 0.064,
      cashOnCashReturn: 0.12,
      breakEvenOccupancy: 0.55,
      reasoning: 'Strong cash flow potential.',
      scenarios: [
        {
          name: 'Conservative',
          purchasePrice: 450000,
          downPayment: 90000,
          loanAmount: 360000,
          interestRate: 0.07,
          monthlyPayment: 2395,
          monthlyCashFlow: 1205,
          annualReturn: 0.16,
        },
      ],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // Add more mock properties...
];
```

### Option 2: Use JSON Server

Install JSON Server:
```bash
npm install -g json-server
```

Create `db.json`:
```json
{
  "properties": [
    {
      "id": "1",
      "address": "123 Main St, Miami, FL",
      "coordinates": { "lat": 25.7617, "lng": -80.1918 },
      "opportunityScore": 85
    }
  ]
}
```

Run mock server:
```bash
json-server --watch db.json --port 8000
```

---

## 📦 Project Structure

```
frontend/
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── auth/       # Login, Register
│   │   ├── dashboard/  # Sidebar, Search, Filters
│   │   ├── map/        # MapView, PropertyBubble
│   │   ├── property/   # PropertyDetail, Panels
│   │   └── ui/         # Reusable components
│   ├── hooks/          # Custom React hooks
│   ├── pages/          # Page components
│   ├── services/       # API, WebSocket
│   ├── store/          # Zustand state
│   ├── types/          # TypeScript types
│   ├── utils/          # Helper functions
│   ├── App.tsx         # Root component
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── .env                # Environment variables
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript config
├── vite.config.ts      # Vite config
└── tailwind.config.js  # Tailwind config
```

---

## 🎨 Customization

### Change Color Theme

Edit `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        50: '#f0f9ff',
        // ... your colors
        900: '#0c4a6e',
      },
    },
  },
}
```

### Change Map Style

In `src/components/map/MapView.tsx`:

```typescript
<Map
  mapStyle="mapbox://styles/mapbox/satellite-streets-v12"  // Change this
  // Options: streets-v12, satellite-v9, dark-v11, light-v11
/>
```

### Change Default Location

In `src/store/index.ts`:

```typescript
mapCenter: [-80.1918, 25.7617], // Miami
mapZoom: 12,
```

---

## 🔧 Common Issues

### Issue: "Invalid Mapbox token"

**Solution:** Make sure your `.env` has `VITE_` prefix:
```env
VITE_MAPBOX_TOKEN=pk.xxxxx  # ✅ Correct
MAPBOX_TOKEN=pk.xxxxx        # ❌ Wrong (Vite won't see it)
```

Restart dev server after changing `.env`!

### Issue: CORS errors

**Solution:** Backend needs to allow frontend origin:

```python
# FastAPI example
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue: WebSocket not connecting

**Solution:** Check `VITE_WS_URL` in `.env` and backend WebSocket endpoint.

### Issue: Map not showing

1. Check Mapbox token is valid
2. Open browser console for errors
3. Verify `mapbox-gl` CSS is imported (in `index.html`)

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel login
vercel
```

Set environment variables in Vercel dashboard.

### Netlify

```bash
npm run build
```

Drag `dist/` folder to Netlify drop zone.

### Docker

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:
```bash
docker build -t jedire-frontend .
docker run -p 80:80 jedire-frontend
```

---

## 📚 Next Steps

1. **Explore Components**: Check `src/components/` for all UI pieces
2. **Read Architecture**: See `ARCHITECTURE.md` for design patterns
3. **Check Types**: Look at `src/types/` for data structures
4. **Test Features**: Try search, filters, property selection
5. **Customize**: Make it your own!

---

## 🆘 Need Help?

- Check `README.md` for feature overview
- Read `ARCHITECTURE.md` for technical details
- Look at component code - it's well-commented
- Open an issue on GitHub

---

**Happy coding!** 🚀
