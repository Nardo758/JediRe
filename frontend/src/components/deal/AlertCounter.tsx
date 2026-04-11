import React, { useMemo, useState, useCallback } from 'react';
import { BT } from './bloomberg-ui';
import { AlertPip } from './AlertPip';
import { useDealStore, useDealType } from '../../stores/dealStore';
import {
  INPUT_FIELD_REGISTRY,
  type AlertLevel,
  type LayeredValue,
  type InputFieldMeta,
} from '../../stores/dealContext.types';

const MONO = BT.font.mono;

interface AlertItem {
  field: InputFieldMeta;
  level: AlertLevel;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let cur: unknown = obj;
  for (const seg of segments) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function isLayeredValue(v: unknown): v is LayeredValue<unknown> {
  return v !== null && typeof v === 'object' && 'value' in v && 'alertLevel' in v;
}

const REQUIRED_IDENTITY_PATHS = ['identity.name', 'identity.address', 'identity.city', 'identity.state', 'identity.mode', 'identity.sponsor', 'identity.capitalIntent'];

export function useAlertScan(): { alerts: AlertItem[]; blockCount: number; warnCount: number; infoCount: number; total: number; hasBlockingAlerts: boolean } {
  const state = useDealStore();
  const dealType = useDealType();

  return useMemo(() => {
    const applicableFields = INPUT_FIELD_REGISTRY.filter(f => f.appliesTo.includes(dealType));
    const alerts: AlertItem[] = [];

    for (const field of applicableFields) {
      const val = getNestedValue(state as unknown as Record<string, unknown>, field.path);
      if (isLayeredValue(val) && val.alertLevel !== 'none') {
        alerts.push({ field, level: val.alertLevel as AlertLevel });
      } else if (field.inputClass === 'identity' && REQUIRED_IDENTITY_PATHS.includes(field.path)) {
        const isEmpty = val === null || val === undefined || val === '' || val === 0;
        if (isEmpty) {
          alerts.push({ field, level: 'block' });
        }
      }
    }

    const blockCount = alerts.filter(a => a.level === 'block').length;
    const warnCount = alerts.filter(a => a.level === 'warn').length;
    const infoCount = alerts.filter(a => a.level === 'info').length;

    return { alerts, blockCount, warnCount, infoCount, total: alerts.length, hasBlockingAlerts: blockCount > 0 };
  }, [state, dealType]);
}

export function useIdentityGate(): { complete: boolean; missing: string[] } {
  const state = useDealStore();
  const dealType = useDealType();

  return useMemo(() => {
    const requiredIdentity = ['identity.name', 'identity.address', 'identity.city', 'identity.state', 'identity.mode', 'identity.sponsor', 'identity.capitalIntent'];
    const missing: string[] = [];
    for (const path of requiredIdentity) {
      const val = getNestedValue(state as unknown as Record<string, unknown>, path);
      if (val === null || val === undefined || val === '' || val === 0) {
        const meta = INPUT_FIELD_REGISTRY.find(f => f.path === path);
        missing.push(meta?.label ?? path);
      }
    }
    return { complete: missing.length === 0, missing };
  }, [state, dealType]);
}

function scrollToField(path: string) {
  const el = document.querySelector(`[data-field-path="${path}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el as HTMLElement).style.outline = `2px solid ${BT.text.amber}`;
    setTimeout(() => { (el as HTMLElement).style.outline = ''; }, 2000);
  }
}

interface AlertCounterProps {
  onClickField?: (path: string) => void;
}

export function AlertCounter({ onClickField }: AlertCounterProps) {
  const { alerts, blockCount, warnCount, infoCount, total } = useAlertScan();
  const markFieldReviewed = useDealStore(s => s.markFieldReviewed);
  const [expanded, setExpanded] = useState(false);

  const handleFieldClick = useCallback((item: AlertItem) => {
    scrollToField(item.field.path);
    if (item.level === 'info') {
      markFieldReviewed(item.field.path);
    }
    onClickField?.(item.field.path);
  }, [onClickField, markFieldReviewed]);

  const handleJumpToFirstBlock = useCallback(() => {
    const firstBlock = alerts.find(a => a.level === 'block');
    if (firstBlock) {
      scrollToField(firstBlock.field.path);
      if (!expanded) setExpanded(true);
    }
  }, [alerts, expanded]);

  if (total === 0) {
    return (
      <div style={{
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        borderBottom: `1px solid ${BT.border.subtle}`,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: BT.text.green,
          animation: 'bt-glow 2s infinite',
        }} />
        <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.green, letterSpacing: 0.5 }}>
          ALL INPUTS CLEAR
        </span>
      </div>
    );
  }

  return (
    <div style={{ borderBottom: `1px solid ${BT.border.subtle}` }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          background: blockCount > 0 ? `${BT.text.red}08` : 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: MONO, fontSize: 9, fontWeight: 700,
            color: blockCount > 0 ? BT.text.red : BT.text.amber,
            letterSpacing: 0.5,
          }}>
            {total} INPUT{total !== 1 ? 'S' : ''} NEED ATTENTION
          </span>
          {blockCount > 0 && (
            <span
              onClick={(e) => { e.stopPropagation(); handleJumpToFirstBlock(); }}
              style={{
                fontFamily: MONO, fontSize: 8, color: BT.text.red,
                background: `${BT.text.red}18`, padding: '0 4px',
                border: `1px solid ${BT.text.red}33`,
                cursor: 'pointer',
              }}
            >
              {blockCount} BLOCKING ↗
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {blockCount > 0 && <AlertPip level="block" />}
          {warnCount > 0 && <AlertPip level="warn" />}
          {infoCount > 0 && <AlertPip level="info" />}
          <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
            {expanded ? '▴' : '▾'}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {alerts
            .sort((a, b) => {
              const order: Record<AlertLevel, number> = { block: 0, warn: 1, info: 2, none: 3 };
              return order[a.level] - order[b.level];
            })
            .map((item) => (
              <div
                key={item.field.path}
                onClick={() => handleFieldClick(item)}
                style={{
                  padding: '3px 8px 3px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: `1px solid ${BT.border.subtle}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertPip level={item.level} />
                  <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.secondary }}>
                    {item.field.label}
                  </span>
                </div>
                <span style={{
                  fontFamily: MONO, fontSize: 8,
                  color: BT.text.muted, textTransform: 'uppercase',
                }}>
                  {item.field.category}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export function IdentityGateBanner() {
  const { complete, missing } = useIdentityGate();

  if (complete) return null;

  return (
    <div style={{
      padding: '6px 8px',
      background: `${BT.text.red}0A`,
      borderBottom: `1px solid ${BT.text.red}33`,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <AlertPip level="block" />
      <div>
        <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BT.text.red, letterSpacing: 0.5 }}>
          IDENTITY INCOMPLETE — AGENTS BLOCKED
        </div>
        <div style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted, marginTop: 1 }}>
          Missing: {missing.join(', ')}
        </div>
      </div>
    </div>
  );
}
