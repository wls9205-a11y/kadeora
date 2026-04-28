'use client';
import { useEffect, useState, useCallback } from 'react';
import HealthRing from './components/HealthRing';
import KPIStrip from './components/KPIStrip';
import SignupRealtimeHeader from './components/SignupRealtimeHeader';
import SignupCTASection from './sections/SignupCTASection';
import IssuePipelineSection from './sections/IssuePipelineSection';
import ContentHealthSection from './sections/ContentHealthSection';
import OpsSection from './sections/OpsSection';
import UsersCommunitySection from './sections/UsersCommunitySection';
import TrafficSection from './sections/TrafficSection';

interface DashboardData {
  generated_at?: string;
  header?: {
    score?: number;
    cron_pct?: number; cron_ok?: number; cron_fail?: number;
    real_users?: number; active_users?: number;
    week_signups?: number; return_rate_pct?: number;
    ctr_avg_pct?: number; broken_count?: number;
  };
  section_signup_cta?: any;
  section_issue_pipeline?: any;
  section_content_seo?: any;
  section_ops?: any;
  section_users_community?: any;
}

export default function AdminShellV4() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(null);

  const fetchData = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    fetch('/api/admin/v4', { cache: 'no-store' })
      .then(async r => {
        if (!r.ok) throw new Error(`http ${r.status}`);
        const j = await r.json();
        setData(j);
        setErr(null);
        setLastFetch(Date.now());
      })
      .catch(e => setErr(e?.message ?? 'fetch failed'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 60_000);
    document.addEventListener('visibilitychange', fetchData);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', fetchData);
    };
  }, [fetchData]);

  const h = data?.header ?? {};

  return (
    <div style={{
      maxWidth: 1400, margin: '0 auto', padding: 'clamp(12px, 3vw, 24px)',
      display: 'flex', flexDirection: 'column', gap: 14,
      color: 'var(--text-primary, #fff)',
      background: 'var(--bg-base, #0d0e14)',
      minHeight: '100vh',
    }}>
      {/* Sticky 헤더 */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        padding: '10px 12px', borderRadius: 'var(--radius-md, 10px)',
        background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <HealthRing score={h.score ?? 0} />
        <KPIStrip items={[
          { label: '크론',     value: `${h.cron_pct ?? 0}%`, tone: (h.cron_pct ?? 0) >= 95 ? 'green' : (h.cron_pct ?? 0) >= 80 ? 'orange' : 'red' },
          { label: '7일 신규', value: h.week_signups ?? 0, tone: (h.week_signups ?? 0) >= 30 ? 'green' : (h.week_signups ?? 0) >= 10 ? 'orange' : 'red' },
          { label: 'UV',       value: h.active_users ?? 0 },
          { label: '작동 안함', value: h.broken_count ?? 0, tone: (h.broken_count ?? 0) === 0 ? 'green' : 'red' },
          { label: '재방문',   value: `${h.return_rate_pct ?? 0}%`, tone: (h.return_rate_pct ?? 0) >= 50 ? 'green' : 'orange' },
          { label: 'CTR',      value: `${h.ctr_avg_pct ?? 0}%`, tone: (h.ctr_avg_pct ?? 0) >= 2 ? 'green' : 'orange' },
        ]} />
        <button onClick={fetchData} style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 700,
          padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
          background: 'transparent', color: 'var(--text-secondary, #ccc)',
          border: '1px solid var(--border, #2a2b35)',
        }}>↻ 새로고침</button>
      </header>

      <SignupRealtimeHeader />

      {loading && !data && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary, #888)' }}>
          로드 중…
        </div>
      )}

      {err && (
        <div style={{
          padding: 14, borderRadius: 'var(--radius-md, 10px)',
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.4)',
          color: '#f87171', fontSize: 12,
        }}>
          데이터 가져오기 실패: {err}
        </div>
      )}

      {data && (
        <>
          <SignupCTASection data={data.section_signup_cta ?? {}} ctrAvg={h.ctr_avg_pct} />
          <IssuePipelineSection data={data.section_issue_pipeline ?? {}} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
            <ContentHealthSection data={data.section_content_seo ?? {}} />
            <OpsSection data={data.section_ops ?? {}} />
          </div>

          <UsersCommunitySection data={data.section_users_community ?? {}} />
          <TrafficSection />

          <div style={{
            padding: '6px 10px', fontSize: 10, color: 'var(--text-tertiary, #888)',
            textAlign: 'right',
          }}>
            생성 시각: {data.generated_at ?? '—'}
            {lastFetch != null && <> · 마지막 갱신: {new Date(lastFetch).toLocaleTimeString('ko-KR')}</>}
          </div>
        </>
      )}
    </div>
  );
}
