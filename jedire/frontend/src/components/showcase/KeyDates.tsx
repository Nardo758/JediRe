import React from 'react';

interface KeyDate {
  id: string;
  title: string;
  date: string;
  status: 'completed' | 'upcoming' | 'overdue';
  critical: boolean;
  dependencies?: string[];
}

interface Props {
  dealId: string;
}

export function KeyDates({ dealId }: Props) {
  // Mock key dates
  const keyDates: KeyDate[] = [
    { id: '1', title: 'LOI Submitted', date: '2025-01-15', status: 'completed', critical: true },
    { id: '2', title: 'PSA Executed', date: '2025-01-22', status: 'completed', critical: true },
    { id: '3', title: 'Due Diligence Start', date: '2025-01-25', status: 'completed', critical: false },
    { id: '4', title: 'Property Inspection', date: '2025-02-05', status: 'completed', critical: false },
    { id: '5', title: 'Appraisal Ordered', date: '2025-02-08', status: 'completed', critical: false },
    { id: '6', title: 'Financing Commitment', date: '2025-02-20', status: 'upcoming', critical: true, dependencies: ['5'] },
    { id: '7', title: 'Due Diligence End', date: '2025-02-25', status: 'upcoming', critical: true },
    { id: '8', title: 'Final Walkthrough', date: '2025-03-10', status: 'upcoming', critical: false },
    { id: '9', title: 'Closing Date', date: '2025-03-15', status: 'upcoming', critical: true, dependencies: ['6', '7'] }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'upcoming': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `in ${diffDays} days`;
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        {/* Timeline items */}
        <div className="space-y-4">
          {keyDates.map(date => (
            <div key={date.id} className="relative flex gap-4">
              {/* Timeline dot */}
              <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-4 ${
                date.status === 'completed' ? 'bg-green-500 border-green-200' :
                date.critical ? 'bg-red-500 border-red-200' :
                'bg-blue-500 border-blue-200'
              } flex items-center justify-center`}>
                {date.status === 'completed' && (
                  <span className="text-white text-xs">✓</span>
                )}
                {date.critical && date.status !== 'completed' && (
                  <span className="text-white text-xs">!</span>
                )}
              </div>
              
              {/* Content card */}
              <div className={`flex-1 p-4 rounded-lg border-2 ${getStatusColor(date.status)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{date.title}</h4>
                      {date.critical && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">
                          Critical
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(date.date).toLocaleDateString('en-US', { 
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    {date.dependencies && date.dependencies.length > 0 && (
                      <p className="text-xs text-gray-500 mt-2">
                        Depends on: {date.dependencies.map(dep => {
                          const depDate = keyDates.find(d => d.id === dep);
                          return depDate?.title;
                        }).join(', ')}
                      </p>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${
                      date.status === 'completed' ? 'text-green-700' :
                      date.status === 'overdue' ? 'text-red-700' :
                      'text-blue-700'
                    }`}>
                      {getDaysUntil(date.date)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
