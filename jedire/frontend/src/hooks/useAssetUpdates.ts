/**
 * useAssetUpdates Hook
 * Subscribe to real-time updates for asset notes and news
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { assetMapWsClient, AssetUpdateEvent } from '../services/websocket.client';

interface UseAssetUpdatesOptions {
  assetId: string;
  enabled?: boolean;
  onNoteCreated?: (data: any) => void;
  onNoteUpdated?: (data: any) => void;
  onNoteDeleted?: (data: any) => void;
  onReplyCreated?: (data: any) => void;
  onReplyUpdated?: (data: any) => void;
  onReplyDeleted?: (data: any) => void;
  onNewsLinked?: (data: any) => void;
  onNewsDismissed?: (data: any) => void;
  showToasts?: boolean;
}

interface AssetUpdatesState {
  isConnected: boolean;
  isSubscribed: boolean;
  activeConnections: number;
}

/**
 * Hook to subscribe to real-time asset updates
 */
export function useAssetUpdates(options: UseAssetUpdatesOptions) {
  const {
    assetId,
    enabled = true,
    onNoteCreated,
    onNoteUpdated,
    onNoteDeleted,
    onReplyCreated,
    onReplyUpdated,
    onReplyDeleted,
    onNewsLinked,
    onNewsDismissed,
    showToasts = true,
  } = options;

  const [state, setState] = useState<AssetUpdatesState>({
    isConnected: false,
    isSubscribed: false,
    activeConnections: 0,
  });

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Show toast notification
   */
  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    if (!showToasts) return;

    // Use your toast library here (e.g., react-hot-toast, react-toastify)
    // For now, just console.log
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Example with a hypothetical toast library:
    // toast[type](message);
  }, [showToasts]);

  /**
   * Handle incoming update events
   */
  const handleUpdate = useCallback((event: AssetUpdateEvent) => {
    console.log('Asset update received:', event.type, event.data);

    switch (event.type) {
      case 'note:created':
        if (onNoteCreated) {
          onNoteCreated(event.data);
        }
        if (showToasts) {
          const authorName = event.data.author?.name || 'Someone';
          showToast(`${authorName} added a new note`, 'info');
        }
        break;

      case 'note:updated':
        if (onNoteUpdated) {
          onNoteUpdated(event.data);
        }
        if (showToasts) {
          const authorName = event.data.author?.name || 'Someone';
          showToast(`${authorName} updated a note`, 'info');
        }
        break;

      case 'note:deleted':
        if (onNoteDeleted) {
          onNoteDeleted(event.data);
        }
        if (showToasts) {
          showToast('A note was deleted', 'warning');
        }
        break;

      case 'note:reply':
        if (onReplyCreated) {
          onReplyCreated(event.data);
        }
        if (showToasts) {
          const authorName = event.data.author?.name || 'Someone';
          showToast(`${authorName} replied to a note`, 'info');
        }
        break;

      case 'reply:updated':
        if (onReplyUpdated) {
          onReplyUpdated(event.data);
        }
        break;

      case 'reply:deleted':
        if (onReplyDeleted) {
          onReplyDeleted(event.data);
        }
        break;

      case 'news:linked':
        if (onNewsLinked) {
          onNewsLinked(event.data);
        }
        if (showToasts) {
          showToast('New market event linked', 'success');
        }
        break;

      case 'news:dismissed':
        if (onNewsDismissed) {
          onNewsDismissed(event.data);
        }
        break;

      default:
        console.warn('Unknown asset update event type:', event.type);
    }
  }, [
    onNoteCreated,
    onNoteUpdated,
    onNoteDeleted,
    onReplyCreated,
    onReplyUpdated,
    onReplyDeleted,
    onNewsLinked,
    onNewsDismissed,
    showToast,
    showToasts,
  ]);

  /**
   * Subscribe to asset updates
   */
  const subscribe = useCallback(async () => {
    if (!enabled || !assetId) return;

    try {
      // Check if connected
      if (!assetMapWsClient.isConnected()) {
        setState((prev) => ({ ...prev, isConnected: false }));
        return;
      }

      setState((prev) => ({ ...prev, isConnected: true }));

      // Subscribe to asset
      const unsubscribe = await assetMapWsClient.subscribeToAsset(assetId, handleUpdate);
      unsubscribeRef.current = unsubscribe;

      setState((prev) => ({ ...prev, isSubscribed: true }));

      // Get active connections
      const count = await assetMapWsClient.getActiveConnections(assetId);
      setState((prev) => ({ ...prev, activeConnections: count }));

      // Setup heartbeat
      heartbeatIntervalRef.current = setInterval(() => {
        assetMapWsClient.sendHeartbeat(assetId);
      }, 30000); // Every 30 seconds

      console.log(`✓ Subscribed to asset updates: ${assetId}`);
    } catch (error) {
      console.error('Failed to subscribe to asset updates:', error);
      setState((prev) => ({ ...prev, isSubscribed: false }));
    }
  }, [enabled, assetId, handleUpdate]);

  /**
   * Unsubscribe from asset updates
   */
  const unsubscribe = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    setState((prev) => ({ ...prev, isSubscribed: false }));

    console.log(`✓ Unsubscribed from asset updates: ${assetId}`);
  }, [assetId]);

  /**
   * Refresh active connections count
   */
  const refreshActiveConnections = useCallback(async () => {
    if (!enabled || !assetId || !assetMapWsClient.isConnected()) return;

    try {
      const count = await assetMapWsClient.getActiveConnections(assetId);
      setState((prev) => ({ ...prev, activeConnections: count }));
    } catch (error) {
      console.error('Failed to refresh active connections:', error);
    }
  }, [enabled, assetId]);

  /**
   * Subscribe on mount, unsubscribe on unmount
   */
  useEffect(() => {
    subscribe();

    return () => {
      unsubscribe();
    };
  }, [subscribe, unsubscribe]);

  /**
   * Reconnect handler
   */
  useEffect(() => {
    if (!enabled) return;

    const checkConnection = () => {
      const connected = assetMapWsClient.isConnected();
      setState((prev) => {
        if (prev.isConnected !== connected) {
          if (connected && !prev.isSubscribed) {
            // Reconnected, resubscribe
            subscribe();
          }
          return { ...prev, isConnected: connected };
        }
        return prev;
      });
    };

    const intervalId = setInterval(checkConnection, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, subscribe]);

  return {
    isConnected: state.isConnected,
    isSubscribed: state.isSubscribed,
    activeConnections: state.activeConnections,
    refreshActiveConnections,
    unsubscribe,
  };
}

/**
 * Hook to initialize asset map WebSocket connection
 * Use this once at the app level
 */
export function useAssetMapWebSocket(token?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!token || isInitialized.current) return;

    isInitialized.current = true;

    assetMapWsClient
      .connect(token)
      .then(() => {
        setIsConnected(true);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        setIsConnected(false);
        isInitialized.current = false; // Allow retry
      });

    return () => {
      assetMapWsClient.disconnect();
      isInitialized.current = false;
    };
  }, [token]);

  return {
    isConnected,
    error,
    disconnect: () => assetMapWsClient.disconnect(),
  };
}
