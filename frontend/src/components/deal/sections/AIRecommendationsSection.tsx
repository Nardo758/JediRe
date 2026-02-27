import React, { useState } from 'react';
import { Lightbulb, TrendingUp, Building2, DollarSign, Clock, CheckCircle, X, ChevronRight, Zap, AlertTriangle } from 'lucide-react';

interface AIRecommendationsSectionProps {
  deal?: any;
  onUpdate?: () => void;
  onBack?: () => void;
}

type Priority = 'high' | 'medium' | 'low';
type Category = 'design' | 'financial' | 'market' | 'timing' | 'acquisition';
type Status = 'new' | 'applied' | 'dismissed' | 'reviewing';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  impact: string;
  confidence: number;
  status: Status;
  actions: string[];
  timestamp: string;
}

const mockRecommendations: Recommendation[] = [
  {
    id: 'rec-1',
    title: 'Neighboring Property: 127 Main St just listed',
    description: 'Adjacent parcel available at $3.8M. Acquiring would add 52 units to your development, increasing economies of scale and improving IRR by 3.8%.',
    category: 'acquisition',
    priority: 'high',
    impact: '+52 units, +3.8% IRR',
    confidence: 92,
    status: 'new',
    actions: ['View Analysis', 'Draft LOI', 'Contact Owner'],
    timestamp: '2 hours ago',
  },
  {
    id: 'rec-2',
    title: 'Optimize unit mix: Increase 1BR allocation',
    description: 'Market demand data shows 1BR waitlists at 3 competing properties. Shifting from 35% to 45% 1BR would increase projected NOI by $185K annually.',
    category: 'design',
    priority: 'high',
    impact: '+$185K NOI/year',
    confidence: 88,
    status: 'new',
    actions: ['Apply to Model', 'View Data'],
    timestamp: '5 hours ago',
  },
  {
    id: 'rec-3',
    title: 'Supply gap window detected: Q2 2026',
    description: 'Only 125 units delivering in Q2 2026 vs 450/quarter average. Accelerating your timeline by 2 months could capture a 2.5% rent premium during this window.',
    category: 'timing',
    priority: 'high',
    impact: '+2.5% rent premium',
    confidence: 85,
    status: 'new',
    actions: ['Accelerate Timeline', 'View Supply Data'],
    timestamp: '1 day ago',
  },
  {
    id: 'rec-4',
    title: 'Add coworking amenity for $125/unit premium',
    description: 'Market analysis shows 65% adoption at competing properties with coworking. 2,000 SF coworking space would generate $125/unit monthly premium at 85% of the cost of comparable amenities.',
    category: 'design',
    priority: 'medium',
    impact: '+$125/unit/month',
    confidence: 82,
    status: 'reviewing',
    actions: ['Add to 3D Model', 'See Analysis'],
    timestamp: '2 days ago',
  },
  {
    id: 'rec-5',
    title: 'Design efficiency below market: 82% vs 87%',
    description: 'Your current floor plate efficiency is 82%, while best-in-class developments achieve 87%. Optimizing corridor layouts could add $165K to annual NOI without increasing construction costs.',
    category: 'design',
    priority: 'medium',
    impact: '+$165K NOI/year',
    confidence: 78,
    status: 'new',
    actions: ['View Suggestions', 'Apply Changes'],
    timestamp: '3 days ago',
  },
  {
    id: 'rec-6',
    title: 'Consider mezz financing for higher equity IRR',
    description: 'Adding a mezzanine layer (15% of capital stack at 12%) would reduce equity required by $12.5M and increase equity IRR from 14.2% to 16.8%.',
    category: 'financial',
    priority: 'medium',
    impact: '+2.6% equity IRR',
    confidence: 90,
    status: 'applied',
    actions: ['View Debt Stack'],
    timestamp: '5 days ago',
  },
];

