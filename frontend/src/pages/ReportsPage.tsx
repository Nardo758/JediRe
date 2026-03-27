import React from 'react';
import { BT } from '@/components/deal/bloomberg-ui';

export function ReportsPage() {
  return (
    <div className="p-6" style={{ background: BT.bg.terminal, minHeight: '100vh' }}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" style={{ color: BT.text.primary }}>Reports & Analytics</h1>
        <p style={{ color: BT.text.secondary }}>Generate insights and track performance</p>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Quick Reports */}
        <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <h2 className="font-semibold mb-4" style={{ color: BT.text.primary }}>📊 Quick Reports</h2>
          <div className="space-y-3">
            <button className="w-full text-left px-4 py-3" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0, background: BT.bg.panelAlt, color: BT.text.primary }}>
              <div className="font-medium">Portfolio Summary</div>
              <div className="text-sm" style={{ color: BT.text.secondary }}>Overview of all properties</div>
            </button>
            <button className="w-full text-left px-4 py-3" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0, background: BT.bg.panelAlt, color: BT.text.primary }}>
              <div className="font-medium">Market Analysis</div>
              <div className="text-sm" style={{ color: BT.text.secondary }}>Submarket trends and insights</div>
            </button>
            <button className="w-full text-left px-4 py-3" style={{ border: `1px solid ${BT.border.subtle}`, borderRadius: 0, background: BT.bg.panelAlt, color: BT.text.primary }}>
              <div className="font-medium">Deal Performance</div>
              <div className="text-sm" style={{ color: BT.text.secondary }}>ROI and metrics by deal</div>
            </button>
          </div>
        </div>

        {/* Custom Reports */}
        <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
          <h2 className="font-semibold mb-4" style={{ color: BT.text.primary }}>🎯 Custom Reports</h2>
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📈</div>
            <p className="mb-4" style={{ color: BT.text.secondary }}>Build custom reports with your data</p>
            <button className="px-4 py-2" style={{ background: BT.text.cyan, color: BT.bg.terminal, borderRadius: 0 }}>
              Create Custom Report
            </button>
          </div>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="p-6" style={{ background: BT.bg.panel, borderRadius: 0, border: `1px solid ${BT.border.subtle}` }}>
        <h2 className="font-semibold mb-4" style={{ color: BT.text.primary }}>📉 Market Trends</h2>
        <div className="h-64 flex items-center justify-center" style={{ background: BT.bg.panelAlt, borderRadius: 0 }}>
          <div className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <p style={{ color: BT.text.secondary }}>Chart visualization coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
