# WebSocket System - Testing Guide

This guide helps you test the real-time WebSocket system for Asset Map Intelligence.

---

## 🧪 Manual Testing Steps

### Test 1: Basic Connection

**Steps:**
1. Open browser DevTools (F12)
2. Navigate to Map View with any asset
3. Check console for: `✅ Asset Map WebSocket connected`
4. Check for: `✓ Subscribed to asset: {assetId}`

**Expected:**
- ✅ Green connection indicator
- ✅ No error messages
- ✅ Console shows connection success

---

### Test 2: Two-User Real-Time Sync

**Setup:**
- Two browser windows (or incognito + regular)
- Both logged in as different users
- Both viewing the same asset

**Steps:**

**Window 1 (User A):**
1. Create a new note with title "Test Note"
2. Content: "Testing real-time sync"
3. Click Save

**Window 2 (User B):**
1. Wait 1-2 seconds
2. New note should appear WITHOUT refreshing

**Expected:**
- ✅ Note appears instantly in Window 2
- ✅ Toast notification: "User A added: 'Test Note'"
- ✅ Note shows correct author

---

### Test 3: Note Updates

**Window 1:**
1. Edit the note created above
2. Change content to "Updated content"
3. Save

**Window 2:**
1. Note content should update instantly
2. Toast: "User A updated a note"

**Expected:**
- ✅ Content updates in real-time
- ✅ No page refresh needed

---

### Test 4: Replies

**Window 1:**
1. Click on a note
2. Add reply: "Great point!"
3. Submit

**Window 2:**
1. Note's reply count should increment
2. Toast: "User A replied to a note"
3. Click note to see new reply

**Expected:**
- ✅ Reply count updates: 0 → 1
- ✅ Reply appears in thread

---

### Test 5: Note Deletion

**Window 1:**
1. Delete a note

**Window 2:**
1. Note should disappear
2. Toast: "A note was deleted"

**Expected:**
- ✅ Note removed from list
- ✅ Smooth removal animation (if implemented)

---

### Test 6: Private Notes (Should NOT Broadcast)

**Window 1:**
1. Create note with "Private" toggle ON
2. Save

**Window 2:**
1. Wait 5 seconds
2. Note should NOT appear

**Expected:**
- ✅ Private note NOT visible to other users
- ✅ No toast notification in Window 2

---

### Test 7: Reconnection

**Window 1:**
1. Open DevTools → Network tab
2. Throttle to "Offline"
3. Wait 5 seconds
4. Set back to "Online"

**Expected:**
- ✅ Toast: "Disconnected from real-time updates"
- ✅ Red connection indicator
- ✅ Auto-reconnects within 5 seconds
- ✅ Toast: "Reconnected to real-time updates"
- ✅ Green connection indicator

---

### Test 8: Permission Denied

**Setup:**
- User C has NO permission to Asset X

**Window 3 (User C):**
1. Try to navigate to Asset X Map View
2. Check console

**Expected:**
- ✅ Error message: "Permission denied"
- ✅ No subscription established
- ✅ UI shows "No access" or redirects

---

### Test 9: Active Viewers Count

**Window 1 & 2:**
1. Both viewing same asset
2. Check status bar

**Expected:**
- ✅ Shows "2 viewers online"

**Window 1:**
1. Close tab

**Window 2:**
1. Count should update to "1 viewer online"

**Expected:**
- ✅ Count decrements automatically

---

### Test 10: Multiple Asset Subscriptions

**Window 1:**
1. Open Asset A
2. Open Asset B in new tab
3. Both should show active connections

**Expected:**
- ✅ Both assets have separate subscriptions
- ✅ Events only broadcast to relevant asset
- ✅ No cross-contamination

---

## 🔍 Debug Checklist

If something doesn't work:

### Backend Issues

**Check Backend Logs:**
```bash
# Check if WebSocket server initialized
grep "WebSocket server initialized" backend/logs/*.log

# Check for connection errors
grep "WebSocket connection error" backend/logs/*.log

# Check for authentication failures
grep "Authentication required" backend/logs/*.log
```

