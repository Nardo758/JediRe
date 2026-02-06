# JEDI RE - MVP Wiring Guide
**Version:** 1.0  
**Date:** February 5, 2026  
**Purpose:** Step-by-step guide to connect all components and make wiring easy

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Environment Configuration](#2-environment-configuration)
3. [State Management Setup](#3-state-management-setup)
4. [API Client Configuration](#4-api-client-configuration)
5. [WebSocket Integration](#5-websocket-integration)
6. [Component Connection Points](#6-component-connection-points)
7. [Common Gotchas & Solutions](#7-common-gotchas--solutions)
8. [Testing Connections](#8-testing-connections)
9. [Deployment Checklist](#9-deployment-checklist)

---

## 1. Project Setup

### Initialize Frontend Project

```bash
# Create Vite + React + TypeScript project
npm create vite@latest jedire-frontend -- --template react-ts

cd jedire-frontend

# Install core dependencies
npm install

# Install routing
npm install react-router-dom

# Install state management
npm install zustand

# Install data fetching
npm install @tanstack/react-query axios

# Install real-time
npm install socket.io-client

# Install map
npm install mapbox-gl
npm install @types/mapbox-gl -D

# Install UI/styling
npm install tailwindcss postcss autoprefixer
npm install class-variance-authority clsx tailwind-merge

# Install utilities
npm install date-fns
npm install react-hot-toast

# Install dev tools
npm install -D @types/node
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

### Initialize Backend Project

```bash
# Create backend directory
mkdir jedire-backend
cd jedire-backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install fastapi
pip install uvicorn[standard]
pip install sqlalchemy
pip install psycopg2-binary
pip install geoalchemy2
pip install redis
pip install celery
pip install python-jose[cryptography]
pip install passlib[bcrypt]
pip install python-multipart
pip install anthropic
pip install python-socketio

# Create requirements.txt
pip freeze > requirements.txt
```

### Folder Structure

```bash
# Frontend
jedire-frontend/
├── src/
│   ├── api/           # API client functions
│   ├── components/    # React components
│   ├── hooks/         # Custom hooks
│   ├── stores/        # Zustand stores
│   ├── types/         # TypeScript types
│   ├── utils/         # Helper functions
│   ├── views/         # Page components
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── .env
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js

# Backend
jedire-backend/
├── app/
│   ├── agents/        # AI agents
│   ├── api/           # API routes
│   ├── engines/       # Intelligence engines
│   ├── models/        # Database models
│   ├── utils/         # Helper functions
│   ├── config.py
│   ├── database.py
│   └── main.py
├── tests/
├── alembic/
├── requirements.txt
└── .env
```

---

## 2. Environment Configuration

### Frontend `.env`

```bash
# API Configuration
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000

# Mapbox
VITE_MAPBOX_TOKEN=your_mapbox_access_token_here

# OAuth (optional for MVP)
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id

# Feature Flags
VITE_ENABLE_VOICE=false
VITE_ENABLE_ANALYTICS=false
```

### Backend `.env`

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/jedire

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# AI
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Email (optional for MVP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Environment
ENVIRONMENT=development
DEBUG=true
```

---

## 3. State Management Setup

### Create Zustand Stores

**File: `src/stores/authStore.ts`**

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  subscription_tier: 'basic' | 'pro' | 'enterprise';
  active_modules: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      setUser: (user) => set({ user, isAuthenticated: true }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage', // localStorage key
    }
  )
);
```

**File: `src/stores/mapStore.ts`**

```typescript
import { create } from 'zustand';

interface Property {
  id: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
  // ... other fields
}

interface MapState {
  properties: Property[];
  selectedProperty: Property | null;
  mapCenter: [number, number];
  mapZoom: number;
  
  // Actions
  setProperties: (properties: Property[]) => void;
  selectProperty: (property: Property | null) => void;
  setMapView: (center: [number, number], zoom: number) => void;
  clearProperties: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  properties: [],
  selectedProperty: null,
  mapCenter: [-84.3880, 33.7490], // Atlanta default
  mapZoom: 11,
  
  setProperties: (properties) => set({ properties }),
  selectProperty: (selectedProperty) => set({ selectedProperty }),
  setMapView: (mapCenter, mapZoom) => set({ mapCenter, mapZoom }),
  clearProperties: () => set({ properties: [], selectedProperty: null }),
}));
```

**File: `src/stores/chatStore.ts`**

```typescript
import { create } from 'zustand';

interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  agent_name?: string;
  metadata?: any;
  created_at: string;
}

interface ChatState {
  messages: Message[];
  conversationId: string | null;
  isTyping: boolean;
  chatExpanded: boolean;
  
  // Actions
  addMessage: (message: Message) => void;
  setTyping: (isTyping: boolean) => void;
  toggleChat: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  conversationId: null,
  isTyping: false,
  chatExpanded: false,
  
  addMessage: (message) => 
    set((state) => ({ messages: [...state.messages, message] })),
  setTyping: (isTyping) => set({ isTyping }),
  toggleChat: () => set((state) => ({ chatExpanded: !state.chatExpanded })),
  clearMessages: () => set({ messages: [], conversationId: null }),
}));
```

### Setup React Query

**File: `src/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes default
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

---

## 4. API Client Configuration

### Create API Client

**File: `src/api/client.ts`**

```typescript
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Create axios instance
export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - logout
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Create API Functions

**File: `src/api/auth.ts`**

```typescript
import { apiClient } from './client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    subscription_tier: string;
    active_modules: string[];
  };
}

