# Asset Map Intelligence - WebSocket Real-Time Sync Guide

## 🎯 Overview

This guide explains how to use the real-time WebSocket system for Asset Map Intelligence. The system provides instant updates for notes, replies, and news events across all connected users viewing the same asset.

---

## 📋 Architecture

### Backend Components

1. **WebSocket Service** (`backend/src/services/websocket.service.ts`)
   - Manages room-based broadcasting
   - Enforces permission-based filtering
   - Handles connection management

2. **WebSocket Handler** (`backend/src/api/websocket/handlers/assetMap.handler.ts`)
   - Processes subscription requests
   - Manages heartbeats
   - Handles disconnections

3. **API Routes** (`backend/src/api/rest/asset-map-intelligence.routes.ts`)
   - CRUD operations for notes and replies
   - Triggers WebSocket broadcasts on database changes
   - Permission checks before broadcasting

### Frontend Components

1. **WebSocket Client** (`frontend/src/services/websocket.client.ts`)
   - Singleton connection manager
   - Auto-reconnect logic
   - Event routing

2. **React Hook** (`frontend/src/hooks/useAssetUpdates.ts`)
   - Subscribe/unsubscribe to assets
   - Handle incoming events
   - Update local state
   - Display notifications

---

## 🚀 Quick Start

### Backend Setup

The WebSocket server is automatically initialized when the Express app starts. No additional setup required!

### Frontend Setup

#### 1. Initialize WebSocket Connection (App Level)

In your main `App.tsx` or layout component:

```typescript
import { useAssetMapWebSocket } from './hooks/useAssetUpdates';
import { useAuthStore } from './stores/authStore';

function App() {
  const token = useAuthStore((state) => state.token);
  const { isConnected, error } = useAssetMapWebSocket(token);

  if (error) {
    console.error('WebSocket connection failed:', error);
  }

  return <YourApp />;
}
```

#### 2. Subscribe to Asset Updates (Component Level)

In your Map View or Asset Detail component:

```typescript
import { useAssetUpdates } from './hooks/useAssetUpdates';
import { useState } from 'react';

function AssetMapView({ assetId }: { assetId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);

  const { isConnected, isSubscribed, activeConnections } = useAssetUpdates({
    assetId,
    enabled: true,
    
    // Handle note created
    onNoteCreated: (data) => {
      setNotes((prev) => [data.note, ...prev]);
    },

    // Handle note updated
    onNoteUpdated: (data) => {
      setNotes((prev) =>
        prev.map((note) =>
          note.id === data.noteId
            ? { ...note, ...data.changes }
            : note
        )
      );
    },

    // Handle note deleted
    onNoteDeleted: (data) => {
      setNotes((prev) => prev.filter((note) => note.id !== data.noteId));
    },

    // Handle reply created
    onReplyCreated: (data) => {
      setNotes((prev) =>
        prev.map((note) =>
          note.id === data.noteId
            ? { ...note, replyCount: (note.replyCount || 0) + 1 }
            : note
        )
      );
    },

    // Handle news linked
    onNewsLinked: (data) => {
      console.log('New news event linked:', data.newsEvent);
      // Update news list
    },

    // Show toast notifications
    showToasts: true,
  });

  return (
    <div>
      <div>
        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        {isSubscribed && ` | ${activeConnections} active viewer(s)`}
      </div>
      
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </div>
  );
}
```

---

## 📡 WebSocket Events

### Client → Server

#### Subscribe to Asset
```typescript
socket.emit('asset:subscribe', { assetId: 'uuid' });
```

#### Unsubscribe from Asset
```typescript
socket.emit('asset:unsubscribe', { assetId: 'uuid' });
```

#### Heartbeat (Keep-Alive)
```typescript
socket.emit('asset:heartbeat', { assetId: 'uuid', timestamp: Date.now() });
```

#### Get Active Connections
```typescript
socket.emit('asset:get_active', { assetId: 'uuid' });
```

---

### Server → Client

#### Note Events

**Note Created**
```typescript
{
  event: 'note:created',
  data: {
    note: Note,
    author: {
      id: string,
      name: string,
      email: string,
      avatar?: string
    },
    timestamp: string
  }
}
```

