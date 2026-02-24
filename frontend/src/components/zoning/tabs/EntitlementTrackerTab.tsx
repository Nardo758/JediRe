import React, { useState } from 'react';
import { useEntitlements, EntitlementFormData } from '../../../hooks/useEntitlements';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import type {
  Entitlement,
  EntitlementStatus,
  EntitlementType,
  EntitlementMilestone,
  RiskFactor,
  EntitlementDocument,
  EntitlementContact,
  RiskLevel,
} from '../../../types/zoning.types';

const KANBAN_COLUMNS: { key: string; label: string; status: EntitlementStatus }[] = [
  { key: 'pre_application', label: 'Pre-App', status: 'pre_application' },
  { key: 'submitted', label: 'Submitted', status: 'submitted' },
  { key: 'under_review', label: 'Under Review', status: 'under_review' },
  { key: 'hearing', label: 'Hearing', status: 'hearing' },
  { key: 'approved', label: 'Approved', status: 'approved' },
];

const TYPE_LABELS: Record<EntitlementType, string> = {
  rezone: 'Rezone',
  variance: 'Variance',
  cup: 'Conditional Use',
  site_plan: 'Site Plan',
  annexation: 'Annexation',
  lot_split: 'Lot Split',
  sap: 'SAP',
  other: 'Other',
};

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'text-green-600 bg-green-50',
  medium: 'text-yellow-600 bg-yellow-50',
  high: 'text-red-600 bg-red-50',
};

const SORT_OPTIONS = [
  { value: 'filedDate', label: 'Filed Date' },
  { value: 'nextMilestoneDate', label: 'Next Milestone' },
  { value: 'riskLevel', label: 'Risk Level' },
  { value: 'parcelAddress', label: 'Address' },
];

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface EntitlementTrackerTabProps {
  dealId?: string;
  deal?: any;
}

