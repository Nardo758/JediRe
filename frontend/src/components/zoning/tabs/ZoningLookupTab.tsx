import React, { useState } from 'react';
import { Search, MapPin, Building2, CheckCircle, AlertTriangle, XCircle, Info, Loader2 } from 'lucide-react';
import { useZoningLookup } from '../../../hooks/useZoningLookup';
import type { ZoningLookupResult, PermittedUse, StrategyAlignment } from '../../../types/zoning.types';

export default function ZoningLookupTab() {
  const [address, setAddress] = useState('');
  const { result, loading, error, lookup, clear } = useZoningLookup();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    lookup(address);
  };

  return (
    <div className="space-y-4 p-4 overflow-y-auto max-h-[calc(100vh-180px)]">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter property address for zoning lookup..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !address.trim()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          Lookup
        </button>
        {result && (
          <button
            type="button"
            onClick={() => { clear(); setAddress(''); }}
            className="px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Clear
          </button>
        )}
      </form>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="ml-3 text-gray-400">Looking up zoning data...</span>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <ZoningClassificationCard result={result} />
          <DevelopmentParametersCard result={result} />
          <PermittedUsesCard uses={result.permittedUses} />
          <StrategyAlignmentCard alignments={result.strategyAlignment} />
          {result.variancePotential && <VariancePotentialCard result={result} />}
        </div>
      )}

      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Building2 className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">Enter an address above to look up zoning information</p>
        </div>
      )}
    </div>
  );
}

function ZoningClassificationCard({ result }: { result: ZoningLookupResult }) {
  const { district } = result;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-blue-400" />
        Zoning Classification
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <InfoField label="District Code" value={district.code} highlight />
        <InfoField label="Full Name" value={district.name} />
        <InfoField label="Municipality" value={`${district.municipality}, ${district.state}`} />
        <InfoField label="Last Amended" value={district.lastAmended || 'N/A'} />
        <InfoField label="Code Reference" value={district.codeReference || 'N/A'} className="col-span-2" />
      </div>
    </div>
  );
}

