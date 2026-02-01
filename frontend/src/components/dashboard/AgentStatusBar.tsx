import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface AgentStatus {
  name: string;
  icon: string;
  confidence: number;
  status: 'green' | 'yellow' | 'red';
}

interface AgentStatusBarProps {
  agents?: AgentStatus[];
  alert?: string;
}

const defaultAgents: AgentStatus[] = [
  { name: 'Supply', icon: '🏠', confidence: 92, status: 'green' },
  { name: 'Demand', icon: '📈', confidence: 88, status: 'green' },
  { name: 'News', icon: '📰', confidence: 75, status: 'yellow' },
  { name: 'Debt', icon: '💰', confidence: 91, status: 'green' },
  { name: 'SF Str', icon: '🏘️', confidence: 95, status: 'green' },
  { name: 'Cash', icon: '💵', confidence: 89, status: 'green' },
];

export default function AgentStatusBar({ agents = defaultAgents, alert }: AgentStatusBarProps) {
  const [expanded, setExpanded] = useState(false);

  const getStatusColor = (status: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
    }
  };

  const getStatusBg = (status: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green': return 'bg-green-50 border-green-200';
      case 'yellow': return 'bg-yellow-50 border-yellow-200';
      case 'red': return 'bg-red-50 border-red-200';
    }
  };

  return (
    <div className="bg-white border-t border-gray-200">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agent Status</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {expanded ? 'Collapse' : 'Details'}
          </button>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {agents.map((agent) => (
            <div
              key={agent.name}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getStatusBg(agent.status)} transition-all`}
            >
              <span className="text-base">{agent.icon}</span>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-700">{agent.name}</span>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                  <span className="text-xs font-bold text-gray-800">{agent.confidence}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {alert && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700">{alert}</span>
          </div>
        )}
      </div>
    </div>
  );
}
