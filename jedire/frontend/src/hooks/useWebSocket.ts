import { useEffect } from 'react';
import { wsService } from '@/services/websocket';
import { useAppStore } from '@/store';
import { Property, CollaborationUser } from '@/types';

export function useWebSocket(sessionId?: string) {
  const { updateProperty, setCollaborators, setSelectedProperty } = useAppStore();

  useEffect(() => {
    wsService.connect(sessionId);

    // Listen for property updates
    const unsubPropertyUpdate = wsService.on('property_update', (data: { property: Property }) => {
      updateProperty(data.property.id, data.property);
    });

    // Listen for user join/leave
    const unsubUserJoin = wsService.on('user_join', (data: { user: CollaborationUser }) => {
      useAppStore.setState((state) => ({
        collaborators: [...state.collaborators, data.user],
      }));
    });

    const unsubUserLeave = wsService.on('user_leave', (data: { userId: string }) => {
      useAppStore.setState((state) => ({
        collaborators: state.collaborators.filter((u) => u.id !== data.userId),
      }));
    });

    // Listen for cursor movements
    const unsubCursorMove = wsService.on('cursor_move', (data: { userId: string; lat: number; lng: number }) => {
      useAppStore.setState((state) => ({
        collaborators: state.collaborators.map((u) =>
          u.id === data.userId ? { ...u, cursor: { lat: data.lat, lng: data.lng } } : u
        ),
      }));
    });

    // Listen for property selection
    const unsubPropertySelect = wsService.on('property_selected', (data: { propertyId: string }) => {
      // Could fetch and show the property
      console.log('User selected property:', data.propertyId);
    });

    // Cleanup
    return () => {
      unsubPropertyUpdate();
      unsubUserJoin();
      unsubUserLeave();
      unsubCursorMove();
      unsubPropertySelect();
      wsService.disconnect();
    };
  }, [sessionId]);

  return {
    updateCursor: wsService.updateCursor.bind(wsService),
    pinProperty: wsService.pinProperty.bind(wsService),
    addAnnotation: wsService.addAnnotation.bind(wsService),
    selectProperty: wsService.selectProperty.bind(wsService),
  };
}
