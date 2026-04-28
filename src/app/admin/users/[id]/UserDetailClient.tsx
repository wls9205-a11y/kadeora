'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface ProfileShape {
  id?: string;
  nickname?: string | null;
  full_name?: string | null;
  email?: string | null;
  provider?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
  last_active_at?: string | null;
  points?: number | null;
  grade?: number | null;
  grade_title?: string | null;
  is_seed?: boolean;
  is_admin?: boolean;
  is_banned?: boolean;
  is_deleted?: boolean;
  kakao_channel_added?: boolean;
  cheongak_score?: number | null;
  region_text?: string | null;
  signup_source?: string | null;
  interests?: string[] | null;
  followers_count?: number | null;
  posts_count?: number | null;
  profile_completed?: boolean;
}

interface ActivityShape {
  posts_30d?: number;
  comments_30d?: number;
  pv_30d?: number;
  last_pv_at?: string | null;
  sessions_30d?: number;
}

interface PageviewItem { path?: string | null; category?: string | null; at?: string | null; duration_ms?: number | null }
interface PostItem { id?: number; title?: string | null; category?: string | null; created_at?: string | null }
interface CommentItem { id?: number; content?: string | null; post_id?: number | null; created_at?: string | null }
interface PointItem { reason?: string | null; points?: number | null; at?: string | null }

interface DetailShape {
  profile?: ProfileShape;
  activity?: ActivityShape;
  recent_pageviews?: PageviewItem[] | null;
  recent_posts?: PostItem[] | null;
  recent_comments?: CommentItem[] | null;
  point_history?: PointItem[] | null;
}

function fmtDate(s?: string | null): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('ko-KR'); } catch { return s; }
}

function decodePath(p?: string | null): string {
  if (!p) return '—';
  try { return decodeURIComponent(p); } catch { return p; }
}

const cardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 'var(--radius-md, 10px)',
  background: 'var(--bg-elevated, #1f2028)',
  border: '1px solid var(--border, #2a2b35)',
};

const subTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary, #888)',
  textTransform: 'uppercase', marginTop: 14, marginBottom: 6, letterSpacing: 0.4,
};

