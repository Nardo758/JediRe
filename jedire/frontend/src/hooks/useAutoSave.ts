/**
 * Auto-Save Hook
 * Automatically saves deal data every 5 seconds when changes are detected
 * Also provides manual save trigger and navigation guard
 */

import { useEffect, useCallback, useRef } from 'react';
import { useDealDataStore } from '../stores/dealData.store';

interface UseAutoSaveOptions {
  dealId: string;
  interval?: number; // Auto-save interval in milliseconds (default: 5000)
  enabled?: boolean; // Enable/disable auto-save (default: true)
  onSaveSuccess?: () => void;
  onSaveError?: (error: string) => void;
}

export function useAutoSave(options: UseAutoSaveOptions) {
  const {
    dealId,
    interval = 5000,
    enabled = true,
    onSaveSuccess,
    onSaveError,
  } = options;
  
  const {
    hasUnsavedChanges,
    isSaving,
    saveToDB,
    loadFromDB,
    error: storeError,
  } = useDealDataStore();
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveAttemptRef = useRef<number>(0);
  
  // Manual save function
  const manualSave = useCallback(async () => {
    if (isSaving) {
      return { success: false, message: 'Save already in progress' };
    }
    
    try {
      await saveToDB();
      onSaveSuccess?.();
      return { success: true, message: 'Saved successfully' };
    } catch (error: any) {
      const message = error.message || 'Failed to save';
      onSaveError?.(message);
      return { success: false, message };
    }
  }, [isSaving, saveToDB, onSaveSuccess, onSaveError]);
  
  // Auto-save effect
  useEffect(() => {
    if (!enabled || !hasUnsavedChanges || isSaving) {
      return;
    }
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout
    saveTimeoutRef.current = setTimeout(async () => {
      const now = Date.now();
      
      // Prevent rapid successive saves
      if (now - lastSaveAttemptRef.current < 2000) {
        return;
      }
      
      lastSaveAttemptRef.current = now;
      
      try {
        await saveToDB();
        onSaveSuccess?.();
      } catch (error: any) {
        const message = error.message || 'Auto-save failed';
        onSaveError?.(message);
      }
    }, interval);
    
    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [hasUnsavedChanges, isSaving, enabled, interval, saveToDB, onSaveSuccess, onSaveError]);
  
  // Load data on mount
  useEffect(() => {
    if (dealId) {
      loadFromDB(dealId);
    }
  }, [dealId, loadFromDB]);
  
  // Cleanup on unmount - save if needed
  useEffect(() => {
    return () => {
      if (hasUnsavedChanges && !isSaving) {
        // Fire and forget - save on unmount
        saveToDB().catch(console.error);
      }
    };
  }, [hasUnsavedChanges, isSaving, saveToDB]);
  
  return {
    hasUnsavedChanges,
    isSaving,
    error: storeError,
    manualSave,
  };
}

/**
 * Navigation Guard Hook
 * Warns user before leaving page with unsaved changes
 */
export function useNavigationGuard(enabled: boolean = true) {
  const { hasUnsavedChanges } = useDealDataStore();
  
  useEffect(() => {
    if (!enabled || !hasUnsavedChanges) {
      return;
    }
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, enabled]);
}

/**
 * Combined hook for both auto-save and navigation guard
 */
export function useAutoSaveWithGuard(options: UseAutoSaveOptions & { guardEnabled?: boolean }) {
  const { guardEnabled = true, ...autoSaveOptions } = options;
  
  const autoSaveResult = useAutoSave(autoSaveOptions);
  useNavigationGuard(guardEnabled);
  
  return autoSaveResult;
}
