/**
 * useEventTracking Hook
 * 
 * Auto-track user interactions with properties. Features:
 * - Automatic batching (sends events every 10 seconds)
 * - Debouncing to prevent spam
 * - Offline queue with retry
 * - Session tracking
 * - Automatic page view tracking on mount
 */

import { useEffect, useRef, useCallback } from 'react';
import { trackBatch, PropertyEvent } from '../services/eventTrackingService';

// Generate a session ID that persists for the browser session
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('event_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('event_session_id', sessionId);
  }
  return sessionId;
};

// Queue for batching events
let eventQueue: PropertyEvent[] = [];
let batchTimer: NodeJS.Timeout | null = null;
let isOnline = navigator.onLine;

// Offline queue persisted to localStorage
const OFFLINE_QUEUE_KEY = 'event_tracking_offline_queue';

const getOfflineQueue = (): PropertyEvent[] => {
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveOfflineQueue = (queue: PropertyEvent[]): void => {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to save offline queue:', error);
  }
};

const clearOfflineQueue = (): void => {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (error) {
    console.error('Failed to clear offline queue:', error);
  }
};

/**
 * Process the event queue - send batched events to the server
 */
const flushQueue = async (): Promise<void> => {
  if (eventQueue.length === 0) return;

  const eventsToSend = [...eventQueue];
  eventQueue = [];

  if (!isOnline) {
    // Save to offline queue
    const offlineQueue = getOfflineQueue();
    saveOfflineQueue([...offlineQueue, ...eventsToSend]);
    return;
  }

  try {
    await trackBatch(eventsToSend);
    
    // If successful and we're back online, try to flush offline queue
    const offlineQueue = getOfflineQueue();
    if (offlineQueue.length > 0) {
      await trackBatch(offlineQueue);
      clearOfflineQueue();
    }
  } catch (error) {
    // If request fails, add to offline queue
    const offlineQueue = getOfflineQueue();
    saveOfflineQueue([...offlineQueue, ...eventsToSend]);
  }
};

/**
 * Schedule batch sending every 10 seconds
 */
const scheduleBatch = (): void => {
  if (batchTimer) clearTimeout(batchTimer);
  
  batchTimer = setTimeout(() => {
    flushQueue();
    scheduleBatch(); // Keep scheduling
  }, 10000); // 10 seconds
};

// Start batch scheduling on module load
scheduleBatch();

// Handle online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    flushQueue(); // Try to send queued events when back online
  });

  window.addEventListener('offline', () => {
    isOnline = false;
  });

  // Flush queue before page unload
  window.addEventListener('beforeunload', () => {
    if (eventQueue.length > 0) {
      const offlineQueue = getOfflineQueue();
      saveOfflineQueue([...offlineQueue, ...eventQueue]);
    }
  });
}

interface UseEventTrackingOptions {
  propertyId?: string;
  autoTrackPageView?: boolean;
  debounceMs?: number;
}

/**
 * Hook for tracking property events
 */
export const useEventTracking = (options: UseEventTrackingOptions = {}) => {
  const { propertyId, autoTrackPageView = false, debounceMs = 1000 } = options;
  const sessionId = getSessionId();
  const lastEventTime = useRef<{ [key: string]: number }>({});

  /**
   * Track a property event
   */
  const trackEvent = useCallback((
    eventPropertyId: string,
    eventType: PropertyEvent['event_type'],
    metadata?: Record<string, any>
  ) => {
    // Debounce: prevent duplicate events within debounceMs
    const eventKey = `${eventPropertyId}_${eventType}`;
    const now = Date.now();
    const lastTime = lastEventTime.current[eventKey] || 0;

    if (now - lastTime < debounceMs) {
      return; // Skip this event - too soon
    }

    lastEventTime.current[eventKey] = now;

    // Add event to queue
    const event: PropertyEvent = {
      property_id: eventPropertyId,
      event_type: eventType,
      metadata: metadata || {},
      session_id: sessionId,
      referrer: document.referrer || undefined,
      timestamp: new Date().toISOString(),
    };

    eventQueue.push(event);
  }, [sessionId, debounceMs]);

  /**
   * Auto-track page view on component mount
   */
  useEffect(() => {
    if (autoTrackPageView && propertyId) {
      trackEvent(propertyId, 'detail_view', {
        page: window.location.pathname,
      });
    }
  }, [autoTrackPageView, propertyId, trackEvent]);

  return {
    trackEvent,
    sessionId,
  };
};

/**
 * Standalone function to track an event outside of React components
 */
export const trackPropertyEvent = (
  propertyId: string,
  eventType: PropertyEvent['event_type'],
  metadata?: Record<string, any>
): void => {
  const event: PropertyEvent = {
    property_id: propertyId,
    event_type: eventType,
    metadata: metadata || {},
    session_id: getSessionId(),
    referrer: document.referrer || undefined,
    timestamp: new Date().toISOString(),
  };

  eventQueue.push(event);
};

export default useEventTracking;
