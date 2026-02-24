import React, { useState } from 'react';
import { Search, MapPin, Building2, CheckCircle, AlertTriangle, XCircle, Info, Loader2, FileText, Bot, Paperclip, BarChart3 } from 'lucide-react';
import { useZoningLookup } from '../../../hooks/useZoningLookup';
import type { ZoningLookupResult, PermittedUse, StrategyAlignment } from '../../../types/zoning.types';

interface ZoningLookupTabProps {
  dealId?: string;
  deal?: any;
}

export default function ZoningLookupTab({ dealId, deal }: ZoningLookupTabProps) {
  const [address, setAddress] = useState('');
  const { result, loading, error, lookup, clear } = useZoningLookup();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    lookup(address);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="847 Peachtree St NE, Atlanta GA"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !address.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Look Up
          </button>
          {result && (
            <button
              type="button"
              onClick={() => { clear(); setAddress(''); }}
              className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2 ml-1">or click parcel on map →</p>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="ml-3 text-gray-500">Looking up zoning data...</span>
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
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Building2 className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">Enter an address above to look up zoning information</p>
          <p className="text-xs text-gray-400 mt-1">or click a parcel on the map</p>
        </div>
      )}
    </div>
  );
}

function ZoningClassificationCard({ result }: { result: ZoningLookupResult }) {
  const { district } = result;
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h3 className="text-gray-900 font-semibold text-sm flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-600" />
          Zoning Classification
        </h3>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            <FileText className="w-3 h-3" /> View Full Code
          </button>
          <button className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100">
            <Bot className="w-3 h-3" /> AI Summary
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <InfoField label="District Code" value={district.code} highlight />
          <InfoField label="Full Name" value={district.name} />
          <InfoField label="Municipality" value={`${district.municipality}, ${district.state}`} />
          <InfoField label="Last Amended" value={district.lastAmended || 'N/A'} />
          <InfoField label="Code Reference" value={district.codeReference || 'N/A'} className="col-span-2" />
        </div>
      </div>
    </div>
  );
}