**Note Updated**
```typescript
{
  event: 'note:updated',
  data: {
    noteId: string,
    assetId: string,
    changes: Partial<Note>,
    author: { id, name, email },
    timestamp: string
  }
}
```

**Note Deleted**
```typescript
{
  event: 'note:deleted',
  data: {
    noteId: string,
    assetId: string,
    deletedBy: string,
    timestamp: string
  }
}
```

#### Reply Events

**Reply Created**
```typescript
{
  event: 'note:reply',
  data: {
    noteId: string,
    assetId: string,
    reply: Reply,
    author: { id, name, email, avatar },
    timestamp: string
  }
}
```

**Reply Updated**
```typescript
{
  event: 'reply:updated',
  data: {
    noteId: string,
    replyId: string,
    assetId: string,
    content: string,
    timestamp: string
  }
}
```

**Reply Deleted**
```typescript
{
  event: 'reply:deleted',
  data: {
    noteId: string,
    replyId: string,
    assetId: string,
    timestamp: string
  }
}
```

#### News Events

**News Linked**
```typescript
{
  event: 'news:linked',
  data: {
    link: AssetNewsLink,
    newsEvent: NewsEvent,
    timestamp: string
  }
}
```

**News Dismissed**
```typescript
{
  event: 'news:dismissed',
  data: {
    assetId: string,
    newsEventId: string,
    dismissedBy: string,
    timestamp: string
  }
}
```

---

## 🔒 Security & Permissions

### Permission-Based Broadcasting

The WebSocket service **automatically filters** events based on user permissions:

1. **Deal Creator**: Full access (admin)
2. **Explicit Permissions**: Users in `asset_note_permissions` table
3. **Private Notes**: Only visible to author

### Private Notes

Notes marked as `isPrivate: true` are **never broadcasted** via WebSocket. They're only visible to:
- The author
- Deal creator (admin)

### Authentication

All WebSocket connections require a valid JWT token:

```typescript
const socket = io(WS_URL, {
  auth: { token: 'your-jwt-token' }
});
```

---

## 🛠️ Advanced Usage

### Custom Toast Notifications

Override the default toast behavior:

```typescript
import { toast } from 'react-hot-toast';

useAssetUpdates({
  assetId,
  showToasts: true, // Enable automatic toasts
  
  onNoteCreated: (data) => {
    // Custom toast
    toast.success(
      `${data.author.name} added: "${data.note.title}"`,
      { duration: 4000, icon: '📝' }
    );
    
    // Update state
    addNote(data.note);
  },
});
```

### Manual Connection Management

```typescript
import { assetMapWsClient } from './services/websocket.client';

// Connect manually
await assetMapWsClient.connect(token);

// Subscribe with custom handler
const unsubscribe = await assetMapWsClient.subscribeToAsset(
  'asset-id',
  (event) => {
    console.log('Event:', event);
  }
);

// Unsubscribe
unsubscribe();

// Disconnect
assetMapWsClient.disconnect();
```

### Heartbeat Management

The hook automatically sends heartbeats every 30 seconds. To customize:

```typescript
// In useAssetUpdates.ts, change the interval:
setInterval(() => {
  assetMapWsClient.sendHeartbeat(assetId);
}, 15000); // 15 seconds instead of 30
```

---

## 🐛 Debugging

### Enable Verbose Logging

```typescript
// In websocket.client.ts, add:
const DEBUG = true;

if (DEBUG) {
  console.log('Subscribing to asset:', assetId);
}
```

### Check Connection Status

```typescript
const { isConnected, isSubscribed } = useAssetUpdates({ assetId });

console.log('Connected:', isConnected);
console.log('Subscribed:', isSubscribed);
```

### Monitor Active Connections

```typescript
const { activeConnections, refreshActiveConnections } = useAssetUpdates({ assetId });

// Refresh count
await refreshActiveConnections();
console.log('Active viewers:', activeConnections);
```

---

## 🚨 Error Handling

### Connection Failures

The client automatically retries up to 10 times with exponential backoff:

```typescript
// In websocket.client.ts
private maxReconnectAttempts = 10;
private reconnectDelay = 1000; // 1 second
```

### Subscription Failures

