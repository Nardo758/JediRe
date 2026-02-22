import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  TrendingUp, 
  Calculator, 
  Send,
  Building,
  Car,
  Layers
} from 'lucide-react';
import DesignToFinancialService from './DesignToFinancialService';
import { Design3D } from './Design3D';

interface FinancialSummaryPanelProps {
  design3D: Design3D;
  className?: string;
}

export const FinancialSummaryPanel: React.FC<FinancialSummaryPanelProps> = ({
  design3D,
  className = ''
}) => {
  const navigate = useNavigate();
  const [quickEstimates, setQuickEstimates] = useState({
    hardCosts: 0,
    totalCost: 0,
    estimatedNOI: 0,
    yieldOnCost: 0,
    costPerUnit: 0
  });
  const [isCalculating, setIsCalculating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  const service = new DesignToFinancialService();
  
  // Calculate quick estimates when design changes
  useEffect(() => {
    const calculateEstimates = async () => {
      try {
        const inputs = await service.exportDesignData(design3D);
        const proForma = service.calculateProForma(inputs);
        
        setQuickEstimates({
          hardCosts: proForma.hardCosts,
          totalCost: proForma.totalDevelopmentCost,
          estimatedNOI: proForma.netOperatingIncome,
          yieldOnCost: proForma.yieldOnCost,
          costPerUnit: proForma.costPerUnit
        });
      } catch (error) {
        console.error('Failed to calculate estimates:', error);
      }
    };
    
    if (design3D) {
      calculateEstimates();
    }
  }, [design3D]);
  
  const handleSendToFinancial = async () => {
    setIsCalculating(true);
    try {
      // Export design data
      const financialInputs = await service.exportDesignData(design3D);
      
      // Store in session for Financial section to pick up
      sessionStorage.setItem('designImportData', JSON.stringify({
        inputs: financialInputs,
        designId: design3D.getId(),
        timestamp: new Date().toISOString()
      }));
      
      // Navigate to financial section
      navigate('/app/financial?source=design');
    } catch (error) {
      console.error('Failed to export to financial:', error);
      // Show error toast
    } finally {
      setIsCalculating(false);
    }
  };
  
  const formatCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };
  
  const buildingMetrics = design3D?.getBuildingMetrics();
  
  return (
    <div className={`financial-summary-panel ${className}`}>
      {/* Header */}
      <div className="panel-header">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Quick Financial Estimate
        </h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-gray-600 hover:text-gray-800"
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
      </div>
      
      {/* Building Summary */}
      <div className="building-summary">
        <div className="metric-row">
          <Building className="w-4 h-4 text-gray-500" />
          <span>{buildingMetrics?.totalUnits || 0} Units</span>
          <span className="text-gray-500">•</span>
          <span>{(buildingMetrics?.totalSF || 0).toLocaleString()} SF</span>
        </div>
        <div className="metric-row">
          <Layers className="w-4 h-4 text-gray-500" />
          <span>{buildingMetrics?.stories || 0} Stories</span>
          <span className="text-gray-500">•</span>
          <Car className="w-4 h-4 text-gray-500" />
          <span>{buildingMetrics?.parkingSpaces || 0} Parking</span>
        </div>
      </div>
      
      {/* Key Estimates */}
      <div className="estimates-grid">
        <div className="estimate-card">
          <div className="label">Total Dev Cost</div>
          <div className="value text-2xl font-bold">
            {formatCurrency(quickEstimates.totalCost)}
          </div>
          <div className="sublabel">
            {formatCurrency(quickEstimates.costPerUnit)}/unit
          </div>
        </div>
        
        <div className="estimate-card">
          <div className="label">Estimated NOI</div>
          <div className="value text-2xl font-bold text-green-600">
            {formatCurrency(quickEstimates.estimatedNOI)}
          </div>
          <div className="sublabel">Annual</div>
        </div>
        
        <div className="estimate-card">
          <div className="label">Yield on Cost</div>
          <div className="value text-2xl font-bold flex items-center gap-1">
            {quickEstimates.yieldOnCost.toFixed(1)}%
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div className="sublabel">
            {quickEstimates.yieldOnCost >= 6.0 ? 'Strong' : 'Review'}
          </div>
        </div>
      </div>
      
      {/* Detailed Breakdown */}
      {showDetails && (
        <div className="details-section">
          <h4 className="font-medium mb-2">Cost Breakdown</h4>
          <div className="breakdown-list">
            <div className="breakdown-item">
              <span>Hard Costs</span>
              <span>{formatCurrency(quickEstimates.hardCosts)}</span>
            </div>
            <div className="breakdown-item">
              <span>Soft Costs (25%)</span>
              <span>{formatCurrency(quickEstimates.hardCosts * 0.25)}</span>
            </div>
            <div className="breakdown-item">
              <span>Land (estimated)</span>
              <span>{formatCurrency(quickEstimates.totalCost - quickEstimates.hardCosts * 1.25)}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="panel-actions">
        <button
          onClick={handleSendToFinancial}
          disabled={isCalculating}
          className="primary-button"
        >
          {isCalculating ? (
            <>
              <div className="spinner" />
              Calculating...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send to Financial Model
            </>
          )}
        </button>
        
        <button 
          onClick={() => navigate('/app/financial')}
          className="secondary-button"
        >
          <Calculator className="w-4 h-4" />
          Open Financial
        </button>
      </div>
      
      {/* Disclaimer */}
      <div className="disclaimer">
        <p className="text-xs text-gray-500">
          * Estimates based on market averages. Full financial model provides detailed analysis.
        </p>
      </div>
      
      <style jsx>{`
        .financial-summary-panel {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .building-summary {
          background: #f9fafb;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
        }
        
        .metric-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        
        .metric-row:last-child {
          margin-bottom: 0;
        }
        
        .estimates-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }
        
        .estimate-card {
          text-align: center;
          padding: 16px;
          background: #f0f9ff;
          border-radius: 8px;
          border: 1px solid #e0f2fe;
        }
        
        .estimate-card .label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }
        
        .estimate-card .value {
          margin-bottom: 4px;
        }
        
        .estimate-card .sublabel {
          font-size: 11px;
          color: #9ca3af;
        }
        
        .details-section {
          background: #f9fafb;
          padding: 16px;
          border-radius: 6px;
          margin-bottom: 20px;
        }
        
        .breakdown-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .breakdown-item {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
        }
        
        .panel-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }
        
        .primary-button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .primary-button:hover:not(:disabled) {
          background: #2563eb;
        }
        
        .primary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .secondary-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: white;
          color: #4b5563;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .secondary-button:hover {
          background: #f9fafb;
        }
        
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .disclaimer {
          padding-top: 12px;
          border-top: 1px solid #e5e7eb;
        }
        
        @media (max-width: 768px) {
          .estimates-grid {
            grid-template-columns: 1fr;
          }
          
          .panel-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default FinancialSummaryPanel;