const categoryConfig: Record<Category, { icon: React.ReactNode; label: string; color: string }> = {
  design: { icon: <Building2 size={14} />, label: 'Design', color: 'bg-purple-100 text-purple-700' },
  financial: { icon: <DollarSign size={14} />, label: 'Financial', color: 'bg-green-100 text-green-700' },
  market: { icon: <TrendingUp size={14} />, label: 'Market', color: 'bg-blue-100 text-blue-700' },
  timing: { icon: <Clock size={14} />, label: 'Timing', color: 'bg-orange-100 text-orange-700' },
  acquisition: { icon: <Zap size={14} />, label: 'Acquisition', color: 'bg-red-100 text-red-700' },
};

export const AIRecommendationsSection: React.FC<AIRecommendationsSectionProps> = ({ deal }) => {
  const [filter, setFilter] = useState<'all' | Priority>('all');
  const [recommendations, setRecommendations] = useState(mockRecommendations);

  const filtered = filter === 'all'
    ? recommendations
    : recommendations.filter(r => r.priority === filter);

  const stats = {
    total: recommendations.length,
    applied: recommendations.filter(r => r.status === 'applied').length,
    actionRequired: recommendations.filter(r => r.status === 'new' && r.priority === 'high').length,
    successRate: 87,
  };

  const handleDismiss = (id: string) => {
    setRecommendations(prev => prev.map(r => r.id === id ? { ...r, status: 'dismissed' as Status } : r));
  };

  const handleApply = (id: string) => {
    setRecommendations(prev => prev.map(r => r.id === id ? { ...r, status: 'applied' as Status } : r));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">AI Recommendations</h2>
          <p className="text-sm text-slate-500">Intelligent suggestions based on your deal data and market conditions</p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'high', 'medium', 'low'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                filter === f
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-xs text-slate-500 mt-1">Total Recommendations</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-red-600">{stats.actionRequired}</div>
          <div className="text-xs text-slate-500 mt-1">Action Required</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-green-600">{stats.applied}</div>
          <div className="text-xs text-slate-500 mt-1">Applied</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.successRate}%</div>
          <div className="text-xs text-slate-500 mt-1">Success Rate</div>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.filter(r => r.status !== 'dismissed').map(rec => {
          const catConfig = categoryConfig[rec.category];
          return (
            <div
              key={rec.id}
              className={`bg-white rounded-xl border p-5 transition-all ${
                rec.priority === 'high' && rec.status === 'new'
                  ? 'border-red-200 shadow-sm'
                  : rec.status === 'applied'
                    ? 'border-green-200 bg-green-50/30'
                    : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {rec.priority === 'high' && rec.status === 'new' && (
                      <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle size={12} /> Action Required
                      </span>
                    )}
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${catConfig.color}`}>
                      {catConfig.icon} {catConfig.label}
                    </span>
                    <span className="text-xs text-slate-400">{rec.timestamp}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">{rec.title}</h3>
                  <p className="text-sm text-slate-600 mb-3">{rec.description}</p>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                      Impact: {rec.impact}
                    </span>
                    <span className="text-xs text-slate-500">
                      Confidence: {rec.confidence}%
                    </span>
                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${rec.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>
                {rec.status !== 'applied' && (
                  <button
                    onClick={() => handleDismiss(rec.id)}
                    className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                {rec.status === 'applied' ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                    <CheckCircle size={14} /> Applied
                  </span>
                ) : (
                  rec.actions.map(action => (
                    <button
                      key={action}
                      onClick={() => action.includes('Apply') ? handleApply(rec.id) : undefined}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                        action.includes('Apply') || action.includes('Draft') || action.includes('Accelerate')
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {action} <ChevronRight size={12} />
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-yellow-500" />
            <span className="text-sm font-medium text-slate-700">AI Learning Metrics</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-3">
          <div className="text-center">
            <div className="text-lg font-bold text-slate-900">47</div>
            <div className="text-xs text-slate-500">Recommendations Made</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-slate-900">38</div>
            <div className="text-xs text-slate-500">Acted Upon</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">87%</div>
            <div className="text-xs text-slate-500">Success Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIRecommendationsSection;
