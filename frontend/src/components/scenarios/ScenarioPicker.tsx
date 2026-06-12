import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Plus, ChevronDown, Archive, Trash2, Copy, GitBranch, Eye } from 'lucide-react';
import { BT } from '../deal/bloomberg-ui';
import {
  listScenarios,
  getActiveScenario,
  createScenario,
  activateScenario,
  archiveScenario,
  restoreScenario,
  deleteScenario,
  updateScenarioMeta,
  type UWScenario,
} from '../../services/underwriting-scenarios.api';

const MONO = BT.font.mono;

interface ScenarioPickerProps {
  dealId: string;
  compact?: boolean;
}

export const ScenarioPicker: React.FC<ScenarioPickerProps> = ({ dealId, compact }) => {
  const [scenarios, setScenarios] = useState<UWScenario[]>([]);
  const [active, setActive] = useState<UWScenario | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuScenarioId, setMenuScenarioId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMenuScenarioId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

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
      setOpen(false);
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

  const activeColor = active?.created_by === 'agent' ? '#8B5CF6' : '#F5A623';
  const activeLabel = active?.created_by === 'agent' ? 'AGENT' : 'USER';

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '1px 6px',
    borderRadius: 2,
    background: 'transparent',
    border: `1px solid ${activeColor}44`,
    cursor: 'pointer',
    fontFamily: MONO,
    fontSize: compact ? 8 : 9,
    color: activeColor,
    letterSpacing: 0.5,
    flexShrink: 0,
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={btnStyle} title={active?.description ?? ''}>
        {active?.created_by === 'agent' && <Bot size={compact ? 9 : 10} />}
        <span style={{ fontWeight: 700 }}>{active?.name ?? 'NO SCENARIO'}</span>
        <span style={{ opacity: 0.6, fontSize: compact ? 7 : 8 }}>{activeLabel}</span>
        <ChevronDown size={compact ? 9 : 10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          zIndex: 9999,
          minWidth: 280,
          maxWidth: 340,
          maxHeight: 420,
          overflowY: 'auto',
          background: '#0F1319',
          border: `1px solid ${BT.border.medium}`,
          borderTop: `2px solid ${activeColor}`,
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
          fontFamily: MONO,
        }}>
          {/* Header */}
          <div style={{
            padding: '6px 10px',
            borderBottom: `1px solid ${BT.border.subtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: BT.text.muted, letterSpacing: 1 }}>
              UNDERWRITING SCENARIOS
            </span>
            <button
              onClick={() => setCreateOpen(o => !o)}
              style={{
                background: 'transparent',
                border: `1px solid ${BT.border.medium}`,
                color: BT.text.secondary,
                fontFamily: MONO,
                fontSize: 9,
                padding: '1px 5px',
                cursor: 'pointer',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <Plus size={10} /> NEW
            </button>
          </div>

          {/* Create form */}
          {createOpen && (
            <div style={{ padding: '8px 10px', borderBottom: `1px solid ${BT.border.subtle}` }}>
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
                  fontFamily: MONO,
                  fontSize: 10,
                  padding: '3px 6px',
                  borderRadius: 2,
                  outline: 'none',
                  marginBottom: 6,
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
                  fontFamily: MONO,
                  fontSize: 9,
                  padding: '3px 6px',
                  borderRadius: 2,
                  outline: 'none',
                  marginBottom: 6,
                }}
              />
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setCreateOpen(false)}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${BT.border.medium}`,
                    color: BT.text.muted,
                    fontFamily: MONO,
                    fontSize: 9,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    borderRadius: 2,
                  }}
                >
                  CANCEL
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || actionLoading === 'create'}
                  style={{
                    background: BT.met.financial,
                    border: 'none',
                    color: '#000',
                    fontFamily: MONO,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    borderRadius: 2,
                    opacity: !newName.trim() ? 0.5 : 1,
                  }}
                >
                  {actionLoading === 'create' ? '...' : 'CREATE'}
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '4px 10px',
              fontSize: 9,
              color: '#EF4444',
              borderBottom: `1px solid ${BT.border.subtle}`,
            }}>
              {error}
            </div>
          )}

          {/* List */}
          <div style={{ padding: '4px 0' }}>
            {scenarios.length === 0 && (
              <div style={{ padding: '8px 10px', fontSize: 9, color: BT.text.muted }}>
                No scenarios yet. Create one to get started.
              </div>
            )}
            {scenarios.map(s => {
              const isActive = s.id === active?.id;
              const isArchived = s.archived_at != null;
              const isAgent = s.created_by === 'agent';
              const color = isAgent ? '#8B5CF6' : '#F5A623';
              const isMenuOpen = menuScenarioId === s.id;
              const isRenaming = renameId === s.id;
              const isLoading = actionLoading === s.id;

              return (
                <div
                  key={s.id}
                  style={{
                    padding: '4px 10px',
                    borderBottom: `1px solid ${BT.border.subtle}20`,
                    opacity: isArchived ? 0.5 : 1,
                    background: isActive ? `${color}10` : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isActive && (
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: color, flexShrink: 0,
                      }} />
                    )}
                    {isRenaming ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                        <input
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          autoFocus
                          style={{
                            flex: 1,
                            background: BT.bg.input ?? '#111',
                            border: `1px solid ${BT.border.medium}`,
                            color: BT.text.primary,
                            fontFamily: MONO,
                            fontSize: 9,
                            padding: '2px 4px',
                            borderRadius: 2,
                            outline: 'none',
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRename(s.id);
                            if (e.key === 'Escape') { setRenameId(null); setRenameValue(''); }
                          }}
                        />
                        <button
                          onClick={() => handleRename(s.id)}
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
                        onClick={() => !isActive && handleActivate(s.id)}
                        disabled={isActive || isLoading}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          background: 'transparent',
                          border: 'none',
                          color: isActive ? color : BT.text.primary,
                          fontFamily: MONO,
                          fontSize: 9,
                          cursor: isActive ? 'default' : 'pointer',
                          padding: 0,
                          fontWeight: isActive ? 700 : 400,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={s.description ?? ''}
                      >
                        {isAgent && <Bot size={9} style={{ marginRight: 3, display: 'inline', verticalAlign: 'middle' }} />}
                        {s.name}
                        {isArchived && <span style={{ color: BT.text.muted, marginLeft: 4 }}>(ARCHIVED)</span>}
                      </button>
                    )}

                    {/* Menu toggle */}
                    <button
                      onClick={() => setMenuScenarioId(isMenuOpen ? null : s.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: BT.text.muted,
                        fontFamily: MONO,
                        fontSize: 11,
                        cursor: 'pointer',
                        padding: '0 2px',
                      }}
                    >
                      ⋯
                    </button>
                  </div>

                  {/* Meta row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 2,
                    marginLeft: isActive ? 11 : 0,
                  }}>
                    <span style={{ fontSize: 8, color: color, fontWeight: 700, letterSpacing: 0.5 }}>
                      {isAgent ? 'AGENT' : 'USER'}
                    </span>
                    <span style={{ fontSize: 8, color: BT.text.muted }}>
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                    {s.parent_id && (
                      <span style={{ fontSize: 8, color: BT.text.muted, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <GitBranch size={8} /> FORK
                      </span>
                    )}
                    {isLoading && (
                      <span style={{ fontSize: 8, color: BT.text.amber }}>…</span>
                    )}
                  </div>

                  {/* Action menu */}
                  {isMenuOpen && !isRenaming && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 4,
                      marginTop: 4,
                      marginLeft: isActive ? 11 : 0,
                    }}>
                      <button
                        onClick={() => { setRenameId(s.id); setRenameValue(s.name); setMenuScenarioId(null); }}
                        style={actionBtnStyle}
                      >
                        RENAME
                      </button>
                      <button
                        onClick={() => { handleFork(s); setMenuScenarioId(null); }}
                        style={actionBtnStyle}
                      >
                        <Copy size={8} style={{ marginRight: 2 }} /> DUPLICATE
                      </button>
                      {isArchived ? (
                        <button
                          onClick={() => { handleRestore(s.id); setMenuScenarioId(null); }}
                          style={actionBtnStyle}
                        >
                          <Archive size={8} style={{ marginRight: 2 }} /> RESTORE
                        </button>
                      ) : (
                        <button
                          onClick={() => { handleArchive(s.id); setMenuScenarioId(null); }}
                          style={actionBtnStyle}
                        >
                          <Archive size={8} style={{ marginRight: 2 }} /> ARCHIVE
                        </button>
                      )}
                      <button
                        onClick={() => { handleDelete(s.id); setMenuScenarioId(null); }}
                        style={{ ...actionBtnStyle, color: '#EF4444' }}
                      >
                        <Trash2 size={8} style={{ marginRight: 2 }} /> DELETE
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const actionBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${BT.border.subtle}`,
  color: BT.text.secondary,
  fontFamily: MONO,
  fontSize: 8,
  padding: '1px 5px',
  cursor: 'pointer',
  borderRadius: 2,
  display: 'flex',
  alignItems: 'center',
};

export default ScenarioPicker;
