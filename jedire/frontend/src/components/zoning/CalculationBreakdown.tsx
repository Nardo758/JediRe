import React, { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, Calculator } from 'lucide-react';
import SourceCitation, { type SourceCitationData } from './SourceCitation';

export interface CalculationInput {
  label: string;
  value: string | number;
  unit?: string;
  citation?: SourceCitationData;
}

export interface CrossReferenceAlert {
  message: string;
  sections: string[];
}

export interface CalculationItem {
  label: string;
  formula: string;
  result: string | number;
  resultUnit?: string;
  inputs: CalculationInput[];
  crossReferenceAlerts?: CrossReferenceAlert[];
}

export interface CalculationSection {
  title: string;
  icon?: string;
  items: CalculationItem[];
}

interface CalculationBreakdownProps {
  sections: CalculationSection[];
  onOpenSourcePanel?: (data: SourceCitationData) => void;
  defaultExpanded?: boolean;
}

function CalculationItemRow({
  item,
  onOpenSourcePanel,
}: {
  item: CalculationItem;
  onOpenSourcePanel?: (data: SourceCitationData) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-gray-700 truncate">{item.label}</span>
          {item.crossReferenceAlerts && item.crossReferenceAlerts.length > 0 && (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-sm font-semibold text-gray-900">{item.result}</span>
          {item.resultUnit && (
            <span className="text-xs text-gray-500">{item.resultUnit}</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-100 bg-gray-50/50 space-y-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-2">
            <Calculator className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            <code className="text-xs text-gray-800 font-mono">{item.formula}</code>
          </div>

          <div className="space-y-1.5">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Inputs</div>
            {item.inputs.map((input, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 text-xs px-1">
                <span className="text-gray-600">{input.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-900">
                    {input.value}{input.unit ? ` ${input.unit}` : ''}
                  </span>
                  {input.citation && (
                    <SourceCitation {...input.citation} onOpenPanel={onOpenSourcePanel} />
                  )}
                </div>
              </div>
            ))}
          </div>

          {item.crossReferenceAlerts && item.crossReferenceAlerts.length > 0 && (
            <div className="space-y-1.5">
              {item.crossReferenceAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-amber-800">{alert.message}</p>
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      Sections: {alert.sections.join(', ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CalculationBreakdown({
  sections,
  onOpenSourcePanel,
  defaultExpanded = false,
}: CalculationBreakdownProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((s) => {
      initial[s.title] = defaultExpanded;
    });
    return initial;
  });

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  if (!sections || sections.length === 0) return null;

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const isOpen = expandedSections[section.title] ?? false;
        return (
          <div key={section.title} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleSection(section.title)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                {section.icon && <span className="text-sm">{section.icon}</span>}
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                  {section.title}
                </span>
              </div>
              <span className="text-[10px] text-gray-400">
                {section.items.length} calculation{section.items.length !== 1 ? 's' : ''}
              </span>
            </button>

            {isOpen && (
              <div className="px-5 pb-4 space-y-2 border-t border-gray-100">
                <div className="pt-3" />
                {section.items.map((item, idx) => (
                  <CalculationItemRow
                    key={idx}
                    item={item}
                    onOpenSourcePanel={onOpenSourcePanel}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