**Verify Server Running:**
```bash
curl http://localhost:4000/health
# Should return: {"status":"healthy"}
```

**Check Socket.io:**
```bash
curl http://localhost:4000/socket.io/
# Should return Socket.io client JS
```

---

### Frontend Issues

**Check Browser Console:**

✅ **Connected:**
```
✅ Asset Map WebSocket connected
✓ Subscribed to asset: abc-123
```

❌ **Connection Error:**
```
❌ Asset Map WebSocket connection error: ...
```

❌ **Authentication Error:**
```
Error: Authentication required
```

**Check Network Tab:**
1. Filter: WS (WebSocket)
2. Should see active WebSocket connection
3. Click to see frames (messages)

**Check Local Storage:**
```javascript
// In browser console:
localStorage.getItem('token')
// Should return JWT token
```

---

### Common Issues

**Issue: "WebSocket not connected"**

**Causes:**
- Token expired
- Backend not running
- CORS misconfigured
- Network firewall blocking WebSocket

**Solutions:**
1. Check token expiry
2. Verify backend running on correct port
3. Check `.env` CORS settings
4. Try different network

---

**Issue: "Permission denied"**

**Causes:**
- User not in `asset_note_permissions` table
- User not deal creator
- Asset doesn't exist

**Solutions:**
1. Check database permissions
2. Verify deal creator
3. Grant explicit permission

---

**Issue: Events not received**

**Causes:**
- Note is private
- Not subscribed to asset
- Connection dropped

**Solutions:**
1. Check note `isPrivate` flag
2. Verify subscription: `assetMapWsClient.getSubscribedAssets()`
3. Check connection: `assetMapWsClient.isConnected()`

---

## 🤖 Automated Testing

### Unit Tests (Backend)

```typescript
// tests/websocket.service.test.ts

describe('WebSocketService', () => {
  test('broadcasts note created event', async () => {
    const wsService = new WebSocketService(io);
    
    await wsService.broadcastNoteCreated(mockNote, mockAuthor);
    
    expect(io.to).toHaveBeenCalledWith('asset:123');
    expect(socket.emit).toHaveBeenCalledWith('note:created', expect.any(Object));
  });

  test('filters private notes from broadcast', async () => {
    const privateNote = { ...mockNote, isPrivate: true };
    
    await wsService.broadcastNoteCreated(privateNote, mockAuthor);
    
    expect(socket.emit).not.toHaveBeenCalled();
  });

  test('checks user permission before subscription', async () => {
    const result = await wsService.subscribeToAsset(
      'socket-id',
      'asset-id',
      'user-id'
    );
    
    expect(result).toBe(true);
  });
});
```

---

### Integration Tests (Frontend)

```typescript
// tests/useAssetUpdates.test.tsx

import { renderHook, waitFor } from '@testing-library/react';
import { useAssetUpdates } from '../hooks/useAssetUpdates';

describe('useAssetUpdates', () => {
  test('subscribes to asset on mount', async () => {
    const { result } = renderHook(() =>
      useAssetUpdates({ assetId: '123' })
    );

    await waitFor(() => {
      expect(result.current.isSubscribed).toBe(true);
    });
  });

  test('handles note created event', async () => {
    const onNoteCreated = jest.fn();
    
    renderHook(() =>
      useAssetUpdates({
        assetId: '123',
        onNoteCreated,
      })
    );

    // Simulate WebSocket event
    assetMapWsClient.emit('note:created', mockData);

    await waitFor(() => {
      expect(onNoteCreated).toHaveBeenCalledWith(mockData);
    });
  });
});
```

---

### End-to-End Tests (Cypress/Playwright)

