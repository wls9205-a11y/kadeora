'use client';

/**
 * ImageQualityWidget — v_image_relevance_dashboard + score histogram
 *
 * AdminShell 에서 DashboardV2 하위 위젯으로 통합. 별도 탭 OR 기존 탭 내부 블록.
 */

import { useEffect, useState } from 'react';

interface DashRow {
  target_table: string;
  status: string;
  cnt: number;
  avg_score: number | null;
  low_relevance_cnt: number;
  high_relevance_cnt: number;
}

interface HistRow {
  bucket: string;
  cnt: number;
}

export default function ImageQualityWidget() {
  const [dash, setDash] = useState<DashRow[]>([]);
  const [hist, setHist] = useState<HistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/image-quality')
      .then(async (r) => {
        const j = await r.json();
        if (cancelled) return;
        setDash(j.dashboard || []);
        setHist(j.histogram || []);
        if (j.error) setErr(j.error);
      })
      .catch((e) => !cancelled && setErr(String(e?.message || e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const maxCnt = Math.max(1, ...hist.map((h) => h.cnt));

  return (
    <div style={{ padding: 16, color: 'var(--text-primary, #e5e7eb)' }}>
      <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 10px', color: 'rgba(255,255,255,0.9)' }}>
        🖼️ 이미지 품질 대시보드
      </h3>

      {loading ? (
        <div style={{ height: 60, background: 'rgba(255,255,255,0.03)', borderRadius: 6 }} />
      ) : (
        <>
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['테이블','상태','cnt','평균','저<50','고≥70'].map((h) => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: 'rgba(255,255,255,0.6)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dash.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 12, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>데이터 없음</td></tr>
                ) : dash.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '6px 8px' }}>{r.target_table}</td>
                    <td style={{ padding: '6px 8px' }}>{r.status}</td>
                    <td style={{ padding: '6px 8px' }}>{Number(r.cnt || 0).toLocaleString()}</td>
                    <td style={{ padding: '6px 8px' }}>{r.avg_score == null ? '—' : Number(r.avg_score).toFixed(1)}</td>
                    <td style={{ padding: '6px 8px', color: '#F87171' }}>{r.low_relevance_cnt ?? 0}</td>
                    <td style={{ padding: '6px 8px', color: '#10B981' }}>{r.high_relevance_cnt ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
              관련성 점수 분포 (0~100)
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 100 }}>
              {hist.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>아직 측정된 이미지 없음</div>
              ) : hist.map((h) => {
                const pct = Math.max(2, (h.cnt / maxCnt) * 100);
                const color = h.bucket.startsWith('80') ? '#10B981'
                  : h.bucket.startsWith('60') ? '#22D3EE'
                  : h.bucket.startsWith('40') ? '#F59E0B'
                  : h.bucket.startsWith('20') ? '#F97316'
                  : '#EF4444';
                return (
                  <div key={h.bucket} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${h.bucket}: ${h.cnt}`}>
                    <div style={{ width: '100%', height: `${pct}%`, background: color, borderRadius: 4 }} />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{h.bucket}</div>
                    <div style={{ fontSize: 10, fontWeight: 700 }}>{h.cnt}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {err && <div style={{ color: '#F87171', fontSize: 11, marginTop: 8 }}>{err}</div>}
    </div>
  );
}