export const authApi = {
  login: (data: LoginRequest) => 
    apiClient.post<LoginResponse>('/auth/login', data),
  
  signup: (data: any) => 
    apiClient.post('/auth/signup', data),
  
  me: () => 
    apiClient.get('/auth/me'),
};
```

**File: `src/api/properties.ts`**

```typescript
import { apiClient } from './client';

export interface PropertySearchParams {
  city?: string;
  max_price?: number;
  bedrooms_min?: number;
  // ... other filters
}

export const propertiesApi = {
  search: (params: PropertySearchParams) =>
    apiClient.get('/properties', { params }),
  
  getById: (id: string) =>
    apiClient.get(`/properties/${id}`),
  
  save: (id: string) =>
    apiClient.post(`/properties/${id}/save`),
};
```

---

## 5. WebSocket Integration

### Create WebSocket Hook

**File: `src/hooks/useWebSocket.ts`**

```typescript
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const messageQueue = useRef<Array<{ event: string; data: any }>>([]);
  
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!token) return;

    const newSocket = io(WS_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: 10,
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
      reconnectAttempts.current = 0;
      
      // Process queued messages
      if (messageQueue.current.length > 0) {
        messageQueue.current.forEach(({ event, data }) => {
          newSocket.emit(event, data);
        });
        messageQueue.current = [];
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      setConnected(false);
      reconnectAttempts.current++;
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  const emit = (event: string, data: any) => {
    if (socket?.connected) {
      socket.emit(event, data);
    } else {
      // Queue message if not connected
      messageQueue.current.push({ event, data });
    }
  };

  return { socket, connected, emit };
}
```

### Use WebSocket in Components

**File: `src/hooks/useChatAgent.ts`**

```typescript
import { useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { useChatStore } from '@/stores/chatStore';

export function useChatAgent() {
  const { socket, emit } = useWebSocket();
  const { addMessage, setTyping } = useChatStore();

  useEffect(() => {
    if (!socket) return;

    // Listen for agent messages
    socket.on('agent:message', (data) => {
      addMessage(data);
      setTyping(false);
    });

    // Listen for task updates
    socket.on('agent:task_update', (data) => {
      console.log('Agent task update:', data);
      // Update agent status bar
    });

    return () => {
      socket.off('agent:message');
      socket.off('agent:task_update');
    };
  }, [socket, addMessage, setTyping]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    
    // Add user message to UI
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    });
    
    // Send to backend
    setTyping(true);
    emit('chat:message', { message: text });
  };

  return { sendMessage };
}
```

---

## 6. Component Connection Points

### Map View + Chat Integration

**Connection Point 1: Chat → Map**

When agent returns property results, update map:

```typescript
// In useChatAgent hook
socket.on('agent:message', (data) => {
  addMessage(data);
  
  // If message includes properties, update map
  if (data.metadata?.properties) {
    useMapStore.getState().setProperties(data.metadata.properties);
  }
});
```

**Connection Point 2: Map → Chat**

When user clicks marker, show property card in chat:

```typescript
// In MapView component
const handleMarkerClick = (property: Property) => {
  useMapStore.getState().selectProperty(property);
  
  // Optionally add system message to chat
  useChatStore.getState().addMessage({
    id: Date.now().toString(),
    role: 'system',
    content: `Viewing ${property.address}`,
    created_at: new Date().toISOString(),
  });
};
```

### Property Detail Integration

**Connection Point 3: Map → Property Detail**

Navigate from map marker to property page:

```typescript
// In PropertyCard component
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

