import { useState, useEffect } from 'react';
import { Users, Search, ArrowUpDown, CheckCircle2, XCircle } from 'lucide-react';
import { leadAPI } from '@/services/api';
import { Lead } from '@/types';
import LeadCard from './LeadCard';

type SortField = 'createdAt' | 'priority' | 'status' | 'name';
type SortDirection = 'asc' | 'desc';

export default function LeadList() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Lead['status'] | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    filterAndSortLeads();
  }, [leads, searchTerm, statusFilter, sortField, sortDirection]);

  const loadLeads = async () => {
    setIsLoading(true);
    try {
      const data = await leadAPI.list();
      setLeads(data);
    } catch (error) {
      console.error('Failed to load leads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortLeads = () => {
    let filtered = [...leads];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.name.toLowerCase().includes(term) ||
          lead.email.toLowerCase().includes(term) ||
          lead.phone.includes(term)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle priority sorting
      if (sortField === 'priority') {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        aValue = priorityOrder[a.priority];
        bValue = priorityOrder[b.priority];
      }

      // Handle date sorting
      if (sortField === 'createdAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredLeads(filtered);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleLeadUpdate = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead)));
  };

  const handleLeadDelete = (leadId: string) => {
    setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
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

  const getPriorityColor = (priority: Lead['priority']) => {
    const colors = {
      high: 'text-red-600',
      medium: 'text-yellow-600',
      low: 'text-gray-600',
    };
    return colors[priority];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Leads</h2>
          <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
            {filteredLeads.length}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'new', 'contacted', 'qualified', 'converted', 'dead'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table View (Desktop) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
                >
                  Name
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </th>
              <th className="text-left py-3 px-4">Contact</th>
              <th className="text-left py-3 px-4">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
                >
                  Status
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </th>
              <th className="text-left py-3 px-4">
                <button
                  onClick={() => handleSort('priority')}
                  className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
                >
                  Priority
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </th>
              <th className="text-left py-3 px-4">Source</th>
              <th className="text-left py-3 px-4">
                <button
                  onClick={() => handleSort('createdAt')}
                  className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
                >
                  Created
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead) => (
              <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium text-gray-900">{lead.name}</td>
                <td className="py-3 px-4">
                  <div className="text-sm">
                    <div className="text-gray-900">{lead.phone}</div>
                    <div className="text-gray-500">{lead.email}</div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      lead.status
                    )}`}
                  >
                    {lead.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={`font-medium ${getPriorityColor(lead.priority)}`}>
                    {lead.priority}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">{lead.source}</td>
                <td className="py-3 px-4 text-sm text-gray-600">
                  {new Date(lead.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    {lead.status !== 'converted' && (
                      <button
                        onClick={() => {
                          leadAPI.convertToClient(lead.id).then(() => {
                            handleLeadUpdate({ ...lead, status: 'converted' });
                          });
                        }}
                        className="p-1 hover:bg-green-100 rounded transition-colors"
                        title="Convert to client"
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('Archive this lead?')) {
                          leadAPI.delete(lead.id).then(() => {
                            handleLeadDelete(lead.id);
                          });
                        }
                      }}
                      className="p-1 hover:bg-red-100 rounded transition-colors"
                      title="Archive lead"
                    >
                      <XCircle className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredLeads.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No leads found. Try adjusting your filters.
          </div>
        )}
      </div>

      {/* Card View (Mobile) */}
      <div className="md:hidden space-y-4">
        {filteredLeads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onUpdate={handleLeadUpdate}
            onDelete={handleLeadDelete}
          />
        ))}

        {filteredLeads.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No leads found. Try adjusting your filters.
          </div>
        )}
      </div>
    </div>
  );
}
