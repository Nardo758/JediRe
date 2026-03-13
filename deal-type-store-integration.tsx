// ═══════════════════════════════════════════════════════════════════════════════
// JEDI RE — Deal Type Store Integration
// ═══════════════════════════════════════════════════════════════════════════════
//
// This file shows how deal-type-visibility.ts integrates with the existing
// Zustand dealStore.ts and the DealDetailPage component tree.
//
// Wire-in points:
//   1. dealStore.ts  → add dealType slice + derived config
//   2. DealDetailPage → consume config for tab rendering
//   3. Bloomberg DEAL_NAV → replace static array with dynamic getDealNav()
//   4. Individual modules → consume variant configs for conditional rendering
//
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  getDealType,
  getDealTypeConfig,
  getAvailableStrategies,
  isModuleVisible,
  type DealType,
  type ModuleId,
  type ModuleTabDefinition,
  type VariantConfig,
} from './deal-type-visibility';


// ═══════════════════════════════════════════════════════════════════════════════
// 1. ZUSTAND STORE SLICE (add to existing dealStore.ts)
// ═══════════════════════════════════════════════════════════════════════════════

/*
  In your existing dealStore.ts, add to the DealContext interface:

  interface DealContext {
    // ... existing fields ...
    projectType: string;  // 'existing' | 'development' | 'redevelopment'
  }

  Then add a derived selector (no new state needed — it's computed from projectType):
*/

// Example: extending the existing store with a selector
// (This goes in dealStore.ts alongside existing selectors)

export const useDealType = (): DealType => {
  // Reads from the existing deal object in the store
  const projectType = useDealStore((state) => state.deal?.projectType ?? 'existing');
  return getDealType({ projectType });
};

// Convenience hook: full deal type configuration derived from store
export const useDealTypeConfig = () => {
  const projectType = useDealStore((state) => state.deal?.projectType ?? 'existing');
  return useMemo(() => getDealTypeConfig({ projectType }), [projectType]);
};


// ═══════════════════════════════════════════════════════════════════════════════
// 2. DEAL DETAIL PAGE — Tab Rendering
// ═══════════════════════════════════════════════════════════════════════════════

/*
  Replace the static tab array in DealDetailPage with the filtered set.
  The key pattern: tabs that are "hidden" for this deal type never render.
  Tabs that are "variant" render with modified content based on variantConfig.
*/

