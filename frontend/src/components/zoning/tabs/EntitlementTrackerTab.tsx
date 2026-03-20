import { T as BT } from '../../deal/bloomberg-tokens';
import React, { useState } from 'react';
import { useEntitlements, EntitlementFormData } from '../../../hooks/useEntitlements';
import { useZoningModuleStore } from '../../../stores/zoningModuleStore';
import SourceCitation, { ViewSourceBadge } from '../SourceCitation';
import type { SourceCitationData } from '../SourceCitation';
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

function getRiskStyle(level: RiskLevel): { color: string; bg: string } {
  if (level === 'low') return { color: BT.greenL, bg: BT.greenBg };
  if (level === 'medium') return { color: BT.amberL, bg: BT.amberBg };
  return { color: BT.redL, bg: BT.redBg };
}

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
        <div className="mx-4 mb-2 p-2 rounded text-sm" style={{ background: BT.redBg, border: `1px solid ${BT.red}50`, color: BT.redL }}>
          {error}
        </div>
      )}

      {loading && !selectedEntitlement ? (
        <div className="flex items-center justify-center flex-1" style={{ color: BT.td }}>
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
  const selectStyle: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: '0.875rem',
    background: BT.bgCard,
    color: BT.text,
    border: `1px solid ${BT.borderL}`,
    outline: 'none',
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 flex-wrap" style={{ borderBottom: `1px solid ${BT.border}`, background: BT.bgCard }}>
      <select style={selectStyle} value={filter.market || ''} onChange={(e) => onFilterChange({ market: e.target.value || null })}>
        <option value="">All Markets</option>
        <option value="atlanta">Atlanta</option>
        <option value="dallas">Dallas</option>
        <option value="phoenix">Phoenix</option>
        <option value="tampa">Tampa</option>
      </select>

      <select style={selectStyle} value={filter.status || ''} onChange={(e) => onFilterChange({ status: (e.target.value as EntitlementStatus) || null })}>
        <option value="">All Statuses</option>
        {KANBAN_COLUMNS.map((col) => (
          <option key={col.status} value={col.status}>{col.label}</option>
        ))}
        <option value="denied">Denied</option>
        <option value="withdrawn">Withdrawn</option>
      </select>

      <select style={selectStyle} value={filter.type || ''} onChange={(e) => onFilterChange({ type: (e.target.value as EntitlementType) || null })}>
        <option value="">All Types</option>
        {(Object.keys(TYPE_LABELS) as EntitlementType[]).map((t) => (
          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Deal ID…"
        style={{ ...selectStyle, width: 128 }}
        value={filter.dealId || ''}
        onChange={(e) => onFilterChange({ dealId: e.target.value || null })}
      />

      <select style={selectStyle} value={filter.sortBy} onChange={(e) => onFilterChange({ sortBy: e.target.value })}>
        {SORT_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onRefresh}
          className="px-3 py-1.5 text-sm rounded-md transition-colors"
          style={{ color: BT.tm, border: `1px solid ${BT.borderL}`, background: 'transparent' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = BT.text; (e.currentTarget as HTMLElement).style.background = BT.bgPanel; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = BT.tm; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          ↻ Refresh
        </button>
        <button
          onClick={onCreate}
          className="px-3 py-1.5 text-sm text-white rounded-md transition-colors"
          style={{ background: BT.blue }}
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
          <div key={col.key} className="flex flex-col rounded-lg min-w-0" style={{ background: BT.bgPanel }}>
            <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: `1px solid ${BT.border}` }}>
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: BT.tm }}>{col.label}</span>
              <span className="text-xs rounded-full px-2 py-0.5 font-medium"
                style={{ color: BT.td, background: BT.border }}>
                {items.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {items.length === 0 && (
                <p className="text-xs text-center py-6" style={{ color: BT.td }}>No entitlements</p>
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
  const risk = getRiskStyle(entitlement.riskLevel);
  return (
    <div
      onClick={onClick}
      className="p-3 rounded-lg shadow-sm cursor-pointer transition-all"
      style={{
        background: BT.bgCard,
        border: selected ? `1px solid ${BT.blue}` : `1px solid ${BT.border}`,
        boxShadow: selected ? `0 0 0 2px ${BT.blue}30` : undefined,
      }}
    >
      <p className="text-sm font-semibold truncate" style={{ color: BT.text }}>{entitlement.parcelAddress}</p>

      <div className="mt-1.5 pt-1.5" style={{ borderTop: `1px solid ${BT.border}` }}>
        <p className="text-xs font-medium" style={{ color: BT.tm }}>{TYPE_LABELS[entitlement.type]}</p>
        {(entitlement.fromDistrict || entitlement.toDistrict) && (
          <p className="text-xs mt-0.5" style={{ color: BT.td }}>
            {entitlement.fromDistrict || '—'} → {entitlement.toDistrict || '—'}
          </p>
        )}
      </div>

      <div className="mt-2 pt-1.5 flex items-center justify-between" style={{ borderTop: `1px solid ${BT.border}` }}>
        {entitlement.nextMilestoneDate ? (
          <span className="text-xs font-medium" style={{ color: BT.td }}>
            Due: {getDaysUntil(entitlement.nextMilestoneDate)}
          </span>
        ) : (
          <span />
        )}
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: risk.color, background: risk.bg }}>
          Risk: {entitlement.riskLevel === 'low' ? 'Low' : entitlement.riskLevel === 'medium' ? 'Med' : 'High'}
        </span>
        <SourceCitation section="§16-28.007" url="#" sourceType="code" lastVerified="2025-11-14" />
      </div>

      {entitlement.dealId && (
        <div className="mt-1.5 pt-1" style={{ borderTop: `1px solid ${BT.border}` }}>
          <p className="text-xs font-medium truncate" style={{ color: BT.blueL }}>
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
  const risk = getRiskStyle(entitlement.riskLevel);
  return (
    <div className="w-[420px] overflow-y-auto flex-shrink-0" style={{ borderLeft: `1px solid ${BT.border}`, background: BT.bgCard }}>
      <div className="sticky top-0 px-4 py-3 flex items-center justify-between z-10"
        style={{ background: BT.bgCard, borderBottom: `1px solid ${BT.border}` }}>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate" style={{ color: BT.text }}>{entitlement.parcelAddress}</h3>
          <p className="text-xs mt-0.5" style={{ color: BT.td }}>
            {TYPE_LABELS[entitlement.type]}
            {(entitlement.fromDistrict || entitlement.toDistrict) && (
              <> — {entitlement.fromDistrict || '—'} → {entitlement.toDistrict || '—'}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={onEdit} className="p-1 transition-colors" style={{ color: BT.td }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = BT.blueL; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = BT.td; }} title="Edit">
            ✎
          </button>
          <button onClick={onDelete} className="p-1 transition-colors" style={{ color: BT.td }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = BT.redL; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = BT.td; }} title="Delete">
            ✕
          </button>
          <button onClick={onClose} className="p-1 transition-colors" style={{ color: BT.td }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = BT.tm; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = BT.td; }} title="Close">
            ✖
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: risk.color, background: risk.bg }}>
            {entitlement.riskLevel === 'low' ? 'Low Risk' : entitlement.riskLevel === 'medium' ? 'Medium Risk' : 'High Risk'}
          </span>
          <ViewSourceBadge section="§16-28.007" url="#" sourceType="code" lastVerified="2025-11-14" />
          {entitlement.dealId && (
            <span className="text-xs font-medium" style={{ color: BT.blueL }}>🔗 Deal #{entitlement.dealId}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs rounded-lg p-3" style={{ color: BT.td, background: BT.bgPanel }}>
          <div><span className="font-medium" style={{ color: BT.tm }}>Filed:</span> {formatDate(entitlement.filedDate)}</div>
          <div><span className="font-medium" style={{ color: BT.tm }}>Hearing:</span> {formatDate(entitlement.hearingDate)} <SourceCitation section="§16-30.003" url="#" sourceType="record" lastVerified="2025-11-14" /></div>
          <div><span className="font-medium" style={{ color: BT.tm }}>Approval:</span> {formatDate(entitlement.approvalDate)}</div>
          <div><span className="font-medium" style={{ color: BT.tm }}>Next:</span> {entitlement.nextMilestone || '—'} <SourceCitation section="§16-30.010" url="#" sourceType="calculated" lastVerified="2025-11-14" /></div>
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
            <h4 className="text-xs font-semibold uppercase mb-1" style={{ color: BT.td }}>Notes</h4>
            <p className="text-sm" style={{ color: BT.tm }}>{entitlement.notes}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: `1px solid ${BT.border}` }}>
          {entitlement.dealId && (
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
              style={{ color: BT.blueL, background: BT.blueBg, border: `1px solid ${BT.blue}40` }}>
              📎 Open Deal Capsule
            </button>
          )}
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
            style={{ color: BT.tm, background: BT.bgCard, border: `1px solid ${BT.borderL}` }}>
            📊 Financial Impact Analysis
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
            style={{ color: BT.tm, background: BT.bgCard, border: `1px solid ${BT.borderL}` }}>
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

  const statusColor = (status: string): string => {
    if (status === 'completed') return BT.greenL;
    if (status === 'in_progress') return BT.blueL;
    return BT.td;
  };

  const dotBg = (status: string): string => {
    if (status === 'completed') return BT.green;
    if (status === 'in_progress') return BT.blue;
    return BT.borderL;
  };

  const lineBg = (status: string): string => {
    if (status === 'completed') return BT.greenL;
    return BT.border;
  };

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase mb-3" style={{ color: BT.td }}>Timeline</h4>
      <div className="overflow-x-auto">
        <div className="flex items-start min-w-0">
          {sorted.map((m, idx) => (
            <div key={m.id} className="flex items-start flex-shrink-0" style={{ width: `${100 / sorted.length}%`, minWidth: '60px' }}>
              <div className="flex flex-col items-center w-full">
                <div className="flex items-center w-full">
                  {idx > 0 && <div className="h-0.5 flex-1" style={{ background: lineBg(sorted[idx - 1].status) }} />}
                  {idx === 0 && <div className="flex-1" />}
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: dotBg(m.status), boxShadow: m.status === 'in_progress' ? `0 0 0 4px ${BT.blueBg}` : undefined }} />
                  {idx < sorted.length - 1 && <div className="h-0.5 flex-1" style={{ background: lineBg(m.status) }} />}
                  {idx === sorted.length - 1 && <div className="flex-1" />}
                </div>
                <p className="text-[10px] font-medium mt-1.5 text-center leading-tight" style={{ color: statusColor(m.status) }}>
                  {m.name}
                </p>
                <p className="text-[9px] text-center mt-0.5" style={{ color: BT.td }}>
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
    <div className="rounded-lg p-3" style={{ background: BT.blueBg, border: `1px solid ${BT.blue}40` }}>
      <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: BT.blueL }}>News Intelligence</h4>
      <p className="text-xs mb-2" style={{ color: BT.blueL }}>Related articles detected:</p>
      <ul className="space-y-1.5">
        <li className="text-xs" style={{ color: BT.tm }}>
          <span style={{ color: BT.blue }}>•</span> "Midtown density debate heats up" — <span style={{ color: BT.td }}>AJC (2/18)</span>
        </li>
        <li className="text-xs" style={{ color: BT.tm }}>
          <span style={{ color: BT.blue }}>•</span> "Atlanta planning commission approves new density guidelines" — <span style={{ color: BT.td }}>(2/5)</span>
        </li>
      </ul>
    </div>
  );
}

function DocumentsList({ documents }: { documents: EntitlementDocument[] }) {
  if (!documents || documents.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: BT.td }}>Documents</h4>
      <ul className="space-y-1.5">
        {documents.map((doc, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span style={{ color: BT.td }}>📄</span>
            <div className="flex-1 min-w-0">
              {doc.url ? (
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate block" style={{ color: BT.blueL }}>
                  {doc.name}
                </a>
              ) : (
                <span className="truncate block" style={{ color: BT.tm }}>{doc.name}</span>
              )}
              <span className="text-xs" style={{ color: BT.td }}>{doc.type} · {formatDate(doc.date)}</span>
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
      <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: BT.td }}>Contacts</h4>
      <ul className="space-y-1.5">
        {contacts.map((c, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium" style={{ color: BT.text }}>{c.name}</span>
            <span style={{ color: BT.td }}> · {c.role}</span>
            {c.organization && <span style={{ color: BT.td }}> · {c.organization}</span>}
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
      <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: BT.td }}>AI Risk Factors</h4>
      <ul className="space-y-1">
        {factors.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span style={{ color: f.type === 'positive' ? BT.green : f.type === 'warning' ? BT.amber : BT.td }}>
              {f.type === 'positive' ? '●' : f.type === 'warning' ? '▲' : '○'}
            </span>
            <span style={{ color: f.type === 'positive' ? BT.greenL : f.type === 'warning' ? BT.amberL : BT.tm }}>
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 6,
    fontSize: '0.875rem',
    background: BT.bgPanel,
    color: BT.text,
    border: `1px solid ${BT.borderL}`,
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 500,
    marginBottom: 4,
    color: BT.tm,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ background: BT.bgCard }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BT.border}` }}>
          <h2 className="text-lg font-semibold" style={{ color: BT.text }}>
            {entitlement ? 'Edit Entitlement' : 'New Entitlement'}
          </h2>
          <button onClick={onClose} className="transition-colors" style={{ color: BT.td }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = BT.tm; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = BT.td; }}>✖</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label style={labelStyle}>Parcel Address *</label>
            <input type="text" required style={inputStyle} value={form.parcelAddress} onChange={(e) => update('parcelAddress', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={form.type} onChange={(e) => update('type', e.target.value)}>
                {(Object.keys(TYPE_LABELS) as EntitlementType[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={(e) => update('status', e.target.value)}>
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
              <label style={labelStyle}>From District</label>
              <input type="text" style={inputStyle} value={form.fromDistrict || ''} onChange={(e) => update('fromDistrict', e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>To District</label>
              <input type="text" style={inputStyle} value={form.toDistrict || ''} onChange={(e) => update('toDistrict', e.target.value || null)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Risk Level</label>
            <select style={inputStyle} value={form.riskLevel} onChange={(e) => update('riskLevel', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Deal ID</label>
            <input type="text" style={inputStyle} value={form.dealId || ''} onChange={(e) => update('dealId', e.target.value || null)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Filed Date</label>
              <input type="date" style={inputStyle} value={form.filedDate || ''} onChange={(e) => update('filedDate', e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>Hearing Date</label>
              <input type="date" style={inputStyle} value={form.hearingDate || ''} onChange={(e) => update('hearingDate', e.target.value || null)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label style={labelStyle}>Cost Low ($)</label>
              <input type="number" style={inputStyle} value={form.estCostLow ?? ''} onChange={(e) => update('estCostLow', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <label style={labelStyle}>Cost High ($)</label>
              <input type="number" style={inputStyle} value={form.estCostHigh ?? ''} onChange={(e) => update('estCostHigh', e.target.value ? Number(e.target.value) : null)} />
            </div>
            <div>
              <label style={labelStyle}>Timeline (mo)</label>
              <input type="number" style={inputStyle} value={form.estTimelineMonths ?? ''} onChange={(e) => update('estTimelineMonths', e.target.value ? Number(e.target.value) : null)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, resize: 'none' }} rows={3} value={form.notes || ''} onChange={(e) => update('notes', e.target.value || null)} />
          </div>

          <div className="flex justify-end gap-3 pt-2" style={{ borderTop: `1px solid ${BT.border}` }}>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md transition-colors"
              style={{ color: BT.tm, border: `1px solid ${BT.borderL}`, background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = BT.bgPanel; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm text-white rounded-md transition-colors"
              style={{ background: BT.blue }}>
              {entitlement ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
