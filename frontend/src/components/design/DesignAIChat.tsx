import React, { useState, useRef, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api.client';
import type { Design3D } from '@/types/financial.types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  text: string;
  update?: { description: string; [key: string]: any } | null;
}

interface DesignAIChatProps {
  dealId: string;
  design3D: Design3D | null;
  dealName?: string;
  zoningConstraints?: {
    maxGba?: number;
    maxUnits?: number;
    maxStories?: number;
    parkingRequired?: number;
    appliedFar?: number;
  };
  marketIntelligence?: {
    recommendedMix?: { studio: number; oneBR: number; twoBR: number; threeBR: number };
    demandPool?: number;
    captureRate?: number;
    targetDemographic?: string;
    lastUpdated?: number;
  };
  onApplyUpdate: (metrics: any) => void;
}

const QUICK_PROMPTS = [
  'Optimize unit mix for market',
  'Add 50 more units',
  'Switch to mid-rise 5 stories',
  'Maximize FAR utilization',
  'Add structured parking',
  'Reduce to garden style',
];

function buildDesignPrompt(
  design: Design3D | null,
  dealName: string,
  zoning?: DesignAIChatProps['zoningConstraints'],
  market?: DesignAIChatProps['marketIntelligence'],
): string {
  const mix = design?.unitMix || { studio: 0, oneBed: 0, twoBed: 0, threeBed: 0 };
  const total = design?.totalUnits || 0;

  let zoningBlock = '';
  if (zoning) {
    const parts: string[] = [];
    if (zoning.maxStories != null) parts.push(`maxStories=${zoning.maxStories}`);
    if (zoning.maxUnits != null) parts.push(`maxUnits=${zoning.maxUnits}`);
    if (zoning.maxGba != null) parts.push(`maxGBA=${zoning.maxGba.toLocaleString()} SF`);
    if (zoning.appliedFar != null) parts.push(`FAR=${zoning.appliedFar}`);
    if (zoning.parkingRequired != null) parts.push(`parkingReq=${zoning.parkingRequired}`);
    if (parts.length) zoningBlock = `\nZONING CONSTRAINTS: ${parts.join(' | ')}`;
  }

  let marketBlock = '';
  if (market?.lastUpdated && market.lastUpdated > 0) {
    const mParts: string[] = [];
    if (market.recommendedMix) {
      const rm = market.recommendedMix;
      mParts.push(`recommendedMix=[Studio ${(rm.studio * 100).toFixed(0)}%, 1BR ${(rm.oneBR * 100).toFixed(0)}%, 2BR ${(rm.twoBR * 100).toFixed(0)}%, 3BR ${(rm.threeBR * 100).toFixed(0)}%]`);
    }
    if (market.demandPool) mParts.push(`demandPool=${market.demandPool}`);
    if (market.captureRate) mParts.push(`captureRate=${(market.captureRate * 100).toFixed(1)}%`);
    if (market.targetDemographic) mParts.push(`demographic=${market.targetDemographic}`);
    if (mParts.length) marketBlock = `\nMARKET INTELLIGENCE: ${mParts.join(' | ')}`;
  }

  return `You are JEDI — an elite real estate building design AI embedded in JEDI RE. You help users design multifamily developments by adjusting building parameters.
DEAL: ${dealName}
CURRENT DESIGN: ${total} units | ${mix.studio} Studio, ${mix.oneBed} 1BR, ${mix.twoBed} 2BR, ${mix.threeBed} 3BR | ${design?.stories || 0} stories | ${(design?.rentableSF || 0).toLocaleString()} rentable SF | ${(design?.grossSF || 0).toLocaleString()} gross SF | ${((design?.efficiency || 0) * 100).toFixed(0)}% efficiency | ${design?.parkingSpaces || 0} parking (${design?.parkingType || 'surface'}) | FAR ${(design?.farUtilized || 0).toFixed(2)}${design?.farMax ? '/' + design.farMax.toFixed(2) : ''} | ${(design?.amenitySF || 0).toLocaleString()} amenity SF${zoningBlock}${marketBlock}

When the user asks to change the design, respond with your analysis AND a design_update block:
\`\`\`design_update
{"description":"Short description of change","totalUnits":280,"unitMix":{"studio":42,"oneBed":112,"twoBed":84,"threeBed":42},"stories":5,"rentableSF":238000,"grossSF":273563,"efficiency":0.87,"parkingSpaces":350,"parkingType":"structured","amenitySF":8400,"farUtilized":2.74}
\`\`\`
Only include fields that change. Omit unchanged fields.
Rules:
- totalUnits must equal sum of unitMix values
- grossSF = rentableSF / efficiency
- Respect zoning constraints (max stories, max units, max GBA, FAR)
- Parking ratio: garden ~1.5/unit, mid-rise ~1.25, high-rise ~1.0
- Efficiency: garden ~92%, mid-rise ~87%, high-rise ~82%
- Average unit SF: garden ~950, mid-rise ~850, high-rise ~750
Speak like a senior development architect — direct, practical, numbers-focused.`;
}

