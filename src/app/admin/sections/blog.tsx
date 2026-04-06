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
  const insights = data?.insights ?? {};
  const rewritePct = blog.total > 0 ? Math.round((blog.rewritten / blog.total) * 100) : 0;

  const CRON_BTNS = [
    { label: '리라이트', path: '/api/cron/blog-rewrite', icon: '✨' },
    { label: '발행 큐', path: '/api/cron/blog-publish-queue', icon: '🚀' },
    { label: '시리즈 배정', path: '/api/cron/blog-series-assign', icon: '📚' },
    { label: 'SEO 비공개', path: '/api/cron/blog-quality-prune', icon: '🧹' },
    { label: 'Batch 리라이트', path: '/api/cron/batch-rewrite-submit', icon: '🔄' },
    { label: 'Batch 폴링', path: '/api/cron/batch-rewrite-poll', icon: '📥' },
    { label: '복원 후보', path: '/api/cron/blog-restore-candidate', icon: '♻️' },
    { label: '🏠 현장분석 생성', path: '/api/cron/apt-analysis-gen', icon: '📊' },
    { label: '📈 종목분석 생성', path: '/api/cron/stock-analysis-gen', icon: '📊' },
    { label: '🏠 현장분석 Batch', path: '/api/cron/batch-analysis-submit', icon: '⚡' },
    { label: 'Batch 분석 폴링', path: '/api/cron/batch-analysis-poll', icon: '📥' },
    { label: '🏘️ 현장 클러스터', path: '/api/cron/blog-apt-cluster', icon: '🌐' },
    { label: '📊 종목 클러스터', path: '/api/cron/blog-stock-cluster', icon: '🌐' },
    { label: '주식 시황 (수동)', path: '/api/cron/blog-daily', icon: '📈', disabled: true },
    { label: '청약 (수동)', path: '/api/cron/blog-apt-new', icon: '🏠', disabled: true },
  ] as const;

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: C.text, margin: '0 0 20px' }}>✍️ 블로그 관리</h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--sp-md)', marginBottom: 'var(--sp-xl)' }}>
        <KPICard icon="📄" label="전체 블로그" value={blog.total} color={C.brand} />
        <KPICard icon="👁" label="총 조회수" value={blog.totalViews} color={C.cyan} />
        <KPICard icon="✨" label="리라이팅" value={`${rewritePct}%`} sub={`${blog.rewritten}/${blog.total}`} color={C.green} />
        <KPICard icon="📝" label="미리라이팅" value={blog.unrewritten} color={C.yellow} />
        <KPICard icon="⏱" label="평균 읽기시간" value={`${blog.avgReadTime || 0}분`} color={C.purple} />
      </div>

      {/* 블로그 성과 대시보드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)', marginBottom: 'var(--sp-xl)' }}>
        {/* 인기글 TOP 10 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-card)', padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>🔥 인기글 TOP 10</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(insights.topPosts || []).map((p: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', fontSize: 12 }}>
                <span style={{ fontWeight: 800, color: i < 3 ? C.brand : C.textDim, minWidth: 18 }}>{i + 1}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{p.title}</span>
                <Badge color={C.purple}>{p.category}</Badge>
                <span style={{ color: C.textDim, flexShrink: 0 }}>👀{fmt(p.view_count)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 카테고리별 조회수 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-card)', padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>📊 카테고리별 성과</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
            {(insights.catViews || []).map((cv: any) => (
              <div key={cv.category} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: C.text }}>{cv.category}</span>
                <span style={{ color: C.textDim }}>{fmt(cv.post_count)}편 · 👀{fmt(cv.total_views)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 댓글 많은 글 TOP 5 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-card)', padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>💬 댓글 많은 글</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(insights.topCommented || []).map((p: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', fontSize: 12 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{p.title}</span>
                <span style={{ color: C.textDim, flexShrink: 0 }}>💬{p.comment_count}</span>
              </div>
            ))}
            {(insights.topCommented || []).length === 0 && <span style={{ color: C.textDim, fontSize: 12 }}>아직 없음</span>}
          </div>
        </div>

        {/* helpful 많은 글 TOP 5 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-card)', padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>👍 도움이 됐어요 TOP</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(insights.topHelpful || []).map((p: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', fontSize: 12 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>{p.title}</span>
                <span style={{ color: C.textDim, flexShrink: 0 }}>👍{p.helpful_count}</span>
              </div>
            ))}
            {(insights.topHelpful || []).length === 0 && <span style={{ color: C.textDim, fontSize: 12 }}>아직 없음</span>}
          </div>
        </div>
      </div>

      {/* 최근 7일 발행 추이 */}
      {insights.dailyCounts && Object.keys(insights.dailyCounts).length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-card)', padding: 18, marginBottom: 'var(--sp-xl)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>📅 최근 7일 발행 추이</h3>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', alignItems: 'flex-end', height: 80 }}>
            {(() => {
              const days: string[] = [];
              for (let i = 6; i >= 0; i--) {
                days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
              }
              const maxCnt = Math.max(1, ...days.map(d => insights.dailyCounts[d] || 0));
              return days.map(d => {
                const cnt = insights.dailyCounts[d] || 0;
                return (
                  <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-xs)' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.text }}>{cnt}</span>
                    <div style={{ width: '100%', borderRadius: 4, background: cnt > 0 ? C.brand : C.border, height: `${Math.max(4, (cnt / maxCnt) * 60)}px`, transition: 'height .3s' }} />
                    <span style={{ fontSize: 9, color: C.textDim }}>{d.slice(5)}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-card)', padding: 18, marginBottom: 'var(--sp-xl)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>카테고리별 분포</h3>
        <div style={{ display: 'flex', gap: 'var(--sp-sm)', flexWrap: 'wrap' }}>
          {Object.entries(blog.byCat || {}).sort(([, a], [, b]) => (b as number) - (a as number)).map(([cat, cnt]) => (
            <div key={cat} style={{ padding: '8px 14px', background: C.surface, borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: C.text }}>{cat}</span>
              <span style={{ color: C.textDim, marginLeft: 6 }}>{fmt(cnt as number)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rewrite Progress Bar */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-card)', padding: 18, marginBottom: 'var(--sp-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-sm)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>리라이팅 진행률</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{rewritePct}%</span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: C.border, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 5, background: `linear-gradient(90deg, ${C.green}, ${C.brand})`, width: `${rewritePct}%`, transition: 'width .5s' }} />
        </div>
      </div>

      {/* Cron Buttons */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-card)', padding: 18, marginBottom: 'var(--sp-xl)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>블로그 크론 실행</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--sp-sm)' }}>
          {CRON_BTNS.map(b => (
            <button key={b.path} onClick={() => runCron(b.path, b.label)} disabled={running !== null}
              style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${C.border}`, background: running === b.label ? C.brandBg : C.surface, color: ('disabled' in b && b.disabled) ? C.textDim : C.text, fontSize: 12, fontWeight: 600, cursor: running ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: ('disabled' in b && b.disabled) ? 0.5 : 1 }}>
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
