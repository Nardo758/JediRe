import { useState, useEffect } from 'react';
import { 
  Users, 
  TrendingUp, 
  Bell, 
  DollarSign, 
  UserPlus, 
  FileText, 
  Target,
  Activity,
  ArrowUpRight
} from 'lucide-react';
import { agentAPI } from '@/services/agentApi';
import { AgentStats, ActivityItem } from '@/types/agent';
import { Link } from 'react-router-dom';

export default function AgentDashboard() {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, activityData] = await Promise.all([
        agentAPI.getStats(),
        agentAPI.getActivity(10)
      ]);
      setStats(statsData);
      setActivity(activityData);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (hours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'client_added': return <UserPlus className="w-4 h-4" />;
      case 'deal_updated': return <TrendingUp className="w-4 h-4" />;
      case 'lead_created': return <Target className="w-4 h-4" />;
      case 'commission_received': return <DollarSign className="w-4 h-4" />;
      case 'note_added': return <FileText className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'client_added': return 'bg-blue-100 text-blue-600';
      case 'deal_updated': return 'bg-green-100 text-green-600';
      case 'lead_created': return 'bg-purple-100 text-purple-600';
      case 'commission_received': return 'bg-emerald-100 text-emerald-600';
      case 'note_added': return 'bg-amber-100 text-amber-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading dashboard</p>
          <p className="text-sm mt-1">{error}</p>
          <button 
            onClick={loadDashboardData}
            className="mt-3 text-sm font-medium hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Agent Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's your overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Clients */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-green-600 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              {stats?.monthlyStats.newClients || 0} this month
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats?.totalClients || 0}</div>
          <div className="text-sm text-gray-600 mt-1">Total Clients</div>
        </div>

        {/* Active Deals */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs font-medium text-blue-600 flex items-center gap-1">
              {stats?.activeDeals || 0} in pipeline
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats?.activeDeals || 0}</div>
          <div className="text-sm text-gray-600 mt-1">Active Deals</div>
        </div>

        {/* Pending Leads */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bell className="w-6 h-6 text-purple-600" />
            </div>
            <Link 
              to="/agent/leads" 
              className="text-xs font-medium text-purple-600 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats?.pendingLeads || 0}</div>
          <div className="text-sm text-gray-600 mt-1">Pending Leads</div>
        </div>

        {/* Commission YTD */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              {((stats?.commissionYTD || 0) / 12).toFixed(0)}% YoY
            </span>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {formatCurrency(stats?.commissionYTD || 0)}
          </div>
          <div className="text-sm text-gray-600 mt-1">Commission YTD</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/agent/clients/new"
            className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group"
          >
            <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
              <UserPlus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900">Add Client</div>
              <div className="text-sm text-gray-600">Create new client profile</div>
            </div>
          </Link>

          <Link
            to="/agent/deals/new"
            className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors group"
          >
            <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900">Create Deal</div>
              <div className="text-sm text-gray-600">Start a new transaction</div>
            </div>
          </Link>

          <Link
            to="/agent/leads/new"
            className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors group"
          >
            <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
              <Target className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900">Capture Lead</div>
              <div className="text-sm text-gray-600">Add new lead prospect</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <Link to="/agent/activity" className="text-sm font-medium text-blue-600 hover:underline">
            View all
          </Link>
        </div>

        {activity.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No recent activity</p>
            <p className="text-sm text-gray-500 mt-1">Your activity will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activity.map((item) => (
              <div key={item.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`p-2 rounded-lg ${getActivityColor(item.type)}`}>
                  {getActivityIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{item.description}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(item.timestamp)}</p>
                </div>
                {item.relatedEntityId && (
                  <Link
                    to={`/agent/${item.relatedEntityType}/${item.relatedEntityId}`}
                    className="text-xs font-medium text-blue-600 hover:underline whitespace-nowrap"
                  >
                    View
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/agent/clients"
          className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 hover:shadow-md transition-shadow group"
        >
          <Users className="w-8 h-8 text-blue-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Manage Clients</h3>
          <p className="text-sm text-gray-600">View and manage your client database</p>
          <div className="mt-3 text-sm font-medium text-blue-600 group-hover:underline">
            Go to Clients →
          </div>
        </Link>

        <Link
          to="/agent/deals"
          className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 hover:shadow-md transition-shadow group"
        >
          <TrendingUp className="w-8 h-8 text-green-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Deal Pipeline</h3>
          <p className="text-sm text-gray-600">Track and manage your active deals</p>
          <div className="mt-3 text-sm font-medium text-green-600 group-hover:underline">
            Go to Deals →
          </div>
        </Link>

        <Link
          to="/agent/analytics"
          className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200 hover:shadow-md transition-shadow group"
        >
          <Activity className="w-8 h-8 text-purple-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Analytics</h3>
          <p className="text-sm text-gray-600">View performance metrics and reports</p>
          <div className="mt-3 text-sm font-medium text-purple-600 group-hover:underline">
            Go to Analytics →
          </div>
        </Link>
      </div>
    </div>
  );
}