function DevelopmentParametersCard({ result }: { result: ZoningLookupResult }) {
  const { parameters } = result;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="text-white font-semibold text-sm mb-3">Development Parameters</h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <ParamBox label="Max Density" value={parameters.maxDensity != null ? `${parameters.maxDensity} du/ac` : 'N/A'} />
        <ParamBox label="Max Height" value={parameters.maxHeight != null ? `${parameters.maxHeight} ft` : 'N/A'} />
        <ParamBox label="FAR" value={parameters.maxFar != null ? `${parameters.maxFar}` : 'N/A'} />
        <ParamBox label="Lot Coverage" value={parameters.maxLotCoverage != null ? `${parameters.maxLotCoverage}%` : 'N/A'} />
        <ParamBox label="Open Space" value={parameters.minOpenSpace != null ? `${parameters.minOpenSpace}%` : 'N/A'} />
      </div>

      <div className="mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Setbacks</p>
        <div className="grid grid-cols-3 gap-2">
          <SetbackBox label="Front" value={parameters.setbacks.front} />
          <SetbackBox label="Side" value={parameters.setbacks.side} />
          <SetbackBox label="Rear" value={parameters.setbacks.rear} />
        </div>
      </div>

      <div className="mb-3">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Parking Requirements</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <span className="text-gray-400">Residential: <span className="text-white">{parameters.parking.residential != null ? `${parameters.parking.residential}/unit` : 'N/A'}</span></span>
          <span className="text-gray-400">Guest: <span className="text-white">{parameters.parking.guest != null ? `${parameters.parking.guest}/unit` : 'N/A'}</span></span>
          <span className="text-gray-400">Commercial: <span className="text-white">{parameters.parking.commercial != null ? `${parameters.parking.commercial}/1000sf` : 'N/A'}</span></span>
          <span className="text-gray-400">Bicycle: <span className="text-white">{parameters.parking.bicycle != null ? `${parameters.parking.bicycle}/unit` : 'N/A'}</span></span>
        </div>
      </div>

      {parameters.aiNotes.length > 0 && (
        <div className="border-t border-gray-700 pt-3">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Info className="w-3 h-3" /> AI Notes
          </p>
          <ul className="space-y-1">
            {parameters.aiNotes.map((note, i) => (
              <li key={i} className="text-xs text-blue-300 flex items-start gap-1.5">
                <span className="text-blue-500 mt-0.5">•</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PermittedUsesCard({ uses }: { uses: PermittedUse[] }) {
  const byRight = uses.filter(u => u.category === 'by_right');
  const conditional = uses.filter(u => u.category === 'conditional');
  const prohibited = uses.filter(u => u.category === 'prohibited');

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="text-white font-semibold text-sm mb-3">Permitted Uses</h3>
      <div className="grid grid-cols-3 gap-4">
        <UseColumn
          title="By-Right"
          uses={byRight}
          icon={<CheckCircle className="w-3.5 h-3.5 text-green-400" />}
          textColor="text-green-300"
          borderColor="border-green-800"
          bgColor="bg-green-900/20"
        />
        <UseColumn
          title="Conditional"
          uses={conditional}
          icon={<AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />}
          textColor="text-yellow-300"
          borderColor="border-yellow-800"
          bgColor="bg-yellow-900/20"
        />
        <UseColumn
          title="Prohibited"
          uses={prohibited}
          icon={<XCircle className="w-3.5 h-3.5 text-red-400" />}
          textColor="text-red-300"
          borderColor="border-red-800"
          bgColor="bg-red-900/20"
        />
      </div>
    </div>
  );
}

function UseColumn({ title, uses, icon, textColor, borderColor, bgColor }: {
  title: string;
  uses: PermittedUse[];
  icon: React.ReactNode;
  textColor: string;
  borderColor: string;
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-3`}>
      <div className={`flex items-center gap-1.5 mb-2 ${textColor} font-medium text-xs`}>
        {icon}
        {title} ({uses.length})
      </div>
      {uses.length === 0 ? (
        <p className="text-xs text-gray-500 italic">None</p>
      ) : (
        <ul className="space-y-1">
          {uses.map((u, i) => (
            <li key={i} className="text-xs text-gray-300">{u.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StrategyAlignmentCard({ alignments }: { alignments: StrategyAlignment[] }) {
  const statusConfig = {
    compatible: { bg: 'bg-green-900/30', text: 'text-green-400', label: 'Compatible', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    conditional: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', label: 'Conditional', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    incompatible: { bg: 'bg-red-900/30', text: 'text-red-400', label: 'Incompatible', icon: <XCircle className="w-3.5 h-3.5" /> },
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="text-white font-semibold text-sm mb-3">Strategy Alignment</h3>
      <div className="overflow-hidden rounded-lg border border-gray-700">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-900/60">
              <th className="text-left text-gray-400 font-medium px-3 py-2">Strategy</th>
              <th className="text-left text-gray-400 font-medium px-3 py-2">Compatibility</th>
              <th className="text-left text-gray-400 font-medium px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {alignments.map((a, i) => {
              const config = statusConfig[a.status];
              return (
                <tr key={i} className="hover:bg-gray-700/30">
                  <td className="px-3 py-2 text-white font-medium">{a.strategy}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 ${config.bg} ${config.text} px-2 py-0.5 rounded-full`}>
                      {config.icon}
                      {config.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-400">{a.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VariancePotentialCard({ result }: { result: ZoningLookupResult }) {
  const vp = result.variancePotential;
  if (!vp) return null;

  const maxUnits = Math.max(vp.byRightUnits, vp.varianceUnits, 1);
  const byRightPct = (vp.byRightUnits / maxUnits) * 100;
  const variancePct = (vp.varianceUnits / maxUnits) * 100;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="text-white font-semibold text-sm mb-3">By-Right vs Variance Potential</h3>

      <div className="space-y-3 mb-4">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">By-Right</span>
            <span className="text-white font-medium">{vp.byRightUnits} units</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div className="bg-blue-500 rounded-full h-3 transition-all" style={{ width: `${byRightPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">With Variance</span>
            <span className="text-white font-medium">{vp.varianceUnits} units</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div className="bg-emerald-500 rounded-full h-3 transition-all" style={{ width: `${variancePct}%` }} />
          </div>
        </div>
        <div className="text-xs text-emerald-400 font-medium">
          +{vp.delta} units ({vp.deltaPercent > 0 ? `+${vp.deltaPercent}` : vp.deltaPercent}%)
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-900/50 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Path</p>
          <p className="text-xs text-white font-medium mt-0.5">{vp.variancePath}</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Timeline</p>
          <p className="text-xs text-white font-medium mt-0.5">{vp.estTimeline}</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Est. Cost</p>
          <p className="text-xs text-white font-medium mt-0.5">{vp.estCost}</p>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3">
        <p className="text-xs text-blue-300 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
          <span>{vp.aiRecommendation}</span>
        </p>
      </div>
    </div>
  );
}

function InfoField({ label, value, highlight, className }: { label: string; value: string; highlight?: boolean; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm mt-0.5 ${highlight ? 'text-blue-400 font-semibold' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function ParamBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900/50 rounded-lg p-2.5 text-center">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-white font-medium mt-0.5">{value}</p>
    </div>
  );
}

function SetbackBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-gray-900/50 rounded p-2 text-center">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-white font-medium">{value != null ? `${value} ft` : 'N/A'}</p>
    </div>
  );
}
