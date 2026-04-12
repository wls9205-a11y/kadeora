'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * IssueTab — 이슈 선점 자동화 어드민 탭
 *
 * 기능:
 * - 이슈 목록 (점수순 정렬)
 * - 자동 발행 킬스위치
 * - 1클릭 발행 (draft → published)
 * - 이슈 무시 처리
 * - 초안 미리보기
 */

interface IssueAlert {
  id: string;
  title: string;
  summary: string;
  category: string;
  issue_type: string;
  final_score: number;
  is_processed: boolean;
  is_published: boolean;
  publish_decision: string;
  block_reason: string | null;
  blog_post_id: string | null;
  draft_title: string | null;
  draft_slug: string | null;
  detected_keywords: string[];
  related_entities: string[];
  source_urls: string[];
  detected_at: string;
  published_at: string | null;
}

export default function IssueTab() {
  const [issues, setIssues] = useState<IssueAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [minScore, setMinScore] = useState(40);
  const [selectedIssue, setSelectedIssue] = useState<IssueAlert | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0, pending: 0 });

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/issues');
      const data = await res.json();
      setIssues(data.issues || []);
      setAutoEnabled(data.config?.auto_publish_enabled ?? true);
      setMinScore(data.config?.auto_publish_min_score ?? 60);
      setStats(data.stats || { total: 0, published: 0, draft: 0, pending: 0 });
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const toggleKillSwitch = async () => {
    const newVal = !autoEnabled;
    await fetch('/api/admin/issues/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_publish_enabled: newVal }),
    });
    setAutoEnabled(newVal);
  };

  const updateMinScore = async (score: number) => {
    await fetch('/api/admin/issues/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_publish_min_score: score }),
    });
    setMinScore(score);
  };

  const publishIssue = async (id: string) => {
    await fetch('/api/admin/issues/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue_id: id }),
    });
    fetchIssues();
  };

  const skipIssue = async (id: string) => {
    await fetch('/api/admin/issues/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue_id: id }),
    });
    fetchIssues();
  };

  const scoreColor = (score: number) => {
    if (score >= 50) return '#ef4444';
    if (score >= 40) return '#f97316';
    if (score >= 25) return '#eab308';
    return '#6b7280';
  };

  const scoreLabel = (score: number) => {
    if (score >= 40) return '🔴 자동발행';
    if (score >= 25) return '🟡 초안대기';
    return '🟢 로그';
  };

  const statusBadge = (issue: IssueAlert) => {
    if (issue.is_published) return <span style={{ color: '#22c55e', fontSize: 12 }}>✅ 발행됨</span>;
    if (issue.publish_decision === 'draft') return <span style={{ color: '#eab308', fontSize: 12 }}>📝 초안</span>;
    if (issue.publish_decision === 'skipped') return <span style={{ color: '#6b7280', fontSize: 12 }}>⏭ 무시</span>;
    if (issue.block_reason) return <span style={{ color: '#ef4444', fontSize: 12 }}>🚫 {issue.block_reason}</span>;
    if (!issue.is_processed) return <span style={{ color: '#3b82f6', fontSize: 12 }}>⏳ 대기중</span>;
    return <span style={{ color: '#6b7280', fontSize: 12 }}>—</span>;
  };

  const filtered = issues.filter(i => {
    if (filter === 'pending') return !i.is_processed;
    if (filter === 'published') return i.is_published;
    if (filter === 'draft') return i.publish_decision === 'draft';
    if (['apt','stock','finance','tax','economy','life'].includes(filter)) return i.category === filter;
    return true;
  });

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    return `${Math.floor(hrs / 24)}일 전`;
  };

  return (
    <div style={{ padding: '20px 0' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' }}>
          🔍 이슈 선점 자동화
        </h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            전체 {stats.total} | 발행 {stats.published} | 초안 {stats.draft} | 대기 {stats.pending}
            {' | '}🏠{issues.filter(i => i.category === 'apt').length}
            {' '}📊{issues.filter(i => i.category === 'stock').length}
            {' '}💰{issues.filter(i => i.category === 'finance').length}
            {' '}📋{issues.filter(i => i.category === 'tax').length}
          </span>
        </div>
      </div>

      {/* 킬스위치 + 기준점 */}
      <div style={{
        background: 'var(--surface, #0C1528)', borderRadius: 12, padding: 16, marginBottom: 16,
        border: '1px solid var(--border, #1e293b)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)' }}>
              자동 발행 {autoEnabled ? '✅ ON' : '❌ OFF'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              {autoEnabled ? `${minScore}점 이상 이슈 자동 발행 중` : '모든 이슈가 초안으로 저장됩니다'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={minScore}
              onChange={e => updateMinScore(Number(e.target.value))}
              style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 12 }}
            >
              {[30, 35, 40, 45, 50, 55, 60].map(s => (
                <option key={s} value={s}>{s}점+</option>
              ))}
            </select>
            <button
              onClick={toggleKillSwitch}
              style={{
                background: autoEnabled ? '#ef4444' : '#22c55e',
                color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 12px',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              {autoEnabled ? '중단' : '시작'}
            </button>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'pending', 'published', 'draft', 'apt', 'stock', 'finance', 'tax', 'economy', 'life'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? '#3b82f6' : '#1e293b',
            color: '#e2e8f0', border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 12px',
            fontSize: 12, cursor: 'pointer',
          }}>
            {({'all':'전체','pending':'대기중','published':'발행됨','draft':'초안','apt':'🏠부동산','stock':'📊주식','finance':'💰재테크','tax':'📋세금','economy':'🌐경제','life':'🏃생활'}[f] || f)}
          </button>
        ))}
      </div>

      {/* 이슈 리스트 */}
      {loading ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>로딩중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>탐지된 이슈가 없습니다</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(issue => (
            <div key={issue.id} style={{
              background: 'var(--surface, #0C1528)', borderRadius: 10, padding: '12px 16px',
              border: `1px solid ${issue.final_score >= 40 ? '#f9731630' : '#1e293b'}`,
              cursor: 'pointer',
            }} onClick={() => setSelectedIssue(selectedIssue?.id === issue.id ? null : issue)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{
                      background: scoreColor(issue.final_score) + '20',
                      color: scoreColor(issue.final_score),
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                    }}>
                      {issue.final_score}점
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      {({'apt':'🏠','stock':'📊','finance':'💰','tax':'📋','economy':'🌐','life':'🏃'}[issue.category] || '📰')} {issue.issue_type}
                    </span>
                    {statusBadge(issue)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', lineHeight: 1.4 }}>
                    {issue.draft_title || issue.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    {timeAgo(issue.detected_at)} · {(issue.related_entities || []).join(', ')} · {(issue.detected_keywords || []).slice(0, 3).join(', ')}{(issue as any).raw_data?.portal_cross_count >= 2 ? ` · 🌐${(issue as any).raw_data.portal_cross_count}포털` : ''}{(issue as any).raw_data?.search_spike ? ` · 📈${(issue as any).raw_data.search_spike}%` : ''}{issue.source_urls?.[0]?.includes('dart') ? ' · 📋DART' : ''}{issue.source_urls?.[0]?.includes('trends.google') ? ' · 🔍Google' : ''}
                  </div>
                </div>

                {/* 액션 버튼 */}
                {!issue.is_published && issue.draft_title && (
                  <div style={{ display: 'flex', gap: 4, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => publishIssue(issue.id)} style={{
                      background: '#22c55e', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
                      padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                    }}>발행</button>
                    <button onClick={() => skipIssue(issue.id)} style={{
                      background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 'var(--radius-sm)',
                      padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                    }}>무시</button>
                  </div>
                )}
              </div>

              {/* 확장: 초안 미리보기 */}
              {selectedIssue?.id === issue.id && issue.draft_title && (
                <div style={{ marginTop: 12, padding: 12, background: '#0f172a', borderRadius: 'var(--radius-md)', fontSize: 12, color: '#94a3b8', maxHeight: 300, overflow: 'auto' }}>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>📝 초안 미리보기</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                    점수 상세: {JSON.stringify(issue)}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {(issue as any).draft_content?.slice(0, 800) || '(초안 내용 없음)'}
                    {((issue as any).draft_content?.length || 0) > 800 && '...'}
                  </div>
                  {issue.source_urls?.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11 }}>
                      출처: {issue.source_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', marginRight: 8 }}>{new URL(url).hostname}</a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
