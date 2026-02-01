# JediRe Frontend

Modern React + TypeScript frontend for the JediRe real estate intelligence platform.

## 🎯 Features

- **Interactive Map**: Mapbox-powered bubble map with property visualization
- **AI Agent Insights**: Zoning, Supply, and Cash Flow analysis modules
- **Real-time Collaboration**: WebSocket-based multi-user sessions
- **Property Details**: Comprehensive detail panels with module insights
- **Search & Filter**: Advanced search and filtering capabilities
- **User Authentication**: Secure login and registration
- **Mobile Responsive**: Fully responsive design for all devices

## 🛠️ Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Mapbox GL JS** for interactive maps
- **Zustand** for state management
- **Socket.io Client** for real-time features
- **Axios** for API requests
- **Tailwind CSS** for styling
- **Lucide React** for icons

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Mapbox API token

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Edit `.env` and add your Mapbox token:
```env
VITE_MAPBOX_TOKEN=your_mapbox_token_here
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── dashboard/      # Dashboard sidebar components
│   ├── map/            # Map and visualization components
│   ├── property/       # Property detail components
│   └── ui/             # Reusable UI components
├── hooks/              # Custom React hooks
├── pages/              # Page components
├── services/           # API and WebSocket services
├── store/              # Zustand state management
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── App.tsx             # Main app component
└── main.tsx            # Entry point
```

## 🎨 Components

### Map Components
- `MapView` - Main Mapbox map container
- `PropertyBubble` - Property marker with score visualization
- `CollaboratorCursor` - Real-time cursor indicators

### Dashboard Components
- `Dashboard` - Main sidebar with search and filters
- `SearchBar` - Property search with autocomplete
- `FilterPanel` - Advanced filtering options
- `ModuleToggle` - Enable/disable agent modules

### Property Components
- `PropertyDetail` - Comprehensive property detail panel
- `ZoningPanel` - Zoning analysis insights
- `SupplyPanel` - Supply and market trends
- `CashFlowPanel` - Investment analysis
- `AnnotationSection` - Comments and collaboration

### Auth Components
- `LoginForm` - User authentication
- `RegisterForm` - New user registration

## 🔌 API Integration

The frontend communicates with the backend via:

- **REST API** (`/api/*`) - Property data, analysis, authentication
- **WebSocket** (`/ws`) - Real-time collaboration features

See `src/services/api.ts` for API endpoints.

## 🎯 State Management

Uses Zustand for global state:

```typescript
const { 
  properties,           // All properties
  selectedProperty,     // Currently selected property
  mapCenter,           // Map center coordinates
  filters,             // Active filters
  activeModules,       // Enabled modules
  collaborators        // Active users
} = useAppStore();
```

## 🤝 Real-time Collaboration

WebSocket events:
- `property_update` - Property data changes
- `user_join` / `user_leave` - User presence
- `cursor_move` - Collaborator cursor positions
- `pin_property` - Property pins
- `add_annotation` - Comments and notes

## 📱 Mobile Responsive

The UI is fully responsive with breakpoints:
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🎨 Styling

Uses Tailwind CSS with custom utility classes:
- `.btn` - Button styles
- `.card` - Card containers
- `.badge` - Status badges
- `.input` - Form inputs

## 🧪 Development Tips

### Mock Data
For development without backend:
```typescript
// In src/services/api.ts, mock responses:
export const propertyAPI = {
  search: async () => mockProperties,
  // ...
};
```

### Mapbox Token
Get a free token at https://mapbox.com

### Hot Reload
Vite provides instant hot module replacement (HMR)

## 🚢 Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm run build
# Upload dist/ folder
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "run", "preview"]
```

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please follow the existing code style and patterns.

## 📞 Support

For issues or questions, open a GitHub issue.