function DealDetailPage() {
  const config = useDealTypeConfig();

  // navTabs only includes visible, top-level modules — no hidden tabs, no sub-tabs
  const sidebarTabs = config.navTabs;

  return (
    <div className="deal-detail">
      {/* Sidebar renders only visible tabs */}
      <Sidebar>
        {sidebarTabs.map((tab) => (
          <SidebarTab
            key={tab.moduleId}
            moduleId={tab.moduleId}
            label={tab.name}
            fKey={tab.fKey}
            hasVariant={tab.showFor[config.dealType] === 'variant'}
          />
        ))}
      </Sidebar>

      {/* Content area renders the active module with its variant config */}
      <ModuleContent
        dealType={config.dealType}
        activeModule={activeModuleId}
        config={config}
      />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 3. BLOOMBERG TERMINAL — Dynamic DEAL_NAV
// ═══════════════════════════════════════════════════════════════════════════════

/*
  In jedi-bloomberg-integrated.jsx, replace the static DEAL_NAV constant:

  BEFORE (static):
    const DEAL_NAV = [
      {key:"F1",label:"OVERVIEW",m:"M01"},
      {key:"F2",label:"PROPERTY",m:"M02"},
      ...
    ];

  AFTER (dynamic):
    import { getDealNav } from './deal-type-visibility';

    // Inside the component:
    const dealType = useDealType();
    const DEAL_NAV = useMemo(() => getDealNav(dealType), [dealType]);
*/


// ═══════════════════════════════════════════════════════════════════════════════
// 4. MODULE-SPECIFIC HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/** M08 Strategy Arbitrage — get available strategies for this deal */
export function useStrategyColumns() {
  const dealType = useDealType();
  return useMemo(() => getAvailableStrategies(dealType), [dealType]);
}

/** M09 ProForma — get the correct template */
export function useProFormaTemplate() {
  const config = useDealTypeConfig();
  return {
    template: config.proformaTemplate,
    lineItems: config.proformaLineItems,
  };
}

/** M13 DD — get the correct checklist */
export function useDDChecklist() {
  const config = useDealTypeConfig();
  return {
    preset: config.ddPreset,
    categories: config.ddChecklist,
  };
}

/** M14 Risk — get the weight profile */
export function useRiskWeights() {
  const config = useDealTypeConfig();
  return {
    profile: config.riskWeightProfile,
    weights: config.riskWeights,
  };
}

/** M02 Zoning — get the depth level */
export function useZoningDepth() {
  const config = useDealTypeConfig();
  return config.zoningDepth;
}

/** Generic: check if a module should render */
export function useModuleVisible(moduleId: ModuleId): boolean {
  const dealType = useDealType();
  return isModuleVisible(moduleId, dealType);
}


// ═══════════════════════════════════════════════════════════════════════════════
// 5. EXAMPLE: Strategy Arbitrage with Deal-Type Filtering
// ═══════════════════════════════════════════════════════════════════════════════

/*
  Shows how M08 Strategy Arbitrage uses the variant config to show/hide columns.
*/

function StrategyArbitrageTab() {
  const strategies = useStrategyColumns();
  const dealType = useDealType();

  // strategies = ['FLIP','RENTAL','STR'] for existing
  // strategies = ['BTS','RENTAL','STR'] for development
  // strategies = ['BTS','FLIP','RENTAL','STR'] for redevelopment

  const STRATEGY_LABELS: Record<string, { icon: string; label: string }> = {
    BTS:    { icon: '🏗️', label: 'Build-to-Sell' },
    FLIP:   { icon: '🔄', label: 'Flip' },
    RENTAL: { icon: '🏠', label: 'Rental' },
    STR:    { icon: '🏨', label: 'Short-Term Rental' },
  };

  return (
    <div className="strategy-arbitrage">
      <div className="strategy-grid" style={{
        gridTemplateColumns: `repeat(${strategies.length}, 1fr)`,
      }}>
        {strategies.map((stratId) => {
          const strat = STRATEGY_LABELS[stratId];
          return (
            <StrategyColumn
              key={stratId}
              strategyId={stratId}
              icon={strat.icon}
              label={strat.label}
              dealType={dealType}
            />
          );
        })}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// 6. EXAMPLE: Zoning Module with Depth Filtering
// ═══════════════════════════════════════════════════════════════════════════════

/*
  Shows how M02 Zoning reduces its sub-tabs for Existing deals.
*/

const ZONING_SUB_TABS = [
  { id: 'code',         label: 'Zoning Code',              depth: 'simplified' as const },
  { id: 'uses',         label: 'Permitted Uses',           depth: 'simplified' as const },
  { id: 'nonconform',   label: 'Nonconforming Status',     depth: 'simplified' as const },
  { id: 'entitlement',  label: 'Entitlement Pathways',     depth: 'full' as const },
  { id: 'comparison',   label: 'Entitlement Comparison',   depth: 'full' as const },
  { id: 'devcap',       label: 'Development Scenarios',    depth: 'full' as const },
  { id: 'tts',          label: 'Time-to-Shovel',           depth: 'full' as const },
];

function ZoningModuleSection() {
  const zoningDepth = useZoningDepth();

  // For existing deals, only show 'simplified' tabs (3 of 7)
  // For dev/redev, show all 7 tabs
  const visibleSubTabs = ZONING_SUB_TABS.filter((tab) => {
    if (zoningDepth === 'full') return true;
    return tab.depth === 'simplified';
  });

  return (
    <div className="zoning-module">
      <SubTabNav tabs={visibleSubTabs} />
      {/* Tab content renders based on active sub-tab */}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// TYPE STUBS (for compilation — replace with your actual imports)
// ═══════════════════════════════════════════════════════════════════════════════

declare function useDealStore(selector: any): any;
declare function Sidebar(props: { children: React.ReactNode }): JSX.Element;
declare function SidebarTab(props: any): JSX.Element;
declare function ModuleContent(props: any): JSX.Element;
declare function StrategyColumn(props: any): JSX.Element;
declare function SubTabNav(props: any): JSX.Element;
