/**
 * Task Status Display Component
 * Shows real-time status of running analysis tasks with polling
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle, Loader2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { getAgentTask } from '@/services/api';

interface TaskStatusDisplayProps {
  taskId: string;
  taskType: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

interface TaskStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  result?: any;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export const TaskStatusDisplay: React.FC<TaskStatusDisplayProps> = ({
  taskId,
  taskType,
  onComplete,
  onError
}) => {
  const [status, setStatus] = useState<TaskStatus>({ status: 'pending' });
  const [elapsed, setElapsed] = useState(0);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!polling) return;

    const pollInterval = setInterval(async () => {
      try {
        const result = await getAgentTask(taskId);
        
        if (result.status) {
          setStatus(result);
          
          if (result.status === 'completed') {
            setPolling(false);
            onComplete?.(result.result);
          } else if (result.status === 'failed') {
            setPolling(false);
            onError?.(result.error || 'Task failed');
          }
        }
      } catch (err) {
        console.error('[TaskStatus] Polling error:', err);
        // Continue polling on error (might be temporary network issue)
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [taskId, polling]);

  useEffect(() => {
    // Track elapsed time
    if (status.status === 'running' || status.status === 'pending') {
      const timer = setInterval(() => {
        setElapsed(e => e + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status.status]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    switch (status.status) {
      case 'pending':
        return <Clock size={20} color="#d29922" />;
      case 'running':
        return <Loader2 size={20} color="#58a6ff" style={{ animation: 'spin 1s linear infinite' }} />;
      case 'completed':
        return <CheckCircle size={20} color="#3fb950" />;
      case 'failed':
        return <XCircle size={20} color="#f85149" />;
      default:
        return <AlertCircle size={20} color="#8b949e" />;
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'pending': return '#d29922';
      case 'running': return '#58a6ff';
      case 'completed': return '#3fb950';
      case 'failed': return '#f85149';
      default: return '#8b949e';
    }
  };

  const getStatusLabel = () => {
    switch (status.status) {
      case 'pending': return 'PENDING';
      case 'running': return 'RUNNING';
      case 'completed': return 'COMPLETED';
      case 'failed': return 'FAILED';
      default: return 'UNKNOWN';
    }
  };

  return (
    <div
      style={{
        background: '#0d1117',
        border: `1px solid ${getStatusColor()}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {getStatusIcon()}
          <div>
            <div style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 13,
              fontWeight: 700,
              color: '#e6edf3',
              letterSpacing: 0.5
            }}>
              {taskType.toUpperCase()} ANALYSIS
            </div>
            <div style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 10,
              color: getStatusColor(),
              marginTop: 2
            }}>
              {getStatusLabel()} • {formatTime(elapsed)}
            </div>
          </div>
        </div>
        
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 9,
          color: '#484f58',
          textAlign: 'right'
        }}>
          TASK ID<br />{taskId.substring(0, 8)}...
        </div>
      </div>

      {/* Progress Bar */}
      {(status.status === 'running' || status.status === 'pending') && (
        <div style={{
          width: '100%',
          height: 4,
          background: '#1a1f28',
          borderRadius: 2,
          overflow: 'hidden',
          marginBottom: 12
        }}>
          <div
            style={{
              height: '100%',
              background: getStatusColor(),
              width: status.progress ? `${status.progress}%` : '0%',
              transition: 'width 0.3s ease',
              animation: !status.progress ? 'indeterminate 2s ease-in-out infinite' : 'none'
            }}
          />
        </div>
      )}

      {/* Message */}
      {status.message && (
        <div style={{
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 11,
          color: '#8b949e',
          marginBottom: 8
        }}>
          {status.message}
        </div>
      )}

      {/* Result Summary */}
      {status.status === 'completed' && status.result && (
        <div style={{
          background: '#3fb95020',
          border: '1px solid #3fb950',
          borderRadius: 4,
          padding: 12,
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 11,
          color: '#e6edf3'
        }}>
          <div style={{ color: '#3fb950', fontWeight: 700, marginBottom: 8 }}>
            ✓ ANALYSIS COMPLETE
          </div>
          <pre style={{
            margin: 0,
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 10,
            color: '#8b949e',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {JSON.stringify(status.result, null, 2).substring(0, 500)}...
          </pre>
        </div>
      )}

      {/* Error Display */}
      {status.status === 'failed' && status.error && (
        <div style={{
          background: '#f8514920',
          border: '1px solid #f85149',
          borderRadius: 4,
          padding: 12,
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 11,
          color: '#f85149'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            ✗ TASK FAILED
          </div>
          <div>{status.error}</div>
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes indeterminate {
          0% { transform: translateX(-100%); width: 30%; }
          50% { transform: translateX(50%); width: 40%; }
          100% { transform: translateX(200%); width: 30%; }
        }
      `}</style>
    </div>
  );
};
