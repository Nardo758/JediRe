import { useDealStore, Y1Source } from '../../../stores/dealStore';

const MONO = "'JetBrains Mono','Roboto Mono','Consolas','monospace'";

const SOURCES: Y1Source[] = ['BROKER', 'T12', 'T6', 'T3', 'T1', 'PLATFORM'];

const SOURCE_STYLE: Record<Y1Source, { bg: string; fg: string; border: string }> = {
  BROKER:   { bg: 'rgba(180,83,9,0.35)',  fg: '#fcd34d', border: 'rgba(180,83,9,0.5)' },
  T12:      { bg: 'rgba(30,64,175,0.35)',  fg: '#93c5fd', border: 'rgba(30,64,175,0.6)' },
  T6:       { bg: 'rgba(30,64,175,0.28)',  fg: '#bfdbfe', border: 'rgba(30,64,175,0.5)' },
  T3:       { bg: 'rgba(30,64,175,0.22)',  fg: '#dbeafe', border: 'rgba(30,64,175,0.4)' },
  T1:       { bg: 'rgba(30,64,175,0.16)',  fg: '#e0f2fe', border: 'rgba(30,64,175,0.3)' },
  PLATFORM: { bg: 'rgba(6,182,212,0.22)',  fg: '#22d3ee', border: 'rgba(6,182,212,0.45)' },
};

export function Y1SourcePicker() {
  const y1Source    = useDealStore(s => s.y1Source) as Y1Source;
  const setY1Source = useDealStore(s => s.setY1Source);

  const cycle = () => {
    const idx = SOURCES.indexOf(y1Source);
    setY1Source(SOURCES[(idx + 1) % SOURCES.length]);
  };

  const st = SOURCE_STYLE[y1Source] ?? SOURCE_STYLE.PLATFORM;

  return (
    <button
      onClick={cycle}
      title={`Y1 data source: ${y1Source} — click to cycle BROKER → T12 → T6 → T3 → T1 → PLATFORM`}
      style={{
        fontFamily: MONO,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        padding: '3px 10px',
        borderRadius: 3,
        border: `1px solid ${st.border}`,
        background: st.bg,
        color: st.fg,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      Y1 · {y1Source}
    </button>
  );
}
