'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * IssueTab v2 — 이슈 선점 자동화 어드민 탭
 *
 * 개선사항:
 * - 파이프라인 상태 시각화 (detect → draft → publish)
 * - 자동발행 조건 명확 표시 (is_auto_publish 제거됨)
 * - 기준점 충족 시 자동발행 보장
 * - 디버그 dump 제거 → 깔끔한 초안 미리보기
 * - 강제 실행 버튼 (issue-draft 즉시 트리거)
 * - 오늘 자동발행 카운트
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
  is_auto_publish: boolean;
  publish_decision: string;
  block_reason: string | null;
  blog_post_id: string | null;
  draft_title: string | null;
  draft_content: string | null;
  draft_slug: string | null;
  detected_keywords: string[];
  related_entities: string[];
  source_urls: string[];
  detected_at: string;
  published_at: string | null;
  fact_check_passed: boolean | null;
}

export default function IssueTab() {
  const [issues, setIssues] = useState<IssueAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [minScore, setMinScore] = useState(40);
  const [selectedIssue, setSelectedIssue] = useState<IssueAlert | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [stats, setStats] = useState({ total: 0, published: 0, draft: 0, pending: 0 });
  const [running, setRunning] = useState(false);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/issues');
      const data = await res.json();
      setIssues(data.issues || []);
      setAutoEnabled(data.config?.auto_publish_enabled ?? true);
      setMinScore(data.config?.auto_publish_min_score ?? 40);
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

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/admin/trigger-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: '/api/cron/issue-draft' }),
      });
      const data = await res.json().catch(() => ({}));
      console.log('[IssueTab] issue-draft trigger:', data);
    } catch (e) {
      console.error('[IssueTab] runNow error:', e);
    }
    setTimeout(() => { setRunning(false); fetchIssues(); }, 4000);
  };

  const scoreColor = (score: number) => {
    if (score >= 50) return '#ef4444';
    if (score >= 40) return '#f97316';
    if (score >= 25) return '#eab308';
    return '#6b7280';
  };

  const catIcon = (cat: string) =>
    ({ apt: '🏠', stock: '📊', finance: '💰', tax: '📋', economy: '🌐', life: '🏃' }[cat] || '📰');

  const statusBadge = (issue: IssueAlert) => {
    if (issue.is_published) return <span style={{ color: '#22c55e', fontSize: 11 }}>✅ 발행됨</span>;
    if (issue.publish_decision === 'auto_published') return <span style={{ color: '#22c55e', fontSize: 11 }}>🤖 자동발행</span>;
    if (issue.publish_decision === 'auto') return <span style={{ color: issue.is_published ? '#22c55e' : '#f97316', fontSize: 11 }}>{issue.is_published ? '🤖 자동발행' : '⏳ 자동발행 대기'}</span>;
    if (issue.publish_decision === 'auto_failed') return <span style={{ color: '#ef4444', fontSize: 11 }}>💥 발행실패(한도)</span>;
    if (issue.publish_decision === 'draft') return <span style={{ color: '#eab308', fontSize: 11 }}>📝 초안</span>;
    if (issue.publish_decision === 'draft_saved') return <span style={{ color: '#eab308', fontSize: 11 }}>📝 초안저장</span>;
    if (issue.publish_decision === 'skipped') return <span style={{ color: '#6b7280', fontSize: 11 }}>⏭ 무시</span>;
    if (issue.publish_decision === 'ai_failed') return <span style={{ color: '#ef4444', fontSize: 11 }}>⚠ AI실패</span>;
    if (issue.publish_decision === 'failed') return <span style={{ color: '#ef4444', fontSize: 11 }}>❌ 실패</span>;
    if (issue.block_reason) return <span style={{ color: '#ef4444', fontSize: 11 }}>🚫 {issue.block_reason}</span>;
    if (!issue.is_processed) return <span style={{ color: '#3b82f6', fontSize: 11 }}>⏳ 대기</span>;
    return <span style={{ color: '#6b7280', fontSize: 11 }}>—</span>;
  };

  const filtered = issues.filter(i => {
    if (filter === 'pending') return !i.is_processed;
    if (filter === 'published') return i.is_published;
    if (filter === 'draft') return ['draft', 'draft_saved'].includes(i.publish_decision);
    if (['apt', 'stock', 'finance', 'tax', 'economy', 'life'].includes(filter)) return i.category === filter;
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

  const todayPublished = stats.publishedToday ?? issues.filter(i => {
    if (!i.published_at) return false;
    const d = new Date(i.published_at);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }).length;

  const pendingAutoPublish = stats.pending40plus ?? issues.filter(i =>
    !i.is_processed && i.final_score >= minScore
  ).length;

  const cronLimitUsed = stats.cronLimitUsed ?? 0;
  const cronLimitMax = stats.cronLimitMax ?? 30;
  const cronLimitPct = Math.round((cronLimitUsed / cronLimitMax) * 100);
  const autoFailed = stats.autoFailed ?? 0;

  return (
    <div style={{ padding: '20px 0' }}>

      {/* 파이프라인 상태 */}
      <div style={{
        background: 'var(--surface, #0C1528)', borderRadius: 12, padding: '14px 20px', marginBottom: 16,
        border: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 0,
      }}>
        <PipelineStep icon="🔍" label="issue-detect" sub="15분 주기" active />
        <PipelineArrow />
        <PipelineStep icon="✍️" label="issue-draft" sub="20분 주기" active />
        <PipelineArrow />
        <PipelineStep icon="🚀" label="자동발행" sub={autoEnabled ? `${minScore}점+ → 즉시` : '중단됨'} active={autoEnabled} />
        <div style={{ flex: 1 }} />
        {/* cronLimit 게이지 */}
        <div style={{ textAlign: 'right', marginLeft: 16 }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>일간 한도</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: cronLimitPct >= 90 ? '#ef4444' : cronLimitPct >= 70 ? '#f97316' : '#94a3b8' }}>
            {cronLimitUsed}/{cronLimitMax}
          </div>
          <div style={{ width: 52, height: 4, background: '#1e293b', borderRadius: 2, marginTop: 2 }}>
            <div style={{ width: `${Math.min(cronLimitPct, 100)}%`, height: '100%', borderRadius: 2, background: cronLimitPct >= 90 ? '#ef4444' : cronLimitPct >= 70 ? '#f97316' : '#22c55e' }} />
          </div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 16 }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>오늘 발행</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{todayPublished}</div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 16 }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>40점+ 대기</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: pendingAutoPublish > 0 ? '#f97316' : '#64748b' }}>{pendingAutoPublish}</div>
        </div>
        {autoFailed > 0 && (
          <div style={{ textAlign: 'right', marginLeft: 16 }}>
            <div style={{ fontSize: 11, color: '#ef4444' }}>발행실패</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{autoFailed}</div>
          </div>
        )}
      </div>

      {/* 킬스위치 + 기준점 */}
      <div style={{
        background: 'var(--surface, #0C1528)', borderRadius: 12, padding: 16, marginBottom: 16,
        border: `1px solid ${autoEnabled ? '#22c55e30' : '#ef444430'}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)' }}>
              자동 발행 {autoEnabled ? '✅ ON' : '❌ OFF'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              {autoEnabled
                ? `기준점 ${minScore}점 이상 + 팩트체크 통과 → 즉시 자동발행`
                : '자동발행 중단됨 — 모든 이슈가 초안으로 저장됩니다'}
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
              ✓ is_auto_publish 조건 제거됨 &nbsp;✓ score threshold: {minScore}점
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={minScore}
              onChange={e => updateMinScore(Number(e.target.value))}
              style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
            >
              {[30, 35, 40, 45, 50, 55, 60].map(s => (
                <option key={s} value={s}>{s}점+</option>
              ))}
            </select>
            <button
              onClick={runNow}
              disabled={running}
              style={{
                background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6,
                padding: '6px 12px', fontSize: 12, cursor: 'pointer', opacity: running ? 0.6 : 1,
              }}
            >
              {running ? '실행중...' : '▶ 지금 실행'}
            </button>
            <button
              onClick={toggleKillSwitch}
              style={{
                background: autoEnabled ? '#ef4444' : '#22c55e',
                color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              {autoEnabled ? '중단' : '시작'}
            </button>
            <button onClick={fetchIssues} style={{ background: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
              🔄
            </button>
          </div>
        </div>
      </div>

      {/* 통계 바 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { label: '전체', value: stats.total, color: '#94a3b8' },
          { label: '40점+ 대기', value: stats.pending40plus ?? stats.pending, color: '#3b82f6' },
          { label: '초안', value: stats.draft, color: '#eab308' },
          { label: '오늘 발행', value: todayPublished, color: '#22c55e' },
          ...(autoFailed > 0 ? [{ label: '발행실패', value: autoFailed, color: '#ef4444' }] : []),
          { label: '🏠부동산', value: issues.filter(i => i.category === 'apt').length, color: '#0ea5e9' },
          { label: '📊주식', value: issues.filter(i => i.category === 'stock').length, color: '#8b5cf6' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--surface, #0C1528)', borderRadius: 8, padding: '8px 14px',
            border: '1px solid #1e293b', textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['all', 'pending', 'published', 'draft', 'apt', 'stock', 'finance', 'tax', 'economy', 'life'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? '#3b7bf6' : '#1e293b',
            color: '#e2e8f0', border: 'none', borderRadius: 6, padding: '4px 12px',
            fontSize: 11, cursor: 'pointer',
          }}>
            {({ all: '전체', pending: '⏳대기', published: '✅발행', draft: '📝초안', apt: '🏠부동산', stock: '📊주식', finance: '💰재테크', tax: '📋세금', economy: '🌐경제', life: '🏃생활' }[f] || f)}
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
              border: `1px solid ${issue.final_score >= minScore && !issue.is_processed ? '#f9731640' : issue.is_published ? '#22c55e20' : '#1e293b'}`,
              cursor: 'pointer',
            }} onClick={() => setSelectedIssue(selectedIssue?.id === issue.id ? null : issue)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      background: scoreColor(issue.final_score) + '25',
                      color: scoreColor(issue.final_score),
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    }}>
                      {issue.final_score}점
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      {catIcon(issue.category)} {issue.issue_type}
                    </span>
                    {statusBadge(issue)}
                    {issue.fact_check_passed === true && <span style={{ fontSize: 10, color: '#22c55e' }}>✓팩트</span>}
                    {issue.fact_check_passed === false && <span style={{ fontSize: 10, color: '#ef4444' }}>✗팩트</span>}
                    {issue.final_score >= minScore && !issue.is_processed && (
                      <span style={{ fontSize: 10, color: '#f97316', fontWeight: 600 }}>→ 다음 실행시 발행예정</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', lineHeight: 1.4 }}>
                    {issue.draft_title || issue.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    {timeAgo(issue.detected_at)}
                    {issue.related_entities?.length > 0 && ` · ${issue.related_entities.slice(0, 2).join(', ')}`}
                    {issue.detected_keywords?.length > 0 && ` · ${issue.detected_keywords.slice(0, 3).join(', ')}`}
                    {issue.published_at && ` · 발행: ${timeAgo(issue.published_at)}`}
                  </div>
                </div>

                {/* 액션 버튼 */}
                {!issue.is_published && issue.draft_title && (
                  <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => publishIssue(issue.id)} style={{
                      background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6,
                      padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                    }}>발행</button>
                    <button onClick={() => skipIssue(issue.id)} style={{
                      background: '#374151', color: '#9ca3af', border: 'none', borderRadius: 6,
                      padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                    }}>무시</button>
                  </div>
                )}
                {issue.is_published && issue.draft_slug && (
                  <a
                    href={`/blog/${issue.draft_slug}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: '#3b82f6', marginLeft: 8, flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}
                  >
                    보기 →
                  </a>
                )}
              </div>

              {/* 확장: 초안 미리보기 */}
              {selectedIssue?.id === issue.id && (
                <div style={{ marginTop: 12, padding: 12, background: '#0f172a', borderRadius: 8, fontSize: 12, color: '#94a3b8', maxHeight: 320, overflow: 'auto' }}>
                  {issue.draft_title && (
                    <>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>📝 초안 미리보기</div>
                      <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
                        슬러그: /blog/{issue.draft_slug} &nbsp;|&nbsp;
                        키워드: {(issue.detected_keywords || []).join(', ')} &nbsp;|&nbsp;
                        점수: {issue.final_score} ({issue.final_score >= minScore ? '✅ 기준점 충족' : `⚠ 기준점 ${minScore} 미달`})
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                        {issue.draft_content?.slice(0, 1000) || '(초안 내용 없음)'}
                        {(issue.draft_content?.length || 0) > 1000 && (
                          <span style={{ color: '#475569' }}> ...({issue.draft_content!.length - 1000}자 더)</span>
                        )}
                      </div>
                    </>
                  )}
                  {!issue.draft_title && (
                    <div>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>🔍 이슈 정보</div>
                      <div style={{ color: '#94a3b8' }}>{issue.summary}</div>
                      <div style={{ marginTop: 6, fontSize: 11, color: '#475569' }}>
                        처리여부: {issue.is_processed ? '처리됨' : '미처리'} &nbsp;|&nbsp;
                        결정: {issue.publish_decision || '없음'}
                      </div>
                    </div>
                  )}
                  {issue.source_urls?.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11 }}>
                      출처: {issue.source_urls.slice(0, 3).map((url, i) => {
                        try {
                          return <a key={i} href={url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', marginRight: 8 }}>{new URL(url).hostname}</a>;
                        } catch { return null; }
                      })}
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

function PipelineStep({ icon, label, sub, active }: { icon: string; label: string; sub: string; active: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 16px' }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: active ? '#e2e8f0' : '#475569' }}>{label}</div>
      <div style={{ fontSize: 10, color: active ? '#22c55e' : '#475569' }}>{sub}</div>
    </div>
  );
}

function PipelineArrow() {
  return (
    <div style={{ color: '#334155', fontSize: 18, padding: '0 4px' }}>→</div>
  );
}
