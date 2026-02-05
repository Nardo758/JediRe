import { useState } from 'react';
import { Deal, DealActivity, DealStage } from '@/types';
import {
  X,
  Edit,
  Archive,
  Flag,
  DollarSign,
  User,
  Calendar,
  MapPin,
  TrendingUp,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface DealDetailModalProps {
  deal: Deal;
  onClose: () => void;
  onEdit: (deal: Deal) => void;
  onUpdateStage: (dealId: string, newStage: DealStage) => Promise<void>;
  onArchive: (dealId: string) => Promise<void>;
  onAddNote: (dealId: string, note: string) => Promise<void>;
}

const stageConfig: Record<DealStage, { label: string; color: string; icon: any }> = {
  lead: { label: 'Lead', color: 'bg-gray-100 text-gray-700', icon: FileText },
  qualified: { label: 'Qualified', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  under_contract: { label: 'Under Contract', color: 'bg-yellow-100 text-yellow-700', icon: FileText },
  closed: { label: 'Closed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  lost: { label: 'Lost', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const activityTypeLabels: Record<DealActivity['type'], string> = {
  stage_change: 'Stage Changed',
  note_added: 'Note Added',
  value_updated: 'Value Updated',
  created: 'Created',
  archived: 'Archived',
};

export default function DealDetailModal({
  deal,
  onClose,
  onEdit,
  onUpdateStage,
  onArchive,
  onAddNote,
}: DealDetailModalProps) {
  const [newNote, setNewNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isChangingStage, setIsChangingStage] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleStageChange = async (newStage: DealStage) => {
    if (newStage === deal.stage) return;
    
    setIsChangingStage(true);
    try {
      await onUpdateStage(deal.id, newStage);
    } finally {
      setIsChangingStage(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsSubmittingNote(true);
    try {
      await onAddNote(deal.id, newNote);
      setNewNote('');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const StageIcon = stageConfig[deal.stage].icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <StageIcon className="w-5 h-5" />
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${stageConfig[deal.stage].color}`}>
                  {stageConfig[deal.stage].label}
                </span>
                {deal.priority !== 'low' && (
                  <Flag className={`w-4 h-4 ${
                    deal.priority === 'high' ? 'text-red-300' : 'text-yellow-300'
                  }`} />
                )}
              </div>
              <h2 className="text-2xl font-bold">{deal.propertyAddress}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm opacity-90">
            <span>{deal.dealType.toUpperCase()} SIDE</span>
            <span>•</span>
            <span>{deal.daysInStage} days in stage</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 mb-1 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  Deal Value
                </div>
                <div className="text-2xl font-bold text-blue-900">
                  {formatCurrency(deal.dealValue)}
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 mb-1 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Commission
                </div>
                <div className="text-2xl font-bold text-green-900">
                  {formatCurrency(deal.commissionEstimate)}
                </div>
                <div className="text-xs text-green-700 mt-1">
                  {deal.commissionRate}% rate
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-600 mb-1 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Days Active
                </div>
                <div className="text-2xl font-bold text-purple-900">
                  {Math.floor((new Date().getTime() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24))}
                </div>
              </div>
            </div>

            {/* Client Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-5 h-5" />
                Client Information
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Name</span>
                  <span className="font-medium text-blue-600">{deal.clientName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Client ID</span>
                  <span className="font-mono text-xs text-gray-500">{deal.clientId}</span>
                </div>
              </div>
            </div>

            {/* Timeline Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Timeline
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Created</span>
                  <span className="font-medium">
                    {format(new Date(deal.createdAt), 'MMM d, yyyy')}
                  </span>
                </div>
                {deal.expectedCloseDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Expected Close</span>
                    <span className="font-medium text-yellow-600">
                      {format(new Date(deal.expectedCloseDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {deal.actualCloseDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Closed</span>
                    <span className="font-medium text-green-600">
                      {format(new Date(deal.actualCloseDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {deal.notes && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Notes
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{deal.notes}</p>
              </div>
            )}

            {/* Stage Update */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Update Stage</h3>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(stageConfig) as DealStage[]).map(stage => {
                  const config = stageConfig[stage];
                  const Icon = config.icon;
                  const isCurrent = stage === deal.stage;
                  
                  return (
                    <button
                      key={stage}
                      onClick={() => handleStageChange(stage)}
                      disabled={isCurrent || isChangingStage}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                        transition-all border-2
                        ${isCurrent
                          ? config.color + ' border-current'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Activity Timeline */}
            {deal.activities && deal.activities.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Activity Timeline</h3>
                <div className="space-y-3">
                  {deal.activities.map((activity) => (
                    <div key={activity.id} className="flex gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-medium">{activityTypeLabels[activity.type]}</span>
                            <span className="text-gray-600 ml-2">by {activity.userName}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-gray-600 mt-1">{activity.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Note */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Add Note</h3>
              <form onSubmit={handleAddNote} className="space-y-3">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note to this deal..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 resize-none"
                  disabled={isSubmittingNote}
                />
                <button
                  type="submit"
                  disabled={!newNote.trim() || isSubmittingNote}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isSubmittingNote ? 'Adding...' : 'Add Note'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex gap-3">
          <button
            onClick={() => onEdit(deal)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit Deal
          </button>
          <button
            onClick={() => onArchive(deal.id)}
            className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}