```typescript
// e2e/asset-map-realtime.spec.ts

describe('Asset Map Real-Time Sync', () => {
  it('syncs notes between two users', () => {
    // User A creates note
    cy.login('userA@example.com');
    cy.visit('/assets/123');
    cy.get('[data-test="add-note"]').click();
    cy.get('[data-test="note-title"]').type('Test Note');
    cy.get('[data-test="note-content"]').type('Test content');
    cy.get('[data-test="save-note"]').click();

    // User B sees note
    cy.login('userB@example.com', { context: 'userB' });
    cy.visit('/assets/123', { context: 'userB' });
    
    cy.get('[data-test="note-card"]', { context: 'userB' })
      .should('contain', 'Test Note')
      .should('be.visible');
  });
});
```

---

## 📊 Performance Testing

### Load Test (Artillery)

```yaml
# load-test.yml
config:
  target: 'ws://localhost:4000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: Ramp up
    - duration: 120
      arrivalRate: 50
      name: Sustained load

scenarios:
  - engine: socketio
    flow:
      - emit:
          channel: 'asset:subscribe'
          data:
            assetId: '123'
      - think: 5
      - emit:
          channel: 'asset:heartbeat'
          data:
            assetId: '123'
            timestamp: '{{ $timestamp }}'
```

Run:
```bash
artillery run load-test.yml
```

---

## 🎯 Success Criteria

### Functional
- ✅ Connection established within 2 seconds
- ✅ Events received within 100ms
- ✅ Auto-reconnect within 5 seconds
- ✅ Permissions enforced correctly
- ✅ Private notes never broadcast

### Performance
- ✅ Handles 100+ concurrent connections per asset
- ✅ Bandwidth < 50 KB/min during active use
- ✅ CPU usage < 10% on backend
- ✅ Memory usage stable over 24 hours

### Reliability
- ✅ No message loss during reconnect
- ✅ No duplicate events
- ✅ Graceful degradation on errors
- ✅ 99.9% uptime

---

## 📝 Test Report Template

```markdown
## Test Report

**Date:** YYYY-MM-DD
**Tester:** Your Name
**Environment:** Development/Staging/Production

### Results

| Test | Status | Notes |
|------|--------|-------|
| Basic Connection | ✅ Pass | Connected in 1.2s |
| Two-User Sync | ✅ Pass | < 50ms latency |
| Note Updates | ✅ Pass | |
| Replies | ✅ Pass | |
| Deletion | ✅ Pass | |
| Private Notes | ✅ Pass | Not broadcasted |
| Reconnection | ✅ Pass | Auto-reconnect worked |
| Permissions | ✅ Pass | |
| Active Count | ✅ Pass | |
| Multi-Asset | ✅ Pass | |

### Issues Found

None / [List any issues]

### Recommendations

[Any suggestions for improvement]
```

---

## 🚨 Emergency Debugging

If system is completely broken:

### 1. Verify Backend

```bash
# Check server running
curl http://localhost:4000/health

# Check WebSocket endpoint
curl http://localhost:4000/socket.io/
```

### 2. Check Logs

```bash
# Backend logs
tail -f backend/logs/app.log | grep WebSocket

# Check for errors
grep ERROR backend/logs/app.log | tail -20
```

### 3. Database Check

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('asset_notes', 'note_replies', 'asset_note_permissions');

-- Check permissions
SELECT * FROM asset_note_permissions WHERE asset_id = 'your-asset-id';
```

### 4. Network Check

```bash
# Test WebSocket connection
npm install -g wscat
wscat -c ws://localhost:4000

# Send test message
> {"type": "ping"}
```

### 5. Frontend Check

```javascript
// In browser console
assetMapWsClient.isConnected()        // Should be true
assetMapWsClient.getSubscribedAssets()  // Should list assets
```

---

## 📞 Get Help

If tests fail:

1. ✅ Check this guide's troubleshooting section
2. ✅ Review console errors
3. ✅ Check ASSET_MAP_WEBSOCKET_GUIDE.md
4. ✅ Verify all files are in place
5. ✅ Restart backend and frontend
6. ✅ Clear browser cache
7. ✅ Try different browser

---

**Happy Testing! 🧪**
