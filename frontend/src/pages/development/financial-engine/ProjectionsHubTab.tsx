// ============================================================================
// ProjectionsHubTab — Projections cluster shell
// ============================================================================
//
// History: previously hosted an INTERACTIVE sub-tab that re-rendered the
// editable ProFormaTab. That slot was repurposed into the Console > DEAL
// TERMS sub-tab (operator-decision input consolidation). The Projections
// hub now exposes only the Projections view itself; if a second sibling
// is added later (e.g. Sensitivity preview), reintroduce the strip.
// ============================================================================

import React from 'react';
import { ProjectionsTab } from './ProjectionsTab';
import type { FinancialEngineTabProps } from './types';

interface ProjectionsHubTabProps extends FinancialEngineTabProps {
  integrityWarning?: boolean;
}

export function ProjectionsHubTab({ integrityWarning, ...props }: ProjectionsHubTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <ProjectionsTab {...props} integrityWarning={integrityWarning} />
      </div>
    </div>
  );
}
