'use client';
import { useState, useEffect, useCallback } from 'react';
import { C } from '../admin-shared';

interface SiteStatus {
  domain: string;
  name: string;
  color: string;
  label: string;
  status: 'ok' | 'error' | 'expired';
  rssItems: number;
  favicon: boolean;
  sitemap: boolean;
  robotsAI: boolean;
  llmsTxt: boolean;
}

const SITES_META = [
  { domain: 'xn--zf0bv61a84di4cc7c4tay28c.com', name: '분양권실전투자', color: '#1E40AF', label: '분' },
  { domain: 'xn--kj0bw8tr3a.com', name: '급매물', color: '#DC2626', label: '급' },
  { domain: 'xn--9i2by8fvyb69i.site', name: '주린이', color: '#059669', label: '주' },
];

export default function SatelliteSection() {
  const [sites, setSites] = useState<SiteStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLog, setActionLog] = useState<string[]>([]);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/satellite');
      if (res.ok) {
        const data = await res.json();
        setSites(data.sites || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const triggerAction = async (action: string, label: string) => {
    setActionLog(prev => [...prev, `${new Date().toLocaleTimeString()} | ${label} 실행 중...`]);
    try {
      const res = await fetch('/api/admin/satellite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setActionLog(prev => [...prev, `${new Date().toLocaleTimeString()} | ${data.message || 'OK'}`]);
      fetchStatus();
    } catch {
      setActionLog(prev => [...prev, `${new Date().toLocaleTimeString()} | ${label} 실패`]);
    }
  };

  const dot = (ok: boolean) => (
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? C.green : C.red, display: 'inline-block' }} />
  );

  if (loading) return <div style={{ color: C.textSec, padding: 20 }}>로딩 중...</div>;

  const activeSites = sites.filter(s => s.status === 'ok').length;
  const totalRss = sites.reduce((s, x) => s + x.rssItems, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {[
          { label: '활성 사이트', value: `${activeSites}/3`, color: C.green },
          { label: 'RSS 아이템', value: totalRss, color: C.yellow },
          { label: 'mu-plugin', value: '7 x 3', color: C.purple },
          { label: '자동 딥링크', value: '33%', color: C.cyan },
          { label: '로테이션', value: '주간', color: C.brand },
        ].map((kpi, i) => (
          <div key={i} style={{ background: C.card, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.textDim }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Site Status */}
      <div style={{ background: C.card, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: C.text }}>사이트 상태</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sites.map((site, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: site.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>
                {site.label}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{site.name}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{site.domain}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
                {dot(site.status === 'ok')}
                <span style={{ color: site.status === 'ok' ? C.green : site.status === 'expired' ? C.yellow : C.red }}>
                  {site.status === 'ok' ? '정상' : site.status === 'expired' ? '만료' : '오류'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: C.textSec }}>{site.rssItems} RSS</div>
            </div>
          ))}
        </div>
      </div>

      {/* SEO Checklist */}
      <div style={{ background: C.card, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: C.text }}>SEO 인프라</h3>
        <table style={{ width: '100%', fontSize: 12, color: C.textSec, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th style={{ textAlign: 'left', padding: 6 }}>항목</th>
              {sites.map((s, i) => <th key={i} style={{ padding: 6, textAlign: 'center' }}>{s.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {(['favicon', 'sitemap', 'robotsAI', 'llmsTxt'] as const).map(key => (
              <tr key={key} style={{ borderBottom: `1px solid ${C.border}20` }}>
                <td style={{ padding: 6 }}>
                  {{ favicon: '파비콘', sitemap: '사이트맵', robotsAI: 'AI봇 허용', llmsTxt: 'llms.txt' }[key]}
                </td>
                {sites.map((s, i) => (
                  <td key={i} style={{ padding: 6, textAlign: 'center' }}>{dot(s[key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div style={{ background: C.card, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: C.text }}>원클릭 액션</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { action: 'check_status', label: '상태 체크' },
            { action: 'ping_search', label: 'IndexNow Ping' },
          ].map(btn => (
            <button key={btn.action} onClick={() => triggerAction(btn.action, btn.label)} style={{
              padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.surface, color: C.text, fontSize: 12, cursor: 'pointer',
            }}>
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Log */}
      {actionLog.length > 0 && (
        <div style={{ background: C.card, borderRadius: 12, padding: 16, border: `1px solid ${C.border}` }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: C.text }}>로그</h3>
          <div style={{ maxHeight: 150, overflow: 'auto', fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>
            {actionLog.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