const handleViewDetails = () => {
  navigate(`/property/${property.id}`);
};
```

**Connection Point 4: Fetch Property + Analysis**

Load property and strategy analysis:

```typescript
// In PropertyDetailPage
import { useQuery } from '@tanstack/react-query';

function PropertyDetailPage() {
  const { id } = useParams();
  
  // Fetch property
  const { data: property, isLoading: propertyLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertiesApi.getById(id!),
  });
  
  // Fetch analyses (only after property loads)
  const { data: analyses, isLoading: analysesLoading } = useQuery({
    queryKey: ['analyses', id],
    queryFn: () => analysisApi.getByPropertyId(id!),
    enabled: !!property, // Wait for property
  });
  
  if (propertyLoading) return <Skeleton />;
  
  return (
    <PropertyDetail 
      property={property} 
      analyses={analyses}
      loadingAnalyses={analysesLoading}
    />
  );
}
```

### Dashboard Integration

**Connection Point 5: Fetch Dashboard Data**

```typescript
// In DashboardView
function DashboardView() {
  // Parallel queries
  const { data: kpis } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => dashboardApi.getKPIs(),
  });
  
  const { data: opportunities } = useQuery({
    queryKey: ['dashboard', 'opportunities'],
    queryFn: () => dashboardApi.getTopOpportunities(),
  });
  
  const { data: tasks } = useQuery({
    queryKey: ['dashboard', 'tasks'],
    queryFn: () => dashboardApi.getTasks(),
  });
  
  return (
    <Dashboard 
      kpis={kpis}
      opportunities={opportunities}
      tasks={tasks}
    />
  );
}
```

---

## 7. Common Gotchas & Solutions

### Gotcha 1: WebSocket Not Connecting

**Problem:** WebSocket fails to connect after login

**Solution:** Ensure token is in WebSocket auth

```typescript
// WRONG
const socket = io(WS_URL);

// CORRECT
const socket = io(WS_URL, {
  auth: { token },
});
```

### Gotcha 2: State Updates Not Triggering Re-render

**Problem:** Zustand state updates but component doesn't re-render

**Solution:** Use selector properly

```typescript
// WRONG
const { messages } = useChatStore();

// CORRECT
const messages = useChatStore((state) => state.messages);
```

### Gotcha 3: React Query Cache Not Invalidating

**Problem:** After mutation, UI doesn't update

**Solution:** Invalidate relevant queries

```typescript
const { mutate } = useMutation({
  mutationFn: (id) => propertiesApi.save(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['properties'] });
  },
});
```

### Gotcha 4: Mapbox Not Rendering

**Problem:** Map shows blank screen

**Solution:** Ensure Mapbox CSS is imported

```typescript
// In main.tsx or App.tsx
import 'mapbox-gl/dist/mapbox-gl.css';
```

### Gotcha 5: CORS Errors

**Problem:** API calls fail with CORS error

**Solution:** Configure backend CORS

```python
# In FastAPI main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Gotcha 6: Environment Variables Not Loading

**Problem:** `import.meta.env.VITE_API_URL` is undefined

