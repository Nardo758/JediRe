import React, { useState } from 'react';
import { BuildingSection, CompletionMetrics, DrawSchedule } from '../../types/construction';

interface DrawScheduleViewProps {
  sections: BuildingSection[];
  metrics: CompletionMetrics;
  onClose: () => void;
}

// Mock draw schedule data
const MOCK_DRAWS: DrawSchedule[] = [
  {
    id: 'draw-1',
    drawNumber: 1,
    requestedAmount: 2500000,
    approvedAmount: 2500000,
    paidAmount: 2500000,
    requestDate: '2024-01-15',
    approvalDate: '2024-01-20',
    paymentDate: '2024-01-25',
    status: 'paid',
    linkedSections: ['floor-1', 'floor-2'],
    workDescription: 'Foundation and site work complete',
    inspectionRequired: true,
    inspectionDate: '2024-01-18',
  },
  {
    id: 'draw-2',
    drawNumber: 2,
    requestedAmount: 3200000,
    approvedAmount: 3200000,
    paidAmount: 3200000,
    requestDate: '2024-03-01',
    approvalDate: '2024-03-05',
    paymentDate: '2024-03-10',
    status: 'paid',
    linkedSections: ['floor-3', 'floor-4'],
    workDescription: 'Structural framing floors 3-4',
    inspectionRequired: true,
    inspectionDate: '2024-03-03',
  },
  {
    id: 'draw-3',
    drawNumber: 3,
    requestedAmount: 2800000,
    approvedAmount: 2600000,
    paidAmount: 0,
    requestDate: '2024-05-15',
    approvalDate: '2024-05-20',
    status: 'approved',
    linkedSections: ['floor-5'],
    workDescription: 'Floor 5 framing and MEP rough-in',
    inspectionRequired: true,
    inspectionDate: '2024-05-18',
    notes: 'Approved with $200k holdback for MEP coordination issues',
  },
  {
    id: 'draw-4',
    drawNumber: 4,
    requestedAmount: 4500000,
    approvedAmount: 0,
    paidAmount: 0,
    requestDate: '2024-07-01',
    status: 'pending',
    linkedSections: ['floor-6', 'floor-7', 'floor-8'],
    workDescription: 'Floors 6-8 structural completion',
    inspectionRequired: true,
  },
];

const STATUS_STYLES = {
  paid: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-300',
    icon: '✅',
  },
  approved: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    icon: '👍',
  },
  pending: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
    icon: '⏳',
  },
  rejected: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    icon: '❌',
  },
};

