'use client';

interface DataPoint { label: string; value: number; color?: string; }

interface Props {
  data: DataPoint[];
  width?: number;
  maxHeight?: number;
  defaultColor?: string;
  showValues?: boolean;
  horizontal?: boolean;
}

export default function MiniBarChart({
  data, width = 300, maxHeight = 200, defaultColor = '#3B82F6',
  showValues = true, horizontal = true,
}: Props) {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map(d => d.value), 1);

  if (horizontal) {
    const barH = 22;
    const gap = 4;
    const totalH = data.length * (barH + gap);
    return (
      <div style={{ width: '100%' }}>
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: gap }}>
              <div style={{ width: 60, fontSize: 11, color: '#64748b', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.label}
              </div>
              <div style={{ flex: 1, height: barH, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  height: '100%', width: `${pct}%`, borderRadius: 4,
                  background: d.color || defaultColor,
                  transition: 'width 0.5s ease',
                }} />
                {showValues && (
                  <span style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 10, fontWeight: 700, color: pct > 50 ? '#fff' : '#64748b',
                  }}>
                    {d.value.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Vertical bars
  const barW = Math.max(12, (width - data.length * 4) / data.length);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: maxHeight }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            {showValues && <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>{d.value.toLocaleString()}</div>}
            <div style={{
              width: barW, height: `${pct}%`, minHeight: 2, borderRadius: '4px 4px 0 0',
              background: d.color || defaultColor,
            }} />
            <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 4, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: barW + 8 }}>
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