**Solution:** Ensure variable has `VITE_` prefix and restart dev server

```bash
# .env
VITE_API_URL=http://localhost:3000  # ✅ Works
API_URL=http://localhost:3000        # ❌ Doesn't work

# Restart dev server after changing .env
npm run dev
```

---

## 8. Testing Connections

### Test 1: Auth Flow

```bash
# Start backend
cd jedire-backend
uvicorn app.main:app --reload

# Start frontend
cd jedire-frontend
npm run dev

# Test:
# 1. Visit http://localhost:5173/login
# 2. Enter email/password
# 3. Check browser console for "✅ Login successful"
# 4. Check localStorage for auth-storage
# 5. Verify redirect to /map
```

### Test 2: WebSocket Connection

```typescript
// Add to App.tsx temporarily
import { useWebSocket } from './hooks/useWebSocket';

function App() {
  const { connected } = useWebSocket();
  
  useEffect(() => {
    console.log('WebSocket connected:', connected);
  }, [connected]);
  
  // ... rest of app
}

// Check console for "✅ WebSocket connected"
```

### Test 3: API Calls

```typescript
// Test in browser console
import { propertiesApi } from './api/properties';

propertiesApi.search({ city: 'Atlanta' })
  .then(data => console.log('✅ Properties:', data))
  .catch(err => console.error('❌ Error:', err));
```

### Test 4: State Updates

```typescript
// Add React Query Devtools
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

// Open devtools (bottom-left icon) to inspect queries
```

---

## 9. Deployment Checklist

### Pre-Deploy

- [ ] All environment variables configured
- [ ] Build succeeds without errors (`npm run build`)
- [ ] All tests pass (`npm run test`)
- [ ] No console errors in production build
- [ ] Lighthouse score > 90

### Backend Deploy (Replit)

```bash
# 1. Create Replit project
# 2. Upload files
# 3. Install dependencies
pip install -r requirements.txt

# 4. Set environment variables in Replit Secrets
# 5. Run migrations
alembic upgrade head

# 6. Start server
uvicorn app.main:app --host 0.0.0.0 --port 3000
```

### Frontend Deploy (Replit/Vercel)

```bash
# 1. Build production bundle
npm run build

# 2. Test build locally
npm run preview

# 3. Deploy to Replit
# - Upload dist/ folder
# - Configure static file serving

# Or deploy to Vercel
vercel deploy --prod
```

### Post-Deploy

- [ ] Test login flow
- [ ] Test property search
- [ ] Test WebSocket connection
- [ ] Test map loading
- [ ] Monitor error logs
- [ ] Check performance metrics

---

## Quick Reference: Connection Checklist

```
✅ Auth Store connected to API client (interceptor)
✅ WebSocket connected with auth token
✅ Chat Store updates from WebSocket events
✅ Map Store updates from Chat Store (property results)
✅ Property Detail fetches from API (React Query)
✅ Dashboard fetches from API (React Query)
✅ All components wrapped in ErrorBoundary
✅ Loading states for all async operations
✅ CORS configured in backend
✅ Environment variables set (.env files)
✅ Mapbox CSS imported
✅ React Query DevTools enabled (dev only)
```

---

## Wiring Diagram (Complete Flow)

```
User Types in Chat
       │
       ▼
ChatInput Component
       │
       ▼
useChatAgent Hook
       │
       ├─> useChatStore (add message)
       └─> useWebSocket (emit 'chat:message')
              │
              ▼
       WebSocket → Backend
              │
              ▼
       Chief Orchestrator → Property Search Agent
              │
              ▼
       PostgreSQL Query
              │
              ▼
       Results returned via WebSocket
              │
              ▼
       Frontend receives 'agent:message'
              │
              ├─> useChatStore (add agent message)
              └─> useMapStore (set properties)
                     │
                     ▼
              ┌──────┴──────┐
              ▼             ▼
       MessageList    MapView
       displays       displays
       response       markers
```

---

**Wiring Guide Complete!** This covers all connection points and common issues.

Ready to start building components? 🚀
