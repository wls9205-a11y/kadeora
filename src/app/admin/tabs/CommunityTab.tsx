'use client';
import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface CommunityStats {
  totalPolls: number;
  totalVS: number;
  totalPredictions: number;
  totalShorts: number;
  totalPollVotes: number;
  totalVSVotes: number;
  totalPredictVotes: number;
  activePollsCount: number;
  pendingPredictions: number;
  resolvedPredictions: number;
}

interface PollItem {
  id: number;
  post_id: number;
  title: string;
  expires_at: string;
  vote_count: number;
  created_at: string;
}

interface PredictionItem {
  id: number;
  post_id: number;
  title: string;
  target: string;
  direction: string;
  deadline: string;
  resolved: boolean;
  result: boolean | null;
  vote_count: number;
}

export default function CommunityTab({ onNavigate }: { onNavigate?: (t: string) => void }) {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [polls, setPolls] = useState<PollItem[]>([]);
  const [predictions, setPredictions] = useState<PredictionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const sb = createSupabaseBrowser();

    // 통계
    const [
      { count: totalPolls },
      { count: totalVS },
      { count: totalPredictions },
      { count: totalShorts },
      { count: totalPollVotes },
      { count: totalVSVotes },
      { count: totalPredictVotes },
    ] = await Promise.all([
      (sb as any).from('post_polls').select('*', { count: 'exact', head: true }),
      (sb as any).from('vs_battles').select('*', { count: 'exact', head: true }),
      (sb as any).from('predictions').select('*', { count: 'exact', head: true }),
      sb.from('posts').select('*', { count: 'exact', head: true }).eq('post_type', 'short').eq('is_deleted', false),
      (sb as any).from('poll_votes').select('*', { count: 'exact', head: true }),
      (sb as any).from('vs_votes').select('*', { count: 'exact', head: true }),
      (sb as any).from('prediction_votes').select('*', { count: 'exact', head: true }),
    ]);

    const { count: activePollsCount } = await (sb as any).from('post_polls')
      .select('*', { count: 'exact', head: true })
      .gt('expires_at', new Date().toISOString());

    const { count: pendingPredictions } = await (sb as any).from('predictions')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false);

    const { count: resolvedPredictions } = await (sb as any).from('predictions')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', true);

    setStats({
      totalPolls: totalPolls ?? 0,
      totalVS: totalVS ?? 0,
      totalPredictions: totalPredictions ?? 0,
      totalShorts: totalShorts ?? 0,
      totalPollVotes: totalPollVotes ?? 0,
      totalVSVotes: totalVSVotes ?? 0,
      totalPredictVotes: totalPredictVotes ?? 0,
      activePollsCount: activePollsCount ?? 0,
      pendingPredictions: pendingPredictions ?? 0,
      resolvedPredictions: resolvedPredictions ?? 0,
    });

    // 최근 투표 목록
    const { data: pollData } = await (sb as any).from('post_polls')
      .select('id, post_id, expires_at, created_at, posts!inner(title)')
      .order('created_at', { ascending: false })
      .limit(10);

    if (pollData) {
      // 일괄 vote count 조회 (N+1 → 1+1)
      const pollIds = pollData.map((p: any) => p.id);
      const { data: allPollVotes } = await (sb as any).from('poll_votes')
        .select('poll_id')
        .in('poll_id', pollIds);
      const pollVoteCounts: Record<number, number> = {};
      for (const v of (allPollVotes || [])) {
        pollVoteCounts[v.poll_id] = (pollVoteCounts[v.poll_id] || 0) + 1;
      }
      setPolls(pollData.map((p: any) => ({
        id: p.id,
        post_id: p.post_id,
        title: p.posts?.title || '(제목없음)',
        expires_at: p.expires_at,
        vote_count: pollVoteCounts[p.id] || 0,
        created_at: p.created_at,
      })));
    }

    // 최근 예측 목록
    const { data: predData } = await (sb as any).from('predictions')
      .select('id, post_id, target, direction, deadline, resolved, result, posts!inner(title)')
      .order('created_at', { ascending: false })
      .limit(10);

    if (predData) {
      // 일괄 vote count 조회 (N+1 → 1+1)
      const predIds = predData.map((p: any) => p.id);
      const { data: allPredVotes } = await (sb as any).from('prediction_votes')
        .select('prediction_id')
        .in('prediction_id', predIds);
      const predVoteCounts: Record<number, number> = {};
      for (const v of (allPredVotes || [])) {
        predVoteCounts[v.prediction_id] = (predVoteCounts[v.prediction_id] || 0) + 1;
      }
      setPredictions(predData.map((p: any) => ({
        id: p.id,
        post_id: p.post_id,
        title: p.posts?.title || '(제목없음)',
        target: p.target,
        direction: p.direction,
        deadline: p.deadline,
        resolved: p.resolved,
        result: p.result,
        vote_count: predVoteCounts[p.id] || 0,
      })));
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resolvePrediction = async (predId: number, result: boolean) => {
    setActionLoading(`pred-${predId}`);
    try {
      const sb = createSupabaseBrowser();
      await (sb as any).from('predictions').update({ resolved: true, result }).eq('id', predId);

      // 적중한 경우 동의 투표자에게 포인트 지급
      if (result) {
        const { data: winners } = await (sb as any).from('prediction_votes')
          .select('user_id').eq('prediction_id', predId).eq('agree', true);
        if (winners) {
          for (const w of winners) {
            await (sb as any).rpc('award_points', {
              p_user_id: w.user_id, p_amount: 50, p_reason: '예측적중', p_meta: { ref_id: predId },
            });
          }
        }
      }
      await loadData();
    } catch (e) {
      console.error('resolve error:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const cardStyle = {
    background: '#111D35', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
    padding: 16, marginBottom: 12,
  };

  const kpiStyle = {
    textAlign: 'center' as const, padding: '12px 8px', borderRadius: 8,
    background: '#0C1528', flex: 1, minWidth: 80,
  };

  if (loading) return <div style={{ padding: 20, color: '#94A3B8', textAlign: 'center' }}>로딩중...</div>;

  return (
    <div style={{ padding: '16px 12px' }}>
      {/* 통계 KPI */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#F1F5F9', marginBottom: 12 }}>📊 커뮤니티 콘텐츠 현황</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { label: '한마디', value: stats?.totalShorts ?? 0, icon: '💬' },
            { label: '투표', value: stats?.totalPolls ?? 0, icon: '📊' },
            { label: 'VS', value: stats?.totalVS ?? 0, icon: '⚔️' },
            { label: '예측', value: stats?.totalPredictions ?? 0, icon: '🔮' },
          ].map(k => (
            <div key={k.label} style={kpiStyle}>
              <div style={{ fontSize: 12 }}>{k.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#3B7BF6' }}>{k.value}</div>
              <div style={{ fontSize: 10, color: '#64748B' }}>{k.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {[
            { label: '투표 참여', value: stats?.totalPollVotes ?? 0, color: '#22C55E' },
            { label: 'VS 참여', value: stats?.totalVSVotes ?? 0, color: '#F59E0B' },
            { label: '예측 참여', value: stats?.totalPredictVotes ?? 0, color: '#A855F7' },
            { label: '진행중 투표', value: stats?.activePollsCount ?? 0, color: '#3B7BF6' },
            { label: '미판정 예측', value: stats?.pendingPredictions ?? 0, color: '#EF4444' },
          ].map(k => (
            <div key={k.label} style={{ ...kpiStyle, minWidth: 70 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 9, color: '#64748B' }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 최근 투표 */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#F1F5F9', marginBottom: 10 }}>📊 최근 투표</div>
        {polls.length === 0 ? (
          <div style={{ fontSize: 12, color: '#64748B', textAlign: 'center', padding: 20 }}>아직 투표가 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {polls.map(p => {
              const expired = new Date(p.expires_at) < new Date();
              return (
                <div key={p.id} style={{
                  padding: '8px 10px', borderRadius: 8, background: '#0C1528',
                  display: 'flex', alignItems: 'center', gap: 8,
                  border: `1px solid ${expired ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: '#F1F5F9',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{p.title}</div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                      {p.vote_count}명 참여 · {expired ? '종료' : '진행중'}
                    </div>
                  </div>
                  <span style={{
                    padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                    background: expired ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                    color: expired ? '#EF4444' : '#22C55E',
                  }}>{expired ? '종료' : '진행'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 예측 판정 */}
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#F1F5F9', marginBottom: 10 }}>🔮 예측 판정</div>
        {predictions.length === 0 ? (
          <div style={{ fontSize: 12, color: '#64748B', textAlign: 'center', padding: 20 }}>아직 예측이 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {predictions.map(p => (
              <div key={p.id} style={{
                padding: '8px 10px', borderRadius: 8, background: '#0C1528',
                border: `1px solid ${p.resolved ? 'rgba(100,116,139,0.15)' : 'rgba(168,85,247,0.15)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12 }}>{p.direction === 'up' ? '📈' : '📉'}</span>
                  <div style={{
                    flex: 1, fontSize: 12, fontWeight: 600, color: '#F1F5F9',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{p.title}</div>
                </div>
                <div style={{ fontSize: 10, color: '#64748B', marginBottom: 6 }}>
                  목표: {p.target} · 기한: {p.deadline} · {p.vote_count}명 참여
                </div>
                {p.resolved ? (
                  <span style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                    background: p.result ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: p.result ? '#22C55E' : '#EF4444',
                  }}>{p.result ? '🎯 적중' : '❌ 미적중'}</span>
                ) : (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => resolvePrediction(p.id, true)}
                      disabled={actionLoading === `pred-${p.id}`}
                      style={{
                        flex: 1, padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: 'rgba(34,197,94,0.12)', color: '#22C55E', fontSize: 11, fontWeight: 700,
                        opacity: actionLoading === `pred-${p.id}` ? 0.5 : 1,
                      }}>🎯 적중</button>
                    <button onClick={() => resolvePrediction(p.id, false)}
                      disabled={actionLoading === `pred-${p.id}`}
                      style={{
                        flex: 1, padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: 'rgba(239,68,68,0.12)', color: '#EF4444', fontSize: 11, fontWeight: 700,
                        opacity: actionLoading === `pred-${p.id}` ? 0.5 : 1,
                      }}>❌ 미적중</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
