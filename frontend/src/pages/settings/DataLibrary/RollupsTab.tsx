import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../services/api.client';

const MONO = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

const viewBtn = (active: boolean): React.CSSProperties => ({
  background: active ? '#1f3a5c' : 'transparent',
  border: `1px solid ${active ? '#388bfd' : '#30363d'}`,
  color: active ? '#4fc3f7' : '#8892b0',
  borderRadius: '12px', padding: '2px 10px', cursor: 'default',
  fontFamily: MONO, fontSize: 11, opacity: 0.5,
});

export function RollupsTab() {
  const [productTypeGroups, setProductTypeGroups] = useState<
    { product_type: string; count: number; avg_units: number; avg_rent: number }[]
  >([]);
  const [msaGroups, setMsaGroups] = useState<
    { msa_name: string; count: number; avg_units: number; avg_rent: number }[]
  >([]);
  const [unclassified, setUnclassified] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('trends');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/api/v1/data-library-assets/rollup-stub');
        setProductTypeGroups(res.data.product_type_groups || []);
        setMsaGroups(res.data.msa_groups || []);
        setUnclassified(res.data.unclassified || 0);
      } catch (err) {
        console.error('Failed to fetch rollup data:', err);
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f0f6fc', margin: 0, fontFamily: MONO }}>ROLLUPS</h3>
          <div style={{ color: '#8892b0', fontSize: 11, fontFamily: MONO, marginTop: 4 }}>
            Cohort analytics by asset type \u00b7 Preview \u2014 limited data
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['Trends', 'Per Unit', 'Distribution'].map(v => (
            <button key={v} style={viewBtn(v.toLowerCase() === activeView)}
              onClick={() => setActiveView(v.toLowerCase())}
            >{v.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#8892b0', padding: 40, textAlign: 'center', fontFamily: MONO }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ color: '#4fc3f7', fontFamily: MONO, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>By Product Type</div>
            <div style={{ padding: '12px', background: '#161b22', border: '1px solid #21262d', borderRadius: 6, fontFamily: MONO, fontSize: 11 }}>
              {productTypeGroups.length === 0 && unclassified === 0 ? (
                <div style={{ color: '#8892b0' }}>No data available</div>
              ) : (
                <>
                  {productTypeGroups.map((g, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < productTypeGroups.length - 1 ? '1px solid #21262d' : 'none' }}>
                      <span style={{ color: '#cdd9e5' }}>{g.product_type}</span>
                      <span style={{ color: '#8892b0' }}>
                        N={g.count} Avg Units: {Math.round(g.avg_units)} Avg Rent: ${Math.round(g.avg_rent).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {unclassified > 0 && (
                    <div style={{ padding: '6px 0', color: '#f59e0b' }}>
                      {unclassified} unclassified (awaiting enrichment)
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div>
            <div style={{ color: '#a78bfa', fontFamily: MONO, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>By MSA</div>
            <div style={{ padding: '12px', background: '#161b22', border: '1px solid #21262d', borderRadius: 6, fontFamily: MONO, fontSize: 11 }}>
              {msaGroups.length === 0 ? (
                <div style={{ color: '#8892b0' }}>No data available</div>
              ) : (
                msaGroups.map((g, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < msaGroups.length - 1 ? '1px solid #21262d' : 'none' }}>
                    <span style={{ color: '#cdd9e5' }}>{g.msa_name}</span>
                    <span style={{ color: '#8892b0' }}>
                      N={g.count} Avg Units: {Math.round(g.avg_units)} Avg Rent: ${Math.round(g.avg_rent).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, padding: '16px 20px', background: '#0d2118', border: '1px solid #4ade8044', borderRadius: 6, fontFamily: MONO }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', marginBottom: 8 }}>FULL ROLLUPS COMING SOON</div>
        <div style={{ fontSize: 11, color: '#8892b0', lineHeight: 1.8 }}>
          The complete Cohort Rollup view ships in Phase 11 with:
          <ul style={{ margin: '6px 0', paddingLeft: 20 }}>
            <li>T-12 line-item rollups (GPR, NOI, OpEx components)</li>
            <li>Per-unit normalization across the cohort</li>
            <li>Trends view: time-series chart across cohort</li>
            <li>Per Unit view: matrix table by year</li>
            <li>Distribution view: P25/P50/P75 instead of single median</li>
            <li>Cohort curation: add/remove specific assets</li>
            <li>Saved named cohorts</li>
            <li>Multi-dimensional cohort definition (Product x Class x MSA x vintage)</li>
          </ul>
          <div style={{ marginTop: 8, color: '#f59e0b' }}>
            Prerequisites: M02 Zoning module + Atlanta enrichment to populate product_type
            and asset_class across cohort.
          </div>
        </div>
      </div>
    </div>
  );
}
