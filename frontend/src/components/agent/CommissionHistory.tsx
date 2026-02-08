import { useState, useEffect } from 'react';
import { FileText, Download, Search, Calendar } from 'lucide-react';
import { commissionAPI } from '@/services/api';
import { Commission } from '@/types';

export default function CommissionHistory() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [filteredCommissions, setFilteredCommissions] = useState<Commission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadCommissions();
  }, [yearFilter]);

  useEffect(() => {
    filterCommissions();
  }, [commissions, searchTerm, statusFilter]);

  const loadCommissions = async () => {
    setIsLoading(true);
    try {
      const data = await commissionAPI.getHistory({ year: yearFilter });
      setCommissions(data);
    } catch (error) {
      console.error('Failed to load commissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterCommissions = () => {
    let filtered = [...commissions];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (commission) =>
          commission.propertyAddress?.toLowerCase().includes(term) ||
          commission.dealId?.toLowerCase().includes(term)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((commission) => commission.status === statusFilter);
    }

    setFilteredCommissions(filtered);
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const blob = await commissionAPI.exportCSV({
        year: yearFilter,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commissions_${yearFilter}_${statusFilter}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert('Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getStatusBadge = (status: Commission['status']) => {
    const styles = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return styles[status];
  };

  const getDealTypeIcon = (type?: string) => {
    const icons = {
      sale: '🏠',
      lease: '📋',
      rental: '🔑',
    };
    return icons[type as keyof typeof icons] || '💼';
  };

  // Generate year options (current year and 5 years back)
  const yearOptions = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  const totalCommissions = filteredCommissions.reduce((sum, c) => sum + c.netCommission, 0);
  const paidCommissions = filteredCommissions
    .filter((c) => c.status === 'paid')
    .reduce((sum, c) => sum + c.netCommission, 0);
  const pendingCommissions = filteredCommissions
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + c.netCommission, 0);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Commission History</h2>
          <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
            {filteredCommissions.length}
          </span>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={isExporting || filteredCommissions.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-sm text-blue-700 font-medium mb-1">Total</div>
          <div className="text-2xl font-bold text-blue-900">{formatCurrency(totalCommissions)}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-sm text-green-700 font-medium mb-1">Paid</div>
          <div className="text-2xl font-bold text-green-900">{formatCurrency(paidCommissions)}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="text-sm text-yellow-700 font-medium mb-1">Pending</div>
          <div className="text-2xl font-bold text-yellow-900">
            {formatCurrency(pendingCommissions)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Search & Year */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by property address or deal ID..."
              aria-label="Search commissions"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(parseInt(e.target.value))}
              aria-label="Filter by year"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          {['all', 'paid', 'pending'].map((status) => (
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Property</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Deal Value</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Rate</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Split</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Gross</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">Net</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredCommissions.map((commission) => (
              <tr key={commission.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-600">
                  {commission.datePaid
                    ? new Date(commission.datePaid).toLocaleDateString()
                    : new Date(commission.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <div className="text-sm font-medium text-gray-900">
                    {commission.propertyAddress || 'N/A'}
                  </div>
                  {commission.dealId && (
                    <div className="text-xs text-gray-500">ID: {commission.dealId}</div>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className="text-lg" title={commission.dealType}>
                    {getDealTypeIcon(commission.dealType)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-sm font-medium text-gray-900">
                  {formatCurrency(commission.dealValue)}
                </td>
                <td className="py-3 px-4 text-right text-sm text-gray-600">
                  {commission.commissionRate.toFixed(1)}%
                </td>
                <td className="py-3 px-4 text-right text-sm text-gray-600">
                  {commission.splitPercentage.toFixed(0)}%
                </td>
                <td className="py-3 px-4 text-right text-sm text-gray-900">
                  {formatCurrency(commission.grossCommission)}
                </td>
                <td className="py-3 px-4 text-right text-sm font-semibold text-blue-900">
                  {formatCurrency(commission.netCommission)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                      commission.status
                    )}`}
                  >
                    {commission.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredCommissions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No commissions found. Try adjusting your filters.
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {filteredCommissions.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {filteredCommissions.length} commission
              {filteredCommissions.length !== 1 ? 's' : ''}
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">Total Net Commissions</div>
              <div className="text-2xl font-bold text-blue-900">{formatCurrency(totalCommissions)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
