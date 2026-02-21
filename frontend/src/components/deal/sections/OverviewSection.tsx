/**
 * Overview Section - Deal Page
 * Progress dashboard showing analysis status, strategy results, and quick stats
 */

import React, { useEffect, useState } from 'react';
import { ActionStatusPanel } from '../ActionStatusPanel';
import { StrategyAnalysisResults } from '../StrategyAnalysisResults';
import {
  dealAnalysisService,
  AnalysisStatus,
  StrategyResults,
} from '@/services/dealAnalysis.service';

interface OverviewSectionProps {
  deal: any;
  onStrategySelected?: (strategyId: string) => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  deal,
  onStrategySelected,
}) => {
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>({
    phase: 'initializing',
    progress: 0,
    message: 'Initializing analysis...',
  });
  const [strategyResults, setStrategyResults] = useState<StrategyResults | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    if (!deal?.id) return;

    let stopPolling: (() => void) | undefined;

    const runAnalysis = async () => {
      stopPolling = await startAnalysis();
    };
    runAnalysis();

    return () => {
      stopPolling?.();
    };
  }, [deal?.id]);

  const startAnalysis = async (): Promise<(() => void) | undefined> => {
    try {
      const existingAnalysis = await dealAnalysisService.getLatestAnalysis(deal.id);

      if (existingAnalysis) {
        setStrategyResults(existingAnalysis);
        setAnalysisComplete(true);
        setAnalysisStatus({
          phase: 'complete',
          progress: 100,
          message: 'Analysis complete',
        });
        return;
      }

      setAnalysisStatus({
        phase: 'initializing',
        progress: 0,
        message: 'Starting analysis...',
      });

      await dealAnalysisService.triggerAnalysis(deal.id);

      const stopPolling = dealAnalysisService.pollAnalysisStatus(
        deal.id,
        (status) => {
          setAnalysisStatus(status);
        },
        (results) => {
          setStrategyResults(results);
          setAnalysisComplete(true);
        },
        2000
      );

      return stopPolling;
    } catch (error) {
      console.error('Failed to start analysis:', error);
      setAnalysisError((error as Error).message);
      setAnalysisStatus({
        phase: 'error',
        progress: 0,
        message: 'Failed to start analysis',
        error: (error as Error).message,
      });
    }
  };

  const handleStrategySelection = (strategyId: string) => {
    console.log('Strategy selected:', strategyId);
    onStrategySelected?.(strategyId);
  };

  const handleAnalysisComplete = () => {
    setAnalysisComplete(true);
  };

  return (
    <div className="space-y-6">
      {!analysisComplete && (
        <ActionStatusPanel
          status={analysisStatus}
          dealType={deal.developmentType || 'Development'}
          propertyType={deal.propertyTypeKey || 'Multifamily'}
          onComplete={handleAnalysisComplete}
        />
      )}

      {strategyResults && (
        <StrategyAnalysisResults
          results={strategyResults}
          dealType={deal.developmentType || 'Development'}
          onChooseStrategy={handleStrategySelection}
        />
      )}

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Properties"
          value={deal.propertyCount || '0'}
          icon="🏢"
          color="blue"
        />
        <StatCard
          title="Budget"
          value={
            deal.budget
              ? `$${(deal.budget / 1000000).toFixed(1)}M`
              : 'Not set'
          }
          icon="💰"
          color="green"
        />
        <StatCard
          title="Status"
          value={deal.pipelineStage?.replace('_', ' ') || 'Active'}
          icon="📊"
          color="purple"
        />
        <StatCard
          title="Timeline"
          value={
            deal.daysInStage
              ? `${deal.daysInStage} days`
              : 'Just started'
          }
          icon="⏱️"
          color="orange"
        />
      </div>

      <RecentActivityCard deal={deal} />

      <KeyContactsCard deal={deal} />

      <QuickActionsCard deal={deal} />
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  };

  return (
    <div
      className={`rounded-lg border-2 p-4 ${colorClasses[color]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-75">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
};

interface RecentActivityCardProps {
  deal: any;
}

const RecentActivityCard: React.FC<RecentActivityCardProps> = ({ deal }) => {
  const activities = [
    {
      action: 'Deal created',
      time: 'Today',
      user: 'You',
      icon: '✨',
    },
    {
      action: 'Analysis started',
      time: 'Just now',
      user: 'System',
      icon: '🔍',
    },
  ];

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Recent Activity
      </h3>
      <div className="space-y-3">
        {activities.map((activity, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <div className="text-2xl">{activity.icon}</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {activity.action}
              </p>
              <p className="text-xs text-gray-600">
                {activity.user} • {activity.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface KeyContactsCardProps {
  deal: any;
}

const KeyContactsCard: React.FC<KeyContactsCardProps> = ({ deal }) => {
  const contacts = [
    {
      name: 'Deal Owner',
      role: 'Primary Contact',
      email: 'owner@example.com',
      avatar: '👤',
    },
  ];

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Key Contacts
      </h3>
      <div className="space-y-3">
        {contacts.map((contact, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className="text-3xl">{contact.avatar}</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {contact.name}
              </p>
              <p className="text-xs text-gray-600">{contact.role}</p>
            </div>
            <a
              href={`mailto:${contact.email}`}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Contact
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

interface QuickActionsCardProps {
  deal: any;
}

const QuickActionsCard: React.FC<QuickActionsCardProps> = ({ deal }) => {
  const actions = [
    { label: 'Find Properties', icon: '🔍', disabled: false },
    { label: 'Run Analysis', icon: '📊', disabled: false },
    { label: 'Generate Report', icon: '📄', disabled: true },
    { label: 'Share Deal', icon: '🔗', disabled: true },
  ];

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, idx) => (
          <button
            key={idx}
            disabled={action.disabled}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors ${
              action.disabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-2 border-blue-200'
            }`}
          >
            <span className="text-xl">{action.icon}</span>
            <span className="text-sm">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default OverviewSection;
