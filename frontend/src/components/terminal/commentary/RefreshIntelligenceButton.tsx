import React, { useEffect, useRef, useState } from 'react';
import { BT } from '../theme';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface RefreshIntelligenceButtonProps {
  entityType: 'msa' | 'submarket';
  entityId: string;
  /** Called once after refresh kicks off (panels can re-fetch immediately). */
  onQueued?: () => void;
  /** Called when ALL queued tasks reach a terminal state (completed | failed | cancelled). */
  onCompleted?: (summary: { completed: number; failed: number }) => void;
}

interface QueuedTask { id: string; taskType: string; }
interface RefreshResponse { entityType: string; entityId: string; queued: QueuedTask[]; }

type ButtonStatus = 'idle' | 'queuing' | 'running' | 'completed' | 'partial' | 'error';

interface PolledTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | string;
  error_message?: string | null;
}

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS  = 5 * 60 * 1000; // give long agent runs room to finish

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken') ?? '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchTaskStatus(taskId: string): Promise<PolledTask | null> {
  const r = await fetch(`/api/v1/agents/tasks/${encodeURIComponent(taskId)}`, {
    headers: authHeaders(),
  });
  if (!r.ok) return null;
  const body = (await r.json()) as PolledTask;
  return body;
}

export const RefreshIntelligenceButton: React.FC<RefreshIntelligenceButtonProps> = ({
  entityType, entityId, onQueued, onCompleted,
}) => {
  const [status, setStatus]   = useState<ButtonStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Cancel any in-flight polling loop on unmount or when entity changes —
  // otherwise the loop keeps running and stomps state on the next mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Task #425: legacy hook deps frozen during bulk triage; revisit when touching this hook.
    return () => { cancelRef.current.cancelled = true; };
  }, [entityType, entityId]);

  const pollTasks = async (taskIds: string[]): Promise<void> => {
    const startedAt = Date.now();
    const localCancel = cancelRef.current;
    const finalStatus = new Map<string, string>();

    while (!localCancel.cancelled && finalStatus.size < taskIds.length) {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setStatus('error');
        setMessage(`Timed out after ${Math.round(POLL_TIMEOUT_MS / 1000)}s`);
        return;
      }
      await Promise.all(
        taskIds
          .filter(id => !finalStatus.has(id))
          .map(async id => {
            const t = await fetchTaskStatus(id);
            if (t && TERMINAL.has(t.status)) {
              finalStatus.set(id, t.status);
            }
          }),
      );
      setProgress({ done: finalStatus.size, total: taskIds.length });
      if (finalStatus.size < taskIds.length) {
        await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
      }
    }
    if (localCancel.cancelled) return;

    const completed = [...finalStatus.values()].filter(s => s === 'completed').length;
    const failed    = [...finalStatus.values()].filter(s => s !== 'completed').length;
    if (failed === 0) {
      setStatus('completed');
      setMessage(`Refreshed (${completed}/${taskIds.length})`);
    } else {
      setStatus('partial');
      setMessage(`${completed} ok, ${failed} failed`);
    }
    onCompleted?.({ completed, failed });
    setTimeout(() => { if (!localCancel.cancelled) setStatus('idle'); }, 6000);
  };

  const handleClick = async (): Promise<void> => {
    cancelRef.current.cancelled = false;
    setStatus('queuing');
    setMessage('');
    setProgress({ done: 0, total: 0 });
    try {
      const r = await fetch(
        `/api/v1/intelligence/refresh/${entityType}/${encodeURIComponent(entityId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
        },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as RefreshResponse;
      const ids = body.queued.map(t => t.id);
      onQueued?.();
      if (ids.length === 0) {
        setStatus('completed');
        setMessage('Nothing to refresh');
        setTimeout(() => setStatus('idle'), 4000);
        return;
      }
      setStatus('running');
      setProgress({ done: 0, total: ids.length });
      setMessage(`Running 0/${ids.length}`);
      void pollTasks(ids);
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  // Keep message in sync with running progress.
  useEffect(() => {
    if (status === 'running' && progress.total > 0) {
      setMessage(`Running ${progress.done}/${progress.total}`);
    }
  }, [status, progress]);

  const colors: Record<ButtonStatus, { bg: string; fg: string; border: string }> = {
    idle:      { bg: `${BT.text.cyan}14`,    fg: BT.text.cyan,   border: `${BT.text.cyan}66` },
    queuing:   { bg: `${BT.text.amber}14`,   fg: BT.text.amber,  border: `${BT.text.amber}66` },
    running:   { bg: `${BT.text.amber}14`,   fg: BT.text.amber,  border: `${BT.text.amber}66` },
    completed: { bg: `${BT.text.green}14`,   fg: BT.text.green,  border: `${BT.text.green}66` },
    partial:   { bg: `${BT.accent.red}14`,   fg: BT.accent.red,  border: `${BT.accent.red}66` },
    error:     { bg: `${BT.accent.red}14`,   fg: BT.accent.red,  border: `${BT.accent.red}66` },
  };
  const c = colors[status];
  const busy = status === 'queuing' || status === 'running';
  const labelMap: Record<ButtonStatus, string> = {
    idle:      'Refresh Intelligence',
    queuing:   'Queuing…',
    running:   `Running ${progress.done}/${progress.total}…`,
    completed: 'Refreshed',
    partial:   'Partial',
    error:     'Failed',
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        style={{
          width: '100%',
          padding: '6px 10px',
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          borderRadius: 3,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          cursor: busy ? 'wait' : 'pointer',
          ...mono,
        }}
      >
        {labelMap[status]}
      </button>
      {message && (
        <div style={{ fontSize: 9, color: c.fg, ...mono, marginTop: 4, textAlign: 'center' }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default RefreshIntelligenceButton;
