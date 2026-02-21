import React from 'react';
import OutputCard, { OutputSection } from '../components/OutputCard';
import { SIGNAL_GROUPS } from '../signalGroups';

interface MarketDataTabProps {
  marketId: string;
}

const MarketDataTab: React.FC<MarketDataTabProps> = ({ marketId }) => {
  const isAtlanta = marketId === 'atlanta';

  const filterFields = [
    { label: 'Submarket', placeholder: 'All Submarkets' },
    { label: 'Vintage', placeholder: 'All Classes' },
    { label: 'Units', placeholder: 'Any Size' },
    { label: 'Owner Type', placeholder: 'All Owners' },
  ];

  const tableHeaders = [
    { id: 'P-01', label: 'Property', width: 'w-48' },
    { id: 'P-02', label: 'Vintage', width: 'w-20' },
    { id: 'P-04', label: 'Owner', width: 'w-36' },
    { id: 'M-01', label: 'Avg Rent', width: 'w-24' },
    { id: 'M-06', label: 'Occupancy', width: 'w-24' },
    { id: 'T-02', label: 'Traffic Score', width: 'w-28' },
    { id: 'DC-07', label: 'Pricing Power', width: 'w-28' },
  ];

  const sampleRows = isAtlanta
    ? [
        { property: 'The Retreat at Peachtree', vintage: 'B+', owner: 'Greystar RE Partners', rent: '$1,650', occ: '94%', traffic: '—', pricing: '—' },
        { property: 'Avalon Heights', vintage: 'A-', owner: 'AvalonBay Communities', rent: '$2,100', occ: '96%', traffic: '—', pricing: '—' },
        { property: 'Palisades at West Midtown', vintage: 'A', owner: 'Camden Property Trust', rent: '$2,350', occ: '91%', traffic: '—', pricing: '—' },
        { property: 'Ashford Place Apartments', vintage: 'C', owner: 'Local Owner LLC', rent: '$1,050', occ: '88%', traffic: '—', pricing: '—' },
        { property: 'Buckhead Grand', vintage: 'A', owner: 'Post Apartment Homes', rent: '$2,800', occ: '93%', traffic: '—', pricing: '—' },
      ]
    : [];

  const flyoutOutputs = [
    'P-01', 'P-02', 'P-03', 'P-04', 'P-05', 'P-06', 'P-07', 'P-08',
    'C-01',
    'T-01', 'T-02', 'T-03', 'T-04', 'T-06', 'T-08', 'T-10',
    'TA-01', 'TA-02', 'TA-03', 'TA-04',
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Market Data</h2>
          <p className="text-sm text-gray-500">Full research library &middot; 5-15 minute deep dive &middot; 44 outputs</p>
        </div>
        <span className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full">
          {isAtlanta ? '27% live data' : 'No live data'}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          {filterFields.map((f) => (
            <div key={f.label} className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{f.label}</label>
              <select className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option>{f.placeholder}</option>
              </select>
            </div>
          ))}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Search</label>
            <input
              type="text"
              placeholder="Search properties..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Property Database</h3>
            <p className="text-sm text-gray-500 mt-0.5">Click any row to open Property Flyout</p>
          </div>
          <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">7 outputs</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {tableHeaders.map((h) => (
                  <th key={h.id} className={`px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider ${h.width}`}>
                    <div className="flex items-center gap-1.5">
                      {h.label}
                      <span className="text-[9px] font-mono text-gray-300">{h.id}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleRows.length > 0 ? sampleRows.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.property}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-7 h-5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: SIGNAL_GROUPS.POSITION.color }}>
                      {row.vintage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]">{row.owner}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.rent}</td>
                  <td className="px-4 py-3 text-gray-700">{row.occ}</td>
                  <td className="px-4 py-3 text-gray-400 italic text-xs">{row.traffic}</td>
                  <td className="px-4 py-3 text-gray-400 italic text-xs">{row.pricing}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                    No property data available for this market. Select Atlanta for sample data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {isAtlanta && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            Showing 5 of 1,028 properties &middot; Scroll or filter to explore
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: SIGNAL_GROUPS.POSITION.color }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Property Flyout</h3>
              <p className="text-sm text-gray-500 mt-0.5">Opens on row click &middot; Full property intelligence modal</p>
            </div>
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">{flyoutOutputs.length} outputs</span>
          </div>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-1.5">
            {flyoutOutputs.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-50 border border-gray-100 text-xs">
                <span className="font-mono text-gray-400">{id}</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Includes Property basics (P-01–P-08), JEDI Score (C-01), Traffic Engine (T-01–T-10), and Trade Area (TA-01–TA-04) outputs.
          </p>
        </div>
      </div>

      <OutputSection
        title="Demand-Supply Dashboard"
        description="Employment, migration, household formation vs pipeline and absorption"
        outputIds={['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06', 'D-07', 'D-08', 'D-09', 'D-10', 'D-11', 'S-04', 'S-05', 'S-06', 'S-07', 'S-08', 'S-09']}
        groupHighlight="DEMAND"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {['D-01', 'D-02', 'D-03', 'D-04', 'D-05', 'D-06', 'D-07', 'D-08', 'D-09', 'D-10', 'D-11'].map((id) => (
            <OutputCard key={id} outputId={id} status="mock" />
          ))}
          {['S-04', 'S-05', 'S-06', 'S-07', 'S-08', 'S-09'].map((id) => (
            <OutputCard key={id} outputId={id} status="mock" />
          ))}
        </div>
      </OutputSection>

      <OutputSection
        title="Rent & Pricing Intelligence"
        description="Rent trends, concessions, wage growth spread, and pricing power"
        outputIds={['M-01', 'M-03', 'M-05', 'M-07', 'R-01', 'R-02', 'R-03', 'DC-07']}
        groupHighlight="MOMENTUM"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <OutputCard outputId="M-01" status="mock" />
          <OutputCard outputId="M-03" status="mock" />
          <OutputCard outputId="M-05" status="mock" />
          <OutputCard outputId="M-07" status="mock" />
          <OutputCard outputId="R-01" status="mock" />
          <OutputCard outputId="R-02" status="mock" />
          <OutputCard outputId="R-03" status="mock" />
          <OutputCard outputId="DC-07" status="pending" />
        </div>
      </OutputSection>

      <OutputSection
        title="Ownership Intelligence"
        description="Portfolio analysis, seller motivation, and concentration risk"
        outputIds={['P-04', 'P-05', 'R-07', 'R-09']}
        groupHighlight="POSITION"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <OutputCard outputId="P-04" status={isAtlanta ? 'real' : 'mock'} />
          <OutputCard outputId="P-05" status={isAtlanta ? 'real' : 'mock'} />
          <OutputCard outputId="R-07" status={isAtlanta ? 'real' : 'mock'} />
          <OutputCard outputId="R-09" status={isAtlanta ? 'real' : 'mock'} />
        </div>
      </OutputSection>

      <OutputSection
        title="Transaction History"
        description="Cap rates, investor activity, and price benchmarks"
        outputIds={['M-08', 'M-09', 'P-07']}
        groupHighlight="MOMENTUM"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <OutputCard outputId="M-08" status={isAtlanta ? 'real' : 'mock'} />
          <OutputCard outputId="M-09" status={isAtlanta ? 'real' : 'mock'} />
          <OutputCard outputId="P-07" status={isAtlanta ? 'real' : 'mock'} />
        </div>
      </OutputSection>

      <OutputSection
        title="Traffic & Demand Heatmap"
        description="Physical and digital traffic patterns, demand momentum overlay"
        outputIds={['D-05', 'D-06', 'D-07', 'D-08', 'D-09', 'T-02', 'T-04']}
        groupHighlight="TRAFFIC"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <OutputCard outputId="D-05" status="mock" />
          <OutputCard outputId="D-06" status="mock" />
          <OutputCard outputId="D-07" status="mock" />
          <OutputCard outputId="D-08" status="mock" />
          <OutputCard outputId="D-09" status="mock" />
          <OutputCard outputId="T-02" status="pending" />
          <OutputCard outputId="T-04" status="pending" />
        </div>
      </OutputSection>
    </div>
  );
};

export default MarketDataTab;
