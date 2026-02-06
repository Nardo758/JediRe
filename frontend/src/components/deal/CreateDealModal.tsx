import React, { useState } from 'react';
import { MapBuilder } from '../map/MapBuilder';
import { Button } from '../shared/Button';
import { useDealStore } from '../../stores/dealStore';

interface CreateDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDealCreated: (deal: any) => void;
}

enum Step {
  DRAW_BOUNDARY = 1,
  DESCRIBE_INTENT = 2
}

export const CreateDealModal: React.FC<CreateDealModalProps> = ({
  isOpen,
  onClose,
  onDealCreated
}) => {
  const { createDeal, error: storeError } = useDealStore();
  const [step, setStep] = useState<Step>(Step.DRAW_BOUNDARY);
  const [boundary, setBoundary] = useState<any>(null);
  const [area, setArea] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form data
  const [dealData, setDealData] = useState({
    name: '',
    projectType: 'multifamily',
    projectIntent: '',
    targetUnits: '',
    budget: '',
    timelineStart: '',
    timelineEnd: ''
  });

  if (!isOpen) return null;

  const handleBoundaryDrawn = (geom: any, acres: number) => {
    setBoundary(geom);
    setArea(acres);
  };

  const handleNext = () => {
    if (step === Step.DRAW_BOUNDARY && boundary) {
      setStep(Step.DESCRIBE_INTENT);
    }
  };

  const handleBack = () => {
    setStep(Step.DRAW_BOUNDARY);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const payload = {
        name: dealData.name,
        boundary,
        projectType: dealData.projectType,
        projectIntent: dealData.projectIntent || undefined,
        targetUnits: dealData.targetUnits ? parseInt(dealData.targetUnits) : undefined,
        budget: dealData.budget ? parseFloat(dealData.budget) : undefined,
        timelineStart: dealData.timelineStart || undefined,
        timelineEnd: dealData.timelineEnd || undefined
      };

      const newDeal = await createDeal(payload);
      onDealCreated(newDeal);
      onClose();
      
      // Reset form
      setStep(Step.DRAW_BOUNDARY);
      setBoundary(null);
      setDealData({
        name: '',
        projectType: 'multifamily',
        projectIntent: '',
        targetUnits: '',
        budget: '',
        timelineStart: '',
        timelineEnd: ''
      });
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to create deal';
      setError(errorMsg);
      
      // Show alert for deal limit
      if (err.response?.data?.error === 'DEAL_LIMIT_REACHED') {
        alert(errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {step === Step.DRAW_BOUNDARY ? 'Draw Your Deal Boundary' : 'Describe Your Deal'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {step === Step.DRAW_BOUNDARY 
                ? 'Step 1 of 2: Define the geographic area' 
                : 'Step 2 of 2: Add project details'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {step === Step.DRAW_BOUNDARY && (
            <div className="h-[600px]">
              <MapBuilder
                onBoundaryDrawn={handleBoundaryDrawn}
                mode="create"
              />
            </div>
          )}

          {step === Step.DESCRIBE_INTENT && (
            <div className="p-6 space-y-6">
              {/* Boundary Summary */}
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  ✓ Boundary confirmed: <strong>{area.toFixed(1)} acres</strong>
                </p>
              </div>

              {/* Deal Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deal Name *
                </label>
                <input
                  type="text"
                  value={dealData.name}
                  onChange={(e) => setDealData({ ...dealData, name: e.target.value })}
                  placeholder="e.g., Buckhead Tower"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Project Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Type *
                </label>
                <select
                  value={dealData.projectType}
                  onChange={(e) => setDealData({ ...dealData, projectType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="multifamily">Multifamily</option>
                  <option value="mixed_use">Mixed-Use</option>
                  <option value="office">Office</option>
                  <option value="retail">Retail</option>
                  <option value="industrial">Industrial</option>
                  <option value="land">Land</option>
                </select>
              </div>

              {/* Project Intent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Intent
                </label>
                <textarea
                  value={dealData.projectIntent}
                  onChange={(e) => setDealData({ ...dealData, projectIntent: e.target.value })}
                  placeholder="Describe your vision: unit mix, target demographic, amenities, timeline..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  AI will use this to configure your deal modules and analysis
                </p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Units
                  </label>
                  <input
                    type="number"
                    value={dealData.targetUnits}
                    onChange={(e) => setDealData({ ...dealData, targetUnits: e.target.value })}
                    placeholder="200"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget ($)
                  </label>
                  <input
                    type="number"
                    value={dealData.budget}
                    onChange={(e) => setDealData({ ...dealData, budget: e.target.value })}
                    placeholder="50000000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timeline Start
                  </label>
                  <input
                    type="date"
                    value={dealData.timelineStart}
                    onChange={(e) => setDealData({ ...dealData, timelineStart: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timeline End
                  </label>
                  <input
                    type="date"
                    value={dealData.timelineEnd}
                    onChange={(e) => setDealData({ ...dealData, timelineEnd: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-t border-red-200">
            <p className="text-sm text-red-800">
              ⚠️ {error}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="flex gap-2">
            {step === Step.DESCRIBE_INTENT && (
              <Button
                variant="secondary"
                onClick={handleBack}
              >
                ← Back
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            
            {step === Step.DRAW_BOUNDARY ? (
              <Button
                onClick={handleNext}
                disabled={!boundary}
              >
                Next: Describe →
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!dealData.name || isSubmitting}
                loading={isSubmitting}
              >
                Create Deal
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
