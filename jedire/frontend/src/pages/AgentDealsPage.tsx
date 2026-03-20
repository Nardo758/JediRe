/**
 * Agent Deals Page
 * 
 * Full-page component for the Deal Pipeline.
 * This can be integrated into your React Router setup.
 */

import { DealPipeline } from '@/components/agent/deals';

export default function AgentDealsPage() {
  return (
    <div className="h-screen overflow-hidden">
      <DealPipeline apiBaseUrl="/api/agent" />
    </div>
  );
}
