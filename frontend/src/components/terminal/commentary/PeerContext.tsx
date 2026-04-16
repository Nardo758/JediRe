import React from 'react';
import { BT } from '../theme';
import type { PeerItem } from '../../../stores/commentaryStore';

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace" };

interface PeerContextProps {
  summary: string;
  peerRank: number;
  peerTotal: number;
  topPeers: PeerItem[];
  currentScore?: number;
  compact?: boolean;
}

export const PeerContext: React.FC<PeerContextProps> = ({
  summary, peerRank, peerTotal, topPeers, currentScore, compact,
}) => {
  return (
    <div style={{ marginBottom: compact ? 8 : 16 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: BT.text.amber,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        borderBottom: `1px solid ${BT.text.amber}44`,
        paddingBottom: 4,
        marginBottom: 8,
        display: 'flex',
        justifyContent: 'space-between',
        ...mono,
      }}>
        <span>Peer Context</span>
        <span style={{ color: BT.text.cyan }}>#{peerRank}/{peerTotal}</span>
      </div>

      <p style={{ fontSize: 11, color: BT.text.secondary, lineHeight: 1.5, margin: '0 0 8px 0' }}>
        {summary}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {topPeers.slice(0, compact ? 3 : 5).map((peer, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 10,
            padding: '2px 0',
            ...mono,
          }}>
            <span style={{ color: BT.text.muted }}>
              {i + 1}) {peer.name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 40,
                height: 4,
                background: BT.bg.elevated,
                borderRadius: 0,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${peer.score}%`,
                  height: '100%',
                  background: peer.score >= 80 ? BT.text.green : peer.score >= 60 ? BT.text.amber : BT.text.red,
                }} />
              </div>
              <span style={{
                color: peer.score >= 80 ? BT.text.green : peer.score >= 60 ? BT.text.amber : BT.text.red,
                fontWeight: 600,
                minWidth: 20,
                textAlign: 'right',
              }}>
                {peer.score}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
