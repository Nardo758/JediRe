import { 
  Mail, 
  Phone, 
  Calendar, 
  TrendingUp, 
  Edit, 
  Trash2,
  DollarSign
} from 'lucide-react';
import { Client } from '@/types/agent';
import { Link } from 'react-router-dom';

interface ClientCardProps {
  client: Client;
  onEdit?: (client: Client) => void;
  onDelete?: (id: string) => void;
}

export default function ClientCard({ client, onEdit, onDelete }: ClientCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'archived': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'buyer': return '🏠';
      case 'seller': return '💰';
      case 'both': return '🔄';
      default: return '👤';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow relative">
      {/* Status Badge */}
      <div className="absolute top-4 right-4">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getStatusColor(client.status)}`}>
          {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
        </span>
      </div>

      {/* Client Info */}
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
          {client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {client.name}
            </h3>
            <span className="text-xl" title={client.type}>
              {getTypeIcon(client.type)}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            {client.type.charAt(0).toUpperCase() + client.type.slice(1)}
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Mail className="w-4 h-4 text-gray-400" />
          <a href={`mailto:${client.email}`} className="hover:text-blue-600 truncate">
            {client.email}
          </a>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Phone className="w-4 h-4 text-gray-400" />
          <a href={`tel:${client.phone}`} className="hover:text-blue-600">
            {client.phone}
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4 pt-4 border-t border-gray-100">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <span className="text-lg font-bold text-gray-900">
              {client.dealsCount || 0}
            </span>
          </div>
          <div className="text-xs text-gray-600">Deals</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-lg font-bold text-gray-900">
              {client.totalValue ? formatCurrency(client.totalValue) : '$0'}
            </span>
          </div>
          <div className="text-xs text-gray-600">Total Value</div>
        </div>
      </div>

      {/* Last Contact */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>Last contact: {formatDate(client.lastContact)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          to={`/agent/clients/${client.id}`}
          className="flex-1 py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors text-center"
        >
          View Details
        </Link>
        <button
          onClick={() => onEdit && onEdit(client)}
          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          title="Edit client"
        >
          <Edit className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={() => onDelete && onDelete(client.id)}
          className="p-2 border border-gray-300 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
          title="Delete client"
        >
          <Trash2 className="w-4 h-4 text-gray-600 hover:text-red-600" />
        </button>
      </div>

      {/* Notes Preview */}
      {client.notes && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-600 line-clamp-2">
            <span className="font-medium">Note:</span> {client.notes}
          </p>
        </div>
      )}
    </div>
  );
}
