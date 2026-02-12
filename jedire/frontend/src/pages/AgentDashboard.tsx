import { useState } from 'react';
import { Users, Calculator, TrendingUp, UserPlus } from 'lucide-react';
import {
  LeadCapture,
  LeadList,
  CommissionCalculator,
  CommissionSummary,
  CommissionHistory,
} from '@/components/agent';

type ActiveView = 'leads' | 'calculator' | 'summary' | 'history' | 'capture';

export default function AgentDashboard() {
  const [activeView, setActiveView] = useState<ActiveView>('summary');

  const renderView = () => {
    switch (activeView) {
      case 'leads':
        return <LeadList />;
      case 'calculator':
        return <CommissionCalculator />;
      case 'summary':
        return (
          <div className="space-y-6">
            <CommissionSummary />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="lg:col-span-2">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setActiveView('capture')}
                    className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg"
                  >
                    <UserPlus className="w-8 h-8 mb-2" />
                    <div className="font-semibold">Capture Lead</div>
                  </button>
                  <button
                    onClick={() => setActiveView('calculator')}
                    className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-lg"
                  >
                    <Calculator className="w-8 h-8 mb-2" />
                    <div className="font-semibold">Calculate Commission</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'history':
        return <CommissionHistory />;
      case 'capture':
        return (
          <LeadCapture
            onClose={() => setActiveView('leads')}
            onSuccess={() => setActiveView('leads')}
          />
        );
      default:
        return <CommissionSummary />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="hidden sm:inline">Welcome back, Agent</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto py-4">
            <button
              onClick={() => setActiveView('summary')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeView === 'summary'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveView('leads')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeView === 'leads'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Users className="w-5 h-5" />
              Leads
            </button>
            <button
              onClick={() => setActiveView('calculator')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeView === 'calculator'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Calculator className="w-5 h-5" />
              Calculator
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeView === 'history'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              History
            </button>
            <button
              onClick={() => setActiveView('capture')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeView === 'capture'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <UserPlus className="w-5 h-5" />
              Capture Lead
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{renderView()}</main>
    </div>
  );
}
