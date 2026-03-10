import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import SummaryTab from './SummaryTab';

const T = {
  bg: { terminal:"#0A0E17",panel:"#0F1319",header:"#1A1F2E",active:"#252D40" },
  text: { primary:"#E8ECF1",secondary:"#8B95A5",muted:"#4A5568",amber:"#F5A623",white:"#FFFFFF" },
  border: { subtle:"#1E2538",medium:"#2A3348" },
  font: { mono:"'JetBrains Mono','Fira Code','SF Mono',monospace" },
};

type Tab = 'summary' | 'projections' | 'debt' | 'waterfall' | 'sensitivity' | 'assumptions';

export default function FinancialModelViewer() {
  const { dealId } = useParams<{ dealId: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [model, setModel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModel();
  }, [dealId]);

  const fetchModel = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/financial-models/${dealId}/claude-output`, {
        credentials: 'include',
      });

      if (response.status === 404) {
        // No model yet - show compute prompt
        setModel(null);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setModel(result.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      console.error('Error fetching financial model:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompute = async (forceRecompute = false) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/financial-models/${dealId}/compute-claude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ forceRecompute }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        setModel(result.data.model);
      } else {
        throw new Error(result.error || 'Failed to compute model');
      }
    } catch (err: any) {
      console.error('Error computing model:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
        color: T.text.muted,
        fontFamily: T.font.mono,
        fontSize: 11,
      }}>
        <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
          LOADING FINANCIAL MODEL...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: `#FF475710`,
        border: `1px solid #FF475740`,
        borderRadius: 4,
        padding: 16,
        margin: 16,
        fontSize: 10,
        fontFamily: T.font.mono,
        color: '#FF4757',
      }}>
        ⚠️ ERROR: {error}
      </div>
    );
  }

  if (!model) {
    return (
      <div style={{
        padding: 40,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 12,
          fontFamily: T.font.mono,
          color: T.text.secondary,
          marginBottom: 20,
        }}>
          No financial model computed yet
        </div>
        <button
          onClick={handleCompute}
          style={{
            padding: "10px 24px",
            background: `linear-gradient(135deg, #4A9EFF 0%, #00D26A 100%)`,
            border: 'none',
            borderRadius: 3,
            color: T.text.white,
            fontSize: 11,
            fontFamily: T.font.mono,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: "0.05em",
          }}
        >
          🧮 COMPUTE FINANCIAL MODEL
        </button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; hotkey: string }[] = [
    { key: 'summary', label: 'SUMMARY', hotkey: 'F1' },
    { key: 'projections', label: 'PROJECTIONS', hotkey: 'F2' },
    { key: 'debt', label: 'DEBT', hotkey: 'F3' },
    { key: 'waterfall', label: 'WATERFALL', hotkey: 'F4' },
    { key: 'sensitivity', label: 'SENSITIVITY', hotkey: 'F5' },
    { key: 'assumptions', label: 'ASSUMPTIONS', hotkey: 'F6' },
  ];

  return (
    <div style={{
      background: T.bg.terminal,
      minHeight: '100vh',
      fontFamily: T.font.mono,
    }}>
      {/* Header */}
      <div style={{
        background: T.bg.header,
        padding: '12px 20px',
        borderBottom: `1px solid ${T.border.subtle}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.text.amber,
            letterSpacing: "0.05em",
          }}>
            FINANCIAL MODEL
          </div>
          <div style={{
            fontSize: 9,
            color: T.text.muted,
            marginTop: 2,
          }}>
            {model.model_type?.toUpperCase() || 'ACQUISITION'} • Computed {model.computed_at ? new Date(model.computed_at).toLocaleString() : 'N/A'}
          </div>
        </div>
        <button
          onClick={() => handleCompute(true)}
          style={{
            padding: "6px 12px",
            background: T.bg.active,
            border: `1px solid ${T.border.medium}`,
            borderRadius: 2,
            color: T.text.amber,
            fontSize: 9,
            fontFamily: T.font.mono,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          🔄 RECOMPUTE
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{
        background: T.bg.header,
        borderBottom: `1px solid ${T.border.subtle}`,
        display: 'flex',
        gap: 0,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              background: activeTab === tab.key ? T.bg.active : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? `2px solid ${T.text.amber}` : '2px solid transparent',
              padding: "10px 16px",
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: T.font.mono,
              fontWeight: 700,
              color: activeTab === tab.key ? T.text.amber : T.text.secondary,
              letterSpacing: "0.05em",
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
            <span style={{ fontSize: 7, marginLeft: 6, color: T.text.muted }}>{tab.hotkey}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ padding: "20px", maxWidth: "1600px", margin: "0 auto" }}>
        {activeTab === 'summary' && <SummaryTab output={model.claude_output || model.results} modelType={model.model_type} />}
        {activeTab === 'projections' && <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>PROJECTIONS TAB (TODO)</div>}
        {activeTab === 'debt' && <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>DEBT TAB (TODO)</div>}
        {activeTab === 'waterfall' && <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>WATERFALL TAB (TODO)</div>}
        {activeTab === 'sensitivity' && <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>SENSITIVITY TAB (TODO)</div>}
        {activeTab === 'assumptions' && <div style={{ padding: 40, textAlign: 'center', color: T.text.muted }}>ASSUMPTIONS TAB (TODO)</div>}
      </div>
    </div>
  );
}