function parseDesignResponse(text: string): { text: string; update: { description: string; [key: string]: any } | null } {
  const m = text.match(/```design_update\n([\s\S]*?)```/);
  if (!m) return { text, update: null };
  try {
    const u = JSON.parse(m[1]);
    return { text: text.replace(/```design_update[\s\S]*?```/, '').trim(), update: u };
  } catch {
    return { text, update: null };
  }
}

export const DesignAIChat: React.FC<DesignAIChatProps> = ({
  dealId,
  design3D,
  dealName = 'Unknown Deal',
  zoningConstraints,
  marketIntelligence,
  onApplyUpdate,
}) => {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [inp, setInp] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, loading]);

  const send = useCallback(async (text?: string) => {
    const message = (text || inp).trim();
    if (!message || loading) return;
    setInp('');

    const userMsg: ChatMessage = { role: 'user', content: message, text: message };
    setMsgs(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const systemPrompt = buildDesignPrompt(design3D, dealName, zoningConstraints, marketIntelligence);
      const allMsgs = [...msgs, userMsg].map(m => ({ role: m.role, content: m.text }));

      const res = await apiClient.post(`/api/v1/design/${dealId}/chat`, {
        messages: allMsgs.slice(-20),
        systemPrompt,
      });

      const raw = res.data?.response || res.data?.data?.content || 'No response from AI.';
      const parsed = parseDesignResponse(raw);

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: raw,
        text: parsed.text,
        update: parsed.update,
      };

      setMsgs(prev => [...prev, assistantMsg]);

      if (parsed.update && design3D) {
        const updated: any = { ...design3D };
        if (parsed.update.totalUnits != null) updated.totalUnits = parsed.update.totalUnits;
        if (parsed.update.unitMix) updated.unitMix = parsed.update.unitMix;
        if (parsed.update.stories != null) updated.stories = parsed.update.stories;
        if (parsed.update.rentableSF != null) updated.rentableSF = parsed.update.rentableSF;
        if (parsed.update.grossSF != null) updated.grossSF = parsed.update.grossSF;
        if (parsed.update.efficiency != null) updated.efficiency = parsed.update.efficiency;
        if (parsed.update.parkingSpaces != null) updated.parkingSpaces = parsed.update.parkingSpaces;
        if (parsed.update.parkingType) updated.parkingType = parsed.update.parkingType;
        if (parsed.update.amenitySF != null) updated.amenitySF = parsed.update.amenitySF;
        if (parsed.update.farUtilized != null) updated.farUtilized = parsed.update.farUtilized;
        onApplyUpdate(updated);
      }
    } catch (err: any) {
      const errorText = err?.response?.status === 500
        ? 'AI service is temporarily unavailable. Please try again.'
        : `Error: ${err?.message || 'Failed to reach AI service.'}`;
      setMsgs(prev => [...prev, { role: 'assistant', content: errorText, text: errorText }]);
    } finally {
      setLoading(false);
    }
  }, [inp, loading, msgs, design3D, dealName, dealId, zoningConstraints, marketIntelligence, onApplyUpdate]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-slate-900 to-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">J</div>
          <div>
            <div className="text-white text-xs font-bold tracking-wide">JEDI <span className="text-indigo-300">RE</span></div>
            <div className="text-slate-400 text-[10px]">AI Design Architect</div>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[10px] text-gray-600 truncate">
            <b>{design3D?.totalUnits || 0} units</b> · <b>{design3D?.stories || 0} stories</b> · <b>{(design3D?.rentableSF || 0).toLocaleString()} SF</b>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {msgs.length === 0 && (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🏗️</div>
            <p className="text-xs text-gray-500 mb-1">JEDI Design Architect</p>
            <p className="text-[10px] text-gray-400">Describe what you want to build. JEDI will adjust the 3D model.</p>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className="flex gap-2">
            <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
              m.role === 'user' ? 'bg-gray-200 text-gray-700' : 'bg-indigo-100 text-indigo-700'
            }`}>
              {m.role === 'user' ? 'U' : 'J'}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-[10px] font-semibold mb-0.5 ${m.role === 'user' ? 'text-gray-500' : 'text-indigo-600'}`}>
                {m.role === 'user' ? 'YOU' : 'JEDI'}
              </div>
              <div className="text-xs text-gray-800 leading-relaxed">
                {m.text.split('\n').filter(l => l.trim()).map((l, j) => <p key={j} className="mb-1">{l}</p>)}
              </div>
              {m.update && (
                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-[10px] text-green-700 font-medium">
                  ✓ {m.update.description || 'Design updated'}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">J</div>
            <div>
              <div className="text-[10px] font-semibold text-indigo-600 mb-1">JEDI</div>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="px-3 py-2 border-t border-gray-100">
        <div className="flex flex-wrap gap-1 mb-2">
          {QUICK_PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={loading}
              className="px-2 py-0.5 text-[10px] rounded-full border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-1.5">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inp}
            placeholder="Describe your design changes..."
            onChange={e => setInp(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="flex-1 resize-none text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
          />
          <button
            disabled={!inp.trim() || loading}
            onClick={() => send()}
            className="px-2.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
};
