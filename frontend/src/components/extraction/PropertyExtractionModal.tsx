/**
 * PropertyExtractionModal - Review properties extracted from emails
 * 
 * Allows users to quickly review, approve, or reject property extractions
 * from automated email parsing.
 * 
 * @version 1.0.0
 * @date 2026-02-05
 */

import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Mail, Calendar, MapPin, Home, DollarSign, TrendingUp, Users, CheckCircle, XCircle, SkipForward, Eye } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ExtractedProperty {
  id: string;
  emailId: string;
  
  // Email context
  emailFrom: string;
  emailSubject: string;
  emailDate: string;
  emailBody?: string;
  
  // Property details
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  propertyType: string;
  units?: number;
  yearBuilt?: number;
  price?: number;
  capRate?: number;
  occupancy?: number;
  
  // Location
  lat?: number;
  lng?: number;
  
  // Match scoring
  matchScore: number; // 0-100
  matchReasons: string[];
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  extractedAt: string;
}

export interface PropertyExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: ExtractedProperty[];
  onApprove: (property: ExtractedProperty) => Promise<void>;
  onReject: (property: ExtractedProperty) => Promise<void>;
  onSkip: (property: ExtractedProperty) => void;
}

// ============================================================================
// Component
// ============================================================================

export const PropertyExtractionModal: React.FC<PropertyExtractionModalProps> = ({
  isOpen,
  onClose,
  properties,
  onApprove,
  onReject,
  onSkip,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFullEmail, setShowFullEmail] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentProperty = properties[currentIndex];
  const hasNext = currentIndex < properties.length - 1;
  const hasPrevious = currentIndex > 0;

  // Reset index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setShowFullEmail(false);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && hasNext) handleNext();
      if (e.key === 'ArrowLeft' && hasPrevious) handlePrevious();
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, currentIndex, hasNext, hasPrevious]);

  // Handlers
  const handleNext = () => {
    if (hasNext) {
      setCurrentIndex(currentIndex + 1);
      setShowFullEmail(false);
    }
  };

  const handlePrevious = () => {
    if (hasPrevious) {
      setCurrentIndex(currentIndex - 1);
      setShowFullEmail(false);
    }
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await onApprove(currentProperty);
      if (hasNext) {
        handleNext();
      } else {
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject(currentProperty);
      if (hasNext) {
        handleNext();
      } else {
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = () => {
    onSkip(currentProperty);
    if (hasNext) {
      handleNext();
    } else {
      onClose();
    }
  };

  if (!isOpen || !currentProperty) return null;

  // Match score color
  const getMatchColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMatchBg = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Property Review
              </h2>
              <p className="text-sm text-gray-500">
                {currentIndex + 1} of {properties.length}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Email Context */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail size={16} />
                <span className="font-medium">From:</span>
                <span>{currentProperty.emailFrom}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar size={16} />
                <span className="font-medium">Received:</span>
                <span>{new Date(currentProperty.emailDate).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Eye size={16} />
                <span className="font-medium">Subject:</span>
                <span className="italic">"{currentProperty.emailSubject}"</span>
              </div>
            </div>

            {/* Property Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Home size={20} />
                Property Details
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Address</label>
                  <p className="text-gray-900">{currentProperty.address}</p>
                  {currentProperty.city && (
                    <p className="text-sm text-gray-500">
                      {currentProperty.city}, {currentProperty.state} {currentProperty.zip}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Property Type</label>
                  <p className="text-gray-900">{currentProperty.propertyType}</p>
                </div>

                {currentProperty.units && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Units</label>
                    <p className="text-gray-900 flex items-center gap-1">
                      <Users size={16} />
                      {currentProperty.units} units
                    </p>
                  </div>
                )}

                {currentProperty.yearBuilt && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Year Built</label>
                    <p className="text-gray-900">{currentProperty.yearBuilt}</p>
                  </div>
                )}

                {currentProperty.price && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Price</label>
                    <p className="text-gray-900 flex items-center gap-1">
                      <DollarSign size={16} />
                      ${(currentProperty.price / 1000000).toFixed(2)}M
                    </p>
                  </div>
                )}

                {currentProperty.capRate && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Cap Rate</label>
                    <p className="text-gray-900 flex items-center gap-1">
                      <TrendingUp size={16} />
                      {currentProperty.capRate}%
                    </p>
                  </div>
                )}

                {currentProperty.occupancy && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Occupancy</label>
                    <p className="text-gray-900">{currentProperty.occupancy}%</p>
                  </div>
                )}
              </div>
            </div>

            {/* Match Score */}
            <div className={`${getMatchBg(currentProperty.matchScore)} rounded-lg p-4`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-lg font-semibold ${getMatchColor(currentProperty.matchScore)}`}>
                  Match Score: {currentProperty.matchScore}%
                </h3>
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${currentProperty.matchScore >= 80 ? 'bg-green-600' : currentProperty.matchScore >= 60 ? 'bg-yellow-600' : 'bg-red-600'}`}
                    style={{ width: `${currentProperty.matchScore}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700 mb-2">Why it matches:</p>
                {currentProperty.matchReasons.map((reason, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Map Preview */}
            {currentProperty.lat && currentProperty.lng && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin size={20} />
                  Location
                </h3>
                <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center">
                  <p className="text-gray-500">
                    Map preview: {currentProperty.lat.toFixed(4)}, {currentProperty.lng.toFixed(4)}
                  </p>
                  {/* TODO: Integrate actual map component (Mapbox/Google Maps) */}
                </div>
              </div>
            )}

            {/* Full Email */}
            <div>
              <button
                onClick={() => setShowFullEmail(!showFullEmail)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                <Mail size={16} />
                {showFullEmail ? 'Hide' : 'View'} Full Email
              </button>

              {showFullEmail && currentProperty.emailBody && (
                <div className="mt-3 bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {currentProperty.emailBody}
                </div>
              )}
            </div>
          </div>

          {/* Actions Footer */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
            {/* Action Buttons */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handleSkip}
                disabled={isProcessing}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <SkipForward size={16} className="inline mr-2" />
                Skip
              </button>

              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="px-6 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <XCircle size={18} />
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="px-6 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle size={18} />
                  Add to Map
                </button>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
              <button
                onClick={handlePrevious}
                disabled={!hasPrevious}
                className="flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed hover:text-gray-900 transition-colors"
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <span className="font-medium">
                {currentIndex + 1} / {properties.length}
              </span>

              <button
                onClick={handleNext}
                disabled={!hasNext}
                className="flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed hover:text-gray-900 transition-colors"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Keyboard Hints */}
            <div className="mt-3 text-xs text-gray-400 text-center">
              ← → arrows to navigate • ESC to close
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PropertyExtractionModal;
