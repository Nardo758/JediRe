import { useState } from 'react';
import { Phone, Mail, MapPin, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { leadAPI } from '@/services/api';
import { Lead } from '@/types';

interface LeadCardProps {
  lead: Lead;
  onUpdate?: (lead: Lead) => void;
  onDelete?: (leadId: string) => void;
}

export default function LeadCard({ lead, onUpdate, onDelete }: LeadCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getPriorityBadgeColor = (priority: Lead['priority']) => {
    const colors = {
      high: 'bg-red-100 text-red-800 border-red-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[priority];
  };

  const getStatusColor = (status: Lead['status']) => {
    const colors = {
      new: 'bg-blue-100 text-blue-800',
      contacted: 'bg-yellow-100 text-yellow-800',
      qualified: 'bg-purple-100 text-purple-800',
      converted: 'bg-green-100 text-green-800',
      dead: 'bg-gray-100 text-gray-800',
    };
    return colors[status];
  };

  const handleConvert = async () => {
    try {
      await leadAPI.convertToClient(lead.id);
      const updated = { ...lead, status: 'converted' as Lead['status'] };
      onUpdate?.(updated);
    } catch (error) {
      console.error('Failed to convert lead:', error);
      alert('Failed to convert lead');
    }
  };

  const handleArchive = async () => {
    if (!confirm('Archive this lead?')) return;

    try {
      await leadAPI.delete(lead.id);
      onDelete?.(lead.id);
    } catch (error) {
      console.error('Failed to archive lead:', error);
      alert('Failed to archive lead');
    }
  };

  const handleCall = () => {
    window.location.href = `tel:${lead.phone}`;
  };

  const handleEmail = () => {
    window.location.href = `mailto:${lead.email}`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900">{lead.name}</h3>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityBadgeColor(
                lead.priority
              )}`}
            >
              {lead.priority}
            </span>
          </div>
          <span
            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
              lead.status
            )}`}
          >
            {lead.status}
          </span>
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Phone className="w-4 h-4" />
          <a href={`tel:${lead.phone}`} className="hover:text-blue-600 transition-colors">
            {lead.phone}
          </a>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Mail className="w-4 h-4" />
          <a href={`mailto:${lead.email}`} className="hover:text-blue-600 transition-colors">
            {lead.email}
          </a>
        </div>
      </div>

      {/* Property Interest */}
      {lead.propertyInterest && (
        <div className="flex items-start gap-2 text-sm text-gray-600 mb-3">
          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{lead.propertyInterest}</span>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
        </div>
        <div>
          <span className="font-medium">Source:</span> {lead.source}
        </div>
        {lead.lastContact && (
          <div>
            <span className="font-medium">Last:</span>{' '}
            {new Date(lead.lastContact).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Expandable Notes */}
      {lead.notes && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-2"
          >
            {isExpanded ? 'Hide' : 'Show'} Notes
          </button>
          {isExpanded && (
            <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 mb-4">{lead.notes}</div>
          )}
        </>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleCall}
          className="flex-1 py-2 px-3 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
        >
          <Phone className="w-4 h-4" />
          Call
        </button>
        <button
          onClick={handleEmail}
          className="flex-1 py-2 px-3 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors flex items-center justify-center gap-1"
        >
          <Mail className="w-4 h-4" />
          Email
        </button>
        {lead.status !== 'converted' && (
          <button
            onClick={handleConvert}
            className="py-2 px-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
            title="Convert to Client"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleArchive}
          className="py-2 px-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
          title="Archive"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
