import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Bot, Plus, GitBranch, Archive, Trash2, Copy, ArrowRightLeft, CheckCircle, Clock, Calendar } from 'lucide-react';
import { BT, SectionPanel, DataRow } from '../deal/bloomberg-ui';
import {
  listScenarios,
  getActiveScenario,
  createScenario,
  activateScenario,
  archiveScenario,
  restoreScenario,
  deleteScenario,
  updateScenarioMeta,
  computeScenarioDiff,
  type UWScenario,
  type ScenarioDiff,
} from '../../services/underwriting-scenarios.api';

const MONO = BT.font.mono;

interface ScenarioManagementTabProps {
  dealId: string;
}

export const ScenarioManagementTab: React.FC<ScenarioManagementTabProps> = ({ dealId }) => {
  const [scenarios, setScenarios] = useState<UWScenario[]>([]);
  const [active, setActive] = useState<UWScenario | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [diffResult, setDiffResult] = useState<ScenarioDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    setError(null);
    try {
      const [all, act] = await Promise.all([
        listScenarios(dealId),
        getActiveScenario(dealId).catch(() => null),
      ]);
      setScenarios(all);
      setActive(act);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const handleCreate = async () => {
    if (!newName.trim() || !dealId) return;
    setActionLoading('create');
    try {
      await createScenario(dealId, { name: newName.trim(), description: newDescription || null });
      setNewName('');
      setNewDescription('');
      setCreateOpen(false);
      await fetchAll();
    } catch (e: any) {
      setError(e?.message ?? 'Create failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (id: string) => {
    if (!dealId) return;
    setActionLoading(id);
    try {
      await activateScenario(dealId, id);
      await fetchAll();
    } catch (e: any) {
      setError(e?.message ?? 'Activate failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async (id: string) => {
    if (!dealId) return;
    setActionLoading(id);
    try {
      await archiveScenario(dealId, id);
      await fetchAll();
    } catch (e: any) {
      setError(e?.message ?? 'Archive failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (id: string) => {
    if (!dealId) return;
    setActionLoading(id);
    try {
      await restoreScenario(dealId, id);
      await fetchAll();
    } catch (e: any) {
      setError(e?.message ?? 'Restore failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!dealId) return;
    if (!window.confirm('Permanently delete this scenario? This cannot be undone.')) return;
    setActionLoading(id);
    try {
      await deleteScenario(dealId, id);
      await fetchAll();
    } catch (e: any) {
      setError(e?.message ?? 'Delete failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRename = async (id: string) => {
    if (!dealId || !renameValue.trim()) return;
    setActionLoading(id);
    try {
      await updateScenarioMeta(dealId, id, { name: renameValue.trim() });
      setRenameId(null);
      setRenameValue('');
      await fetchAll();
    } catch (e: any) {
      setError(e?.message ?? 'Rename failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFork = async (source: UWScenario) => {
    if (!dealId) return;
    setActionLoading(source.id);
    try {
      await createScenario(dealId, {
        name: `${source.name} (Copy)`,
        description: `Forked from ${source.name}`,
        source_scenario_id: source.id,
      });
      await fetchAll();
    } catch (e: any) {
      setError(e?.message ?? 'Fork failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompareToggle = (id: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const runDiff = async () => {
    if (!dealId || selectedForCompare.length !== 2) return;
    setDiffLoading(true);
    try {
      const diff = await computeScenarioDiff(dealId, selectedForCompare[0], selectedForCompare[1]);
      setDiffResult(diff);
    } catch (e: any) {
      setError(e?.message ?? 'Diff failed');
    } finally {
      setDiffLoading(false);
    }
  };

  const sorted = useMemo(() => {
    return [...scenarios].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [scenarios]);

  const grouped = useMemo(() => {
    const active = sorted.filter(s => s.is_active);
    const regular = sorted.filter(s => !s.is_active && !s.archived_at);
    const archived = sorted.filter(s => s.archived_at);
    return { active, regular, archived };
  }, [sorted]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', background: BT.bg.header,
        borderBottom: `1px solid ${BT.border.subtle}`, flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: BT.text.white, fontFamily: MONO, letterSpacing: 0.8 }}>
          ◐ SCENARIO MANAGEMENT
        </span>
        <span style={{ fontSize: 9, color: BT.text.muted, fontFamily: MONO }}>
          M40 · {scenarios.length} SCENARIO{scenarios.length !== 1 ? 'S' : ''}
        </span>
        <div style={{ flex: 1 }} />

        <button
          onClick={() => setCompareMode(!compareMode)}
          style={{
            background: compareMode ? `${BT.met.financial}18` : 'transparent',
            border: `1px solid ${compareMode ? BT.met.financial : BT.border.medium}`,
            color: compareMode ? BT.met.financial : BT.text.muted,
            fontFamily: MONO, fontSize: 9, padding: '2px 8px',
            cursor: 'pointer', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <ArrowRightLeft size={10} />
          {compareMode ? 'COMPARE MODE' : 'COMPARE'}
        </button>

        <button
          onClick={() => setCreateOpen(!createOpen)}
          style={{
            background: BT.met.financial,
            border: 'none', color: '#000',
            fontFamily: MONO, fontSize: 9, fontWeight: 700,
            padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
            display: 'flex', alignItems: 'center', gap: 3,
          }}
        >
          <Plus size={10} /> NEW
        </button>
      </div>

      {/* Create panel */}
      {createOpen && (
        <div style={{
          padding: '10px 12px',
          background: BT.bg.panel,
          borderBottom: `1px solid ${BT.border.subtle}`,
          display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0,
        }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Scenario name..."
              autoFocus
              style={{
                width: '100%',
                background: BT.bg.input ?? '#111',
                border: `1px solid ${BT.border.medium}`,
                color: BT.text.primary,
                fontFamily: MONO, fontSize: 10,
                padding: '4px 8px', borderRadius: 2, outline: 'none',
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
            />
            <input
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              style={{
                width: '100%',
                background: BT.bg.input ?? '#111',
                border: `1px solid ${BT.border.medium}`,
                color: BT.text.primary,
                fontFamily: MONO, fontSize: 9,
                padding: '3px 8px', borderRadius: 2, outline: 'none',
              }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || actionLoading === 'create'}
            style={{
              background: BT.met.financial, border: 'none', color: '#000',
              fontFamily: MONO, fontSize: 9, fontWeight: 700,
              padding: '4px 12px', cursor: 'pointer', borderRadius: 2,
              opacity: !newName.trim() ? 0.5 : 1,
            }}
          >
            {actionLoading === 'create' ? 'CREATING…' : 'CREATE'}
          </button>
          <button
            onClick={() => setCreateOpen(false)}
            style={{
              background: 'transparent', border: `1px solid ${BT.border.medium}`,
              color: BT.text.muted, fontFamily: MONO, fontSize: 9,
              padding: '4px 10px', cursor: 'pointer', borderRadius: 2,
            }}
          >
            CANCEL
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '4px 10px', background: '#EF444410',
          borderBottom: `1px solid #EF444444`,
          fontFamily: MONO, fontSize: 9, color: '#EF4444',
          flexShrink: 0,
        }}>
          {error}
          <button onClick={() => setError(null)} style={{
            float: 'right', background: 'transparent', border: 'none',
            color: '#EF4444', cursor: 'pointer', fontFamily: MONO, fontSize: 9,
          }}>
            ✕
          </button>
        </div>
      )}

      {/* Compare mode info */}
      {compareMode && (
        <div style={{
          padding: '6px 10px', background: `${BT.met.financial}10`,
          borderBottom: `1px solid ${BT.met.financial}44`,
          fontFamily: MONO, fontSize: 9, color: BT.met.financial,
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>Select 2 scenarios to compare</span>
          <span style={{ color: BT.text.muted }}>
            {selectedForCompare.length}/2 selected
          </span>
          {selectedForCompare.length === 2 && (
            <button
              onClick={runDiff}
              disabled={diffLoading}
              style={{
                background: BT.met.financial, border: 'none', color: '#000',
                fontFamily: MONO, fontSize: 9, fontWeight: 700,
                padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
              }}
            >
              {diffLoading ? 'COMPUTING…' : 'RUN DIFF'}
            </button>
          )}
          {diffResult && (
            <button
              onClick={() => { setDiffResult(null); setSelectedForCompare([]); }}
              style={{
                background: 'transparent', border: `1px solid ${BT.border.medium}`,
                color: BT.text.muted, fontFamily: MONO, fontSize: 9,
                padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
              }}
            >
              CLEAR
            </button>
          )}
        </div>
      )}

      {/* Diff result panel */}
      {diffResult && (
        <div style={{
          flexShrink: 0,
          maxHeight: 300,
          overflowY: 'auto',
          background: BT.bg.panel,
          borderBottom: `1px solid ${BT.border.subtle}`,
        }}>
          <div style={{
            padding: '6px 10px', background: BT.bg.header,
            borderBottom: `1px solid ${BT.border.subtle}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: BT.text.white, fontWeight: 700 }}>
              DIFF RESULT
            </span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.muted }}>
              {diffResult.summary.fields_with_changes} CHANGED · {diffResult.summary.fields_unchanged} SAME · {diffResult.summary.materially_different} MAJOR
            </span>
          </div>
          <div style={{ padding: '4px 0' }}>
            {diffResult.field_diffs.map((f, i) => (
              <div key={i} style={{
                padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: MONO, fontSize: 9,
                borderBottom: `1px solid ${BT.border.subtle}10`,
              }}>
                <span style={{ width: 140, color: BT.text.secondary, flexShrink: 0 }}>{f.field_path}</span>
                <span style={{ width: 80, color: BT.text.muted, textAlign: 'right' }}>
                  {f.scenario_a_value != null ? f.scenario_a_value.toLocaleString() : '—'}
                </span>
                <span style={{ width: 80, color: BT.text.primary, textAlign: 'right', fontWeight: 700 }}>
                  {f.scenario_b_value != null ? f.scenario_b_value.toLocaleString() : '—'}
                </span>
                <span style={{
                  width: 60, textAlign: 'right',
                  color: f.delta_absolute > 0 ? BT.text.green : f.delta_absolute < 0 ? '#EF4444' : BT.text.muted,
                }}>
                  {f.delta_pct != null ? `${f.delta_pct > 0 ? '+' : ''}${f.delta_pct.toFixed(1)}%` : '—'}
                </span>
                <span style={{
                  padding: '1px 4px', borderRadius: 2, fontSize: 8, fontWeight: 700,
                  background: f.significance === 'major' ? '#EF444420' : f.significance === 'minor' ? '#F59E0B20' : '#6B758520',
                  color: f.significance === 'major' ? '#EF4444' : f.significance === 'minor' ? '#F59E0B' : '#6B7585',
                }}>
                  {f.significance.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scenario list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {loading ? (
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, padding: 20 }}>
            Loading scenarios…
          </div>
        ) : (
          <>
            {renderGroup('ACTIVE', grouped.active, true)}
            {renderGroup('SCENARIOS', grouped.regular, false)}
            {grouped.archived.length > 0 && renderGroup('ARCHIVED', grouped.archived, false, true)}
          </>
        )}
      </div>
    </div>
  );

  function renderGroup(label: string, items: UWScenario[], isActiveGroup: boolean, isArchived = false) {
    if (items.length === 0 && !isActiveGroup) return null;
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: MONO, fontSize: 8, fontWeight: 800,
          color: BT.text.muted, letterSpacing: 1,
          padding: '4px 0', borderBottom: `1px solid ${BT.border.subtle}`,
          marginBottom: 6,
        }}>
          {label} · {items.length}
        </div>
        {items.length === 0 && isActiveGroup && (
          <div style={{ fontFamily: MONO, fontSize: 9, color: BT.text.muted, padding: '8px 0' }}>
            No active scenario. Create one to get started.
          </div>
        )}
        {items.map(s => (
          <ScenarioRow
            key={s.id}
            scenario={s}
            isActive={s.id === active?.id}
            isArchived={isArchived}
            compareMode={compareMode}
            isSelected={selectedForCompare.includes(s.id)}
            actionLoading={actionLoading}
            renameId={renameId}
            renameValue={renameValue}
            onActivate={handleActivate}
            onArchive={handleArchive}
            onRestore={handleRestore}
            onDelete={handleDelete}
            onRename={(id, val) => { setRenameId(id); setRenameValue(val); }}
            onRenameSubmit={handleRename}
            onFork={handleFork}
            onCompareToggle={handleCompareToggle}
          />
        ))}
      </div>
    );
  }
};

// ── Row sub-component ────────────────────────────────────────────────────────

interface RowProps {
  scenario: UWScenario;
  isActive: boolean;
  isArchived: boolean;
  compareMode: boolean;
  isSelected: boolean;
  actionLoading: string | null;
  renameId: string | null;
  renameValue: string;
  onActivate: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, val: string) => void;
  onRenameSubmit: (id: string) => void;
  onFork: (s: UWScenario) => void;
  onCompareToggle: (id: string) => void;
}

function ScenarioRow(props: RowProps) {
  const {
    scenario, isActive, isArchived, compareMode, isSelected,
    actionLoading, renameId, renameValue,
    onActivate, onArchive, onRestore, onDelete, onRename, onRenameSubmit,
    onFork, onCompareToggle,
  } = props;

  const [menuOpen, setMenuOpen] = useState(false);
  const isAgent = scenario.created_by === 'agent';
  const color = isAgent ? '#8B5CF6' : '#F5A623';
  const isLoading = actionLoading === scenario.id;
  const isRenaming = renameId === scenario.id;

  return (
    <div style={{
      padding: '6px 8px',
      borderRadius: 2,
      background: isActive ? `${color}10` : 'transparent',
      border: `1px solid ${isActive ? color : 'transparent'}`,
      marginBottom: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Compare checkbox */}
        {compareMode && (
          <button
            onClick={() => onCompareToggle(scenario.id)}
            style={{
              width: 14, height: 14, borderRadius: 2,
              border: `1px solid ${isSelected ? BT.met.financial : BT.border.medium}`,
              background: isSelected ? BT.met.financial : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            {isSelected && <CheckCircle size={10} color="#000" />}
          </button>
        )}

        {/* Active dot */}
        {isActive && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: color, flexShrink: 0,
          }} />
        )}

        {/* Name */}
        {isRenaming ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
            <input
              value={renameValue}
              onChange={e => onRename(scenario.id, e.target.value)}
              autoFocus
              style={{
                flex: 1,
                background: BT.bg.input ?? '#111',
                border: `1px solid ${BT.border.medium}`,
                color: BT.text.primary,
                fontFamily: MONO, fontSize: 10,
                padding: '2px 6px', borderRadius: 2, outline: 'none',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') onRenameSubmit(scenario.id);
                if (e.key === 'Escape') onRename('', '');
              }}
            />
            <button
              onClick={() => onRenameSubmit(scenario.id)}
              style={{
                background: 'transparent', border: 'none',
                color: BT.text.green, fontFamily: MONO, fontSize: 9,
                cursor: 'pointer', padding: 0,
              }}
            >
              ✓
            </button>
          </div>
        ) : (
          <button
            onClick={() => !isActive && onActivate(scenario.id)}
            disabled={isActive || isLoading}
            style={{
              flex: 1, textAlign: 'left',
              background: 'transparent', border: 'none',
              color: isActive ? color : BT.text.primary,
              fontFamily: MONO, fontSize: 10,
              cursor: isActive ? 'default' : 'pointer',
              padding: 0, fontWeight: isActive ? 700 : 400,
            }}
          >
            {isAgent && <Bot size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />}
            {scenario.name}
          </button>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isLoading && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: BT.text.amber }}>…</span>
          )}
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{
              background: 'transparent', border: 'none',
              color: BT.text.muted, fontFamily: MONO, fontSize: 11,
              cursor: 'pointer', padding: '0 2px',
            }}
          >
            ⋯
          </button>
        </div>
      </div>

      {/* Meta */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginTop: 4, marginLeft: isActive ? 14 : 0,
      }}>
        <span style={{ fontSize: 8, color, fontWeight: 700, letterSpacing: 0.5 }}>
          {isAgent ? 'AGENT' : 'USER'}
        </span>
        <span style={{ fontSize: 8, color: BT.text.muted, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Calendar size={8} />
          {new Date(scenario.created_at).toLocaleDateString()}
        </span>
        {scenario.parent_id && (
          <span style={{ fontSize: 8, color: BT.text.muted, display: 'flex', alignItems: 'center', gap: 2 }}>
            <GitBranch size={8} /> FORK
          </span>
        )}
        {scenario.description && (
          <span style={{ fontSize: 8, color: BT.text.muted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {scenario.description}
          </span>
        )}
      </div>

      {/* Menu */}
      {menuOpen && !isRenaming && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4,
          marginTop: 6, marginLeft: isActive ? 14 : 0,
        }}>
          <button onClick={() => { onRename(scenario.id, scenario.name); setMenuOpen(false); }} style={actionBtn}>
            RENAME
          </button>
          <button onClick={() => { onFork(scenario); setMenuOpen(false); }} style={actionBtn}>
            <Copy size={8} style={{ marginRight: 2 }} /> DUPLICATE
          </button>
          {isArchived ? (
            <button onClick={() => { onRestore(scenario.id); setMenuOpen(false); }} style={actionBtn}>
              <Archive size={8} style={{ marginRight: 2 }} /> RESTORE
            </button>
          ) : (
            <button onClick={() => { onArchive(scenario.id); setMenuOpen(false); }} style={actionBtn}>
              <Archive size={8} style={{ marginRight: 2 }} /> ARCHIVE
            </button>
          )}
          <button onClick={() => { onDelete(scenario.id); setMenuOpen(false); }} style={{ ...actionBtn, color: '#EF4444' }}>
            <Trash2 size={8} style={{ marginRight: 2 }} /> DELETE
          </button>
        </div>
      )}
    </div>
  );
}

const actionBtn: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${BT.border.subtle}`,
  color: BT.text.secondary,
  fontFamily: MONO,
  fontSize: 8,
  padding: '1px 6px',
  cursor: 'pointer',
  borderRadius: 2,
  display: 'flex',
  alignItems: 'center',
};

export default ScenarioManagementTab;