function DevelopmentParametersCard({ result }: { result: ZoningLookupResult }) {
  const { parameters } = result;
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-gray-900 font-semibold text-sm">Development Parameters</h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <ParamBox label="Max Density" value={parameters.maxDensity != null ? `${parameters.maxDensity} du/ac` : 'N/A'} />
          <ParamBox label="Max Height" value={parameters.maxHeight != null ? `${parameters.maxHeight} ft` : 'N/A'} />
          <ParamBox label="FAR" value={parameters.maxFar != null ? `${parameters.maxFar}` : 'N/A'} />
          <ParamBox label="Lot Coverage" value={parameters.maxLotCoverage != null ? `${parameters.maxLotCoverage}%` : 'N/A'} />
          <ParamBox label="Open Space" value={parameters.minOpenSpace != null ? `${parameters.minOpenSpace}%` : 'N/A'} />
        </div>

        <div className="mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Setbacks</p>
          <div className="grid grid-cols-3 gap-2">
            <SetbackBox label="Front" value={parameters.setbacks.front} />
            <SetbackBox label="Side" value={parameters.setbacks.side} />
            <SetbackBox label="Rear" value={parameters.setbacks.rear} />
          </div>
        </div>

        <div className="mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Parking Requirements</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span className="text-gray-500">Residential: <span className="text-gray-900 font-medium">{parameters.parking.residential != null ? `${parameters.parking.residential}/unit` : 'N/A'}</span></span>
            <span className="text-gray-500">Guest: <span className="text-gray-900 font-medium">{parameters.parking.guest != null ? `${parameters.parking.guest}/unit` : 'N/A'}</span></span>
            <span className="text-gray-500">Commercial: <span className="text-gray-900 font-medium">{parameters.parking.commercial != null ? `${parameters.parking.commercial}/1000sf` : 'N/A'}</span></span>
            <span className="text-gray-500">Bicycle: <span className="text-gray-900 font-medium">{parameters.parking.bicycle != null ? `${parameters.parking.bicycle}/unit` : 'N/A'}</span></span>
          </div>
        </div>

        {parameters.aiNotes.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
            <p className="text-xs text-blue-800 font-medium mb-1.5 flex items-center gap-1">
              <Info className="w-3 h-3" /> AI Notes
            </p>
            <ul className="space-y-1">
              {parameters.aiNotes.map((note, i) => (
                <li key={i} className="text-xs text-blue-700 flex items-start gap-1.5">
                  <span className="text-blue-500 mt-0.5">•</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function PermittedUsesCard({ uses }: { uses: PermittedUse[] }) {
  const byRight = uses.filter(u => u.category === 'by_right');
  const conditional = uses.filter(u => u.category === 'conditional');
  const prohibited = uses.filter(u => u.category === 'prohibited');

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-gray-900 font-semibold text-sm">Permitted Uses</h3>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4">
          <UseColumn
            title="By-Right"
            emoji="✅"
            uses={byRight}
            icon={<CheckCircle className="w-3.5 h-3.5 text-green-600" />}
            textColor="text-green-700"
            borderColor="border-green-200"
            bgColor="bg-green-50"
          />
          <UseColumn
            title="Conditional"
            emoji="⚠️"
            uses={conditional}
            icon={<AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />}
            textColor="text-yellow-700"
            borderColor="border-yellow-200"
            bgColor="bg-yellow-50"
          />
          <UseColumn
            title="Prohibited"
            emoji="❌"
            uses={prohibited}
            icon={<XCircle className="w-3.5 h-3.5 text-red-600" />}
            textColor="text-red-700"
            borderColor="border-red-200"
            bgColor="bg-red-50"
          />
        </div>
      </div>
    </div>
  );
}

function UseColumn({ title, emoji, uses, icon, textColor, borderColor, bgColor }: {
  title: string;
  emoji: string;
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
        {title} {emoji}
      </div>
      {uses.length === 0 ? (
        <p className="text-xs text-gray-400 italic">None</p>
      ) : (
        <ul className="space-y-1">
          {uses.map((u, i) => (
            <li key={i} className="text-xs text-gray-700 flex items-start gap-1">
              <span className="mt-0.5">•</span>
              {u.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StrategyAlignmentCard({ alignments }: { alignments: StrategyAlignment[] }) {
  const statusConfig = {
    compatible: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: 'Compatible', icon: '✅' },
    conditional: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Conditional', icon: '⚠️' },
    incompatible: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Incompatible', icon: '❌' },
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-gray-900 font-semibold text-sm">Strategy Alignment</h3>
      </div>
      <div className="overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-gray-500 font-medium px-4 py-2.5">Strategy</th>
              <th className="text-left text-gray-500 font-medium px-4 py-2.5">Compatibility</th>
              <th className="text-left text-gray-500 font-medium px-4 py-2.5">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {alignments.map((a, i) => {
              const config = statusConfig[a.status];
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-900 font-medium">{a.strategy}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 ${config.bg} ${config.text} border ${config.border} px-2 py-0.5 rounded-full`}>
                      <span>{config.icon}</span>
                      {config.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{a.note}</td>
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
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-gray-900 font-semibold text-sm">By-Right vs Variance Potential</h3>
      </div>
      <div className="p-4">
        <div className="space-y-3 mb-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">By-Right</span>
              <span className="text-gray-900 font-medium">{vp.byRightUnits} units</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="bg-blue-500 rounded-full h-3 transition-all" style={{ width: `${byRightPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">With Variance</span>
              <span className="text-gray-900 font-medium">{vp.varianceUnits} units</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className="bg-emerald-500 rounded-full h-3 transition-all" style={{ width: `${variancePct}%` }} />
            </div>
          </div>
          <div className="text-xs text-emerald-600 font-semibold">
            Delta: +{vp.delta} units ({vp.deltaPercent > 0 ? `+${vp.deltaPercent}` : vp.deltaPercent}%)
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Variance Path</p>
            <p className="text-xs text-gray-900 font-medium mt-0.5">{vp.variancePath}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Est. Timeline</p>
            <p className="text-xs text-gray-900 font-medium mt-0.5">{vp.estTimeline}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Est. Cost</p>
            <p className="text-xs text-gray-900 font-medium mt-0.5">{vp.estCost}</p>
          </div>
        </div>

        {vp.successRate != null && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center mb-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Success Rate</p>
            <p className="text-xs text-gray-900 font-medium mt-0.5">{vp.successRate}% (local historical)</p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-blue-800 flex items-start gap-1.5">
            <span className="flex-shrink-0 mt-0.5">💡</span>
            <span className="font-medium">AI Recommendation: </span>
          </p>
          <p className="text-xs text-blue-700 mt-1 ml-5 leading-relaxed">
            "{vp.aiRecommendation}"
          </p>
        </div>

        <div className="flex gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <Paperclip className="w-3.5 h-3.5" /> Attach to Deal Capsule
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
            <BarChart3 className="w-3.5 h-3.5" /> Run Dev Feasibility
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value, highlight, className }: { label: string; value: string; highlight?: boolean; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm mt-0.5 ${highlight ? 'text-blue-600 font-semibold' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function ParamBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-gray-900 font-medium mt-0.5">{value}</p>
    </div>
  );
}

function SetbackBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-gray-900 font-medium">{value != null ? `${value} ft` : 'N/A'}</p>
    </div>
  );
}
