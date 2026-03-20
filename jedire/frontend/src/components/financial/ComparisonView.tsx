import React from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown,
  Target,
  ArrowRight,
  Building,
  DollarSign
} from 'lucide-react';
import { FinancialInputs, ProForma } from './DesignToFinancialService';

interface ComparisonViewProps {
  currentDesign: FinancialInputs;
  proForma: ProForma;
  targets: {
    minUnits?: number;
    maxCostPerUnit?: number;
    minYieldOnCost?: number;
    maxCostPerSF?: number;
  };
  onReturnToDesign: () => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  currentDesign,
  proForma,
  targets,
  onReturnToDesign
}) => {
  // Calculate comparisons
  const comparisons = [];
  
  // Units comparison
  if (targets.minUnits) {
    const unitDiff = currentDesign.totalUnits - targets.minUnits;
    comparisons.push({
      metric: 'Total Units',
      current: currentDesign.totalUnits,
      target: targets.minUnits,
      status: unitDiff >= 0 ? 'pass' : 'fail',
      difference: unitDiff,
      percentDiff: (unitDiff / targets.minUnits) * 100,
      recommendation: unitDiff < 0 ? 
        `Add ${Math.abs(unitDiff)} more units to meet target` : 
        `Exceeds target by ${unitDiff} units`,
      impact: unitDiff < 0 ? 
        `Would add ~$${(Math.abs(unitDiff) * proForma.revenuePerUnit).toLocaleString()}/year revenue` :
        null
    });
  }
  
  // Cost per unit comparison
  if (targets.maxCostPerUnit) {
    const costDiff = proForma.costPerUnit - targets.maxCostPerUnit;
    comparisons.push({
      metric: 'Cost per Unit',
      current: proForma.costPerUnit,
      target: targets.maxCostPerUnit,
      status: costDiff <= 0 ? 'pass' : 'fail',
      difference: -costDiff,
      percentDiff: (costDiff / targets.maxCostPerUnit) * 100,
      recommendation: costDiff > 0 ? 
        `Reduce costs by $${costDiff.toLocaleString()}/unit` : 
        `Under budget by $${Math.abs(costDiff).toLocaleString()}/unit`,
      impact: costDiff > 0 ? 
        'Consider value engineering or adjusting unit mix' :
        null
    });
  }
  
  // Yield on cost comparison
  if (targets.minYieldOnCost) {
    const yieldDiff = proForma.yieldOnCost - targets.minYieldOnCost;
    comparisons.push({
      metric: 'Yield on Cost',
      current: proForma.yieldOnCost,
      target: targets.minYieldOnCost,
      status: yieldDiff >= 0 ? 'pass' : 'fail',
      difference: yieldDiff,
      percentDiff: (yieldDiff / targets.minYieldOnCost) * 100,
      recommendation: yieldDiff < 0 ? 
        `Improve yield by ${Math.abs(yieldDiff).toFixed(2)}%` : 
        `Exceeds target by ${yieldDiff.toFixed(2)}%`,
      impact: yieldDiff < 0 ? 
        `Need $${((targets.minYieldOnCost / 100 * proForma.totalDevelopmentCost) - proForma.netOperatingIncome).toLocaleString()} more NOI` :
        null,
      isPercentage: true
    });
  }
  
  // Hard cost per SF comparison
  if (targets.maxCostPerSF) {
    const currentCostPerSF = proForma.hardCosts / currentDesign.totalSquareFeet;
    const costDiff = currentCostPerSF - targets.maxCostPerSF;
    comparisons.push({
      metric: 'Hard Cost per SF',
      current: currentCostPerSF,
      target: targets.maxCostPerSF,
      status: costDiff <= 0 ? 'pass' : 'fail',
      difference: -costDiff,
      percentDiff: (costDiff / targets.maxCostPerSF) * 100,
      recommendation: costDiff > 0 ? 
        `Reduce by $${costDiff.toFixed(0)}/SF` : 
        `Under target by $${Math.abs(costDiff).toFixed(0)}/SF`,
      impact: costDiff > 0 ? 
        'Simplify design or use more cost-effective materials' :
        null
    });
  }
  
  const passCount = comparisons.filter(c => c.status === 'pass').length;
  const failCount = comparisons.filter(c => c.status === 'fail').length;
  
  // Calculate optimization potential
  const optimizationPotential = {
    additionalUnits: targets.minUnits && currentDesign.totalUnits < targets.minUnits ? 
      targets.minUnits - currentDesign.totalUnits : 0,
    costReduction: targets.maxCostPerUnit && proForma.costPerUnit > targets.maxCostPerUnit ?
      (proForma.costPerUnit - targets.maxCostPerUnit) * currentDesign.totalUnits : 0,
    yieldImprovement: targets.minYieldOnCost && proForma.yieldOnCost < targets.minYieldOnCost ?
      targets.minYieldOnCost - proForma.yieldOnCost : 0
  };
  
  return (
    <div className="comparison-view">
      <div className="comparison-header">
        <div className="header-content">
          <h3 className="text-xl font-semibold">Design vs Financial Targets</h3>
          <p className="text-gray-600">
            Optimize your design to meet financial goals
          </p>
        </div>
        <div className="summary-badges">
          <div className="badge pass">
            <CheckCircle className="w-4 h-4" />
            {passCount} Pass
          </div>
          <div className="badge fail">
            <AlertTriangle className="w-4 h-4" />
            {failCount} Need Attention
          </div>
        </div>
      </div>
      
      {/* Comparison Table */}
      <div className="comparison-table">
        {comparisons.map((comp, index) => (
          <div key={index} className={`comparison-row ${comp.status}`}>
            <div className="metric-info">
              <h4 className="metric-name">{comp.metric}</h4>
              <p className="recommendation">{comp.recommendation}</p>
              {comp.impact && (
                <p className="impact">{comp.impact}</p>
              )}
            </div>
            
            <div className="values-comparison">
              <div className="value-box current">
                <label>Current</label>
                <span className="value">
                  {comp.isPercentage ? 
                    `${comp.current.toFixed(2)}%` : 
                    comp.metric.includes('Cost') || comp.metric.includes('per') ?
                      `$${comp.current.toLocaleString()}` :
                      comp.current.toLocaleString()
                  }
                </span>
              </div>
              
              <div className="arrow">
                <ArrowRight className="w-5 h-5" />
              </div>
              
              <div className="value-box target">
                <label>Target</label>
                <span className="value">
                  {comp.isPercentage ? 
                    `${comp.target.toFixed(2)}%` : 
                    comp.metric.includes('Cost') || comp.metric.includes('per') ?
                      `$${comp.target.toLocaleString()}` :
                      comp.target.toLocaleString()
                  }
                </span>
              </div>
              
              <div className={`status-indicator ${comp.status}`}>
                {comp.status === 'pass' ? 
                  <CheckCircle className="w-6 h-6" /> : 
                  <AlertTriangle className="w-6 h-6" />
                }
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Optimization Summary */}
      {(optimizationPotential.additionalUnits > 0 || 
        optimizationPotential.costReduction > 0 || 
        optimizationPotential.yieldImprovement > 0) && (
        <div className="optimization-summary">
          <h4 className="summary-title">
            <Target className="w-5 h-5" />
            Optimization Opportunities
          </h4>
          
          <div className="opportunity-cards">
            {optimizationPotential.additionalUnits > 0 && (
              <div className="opportunity-card">
                <Building className="w-8 h-8 text-blue-500" />
                <div className="opportunity-content">
                  <h5>Add {optimizationPotential.additionalUnits} Units</h5>
                  <p>Consider increasing density or reducing unit sizes</p>
                  <span className="potential-value">
                    +${(optimizationPotential.additionalUnits * proForma.revenuePerUnit).toLocaleString()}/year
                  </span>
                </div>
              </div>
            )}
            
            {optimizationPotential.costReduction > 0 && (
              <div className="opportunity-card">
                <DollarSign className="w-8 h-8 text-green-500" />
                <div className="opportunity-content">
                  <h5>Reduce Costs</h5>
                  <p>Value engineering could save significantly</p>
                  <span className="potential-value">
                    -${optimizationPotential.costReduction.toLocaleString()} total
                  </span>
                </div>
              </div>
            )}
            
            {optimizationPotential.yieldImprovement > 0 && (
              <div className="opportunity-card">
                <TrendingUp className="w-8 h-8 text-purple-500" />
                <div className="opportunity-content">
                  <h5>Improve Yield</h5>
                  <p>Optimize revenue or reduce costs</p>
                  <span className="potential-value">
                    +{optimizationPotential.yieldImprovement.toFixed(2)}% needed
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Action Button */}
      <div className="comparison-actions">
        <button 
          onClick={onReturnToDesign}
          className="optimize-button"
        >
          <TrendingUp className="w-5 h-5" />
          Return to Design & Optimize
        </button>
      </div>
      
      <style jsx>{`
        .comparison-view {
          background: white;
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-top: 24px;
        }
        
        .comparison-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        
        .summary-badges {
          display: flex;
          gap: 12px;
        }
        
        .badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
        }
        
        .badge.pass {
          background: #d1fae5;
          color: #065f46;
        }
        
        .badge.fail {
          background: #fee2e2;
          color: #991b1b;
        }
        
        .comparison-table {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .comparison-row {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          transition: all 0.2s;
        }
        
        .comparison-row.fail {
          border-color: #fca5a5;
          background: #fef2f2;
        }
        
        .comparison-row.pass {
          border-color: #86efac;
          background: #f0fdf4;
        }
        
        .metric-info {
          margin-bottom: 16px;
        }
        
        .metric-name {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        
        .recommendation {
          font-size: 14px;
          color: #4b5563;
        }
        
        .impact {
          font-size: 13px;
          color: #6b7280;
          font-style: italic;
          margin-top: 4px;
        }
        
        .values-comparison {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .value-box {
          flex: 1;
          text-align: center;
          padding: 12px;
          background: white;
          border-radius: 6px;
        }
        
        .value-box label {
          display: block;
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }
        
        .value-box .value {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }
        
        .arrow {
          color: #9ca3af;
        }
        
        .status-indicator {
          padding: 8px;
        }
        
        .status-indicator.pass {
          color: #10b981;
        }
        
        .status-indicator.fail {
          color: #f59e0b;
        }
        
        .optimization-summary {
          margin-top: 32px;
          padding: 24px;
          background: #f0f9ff;
          border-radius: 8px;
          border: 1px solid #bfdbfe;
        }
        
        .summary-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        
        .opportunity-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        
        .opportunity-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          display: flex;
          gap: 16px;
        }
        
        .opportunity-content h5 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        
        .opportunity-content p {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 8px;
        }
        
        .potential-value {
          font-size: 14px;
          font-weight: 600;
          color: #059669;
        }
        
        .comparison-actions {
          margin-top: 24px;
          display: flex;
          justify-content: center;
        }
        
        .optimize-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .optimize-button:hover {
          background: #2563eb;
          transform: translateY(-1px);
        }
        
        @media (max-width: 768px) {
          .comparison-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }
          
          .values-comparison {
            flex-direction: column;
          }
          
          .arrow {
            transform: rotate(90deg);
          }
          
          .opportunity-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default ComparisonView;