# JEDI RE Frontend

**Status:** 🚧 Under Construction - Foundation Complete

## What's Been Built

### ✅ Complete (Ready to Use)

**State Management:**
- `src/stores/authStore.ts` - User authentication (persisted)
- `src/stores/mapStore.ts` - Map state & properties
- `src/stores/chatStore.ts` - Chat messages & agent state

**API Layer:**
- `src/api/client.ts` - Axios client with auth interceptors

**Hooks:**
- `src/hooks/useWebSocket.ts` - WebSocket connection with reconnection & queuing

**Components:**
- `src/components/shared/Button.tsx` - Reusable button with variants
- `src/components/chat/ChatInput.tsx` - Message input with send
- `src/components/chat/ChatMessage.tsx` - Message bubble display
- `src/components/property/PropertyCard.tsx` - Property card with loading state

**Utils:**
- `src/utils/cn.ts` - Tailwind class merger

## Next Steps

### Week 1 Priority (Map + Chat)
1. Create `MapView` component
2. Create `ChatOverlay` component
3. Connect WebSocket to chat
4. Add property markers to map
5. Wire up end-to-end property search

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Architecture

- **State:** Zustand (client state) + React Query (server state)
- **Routing:** React Router v6
- **Styling:** TailwindCSS
- **Map:** Mapbox GL JS
- **Real-time:** Socket.io

## Environment Variables

Create `.env` file:

```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_MAPBOX_TOKEN=your_token_here
```

---

**📊 Progress:** Foundation complete, ready for component development