export default function UserDetailClient({ userId }: { userId: string }) {
  const [data, setData] = useState<DetailShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/v4/users/${userId}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (j?.ok) setData(j.data);
        else setErr(j?.error || '데이터 없음');
      })
      .catch(e => setErr(String(e?.message || e)))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const p = data?.profile ?? {};
  const a = data?.activity ?? {};
  const pvs = data?.recent_pageviews ?? [];
  const posts = data?.recent_posts ?? [];
  const comments = data?.recent_comments ?? [];
  const points = data?.point_history ?? [];

  const isAdmin = !!p.is_admin;

  return (
    <div style={{
      maxWidth: 1200, margin: '0 auto', padding: 'clamp(12px, 3vw, 24px)',
      display: 'flex', flexDirection: 'column', gap: 14,
      color: 'var(--text-primary, #fff)', background: 'var(--bg-base, #0d0e14)',
      minHeight: '100vh',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link href="/admin/users" style={{ fontSize: 12, color: 'var(--text-tertiary, #888)', textDecoration: 'none' }}>← 유저 목록</Link>
      </div>

      {loading && !data && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary, #888)' }}>로드 중…</div>}
      {err && <div style={{ ...cardStyle, color: '#f87171', borderColor: 'rgba(248,113,113,0.4)' }}>오류: {err}</div>}

      {data && (
        <>
          {/* 프로필 카드 */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-surface, #1a1b22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--text-tertiary, #888)' }}>
                  {(p.nickname || p.full_name || '?').slice(0, 1)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{p.nickname || '—'}</div>
                {p.full_name && p.full_name !== p.nickname && (
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary, #888)' }}>{p.full_name}</div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {p.provider && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: p.provider === 'kakao' ? 'rgba(254,229,0,0.12)' : 'rgba(66,133,244,0.12)', color: p.provider === 'kakao' ? '#fde047' : '#60a5fa', fontWeight: 700 }}>{p.provider}</span>}
                  {p.is_seed && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(251,146,60,0.12)', color: '#fb923c', fontWeight: 700 }}>시드</span>}
                  {p.is_admin && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(139,92,246,0.12)', color: '#a78bfa', fontWeight: 700 }}>어드민</span>}
                  {p.kakao_channel_added && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(254,229,0,0.12)', color: '#fde047', fontWeight: 700 }}>카카오 채널</span>}
                  {p.is_banned && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(248,113,113,0.12)', color: '#f87171', fontWeight: 700 }}>차단</span>}
                  {p.is_deleted && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(0,0,0,0.3)', color: 'var(--text-tertiary, #888)', fontWeight: 700 }}>삭제됨</span>}
                </div>
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button disabled style={{ padding: '6px 12px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border, #2a2b35)', background: 'transparent', color: 'var(--text-tertiary, #888)', cursor: 'not-allowed', opacity: 0.6 }}>차단 (s208 예정)</button>
                  <button disabled style={{ padding: '6px 12px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border, #2a2b35)', background: 'transparent', color: 'var(--text-tertiary, #888)', cursor: 'not-allowed', opacity: 0.6 }}>삭제 (s208 예정)</button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 14, fontSize: 12 }}>
              {[
                { k: 'id',          label: 'UUID',     v: p.id || '—' },
                { k: 'created_at',  label: '가입일',   v: fmtDate(p.created_at) },
                { k: 'last_active', label: '마지막 활성', v: fmtDate(p.last_active_at) },
                { k: 'points',      label: '포인트',   v: (p.points ?? 0).toLocaleString() },
                { k: 'grade',       label: '등급',     v: `${p.grade_title || '—'} (Lv ${p.grade ?? 1})` },
                { k: 'cheongak',    label: '청약점수', v: p.cheongak_score ?? '—' },
                { k: 'region',      label: '거주지',   v: p.region_text || '—' },
                { k: 'source',      label: '가입 출처', v: p.signup_source || '—' },
                { k: 'interests',   label: '관심사',   v: Array.isArray(p.interests) ? p.interests.join(', ') : '—' },
                { k: 'followers',   label: '팔로워',   v: (p.followers_count ?? 0).toLocaleString() },
              ].map(r => (
                <div key={r.k} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary, #888)', textTransform: 'uppercase' }}>{r.label}</span>
                  <span style={{ color: 'var(--text-secondary, #ccc)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(r.v)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 활동 KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            {[
              { label: '30일 게시물', v: a.posts_30d ?? 0 },
              { label: '30일 댓글',   v: a.comments_30d ?? 0 },
              { label: '30일 PV',     v: a.pv_30d ?? 0 },
              { label: '30일 세션',   v: a.sessions_30d ?? 0 },
              { label: '마지막 PV',   v: fmtDate(a.last_pv_at), small: true },
            ].map((kp, i) => (
              <div key={i} style={{
                padding: 12, borderRadius: 8,
                background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary, #888)', textTransform: 'uppercase' }}>{kp.label}</div>
                <div style={{ fontSize: kp.small ? 13 : 18, fontWeight: 800, marginTop: 4 }}>{kp.v}</div>
              </div>
            ))}
          </div>

          {/* 2-column: 최근 PV / 포인트 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            <div style={cardStyle}>
              <div style={subTitle}>최근 페이지뷰 (30개)</div>
              <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {pvs.length === 0 && <div style={{ color: 'var(--text-tertiary, #888)', fontSize: 12 }}>없음</div>}
                {pvs.map((v, i) => (
                  <div key={i} style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.18)', display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 }}>
                    <code style={{ color: 'var(--text-secondary, #ccc)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{decodePath(v.path)}</code>
                    <span style={{ color: 'var(--text-tertiary, #888)', flexShrink: 0 }}>
                      {v.category && <span style={{ marginRight: 4, fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>{v.category}</span>}
                      {fmtDate(v.at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={subTitle}>포인트 히스토리 (20개)</div>
              <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {points.length === 0 && <div style={{ color: 'var(--text-tertiary, #888)', fontSize: 12 }}>없음</div>}
                {points.map((pt, i) => (
                  <div key={i} style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.18)', display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 }}>
                    <span style={{ color: 'var(--text-secondary, #ccc)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pt.reason || '—'}</span>
                    <span style={{ color: (pt.points ?? 0) >= 0 ? 'var(--accent-green, #34d399)' : 'var(--accent-red, #f87171)', fontWeight: 700 }}>
                      {(pt.points ?? 0) >= 0 ? '+' : ''}{pt.points ?? 0}
                    </span>
                    <span style={{ color: 'var(--text-tertiary, #888)' }}>{fmtDate(pt.at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2-column: 최근 게시물 / 최근 댓글 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            <div style={cardStyle}>
              <div style={subTitle}>최근 게시물 (10개)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {posts.length === 0 && <div style={{ color: 'var(--text-tertiary, #888)', fontSize: 12 }}>없음</div>}
                {posts.map((po, i) => (
                  <div key={i} style={{ padding: '6px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.18)', fontSize: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: 'var(--text-primary, #fff)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{po.title || '(제목 없음)'}</span>
                      <span style={{ color: 'var(--text-tertiary, #888)', flexShrink: 0 }}>{fmtDate(po.created_at)}</span>
                    </div>
                    {po.category && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.06)', color: 'var(--text-tertiary, #888)' }}>{po.category}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={subTitle}>최근 댓글 (10개)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {comments.length === 0 && <div style={{ color: 'var(--text-tertiary, #888)', fontSize: 12 }}>없음</div>}
                {comments.map((c, i) => (
                  <div key={i} style={{ padding: '6px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.18)', fontSize: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: 'var(--text-secondary, #ccc)' }}>{c.content || '(내용 없음)'}</span>
                      <span style={{ color: 'var(--text-tertiary, #888)', flexShrink: 0 }}>{fmtDate(c.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
