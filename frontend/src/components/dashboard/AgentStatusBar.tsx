import React from 'react';

export function AgentStatusBar() {
  const agents = [
    { name: 'Property Search', status: 'completed', progress: 100, emoji: '🔍' },
    { name: 'Strategy Arbitrage', status: 'running', progress: 78, emoji: '🎯' },
    { name: 'Zoning Analysis', status: 'idle', progress: 0, emoji: '📋' },
    { name: 'Cash Flow', status: 'idle', progress: 0, emoji: '💰' },
  ];

  return (
    <div className="bg-white border-t border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">🤖 Agent Status:</span>
        </div>
        
        <div className="flex items-center gap-6">
          {agents.map((agent) => (
            <div key={agent.name} className="flex items-center gap-2">
              <span>{agent.emoji}</span>
              <div>
                <div className="text-xs font-medium text-gray-700">{agent.name}</div>
                <div className="flex items-center gap-2">
                  {agent.status === 'completed' && (
                    <span className="text-xs text-green-600">✓ Complete</span>
                  )}
                  {agent.status === 'running' && (
                    <>
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${agent.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-blue-600">{agent.progress}%</span>
                    </>
                  )}
                  {agent.status === 'idle' && (
                    <span className="text-xs text-gray-400">Idle</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button className="px-3 py-1 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50">
            View All
          </button>
          <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
            Manage Agents
          </button>
        </div>
      </div>
    </div>
  );
}
