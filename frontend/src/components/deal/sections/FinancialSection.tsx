import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft,
  RefreshCw,
  Download,
  Upload,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Target
} from 'lucide-react';
import DesignToFinancialService from './DesignToFinancialService';
import ComparisonView from './ComparisonView';
import { FinancialInputs, ProForma } from './DesignToFinancialService';

interface FinancialSectionProps {
  projectId: string;
}

export const FinancialSection: React.FC<FinancialSectionProps> = ({ projectId }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isImported, setIsImported] = useState(false);
  const [importedData, setImportedData] = useState<FinancialInputs | null>(null);
  const [proForma, setProForma] = useState<ProForma | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [financialTargets, setFinancialTargets] = useState({
    minUnits: 100,
    maxCostPerUnit: 350000,
    minYieldOnCost: 6.0,
    maxCostPerSF: 250
  });
  
  const service = new DesignToFinancialService();
  
  // Check if arriving from Design Dashboard
  useEffect(() => {
    const source = searchParams.get('source');
    if (source === 'design') {
      const storedData = sessionStorage.getItem('designImportData');
      if (storedData) {
        const { inputs, designId, timestamp } = JSON.parse(storedData);
        setImportedData(inputs);
        setIsImported(true);
        
        // Calculate pro forma
        const calculatedProForma = service.calculateProForma(inputs);
        setProForma(calculatedProForma);
        
        // Clear session storage
        sessionStorage.removeItem('designImportData');
        
        // Store the link between design and financial
        service.linkDesignToFinancial(designId, projectId);
      }
    }
  }, [searchParams]);
  
  const handleReturnToDesign = async () => {
    const designId = await service.getSourceDesignId(projectId);
    if (designId) {
      // Pass financial targets back to design
      sessionStorage.setItem('financialTargets', JSON.stringify({
        targets: financialTargets,
        currentProForma: proForma,
        timestamp: new Date().toISOString()
      }));
      
      navigate(`/app/design/${designId}?source=financial`);
    } else {
      navigate('/app/design');
    }
  };
  
  const handleRecalculateFromDesign = async () => {
    const designId = await service.getSourceDesignId(projectId);
    if (designId) {
      // Re-fetch design data
      // In production, this would call an API to get latest design data
      alert('Fetching latest design data...');
    }
  };
  
  const renderImportBanner = () => {
    if (!isImported) return null;
    
    return (
      <div className="import-banner">
        <div className="banner-content">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div className="banner-text">
            <h4 className="font-medium">Design Data Imported</h4>
            <p className="text-sm text-gray-600">
              Financial model populated with data from Design Dashboard
            </p>
          </div>
        </div>
        <button 
          onClick={handleReturnToDesign}
          className="return-button"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Design
        </button>
      </div>
    );
  };
  
  const renderImportedValues = () => {
    if (!importedData) return null;
    
    return (
      <div className="imported-values-section">
        <div className="section-header">
          <h3 className="text-lg font-semibold">Design Parameters</h3>
          <button 
            onClick={handleRecalculateFromDesign}
            className="refresh-button"
          >
            <RefreshCw className="w-4 h-4" />
            Recalculate from Design
          </button>
        </div>
        
        <div className="values-grid">
          <div className="value-card imported">
            <label>Total Units</label>
            <input 
              type="number" 
              value={importedData.totalUnits}
              readOnly
              className="imported-input"
            />
          </div>
          
          <div className="value-card imported">
            <label>Total Square Feet</label>
            <input 
              type="number" 
              value={importedData.totalSquareFeet}
              readOnly
              className="imported-input"
            />
          </div>
          
          <div className="value-card imported">
            <label>Parking Spaces</label>
            <input 
              type="number" 
              value={importedData.parkingSpaces}
              readOnly
              className="imported-input"
            />
          </div>
          
          <div className="value-card imported">
            <label>Building Efficiency</label>
            <input 
              type="text" 
              value={`${(importedData.efficiency * 100).toFixed(1)}%`}
              readOnly
              className="imported-input"
            />
          </div>
        </div>
      </div>
    );
  };
  
  const renderProForma = () => {
    if (!proForma) return null;
    
    return (
      <div className="proforma-section">
        <h3 className="text-xl font-semibold mb-4">Financial Summary</h3>
        
        <div className="proforma-grid">
          {/* Revenue Section */}
          <div className="proforma-card">
            <h4 className="card-title">Revenue</h4>
            <div className="metric-list">
              <div className="metric">
                <span>Gross Potential Rent</span>
                <span>${proForma.grossPotentialRent.toLocaleString()}</span>
              </div>
              <div className="metric">
                <span>Effective Gross Income</span>
                <span>${proForma.effectiveGrossIncome.toLocaleString()}</span>
              </div>
              <div className="metric">
                <span>Other Income</span>
                <span>${proForma.otherIncome.toLocaleString()}</span>
              </div>
              <div className="metric total">
                <span>Total Revenue</span>
                <span>${proForma.totalRevenue.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          {/* Costs Section */}
          <div className="proforma-card">
            <h4 className="card-title">Development Costs</h4>
            <div className="metric-list">
              <div className="metric">
                <span>Hard Costs</span>
                <span>${proForma.hardCosts.toLocaleString()}</span>
              </div>
              <div className="metric">
                <span>Soft Costs</span>
                <span>${proForma.softCosts.toLocaleString()}</span>
              </div>
              <div className="metric">
                <span>Land Cost</span>
                <span>${proForma.landCost.toLocaleString()}</span>
              </div>
              <div className="metric total">
                <span>Total Dev Cost</span>
                <span>${proForma.totalDevelopmentCost.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          {/* Returns Section */}
          <div className="proforma-card">
            <h4 className="card-title">Returns</h4>
            <div className="metric-list">
              <div className="metric">
                <span>Net Operating Income</span>
                <span>${proForma.netOperatingIncome.toLocaleString()}</span>
              </div>
              <div className="metric highlight">
                <span>Yield on Cost</span>
                <span className={proForma.yieldOnCost >= 6.0 ? 'text-green-600' : 'text-orange-600'}>
                  {proForma.yieldOnCost.toFixed(2)}%
                </span>
              </div>
              <div className="metric">
                <span>Profit Margin</span>
                <span>{proForma.profitMargin.toFixed(1)}%</span>
              </div>
              <div className="metric">
                <span>Cost per Unit</span>
                <span>${proForma.costPerUnit.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  const renderTargetsSection = () => {
    return (
      <div className="targets-section">
        <div className="section-header">
          <h3 className="text-lg font-semibold">Financial Targets</h3>
          <button 
            onClick={() => setShowComparison(!showComparison)}
            className="compare-button"
          >
            <Target className="w-4 h-4" />
            {showComparison ? 'Hide' : 'Show'} Comparison
          </button>
        </div>
        
        <div className="targets-grid">
          <div className="target-input">
            <label>Min Units</label>
            <input 
              type="number"
              value={financialTargets.minUnits}
              onChange={(e) => setFinancialTargets({
                ...financialTargets,
                minUnits: parseInt(e.target.value)
              })}
            />
          </div>
          
          <div className="target-input">
            <label>Max Cost/Unit</label>
            <input 
              type="number"
              value={financialTargets.maxCostPerUnit}
              onChange={(e) => setFinancialTargets({
                ...financialTargets,
                maxCostPerUnit: parseInt(e.target.value)
              })}
            />
          </div>
          
          <div className="target-input">
            <label>Min Yield on Cost (%)</label>
            <input 
              type="number"
              step="0.1"
              value={financialTargets.minYieldOnCost}
              onChange={(e) => setFinancialTargets({
                ...financialTargets,
                minYieldOnCost: parseFloat(e.target.value)
              })}
            />
          </div>
          
          <div className="target-input">
            <label>Max Hard Cost/SF</label>
            <input 
              type="number"
              value={financialTargets.maxCostPerSF}
              onChange={(e) => setFinancialTargets({
                ...financialTargets,
                maxCostPerSF: parseInt(e.target.value)
              })}
            />
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="financial-section">
      {renderImportBanner()}
      
      <div className="section-content">
        {renderImportedValues()}
        {renderProForma()}
        {renderTargetsSection()}
        
        {showComparison && importedData && (
          <ComparisonView 
            currentDesign={importedData}
            proForma={proForma!}
            targets={financialTargets}
            onReturnToDesign={handleReturnToDesign}
          />
        )}
      </div>
      
      <style jsx>{`
        .financial-section {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
        }
        
        .import-banner {
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .banner-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .return-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .return-button:hover {
          background: #f9fafb;
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .refresh-button, .compare-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .refresh-button:hover, .compare-button:hover {
          background: #f9fafb;
        }
        
        .imported-values-section, .proforma-section, .targets-section {
          background: white;
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .values-grid, .targets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 16px;
        }
        
        .value-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .value-card.imported {
          position: relative;
        }
        
        .value-card label {
          font-size: 14px;
          font-weight: 500;
          color: #4b5563;
        }
        
        .imported-input {
          background: #dbeafe;
          border: 2px solid #3b82f6;
          color: #1e40af;
          padding: 10px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 500;
        }
        
        .value-card input:not(.imported-input) {
          padding: 10px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 16px;
        }
        
        .proforma-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 20px;
        }
        
        .proforma-card {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
        }
        
        .card-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
          color: #111827;
        }
        
        .metric-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .metric {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
        }
        
        .metric.total {
          padding-top: 10px;
          border-top: 1px solid #e5e7eb;
          font-weight: 600;
        }
        
        .metric.highlight span:last-child {
          font-weight: 600;
        }
        
        .target-input {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .target-input label {
          font-size: 14px;
          font-weight: 500;
          color: #4b5563;
        }
        
        .target-input input {
          padding: 10px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 16px;
        }
      `}</style>
    </div>
  );
};

export default FinancialSection;