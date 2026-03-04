import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Building2,
  TrendingUp,
  DollarSign,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Copy,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
} from 'lucide-react';
import api from '@/services/api';
import {
  exportToCSV,
  exportToExcel,
  copyToClipboard,
  formatOwnerDataForExport,
} from '@/services/marketResearchExport.service';

interface Owner {
  id: string;
  owner_name: string;
  properties_owned: number;
  total_units: number;
  transactions: number;
  avg_price_per_unit: number;
}

interface Stats {
  totalOwners: number;
  totalTransactions: number;
  avgTransactionSize: number;
}

type SortField = 'owner_name' | 'properties_owned' | 'total_units' | 'transactions' | 'avg_price_per_unit';
type SortOrder = 'asc' | 'desc';

export default function ActiveOwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalOwners: 0,
    totalTransactions: 0,
    avgTransactionSize: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [startYear, setStartYear] = useState('2018');
  const [endYear, setEndYear] = useState('2022');
  
  // Sorting
  const [sortBy, setSortBy] = useState<SortField>('total_units');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // UI state
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);

  useEffect(() => {
    fetchOwners();
  }, [sortBy, sortOrder, startYear, endYear]);

  const fetchOwners = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params: any = {
        sortBy,
        sortOrder,
        startYear: parseInt(startYear),
        endYear: parseInt(endYear),
      };
      
      const { data } = await api.get('/market-research/active-owners', { params });
      
      setOwners(data.owners || []);
      setStats(data.stats || stats);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load active owners');
      console.error('Error fetching owners:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc'); // Default to descending for numbers
    }
  };

  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const formatted = formatOwnerDataForExport(owners);
      exportToCSV(formatted, `active-owners-${startYear}-${endYear}-${new Date().toISOString().split('T')[0]}`);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExportLoading(true);
    try {
      const formatted = formatOwnerDataForExport(owners);
      exportToExcel(formatted, `active-owners-${startYear}-${endYear}-${new Date().toISOString().split('T')[0]}`, 'Active Owners');
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const formatted = formatOwnerDataForExport(owners);
      await copyToClipboard(formatted);
      alert('Data copied to clipboard!');
    } catch (err) {
      console.error('Copy error:', err);
      alert('Failed to copy to clipboard');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="w-4 h-4 opacity-30" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/market-research" className="text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Active Owners</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/market-research"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Building2 className="w-4 h-4 inline mr-2" />
                Properties
              </Link>
              <Link
                to="/market-research/future-supply"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Future Supply
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Owners</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalOwners.toLocaleString()}</p>
              </div>
              <Users className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTransactions.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-emerald-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Avg Transaction Size</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.avgTransactionSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-green-500" />
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Period:</label>
                <select
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {[2018, 2019, 2020, 2021, 2022].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <span className="text-gray-500">to</span>
                <select
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {[2018, 2019, 2020, 2021, 2022].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                disabled={exportLoading || owners.length === 0}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4 inline mr-1" />
                CSV
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exportLoading || owners.length === 0}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 inline mr-1" />
                Excel
              </button>
              <button
                onClick={handleCopyToClipboard}
                disabled={owners.length === 0}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Copy className="w-4 h-4 inline mr-1" />
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-lg p-12 border border-gray-200 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading active owners...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg p-12 border border-red-200 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        ) : owners.length === 0 ? (
          <div className="bg-white rounded-lg p-12 border border-gray-200 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No active owners found</h3>
            <p className="text-gray-500">Try adjusting your date range</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs font-medium text-gray-700 uppercase">
                        Rank
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('owner_name')}
                        className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase hover:text-blue-600"
                      >
                        Owner Name
                        <SortIcon field="owner_name" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('properties_owned')}
                        className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase hover:text-blue-600"
                      >
                        Properties Owned
                        <SortIcon field="properties_owned" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('total_units')}
                        className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase hover:text-blue-600"
                      >
                        Total Units
                        <SortIcon field="total_units" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('transactions')}
                        className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase hover:text-blue-600"
                      >
                        Transactions ({startYear}-{endYear})
                        <SortIcon field="transactions" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={() => handleSort('avg_price_per_unit')}
                        className="flex items-center gap-2 text-xs font-medium text-gray-700 uppercase hover:text-blue-600"
                      >
                        Avg $/Unit
                        <SortIcon field="avg_price_per_unit" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <span className="text-xs font-medium text-gray-700 uppercase">
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {owners.map((owner, index) => (
                    <tr 
                      key={owner.id} 
                      className="hover:bg-blue-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedOwner(owner)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-500">
                        #{index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {owner.owner_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {owner.properties_owned}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-blue-600">
                        {owner.total_units.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {owner.transactions}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-emerald-600">
                        ${owner.avg_price_per_unit?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOwner(owner);
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Portfolio
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Owner Detail Modal (Placeholder) */}
        {selectedOwner && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOwner(null)}>
            <div className="bg-white rounded-xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">{selectedOwner.owner_name}</h3>
                <button 
                  onClick={() => setSelectedOwner(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Properties Owned</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedOwner.properties_owned}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Total Units</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedOwner.total_units.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Transactions</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedOwner.transactions}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 mb-1">Avg $/Unit</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${selectedOwner.avg_price_per_unit?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="pt-4">
                  <p className="text-sm text-gray-500 text-center">
                    Detailed portfolio view coming soon...
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
                <button
                  onClick={() => setSelectedOwner(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
