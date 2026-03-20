/**
 * Module Event Bus
 *
 * Real-time inter-module signal propagation system.
 * When a module produces new data, downstream modules are notified and can recalculate.
 * Supports both sync and async event handling, with debouncing for cascade prevention.
 */

import { EventEmitter } from 'events';
import { ModuleId } from './module-registry';
import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export enum ModuleEventType {
  /** A module's data has been updated */
  DATA_UPDATED = 'module:data_updated',
  /** A module needs recalculation */
  RECALCULATE = 'module:recalculate',
  /** A module calculation has completed */
  CALCULATION_COMPLETE = 'module:calculation_complete',
  /** A module calculation has failed */
  CALCULATION_FAILED = 'module:calculation_failed',
  /** A JEDI score has changed (high-priority) */
  SCORE_CHANGED = 'module:score_changed',
  /** A risk threshold was breached */
  RISK_ALERT = 'module:risk_alert',
  /** A news event was classified */
  NEWS_CLASSIFIED = 'module:news_classified',
  /** Strategy arbitrage opportunity detected */
  ARBITRAGE_DETECTED = 'module:arbitrage_detected',
}

export interface ModuleEvent {
  type: ModuleEventType;
  sourceModule: ModuleId;
  dealId: string;
  data?: Record<string, any>;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export type ModuleEventHandler = (event: ModuleEvent) => void | Promise<void>;

export interface Subscription {
  id: string;
  eventType: ModuleEventType | '*';
  moduleFilter?: ModuleId;
  handler: ModuleEventHandler;
  unsubscribe: () => void;
}

// ============================================================================
// Module Event Bus
// ============================================================================

class ModuleEventBus {
  private emitter: EventEmitter;
  private subscriptions = new Map<string, Subscription>();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private subscriptionCounter = 0;

  /** Default debounce window in ms for cascade events */
  private readonly DEBOUNCE_MS = 250;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
  }

  /**
   * Emit a module event. All subscribers matching the event type are notified.
   */
  emit(event: ModuleEvent): void {
    logger.debug('Module event emitted', {
      type: event.type,
      source: event.sourceModule,
      dealId: event.dealId,
    });

    // Emit typed event
    this.emitter.emit(event.type, event);
    // Emit wildcard for global listeners
    this.emitter.emit('*', event);
  }

  /**
   * Emit a debounced event. If the same event key fires within the debounce window,
   * only the last one is emitted. Useful for cascade prevention.
   */
  emitDebounced(event: ModuleEvent, debounceKey?: string): void {
    const key = debounceKey || `${event.type}:${event.sourceModule}:${event.dealId}`;

    // Clear existing timer
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.emit(event);
      this.debounceTimers.delete(key);
    }, this.DEBOUNCE_MS);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Subscribe to a specific event type.
   */
  on(eventType: ModuleEventType | '*', handler: ModuleEventHandler, moduleFilter?: ModuleId): Subscription {
    const id = `sub_${++this.subscriptionCounter}`;

    const wrappedHandler: ModuleEventHandler = (event) => {
      if (moduleFilter && event.sourceModule !== moduleFilter) return;
      handler(event);
    };

    this.emitter.on(eventType, wrappedHandler);

    const subscription: Subscription = {
      id,
      eventType,
      moduleFilter,
      handler: wrappedHandler,
      unsubscribe: () => {
        this.emitter.off(eventType, wrappedHandler);
        this.subscriptions.delete(id);
      },
    };

    this.subscriptions.set(id, subscription);
    return subscription;
  }

  /**
   * Subscribe to events from a specific module.
   */
  onModule(moduleId: ModuleId, handler: ModuleEventHandler): Subscription {
    return this.on('*', handler, moduleId);
  }

  /**
   * Subscribe to data updates that affect a specific module's inputs.
   * Fires when any upstream module publishes new data.
   */
  onInputsChanged(targetModuleId: ModuleId, upstreamModules: ModuleId[], handler: ModuleEventHandler): Subscription[] {
    return upstreamModules.map(upstream =>
      this.on(ModuleEventType.DATA_UPDATED, (event) => {
        if (upstreamModules.includes(event.sourceModule)) {
          handler(event);
        }
      }, upstream)
    );
  }

  /**
   * Subscribe once to an event type.
   */
  once(eventType: ModuleEventType, handler: ModuleEventHandler): void {
    this.emitter.once(eventType, handler);
  }

  /**
   * Get all active subscriptions.
   */
  getSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Remove all subscriptions.
   */
  removeAllSubscriptions(): void {
    for (const sub of this.subscriptions.values()) {
      sub.unsubscribe();
    }
    this.subscriptions.clear();
    this.emitter.removeAllListeners();
  }

  /**
   * Clear all debounce timers.
   */
  clearDebounceTimers(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Get event bus stats.
   */
  getStats(): { subscriptionCount: number; pendingDebounces: number; listenerCounts: Record<string, number> } {
    const listenerCounts: Record<string, number> = {};
    for (const type of Object.values(ModuleEventType)) {
      listenerCounts[type] = this.emitter.listenerCount(type);
    }
    listenerCounts['*'] = this.emitter.listenerCount('*');

    return {
      subscriptionCount: this.subscriptions.size,
      pendingDebounces: this.debounceTimers.size,
      listenerCounts,
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const moduleEventBus = new ModuleEventBus();
