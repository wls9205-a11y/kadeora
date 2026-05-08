"use client";
// s258 — recharts 의존성 미설치 stub. props 동일, 단순 HTML bar 로 대체.

export default function CarouselDistribution({ posDist }: { posDist: number[] }) {
  const max = Math.max(1, ...posDist);
  return (
    <div style={{ width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border, #2a2b35)' }}>
            <th style={{ textAlign: 'left', padding: '6px 8px' }}>position</th>
            <th style={{ textAlign: 'right', padding: '6px 8px' }}>cnt</th>
            <th style={{ textAlign: 'left', padding: '6px 8px' }}>분포</th>
          </tr>
        </thead>
        <tbody>
          {posDist.map((cnt, position) => {
            const abnormal = position === 7 && cnt > max * 0.5;
            const pct = (cnt / max) * 100;
            return (
              <tr key={position} style={{ borderBottom: '0.5px solid var(--border, #2a2b35)' }}>
                <td style={{ padding: '4px 8px' }}>{position}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: abnormal ? 800 : 400, color: abnormal ? '#ef4444' : 'inherit' }}>
                  {cnt.toLocaleString()}
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <div style={{ height: 10, background: abnormal ? '#ef4444' : 'var(--brand, #3b82f6)', width: `${pct}%`, borderRadius: 2 }} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