export default function EntitlementTrackerTab({ dealId, deal }: EntitlementTrackerTabProps = {}) {
  const {
    kanbanData,
    loading,
    error,
    selectedEntitlement,
    setSelectedEntitlement,
    fetchEntitlements,
    createEntitlement,
    updateEntitlement,
    deleteEntitlement,
  } = useEntitlements();

  const { entitlementFilter, updateEntitlementFilter } = useZoningModuleStore();

  const [showModal, setShowModal] = useState(false);
  const [editingEntitlement, setEditingEntitlement] = useState<Entitlement | null>(null);

  const handleOpenCreate = () => {
    setEditingEntitlement(null);
    setShowModal(true);
  };

  const handleOpenEdit = (ent: Entitlement) => {
    setEditingEntitlement(ent);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEntitlement(null);
  };

  const handleSave = async (formData: EntitlementFormData) => {
    if (editingEntitlement) {
      await updateEntitlement(editingEntitlement.id, formData);
    } else {
      await createEntitlement(formData);
    }
    handleCloseModal();
    fetchEntitlements();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this entitlement?')) {
      await deleteEntitlement(id);
      setSelectedEntitlement(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <FilterBar
        filter={entitlementFilter}
        onFilterChange={updateEntitlementFilter}
        onRefresh={() => fetchEntitlements()}
        onCreate={handleOpenCreate}
      />

      {error && (
        <div className="mx-4 mb-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && !selectedEntitlement ? (
        <div className="flex items-center justify-center flex-1 text-gray-400">
          <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading…
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className={`flex-1 overflow-x-auto ${selectedEntitlement ? 'w-1/2' : 'w-full'}`}>
            <KanbanBoard
              data={kanbanData}
              onCardClick={(ent) => setSelectedEntitlement(ent)}
              selectedId={selectedEntitlement?.id || null}
            />
          </div>

          {selectedEntitlement && (
            <DetailPanel
              entitlement={selectedEntitlement}
              onClose={() => setSelectedEntitlement(null)}
              onEdit={() => handleOpenEdit(selectedEntitlement)}
              onDelete={() => handleDelete(selectedEntitlement.id)}
            />
          )}
        </div>
      )}

      {showModal && (
        <EntitlementModal
          entitlement={editingEntitlement}
          onSave={handleSave}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

function FilterBar({
  filter,
  onFilterChange,
  onRefresh,
  onCreate,
}: {
  filter: {
    market: string | null;
    status: EntitlementStatus | null;
    type: EntitlementType | null;
    dealId: string | null;
    sortBy: string;
  };
  onFilterChange: (f: any) => void;
  onRefresh: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-wrap">
      <select
        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        value={filter.market || ''}
        onChange={(e) => onFilterChange({ market: e.target.value || null })}
      >
        <option value="">All Markets</option>
        <option value="atlanta">Atlanta</option>
        <option value="dallas">Dallas</option>
        <option value="phoenix">Phoenix</option>
        <option value="tampa">Tampa</option>
      </select>

      <select
        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        value={filter.status || ''}
        onChange={(e) => onFilterChange({ status: (e.target.value as EntitlementStatus) || null })}
      >
        <option value="">All Statuses</option>
        {KANBAN_COLUMNS.map((col) => (
          <option key={col.status} value={col.status}>{col.label}</option>
        ))}
        <option value="denied">Denied</option>
        <option value="withdrawn">Withdrawn</option>
      </select>

      <select
        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        value={filter.type || ''}
        onChange={(e) => onFilterChange({ type: (e.target.value as EntitlementType) || null })}
      >
        <option value="">All Types</option>
        {(Object.keys(TYPE_LABELS) as EntitlementType[]).map((t) => (
          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Deal ID…"
        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm w-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        value={filter.dealId || ''}
        onChange={(e) => onFilterChange({ dealId: e.target.value || null })}
      />

      <select
        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        value={filter.sortBy}
        onChange={(e) => onFilterChange({ sortBy: e.target.value })}
      >
        {SORT_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          ↻ Refresh
        </button>
        <button
          onClick={onCreate}
          className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          + New Entitlement
        </button>
      </div>
    </div>
  );
}

function KanbanBoard({
  data,
  onCardClick,
  selectedId,
}: {
  data: Record<string, Entitlement[]>;
  onCardClick: (ent: Entitlement) => void;
  selectedId: string | null;
}) {
  return (
    <div className="grid grid-cols-5 gap-3 p-4 h-full">
      {KANBAN_COLUMNS.map((col) => {
        const items = data[col.key] || [];
        return (
          <div key={col.key} className="flex flex-col bg-gray-50 rounded-lg min-w-0">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{col.label}</span>
              <span className="text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5 font-medium">
                {items.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {items.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">No entitlements</p>
              )}
              {items.map((ent) => (
                <EntitlementCard
                  key={ent.id}
                  entitlement={ent}
                  onClick={() => onCardClick(ent)}
                  selected={ent.id === selectedId}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getDaysUntil(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `${diff}d`;
}

function EntitlementCard({
  entitlement,
  onClick,
  selected,
}: {
  entitlement: Entitlement;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-3 bg-white rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-all ${
        selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'
      }`}
    >
      <p className="text-sm font-semibold text-gray-900 truncate">{entitlement.parcelAddress}</p>

      <div className="mt-1.5 pt-1.5 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-600">{TYPE_LABELS[entitlement.type]}</p>
        {(entitlement.fromDistrict || entitlement.toDistrict) && (
          <p className="text-xs text-gray-500 mt-0.5">
            {entitlement.fromDistrict || '—'} → {entitlement.toDistrict || '—'}
          </p>
        )}
      </div>

      <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center justify-between">
        {entitlement.nextMilestoneDate ? (
          <span className="text-xs text-gray-500 font-medium">
            Due: {getDaysUntil(entitlement.nextMilestoneDate)}
          </span>
        ) : (
          <span />
        )}
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${RISK_COLORS[entitlement.riskLevel]}`}>
          Risk: {entitlement.riskLevel === 'low' ? 'Low' : entitlement.riskLevel === 'medium' ? 'Med' : 'High'}
        </span>
      </div>

      {entitlement.dealId && (
        <div className="mt-1.5 pt-1 border-t border-gray-100">
          <p className="text-xs text-blue-600 font-medium truncate">
            🔗 Deal #{entitlement.dealId}
          </p>
        </div>
      )}
    </div>
  );
}

function DetailPanel({
  entitlement,
  onClose,
  onEdit,
  onDelete,
}: {
  entitlement: Entitlement;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="w-[420px] border-l border-gray-200 bg-white overflow-y-auto flex-shrink-0">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm truncate">{entitlement.parcelAddress}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {TYPE_LABELS[entitlement.type]}
            {(entitlement.fromDistrict || entitlement.toDistrict) && (
              <> — {entitlement.fromDistrict || '—'} → {entitlement.toDistrict || '—'}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={onEdit} className="p-1 text-gray-400 hover:text-blue-600" title="Edit">
            ✎
          </button>
          <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600" title="Delete">
            ✕
          </button>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700" title="Close">
            ✖
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${RISK_COLORS[entitlement.riskLevel]}`}>
            {entitlement.riskLevel === 'low' ? 'Low Risk' : entitlement.riskLevel === 'medium' ? 'Medium Risk' : 'High Risk'}
          </span>
          {entitlement.dealId && (
            <span className="text-xs text-blue-600 font-medium">🔗 Deal #{entitlement.dealId}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
          <div><span className="font-medium text-gray-600">Filed:</span> {formatDate(entitlement.filedDate)}</div>
          <div><span className="font-medium text-gray-600">Hearing:</span> {formatDate(entitlement.hearingDate)}</div>
          <div><span className="font-medium text-gray-600">Approval:</span> {formatDate(entitlement.approvalDate)}</div>
          <div><span className="font-medium text-gray-600">Next:</span> {entitlement.nextMilestone || '—'}</div>
        </div>

        <HorizontalTimeline milestones={entitlement.milestones} />

        <div className="grid grid-cols-2 gap-4">
          <DocumentsList documents={entitlement.documents} />
          <ContactsList contacts={entitlement.contacts} />
        </div>

        <RiskFactorsList factors={entitlement.aiRiskFactors} />

        <NewsIntelligenceSection />

        {entitlement.notes && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Notes</h4>
            <p className="text-sm text-gray-700">{entitlement.notes}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
          {entitlement.dealId && (
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors">
              📎 Open Deal Capsule
            </button>
          )}
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            📊 Financial Impact Analysis
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            📧 Share Update
          </button>
        </div>
      </div>
    </div>
  );
}

function HorizontalTimeline({ milestones }: { milestones: EntitlementMilestone[] }) {
  if (!milestones || milestones.length === 0) return null;

  const sorted = [...milestones].sort((a, b) => a.sortOrder - b.sortOrder);

  const statusColor = (status: string) => {
    if (status === 'completed') return 'text-green-600';
    if (status === 'in_progress') return 'text-blue-600';
    return 'text-gray-400';
  };

  const dotBg = (status: string) => {
    if (status === 'completed') return 'bg-green-500';
    if (status === 'in_progress') return 'bg-blue-500 ring-4 ring-blue-100';
    return 'bg-gray-300';
  };

  const lineBg = (status: string) => {
    if (status === 'completed') return 'bg-green-400';
    return 'bg-gray-200';
  };

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Timeline</h4>
      <div className="overflow-x-auto">
        <div className="flex items-start min-w-0">
          {sorted.map((m, idx) => (
            <div key={m.id} className="flex items-start flex-shrink-0" style={{ width: `${100 / sorted.length}%`, minWidth: '60px' }}>
              <div className="flex flex-col items-center w-full">
                <div className="flex items-center w-full">
                  {idx > 0 && <div className={`h-0.5 flex-1 ${lineBg(sorted[idx - 1].status)}`} />}
                  {idx === 0 && <div className="flex-1" />}
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${dotBg(m.status)}`} />
                  {idx < sorted.length - 1 && <div className={`h-0.5 flex-1 ${lineBg(m.status)}`} />}
                  {idx === sorted.length - 1 && <div className="flex-1" />}
                </div>
                <p className={`text-[10px] font-medium mt-1.5 text-center leading-tight ${statusColor(m.status)}`}>
                  {m.name}
                </p>
                <p className="text-[9px] text-gray-400 text-center mt-0.5">
                  {m.status === 'completed' ? '✅' : m.status === 'in_progress' ? '🔄 NOW' : '⏳'}{' '}
                  {m.actualDate ? formatDate(m.actualDate) : m.scheduledDate ? formatDate(m.scheduledDate) : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewsIntelligenceSection() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <h4 className="text-xs font-semibold text-blue-800 uppercase mb-2">News Intelligence</h4>
      <p className="text-xs text-blue-600 mb-2">Related articles detected:</p>
      <ul className="space-y-1.5">
        <li className="text-xs text-gray-700">
          <span className="text-blue-500">•</span> "Midtown density debate heats up" — <span className="text-gray-400">AJC (2/18)</span>
        </li>
        <li className="text-xs text-gray-700">
          <span className="text-blue-500">•</span> "Atlanta planning commission approves new density guidelines" — <span className="text-gray-400">(2/5)</span>
        </li>
      </ul>
    </div>
  );
}

function DocumentsList({ documents }: { documents: EntitlementDocument[] }) {
  if (!documents || documents.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Documents</h4>
      <ul className="space-y-1.5">
        {documents.map((doc, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">📄</span>
            <div className="flex-1 min-w-0">
              {doc.url ? (
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate block">
                  {doc.name}
                </a>
              ) : (
                <span className="text-gray-700 truncate block">{doc.name}</span>
              )}
              <span className="text-xs text-gray-400">{doc.type} · {formatDate(doc.date)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactsList({ contacts }: { contacts: EntitlementContact[] }) {
  if (!contacts || contacts.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Contacts</h4>
      <ul className="space-y-1.5">
        {contacts.map((c, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium text-gray-800">{c.name}</span>
            <span className="text-gray-400"> · {c.role}</span>
            {c.organization && <span className="text-gray-400"> · {c.organization}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RiskFactorsList({ factors }: { factors: RiskFactor[] }) {
  if (!factors || factors.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">AI Risk Factors</h4>
      <ul className="space-y-1">
        {factors.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={f.type === 'positive' ? 'text-green-500' : f.type === 'warning' ? 'text-yellow-500' : 'text-gray-400'}>
              {f.type === 'positive' ? '●' : f.type === 'warning' ? '▲' : '○'}
            </span>
            <span className={f.type === 'positive' ? 'text-green-700' : f.type === 'warning' ? 'text-yellow-700' : 'text-gray-600'}>
              {f.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntitlementModal({
  entitlement,
  onSave,
  onClose,
}: {
  entitlement: Entitlement | null;
  onSave: (data: EntitlementFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EntitlementFormData>({
    dealId: entitlement?.dealId || null,
    parcelAddress: entitlement?.parcelAddress || '',
    type: entitlement?.type || 'rezone',
    fromDistrict: entitlement?.fromDistrict || null,
    toDistrict: entitlement?.toDistrict || null,
    status: entitlement?.status || 'pre_application',
    riskLevel: entitlement?.riskLevel || 'low',
    filedDate: entitlement?.filedDate || null,
    hearingDate: entitlement?.hearingDate || null,
    estCostLow: entitlement?.estCostLow || null,
    estCostHigh: entitlement?.estCostHigh || null,
    estTimelineMonths: entitlement?.estTimelineMonths || null,
    notes: entitlement?.notes || null,
  });

  const update = (key: keyof EntitlementFormData, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.parcelAddress.trim()) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {entitlement ? 'Edit Entitlement' : 'New Entitlement'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✖</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parcel Address *</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.parcelAddress}
              onChange={(e) => update('parcelAddress', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                value={form.type}
                onChange={(e) => update('type', e.target.value)}
              >
                {(Object.keys(TYPE_LABELS) as EntitlementType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
              >
                {KANBAN_COLUMNS.map((col) => (
                  <option key={col.status} value={col.status}>{col.label}</option>
                ))}
                <option value="denied">Denied</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From District</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={form.fromDistrict || ''}
                onChange={(e) => update('fromDistrict', e.target.value || null)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To District</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={form.toDistrict || ''}
                onChange={(e) => update('toDistrict', e.target.value || null)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Risk Level</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
              value={form.riskLevel}
              onChange={(e) => update('riskLevel', e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deal ID</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              value={form.dealId || ''}
              onChange={(e) => update('dealId', e.target.value || null)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filed Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={form.filedDate || ''}
                onChange={(e) => update('filedDate', e.target.value || null)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hearing Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={form.hearingDate || ''}
                onChange={(e) => update('hearingDate', e.target.value || null)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost Low ($)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={form.estCostLow ?? ''}
                onChange={(e) => update('estCostLow', e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost High ($)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={form.estCostHigh ?? ''}
                onChange={(e) => update('estCostHigh', e.target.value ? Number(e.target.value) : null)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeline (mo)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                value={form.estTimelineMonths ?? ''}
                onChange={(e) => update('estTimelineMonths', e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
              rows={3}
              value={form.notes || ''}
              onChange={(e) => update('notes', e.target.value || null)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              {entitlement ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
