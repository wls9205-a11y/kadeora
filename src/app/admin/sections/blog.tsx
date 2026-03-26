'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, C, DataTable, KPI, KPICard, Spinner, ago, fmt } from '../admin-shared';

export default function BlogSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/dashboard?section=blog').then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  const runCron = async (path: string, label: string) => {
    setRunning(label);
    try {
      const cronSecret = ''; // god-mode 경유
      await fetch(`/api/admin/god-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', endpoint: path }),
      });
      alert(`${label} 실행 완료`);
    } catch { alert('실행 실패'); }
    finally { setRunning(null); }
  };

  if (loading) return <Spinner />;

  const blog = data?.blog ?? {};
  const rewritePct = blog.total > 0 ? Math.round((blog.rewritten / blog.total) * 100) : 0;

  const CRON_BTNS = [
    { label: '주식 시황', path: '/api/cron/blog-daily', icon: '📈' },
    { label: '청약/미분양', path: '/api/cron/blog-apt-new', icon: '🏠' },
    { label: '대장 아파트', path: '/api/cron/blog-apt-landmark', icon: '🏢' },
    { label: '재개발', path: '/api/cron/blog-redevelopment', icon: '🏗️' },
    { label: '가이드', path: '/api/cron/blog-seed-guide', icon: '📖' },
    { label: '리라이트', path: '/api/cron/blog-rewrite', icon: '✨' },
    { label: '시리즈 배정', path: '/api/cron/blog-series-assign', icon: '📚' },
    { label: '발행 큐', path: '/api/cron/blog-publish-queue', icon: '🚀' },
  ];

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 20px' }}>✍️ 블로그 관리</h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KPICard icon="📄" label="전체 블로그" value={blog.total} color={C.brand} />
        <KPICard icon="👁" label="총 조회수" value={blog.totalViews} color={C.cyan} />
        <KPICard icon="✨" label="리라이팅" value={`${rewritePct}%`} sub={`${blog.rewritten}/${blog.total}`} color={C.green} />
        <KPICard icon="📝" label="미리라이팅" value={blog.unrewritten} color={C.yellow} />
      </div>

      {/* Category breakdown */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>카테고리별 분포</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(blog.byCat || {}).sort(([, a], [, b]) => (b as number) - (a as number)).map(([cat, cnt]) => (
            <div key={cat} style={{ padding: '8px 14px', background: C.surface, borderRadius: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: C.text }}>{cat}</span>
              <span style={{ color: C.textDim, marginLeft: 6 }}>{fmt(cnt as number)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rewrite Progress Bar */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>리라이팅 진행률</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{rewritePct}%</span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: C.border, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 5, background: `linear-gradient(90deg, ${C.green}, ${C.brand})`, width: `${rewritePct}%`, transition: 'width .5s' }} />
        </div>
      </div>

      {/* Cron Buttons */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>블로그 크론 실행</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {CRON_BTNS.map(b => (
            <button key={b.path} onClick={() => runCron(b.path, b.label)} disabled={running !== null}
              style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: running === b.label ? C.brandBg : C.surface, color: C.text, fontSize: 12, fontWeight: 600, cursor: running ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{b.icon}</span> {running === b.label ? '실행중...' : b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent blogs */}
      <DataTable
        headers={['제목', '카테고리', '조회', '리라이팅', '작성일']}
        rows={(data?.recentBlogs ?? []).map((b: Record<string, any>) => [
          <span key="t" style={{ maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', fontWeight: 500 }}>{b.title}</span>,
          <Badge key="c" color={C.purple}>{b.category}</Badge>,
          b.view_count || 0,
          b.rewritten_at ? <Badge key="r" color={C.green}>완료</Badge> : <Badge key="r" color={C.yellow}>대기</Badge>,
          ago(b.created_at),
        ])}
      />
    </div>
  );
}

// ══════════════════════════════════════
// 🏢 REAL ESTATE
// ══════════════════════════════════════
