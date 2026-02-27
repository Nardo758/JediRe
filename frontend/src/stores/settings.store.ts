/**
 * Application Settings Store
 * Manages user preferences and AI feature toggles
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

export interface AISettings {
  enabled: boolean;
  features: {
    imageTo3D: boolean;
    designCompliance: boolean;
    aerialAnalysis: boolean;
    ownerDisposition: boolean;
    autoTagPhotos: boolean;
    progressEstimation: boolean;
    rentPrediction: boolean;
    costEstimation: boolean;
  };
}

export interface MapSettings {
  defaultZoom: number;
  defaultCenter: [number, number];
  showLabels: boolean;
  show3DBuildings: boolean;
  showParcelBoundaries: boolean;
}

export interface UISettings {
  theme: 'light' | 'dark' | 'auto';
  sidebarCollapsed: boolean;
  compactMode: boolean;
  showTooltips: boolean;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  dealUpdates: boolean;
  marketAlerts: boolean;
  taskReminders: boolean;
}

export interface SettingsState {
  // AI Settings
  ai: AISettings;
  
  // Map Settings
  map: MapSettings;
  
  // UI Settings
  ui: UISettings;
  
  // Notification Settings
  notifications: NotificationSettings;
  
  // Actions
  updateAISettings: (settings: Partial<AISettings>) => void;
  toggleAIFeature: (feature: keyof AISettings['features']) => void;
  updateMapSettings: (settings: Partial<MapSettings>) => void;
  updateUISettings: (settings: Partial<UISettings>) => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  resetToDefaults: () => void;
}

// ============================================================================
// Default Settings
// ============================================================================

const defaultAISettings: AISettings = {
  enabled: true,
  features: {
    imageTo3D: true,
    designCompliance: true,
    aerialAnalysis: true,
    ownerDisposition: true,
    autoTagPhotos: true,
    progressEstimation: true,
    rentPrediction: true,
    costEstimation: true,
  },
};

const defaultMapSettings: MapSettings = {
  defaultZoom: 12,
  defaultCenter: [33.7490, -84.3880], // Atlanta
  showLabels: true,
  show3DBuildings: true,
  showParcelBoundaries: true,
};

const defaultUISettings: UISettings = {
  theme: 'light',
  sidebarCollapsed: false,
  compactMode: false,
  showTooltips: true,
};

const defaultNotificationSettings: NotificationSettings = {
  emailNotifications: true,
  pushNotifications: false,
  dealUpdates: true,
  marketAlerts: true,
  taskReminders: true,
};

// ============================================================================
// Store
// ============================================================================

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state
      ai: defaultAISettings,
      map: defaultMapSettings,
      ui: defaultUISettings,
      notifications: defaultNotificationSettings,

      // Actions
      updateAISettings: (settings) =>
        set((state) => ({
          ai: { ...state.ai, ...settings },
        })),

      toggleAIFeature: (feature) =>
        set((state) => ({
          ai: {
            ...state.ai,
            features: {
              ...state.ai.features,
              [feature]: !state.ai.features[feature],
            },
          },
        })),

      updateMapSettings: (settings) =>
        set((state) => ({
          map: { ...state.map, ...settings },
        })),

      updateUISettings: (settings) =>
        set((state) => ({
          ui: { ...state.ui, ...settings },
        })),

      updateNotificationSettings: (settings) =>
        set((state) => ({
          notifications: { ...state.notifications, ...settings },
        })),

      resetToDefaults: () =>
        set({
          ai: defaultAISettings,
          map: defaultMapSettings,
          ui: defaultUISettings,
          notifications: defaultNotificationSettings,
        }),
    }),
    {
      name: 'jedire-settings',
      version: 1,
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectAIEnabled = (state: SettingsState) => state.ai.enabled;
export const selectAIFeature = (feature: keyof AISettings['features']) => 
  (state: SettingsState) => state.ai.features[feature];
export const selectMapSettings = (state: SettingsState) => state.map;
export const selectUITheme = (state: SettingsState) => state.ui.theme;
export const selectNotifications = (state: SettingsState) => state.notifications;