If subscription fails (e.g., permission denied):

```typescript
try {
  await assetMapWsClient.subscribeToAsset(assetId, handler);
} catch (error) {
  console.error('Subscription failed:', error);
  // Show error to user
  toast.error('Unable to subscribe to real-time updates');
}
```

---

## 🧪 Testing

### Manual Testing

1. Open two browser windows
2. Log in as different users (with access to same asset)
3. In Window 1: Create a note
4. In Window 2: Note should appear instantly

### Automated Testing

```typescript
// Mock WebSocket client
jest.mock('./services/websocket.client', () => ({
  assetMapWsClient: {
    connect: jest.fn(),
    subscribeToAsset: jest.fn((assetId, handler) => {
      // Simulate event
      handler({
        type: 'note:created',
        data: { note: mockNote },
        timestamp: new Date().toISOString(),
      });
      
      return jest.fn(); // Unsubscribe function
    }),
  },
}));
```

---

## 📊 Performance Considerations

### Room Size Limits

- Each asset = 1 room
- Recommended max: **100 concurrent viewers per asset**
- Beyond that, consider:
  - Polling fallback
  - Event batching
  - Rate limiting

### Message Size

- Average message size: ~500 bytes
- Max attachment size: 50 MB (not sent via WebSocket)
- Attachments use REST API + file storage

### Bandwidth Usage

- Idle connection: ~1 KB/minute (heartbeats)
- Active asset (10 notes/hour): ~5 KB/minute
- High activity (100 notes/hour): ~50 KB/minute

---

## 🔧 Configuration

### Environment Variables

**Backend** (`.env`):
```env
WS_CORS_ORIGIN=http://localhost:3000
WS_PING_INTERVAL=25000
WS_PING_TIMEOUT=20000
```

**Frontend** (`.env`):
```env
VITE_WS_URL=http://localhost:4000
```

---

## 📝 Migration Guide

If you're upgrading from polling:

### Before (Polling)
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    fetchNotes(assetId);
  }, 5000);
  
  return () => clearInterval(interval);
}, [assetId]);
```

### After (WebSocket)
```typescript
useAssetUpdates({
  assetId,
  onNoteCreated: (data) => addNote(data.note),
  onNoteUpdated: (data) => updateNote(data.noteId, data.changes),
  onNoteDeleted: (data) => removeNote(data.noteId),
});
```

**Benefits:**
- ✅ Instant updates (no 5-second delay)
- ✅ Lower server load (no polling requests)
- ✅ Lower bandwidth (only send changes)
- ✅ Scalable (WebSocket handles 1000s of connections)

---

## 🎓 Best Practices

1. **Initialize Once**: Connect WebSocket at app level, not per component
2. **Subscribe Per Asset**: Each component subscribes to its specific asset
3. **Unsubscribe Properly**: Always clean up subscriptions in `useEffect` return
4. **Handle Disconnections**: Show connection status to user
5. **Graceful Degradation**: Fall back to polling if WebSocket fails
6. **Permission-Aware**: Respect `isPrivate` flags in your UI
7. **Toast Moderation**: Don't spam toasts for every event

---

## 🤝 Contributing

When adding new event types:

1. **Backend**: Add broadcast method in `websocket.service.ts`
2. **Client**: Add event listener in `websocket.client.ts`
3. **Hook**: Add handler in `useAssetUpdates.ts`
4. **Docs**: Update this guide with new event type

---

## 📚 Additional Resources

- [Socket.io Documentation](https://socket.io/docs/v4/)
- [React WebSocket Best Practices](https://react.dev/learn/synchronizing-with-effects)
- [JWT Authentication Guide](https://jwt.io/introduction)

---

## ❓ Troubleshooting

### "WebSocket not connected" error
- Check if `useAssetMapWebSocket` is called in parent component
- Verify JWT token is valid
- Check browser console for connection errors

### Events not received
- Verify user has permission to view asset
- Check if note is private (won't broadcast)
- Enable debug logging to see raw events

### Duplicate events
- Ensure you're not subscribing twice to the same asset
- Check for multiple `useAssetUpdates` calls with same `assetId`

---

**Built with ❤️ for JediRe Asset Map Intelligence**