export const DrawScheduleView: React.FC<DrawScheduleViewProps> = ({
  sections,
  metrics,
  onClose,
}) => {
  const [selectedDraw, setSelectedDraw] = useState<DrawSchedule | null>(null);
  const [view, setView] = useState<'list' | '3d'>('list');

  const totalRequested = MOCK_DRAWS.reduce((sum, d) => sum + d.requestedAmount, 0);
  const totalApproved = MOCK_DRAWS.reduce((sum, d) => sum + (d.approvedAmount || 0), 0);
  const totalPaid = MOCK_DRAWS.reduce((sum, d) => sum + d.paidAmount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Pending';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getSectionColor = (sectionId: string, draw: DrawSchedule) => {
    if (draw.status === 'paid') return '#10B981'; // green-500
    if (draw.status === 'approved') return '#F59E0B'; // amber-500
    return '#9CA3AF'; // gray-400
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">💰 Draw Schedule</h2>
              <p className="text-sm text-gray-600 mt-1">Construction financing draws and payments</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Summary Metrics */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium">Total Requested</div>
              <div className="text-2xl font-bold text-blue-900 mt-1">{formatCurrency(totalRequested)}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium">Total Paid</div>
              <div className="text-2xl font-bold text-green-900 mt-1">{formatCurrency(totalPaid)}</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <div className="text-sm text-amber-600 font-medium">Pending Payment</div>
              <div className="text-2xl font-bold text-amber-900 mt-1">{formatCurrency(totalApproved - totalPaid)}</div>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                view === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 List View
            </button>
            <button
              onClick={() => setView('3d')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                view === '3d'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🏗️ 3D Progress Map
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === 'list' ? (
            /* List View */
            <div className="space-y-4">
              {MOCK_DRAWS.map((draw) => {
                const style = STATUS_STYLES[draw.status];
                return (
                  <div
                    key={draw.id}
                    onClick={() => setSelectedDraw(selectedDraw?.id === draw.id ? null : draw)}
                    className={`
                      border-2 rounded-lg p-4 cursor-pointer transition
                      ${selectedDraw?.id === draw.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                      }
                    `}
                  >
                    {/* Draw Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${style.bg} ${style.text} ${style.border}`}>
                          {style.icon} Draw #{draw.drawNumber}
                        </div>
                        <h3 className="font-semibold text-gray-900">{draw.workDescription}</h3>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">{formatCurrency(draw.requestedAmount)}</div>
                        {draw.approvedAmount !== draw.requestedAmount && draw.approvedAmount && (
                          <div className="text-sm text-gray-600">Approved: {formatCurrency(draw.approvedAmount)}</div>
                        )}
                      </div>
                    </div>

                    {/* Draw Details */}
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">Requested</div>
                        <div className="font-medium text-gray-900">{formatDate(draw.requestDate)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Approved</div>
                        <div className="font-medium text-gray-900">{formatDate(draw.approvalDate)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Paid</div>
                        <div className="font-medium text-gray-900">{formatDate(draw.paymentDate)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">Inspection</div>
                        <div className="font-medium text-gray-900">
                          {draw.inspectionRequired 
                            ? draw.inspectionDate ? `✓ ${formatDate(draw.inspectionDate)}` : '⏳ Required'
                            : 'N/A'
                          }
                        </div>
                      </div>
                    </div>

                    {/* Linked Sections */}
                    <div className="mt-3">
                      <div className="text-xs text-gray-600 mb-1">Linked Sections:</div>
                      <div className="flex flex-wrap gap-2">
                        {draw.linkedSections.map(sectionId => {
                          const section = sections.find(s => s.id === sectionId);
                          return section ? (
                            <span
                              key={sectionId}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium"
                            >
                              {section.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>

                    {/* Notes */}
                    {draw.notes && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-900">
                        <strong>Note:</strong> {draw.notes}
                      </div>
                    )}

                    {/* Expanded Details */}
                    {selectedDraw?.id === draw.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center gap-3">
                          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                            📄 View Documents
                          </button>
                          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium">
                            📊 Payment Details
                          </button>
                          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium">
                            📸 View Progress Photos
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* 3D Progress Map View */
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🏗️</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">3D Progress Visualization</h3>
                <p className="text-gray-600 mb-6">
                  Visual representation of paid vs unpaid work by building section
                </p>
                
                {/* Draw Status by Section */}
                <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
                  {sections.slice(0, 12).map(section => {
                    const relatedDraws = MOCK_DRAWS.filter(d => d.linkedSections.includes(section.id));
                    const isPaid = relatedDraws.some(d => d.status === 'paid');
                    const isApproved = relatedDraws.some(d => d.status === 'approved');
                    
                    return (
                      <div
                        key={section.id}
                        className={`
                          p-4 rounded-lg border-2 transition
                          ${isPaid 
                            ? 'bg-green-100 border-green-500' 
                            : isApproved 
                            ? 'bg-amber-100 border-amber-500'
                            : 'bg-gray-100 border-gray-300'
                          }
                        `}
                      >
                        <div className="font-semibold text-gray-900">{section.name}</div>
                        <div className="text-sm mt-1">
                          {isPaid && '✅ Paid'}
                          {!isPaid && isApproved && '⏳ Approved'}
                          {!isPaid && !isApproved && '⏸️ Pending'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded" />
                    <span>Paid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-amber-500 rounded" />
                    <span>Approved/Unpaid</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-400 rounded" />
                    <span>Not Yet Requested</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {MOCK_DRAWS.filter(d => d.status === 'paid').length} of {MOCK_DRAWS.length} draws completed
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
