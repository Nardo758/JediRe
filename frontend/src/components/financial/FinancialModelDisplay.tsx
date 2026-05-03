/**
 * Financial Model Display Component
 * Real-time 3D-integrated financial model visualization
 */

import React, { useEffect, useState, useCallback } from 'react';
import { financialAutoSync } from '../../services/financialAutoSync.service';
import type {
  Design3D,
  ProForma,
  FinancialAssumptions,
  FinancialSyncState,
} from '../../types/financial.types';

interface FinancialModelDisplayProps {
  design3D: Design3D;
  assumptions: FinancialAssumptions;
  onProFormaChange?: (proForma: ProForma) => void;
}

export const FinancialModelDisplay: React.FC<FinancialModelDisplayProps> = ({
  design3D,
  assumptions,
  onProFormaChange,
}) => {
  const [proForma, setProForma] = useState<ProForma | null>(null);
  const [syncState, setSyncState] = useState<FinancialSyncState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Watch for design changes
  useEffect(() => {
    const unwatch = financialAutoSync.watchDesign3D(
      design3D.id,
      assumptions,
      (design, newProForma) => {
        setProForma(newProForma);
        setError(null);
        onProFormaChange?.(newProForma);
      },
      (err) => {
        setError(err.message);
      }
    );

    // Trigger initial calculation
    financialAutoSync.onDesignChange(design3D);

    // Cleanup on unmount
    return () => {
      unwatch();
    };
  }, [design3D.id, assumptions]);

  // Update sync state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const state = financialAutoSync.getSyncState(design3D.id);
      setSyncState(state);
    }, 100);

    return () => clearInterval(interval);
  }, [design3D.id]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number, decimals: number = 1): string => {
    return `${(value * 100).toFixed(decimals)}%`;
  };

  const formatNumber = (value: number, decimals: number = 0): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <span className="text-xl">⚠️</span>
          <div>
            <div className="font-semibold">Error calculating financial model</div>
            <div className="text-sm">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!proForma) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-gray-600">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span>Calculating financial model...</span>
        </div>
      </div>
    );
  }

  const { developmentBudget, operatingProForma, returns, sensitivity } = proForma;
  const stabilized = operatingProForma.stabilizedYear;

  return (
    <div className="space-y-6">
      {/* Sync Status */}
      {syncState?.isCalculating && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-blue-800">Recalculating...</span>
        </div>
      )}

      {/* Recent Changes */}
      {syncState?.pendingChanges && syncState.pendingChanges.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="font-semibold text-amber-900 mb-2">Recent Changes:</div>
          <div className="space-y-1">
            {syncState.pendingChanges.map((change, idx) => (
              <div key={idx} className="text-sm text-amber-800">
                <span className="font-medium">{change.field}:</span>{' '}
                {typeof change.oldValue === 'number'
                  ? formatCurrency(change.oldValue)
                  : change.oldValue}{' '}
                → {typeof change.newValue === 'number'
                  ? formatCurrency(change.newValue)
                  : change.newValue}
                {change.impact.irr && (
                  <span className={change.impact.irr > 0 ? 'text-green-600' : 'text-red-600'}>
                    {' '}({change.impact.irr > 0 ? '+' : ''}{formatPercent(change.impact.irr, 2)})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3D Design Inputs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">3D Design Inputs</h3>
            <button
              onClick={() => financialAutoSync.recalculate(design3D)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>↻</span> Sync from 3D Model
            </button>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Units:</span>
              <span className="font-semibold">{design3D.totalUnits}</span>
            </div>
            
            <div className="border-t pt-2">
              <div className="text-sm font-semibold text-gray-700 mb-1">Unit Mix:</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Studios:</span>
                  <span>{design3D.unitMix.studio} × {formatCurrency(assumptions.marketRents.studio)} = {formatCurrency(design3D.unitMix.studio * assumptions.marketRents.studio * 12)}/yr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">1BR:</span>
                  <span>{design3D.unitMix.oneBed} × {formatCurrency(assumptions.marketRents.oneBed)} = {formatCurrency(design3D.unitMix.oneBed * assumptions.marketRents.oneBed * 12)}/yr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">2BR:</span>
                  <span>{design3D.unitMix.twoBed} × {formatCurrency(assumptions.marketRents.twoBed)} = {formatCurrency(design3D.unitMix.twoBed * assumptions.marketRents.twoBed * 12)}/yr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">3BR:</span>
                  <span>{design3D.unitMix.threeBed} × {formatCurrency(assumptions.marketRents.threeBed)} = {formatCurrency(design3D.unitMix.threeBed * assumptions.marketRents.threeBed * 12)}/yr</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-2 flex justify-between">
              <span className="text-gray-600">Rentable SF:</span>
              <span className="font-semibold">{formatNumber(design3D.rentableSF)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Parking Spaces:</span>
              <span className="font-semibold">{design3D.parkingSpaces}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Amenity SF:</span>
              <span className="font-semibold">{formatNumber(design3D.amenitySF)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Efficiency:</span>
              <span className="font-semibold">{formatPercent(design3D.efficiency)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">FAR Utilized:</span>
              <span className="font-semibold">{design3D.farUtilized.toFixed(1)}{design3D.farMax ? `/${design3D.farMax}` : ''}</span>
            </div>
          </div>
        </div>

        {/* Development Budget */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Development Budget</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Land Cost:</span>
              <span className="font-semibold">{formatCurrency(developmentBudget.landAcquisition)}</span>
            </div>
            
            <div className="border-t pt-2">
              <div className="text-sm font-semibold text-gray-700 mb-1">Hard Costs:</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Residential:</span>
                  <span>{formatCurrency(developmentBudget.hardCosts.residential)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Parking:</span>
                  <span>{formatCurrency(developmentBudget.hardCosts.parking)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amenities:</span>
                  <span>{formatCurrency(developmentBudget.hardCosts.amenities)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Site Work:</span>
                  <span>{formatCurrency(developmentBudget.hardCosts.siteWork)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Contingency:</span>
                  <span>{formatCurrency(developmentBudget.hardCosts.contingency)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t">
                  <span>Hard Costs Total:</span>
                  <span>{formatCurrency(developmentBudget.hardCosts.total)}</span>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-2">
              <div className="text-sm font-semibold text-gray-700 mb-1">Soft Costs:</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">A&E:</span>
                  <span>{formatCurrency(developmentBudget.softCosts.architectureEngineering)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Legal/Permits:</span>
                  <span>{formatCurrency(developmentBudget.softCosts.legalPermitting)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Financing:</span>
                  <span>{formatCurrency(developmentBudget.softCosts.financing)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Marketing:</span>
                  <span>{formatCurrency(developmentBudget.softCosts.marketing)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Developer Fee:</span>
                  <span>{formatCurrency(developmentBudget.softCosts.developerFee)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t">
                  <span>Soft Costs Total:</span>
                  <span>{formatCurrency(developmentBudget.softCosts.total)}</span>
                </div>
              </div>
            </div>
            
            <div className="border-t-2 pt-2 flex justify-between font-bold text-lg">
              <span>Total Dev Cost:</span>
              <span>{formatCurrency(developmentBudget.totalDevelopmentCost)}</span>
            </div>
            
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Cost per Unit:</span>
                <span>{formatCurrency(developmentBudget.costPerUnit)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cost per SF:</span>
                <span>{formatCurrency(developmentBudget.costPerSF)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operating Pro Forma & Returns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operating Pro Forma */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Operating Pro Forma (Stabilized)</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Gross Potential Income:</span>
              <span className="font-semibold">{formatCurrency(stabilized.revenue.grossPotentialIncome)}</span>
            </div>
            
            <div className="flex justify-between text-red-600">
              <span>Vacancy ({formatPercent(assumptions.operating.vacancyRate)}):</span>
              <span>-{formatCurrency(stabilized.revenue.vacancy)}</span>
            </div>
            
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Effective Gross Income:</span>
              <span>{formatCurrency(stabilized.revenue.effectiveGrossIncome)}</span>
            </div>
            
            <div className="border-t pt-2">
              <div className="text-sm font-semibold text-gray-700 mb-1">Operating Expenses:</div>
              <div className="space-y-1 text-sm text-red-600">
                <div className="flex justify-between">
                  <span>Management:</span>
                  <span>-{formatCurrency(stabilized.expenses.management)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Property Tax:</span>
                  <span>-{formatCurrency(stabilized.expenses.propertyTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Insurance:</span>
                  <span>-{formatCurrency(stabilized.expenses.insurance)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Utilities:</span>
                  <span>-{formatCurrency(stabilized.expenses.utilities)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Repairs & Maintenance:</span>
                  <span>-{formatCurrency(stabilized.expenses.repairsMaintenance)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payroll:</span>
                  <span>-{formatCurrency(stabilized.expenses.payroll)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-1 border-t">
                  <span className="text-gray-700">Total Expenses:</span>
                  <span>-{formatCurrency(stabilized.expenses.total)}</span>
                </div>
              </div>
            </div>
            
            <div className="border-t-2 pt-2 flex justify-between font-bold text-lg text-green-600">
              <span>NOI:</span>
              <span>{formatCurrency(stabilized.cashFlow.netOperatingIncome)}</span>
            </div>
            
            {stabilized.cashFlow.debtService && stabilized.cashFlow.debtService > 0 && (
              <>
                <div className="flex justify-between text-red-600">
                  <span>Debt Service:</span>
                  <span>-{formatCurrency(stabilized.cashFlow.debtService)}</span>
                </div>
                
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>Cash Flow:</span>
                  <span>{formatCurrency(stabilized.cashFlow.cashFlowBeforeTax)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Returns Analysis */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Returns Analysis</h3>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Levered Returns:</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">IRR:</span>
                  <span className="font-bold text-xl text-blue-600">{formatPercent(returns.leveredIRR)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Equity Multiple:</span>
                  <span className="font-semibold">{returns.leveredEquityMultiple.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cash-on-Cash:</span>
                  <span className="font-semibold">{formatPercent(returns.cashOnCashReturn)}</span>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-3">
              <div className="text-sm font-semibold text-gray-700 mb-2">Unlevered Returns:</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">IRR:</span>
                  <span className="font-semibold">{formatPercent(returns.unleveredIRR)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Equity Multiple:</span>
                  <span className="font-semibold">{returns.unleveredEquityMultiple.toFixed(2)}x</span>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-3">
              <div className="text-sm font-semibold text-gray-700 mb-2">Development Metrics:</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Yield on Cost:</span>
                  <span className="font-semibold">{formatPercent(returns.yieldOnCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Dev Spread:</span>
                  <span className="font-semibold">{formatNumber(returns.developmentSpread)} bps</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payback Period:</span>
                  <span className="font-semibold">{returns.paybackPeriod.toFixed(1)} yrs</span>
                </div>
                {returns.debtServiceCoverageRatio > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">DSCR:</span>
                    <span className="font-semibold">{returns.debtServiceCoverageRatio.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sensitivity Analysis */}
      {sensitivity && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Sensitivity Analysis</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Variable</th>
                  <th className="text-right py-2">-10%</th>
                  <th className="text-right py-2 font-bold">Base</th>
                  <th className="text-right py-2">+10%</th>
                </tr>
              </thead>
              <tbody>
                {sensitivity.variables.map((variable) => (
                  <tr key={variable.name} className="border-b hover:bg-gray-50">
                    <td className="py-2">
                      {variable.name}
                      {variable.name === sensitivity.mostSensitive && (
                        <span className="ml-2 text-amber-600">← Most sensitive</span>
                      )}
                    </td>
                    <td className="text-right">{formatPercent(variable.impactOnIRR.negTen)}</td>
                    <td className="text-right font-semibold">{formatPercent(variable.impactOnIRR.base)}</td>
                    <td className="text-right">{formatPercent(variable.impactOnIRR.posTen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialModelDisplay;
