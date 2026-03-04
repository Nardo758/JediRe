import { EventEmitter } from 'events';

export interface ZoningEvent {
  type: string;
  timestamp: Date;
  data: Record<string, any>;
}

class ZoningEventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  publish(type: string, data: Record<string, any>) {
    const event: ZoningEvent = { type, timestamp: new Date(), data };
    this.emitter.emit(type, event);
    this.emitter.emit('*', event);
  }

  subscribe(type: string, handler: (event: ZoningEvent) => void) {
    this.emitter.on(type, handler);
    return () => this.emitter.off(type, handler);
  }

  subscribeAll(handler: (event: ZoningEvent) => void) {
    this.emitter.on('*', handler);
    return () => this.emitter.off('*', handler);
  }
}

export const zoningEventBus = new ZoningEventBus();

export const ZONING_EVENTS = {
  CORRECTION_APPLIED: 'zoning.correction_applied',
  CORRECTION_SUBMITTED: 'zoning.correction_submitted',
  PRECEDENT_ADDED: 'zoning.precedent_added',
  CONFIDENCE_CHANGED: 'zoning.confidence_changed',
  OUTCOME_RECORDED: 'zoning.outcome_recorded',
  ANALYSIS_COMPLETE: 'zoning.analysis_complete',
  CODE_UPDATED: 'zoning.code_updated',
  MATURITY_CHANGED: 'zoning.maturity_changed',
} as const;
