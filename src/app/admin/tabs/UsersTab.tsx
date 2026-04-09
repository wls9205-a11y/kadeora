'use client';
import { useState, useEffect, useCallback } from 'react';

const ago = (d: string) => { const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); return s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분' : s < 86400 ? Math.floor(s / 3600) + '시' : Math.floor(s / 86400) + '일'; };
const fmt = (d: string) => d ? new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '—';

const Badge = ({ ok, label }: { ok: boolean; label: string }) => (
  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, fontWeight: 600, background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)', color: ok ? '#10B981' : 'rgba(255,255,255,0.2)' }}>{ok ? '✓' : '✗'} {label}</span>
);

const Stat = ({ icon, val, label, warn }: { icon: string; val: number | string; label: string; warn?: boolean }) => (
  <div style={{ textAlign: 'center', minWidth: 36 }}>
    <div style={{ fontSize: 10 }}>{icon}</div>
    <div style={{ fontSize: 13, fontWeight: 800, color: warn && val === 0 ? 'rgba(255,255,255,0.15)' : '#E2E8F0', lineHeight: 1 }}>{val}</div>
    <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{label}</div>
  </div>
);

const providerIcon: Record<string, string> = { kakao: '💬', google: '🔵', naver: '🟢', apple: '🍎', email: '📧' };
const gradeLabel: Record<number, { name: string; color: string }> = {
  1: { name: '새싹', color: '#10B981' }, 2: { name: '묘목', color: '#34D399' }, 3: { name: '나무', color: '#06B6D4' },
  4: { name: '숲', color: '#3B82F6' }, 5: { name: '산', color: '#8B5CF6' }, 6: { name: '달', color: '#F59E0B' },
  7: { name: '별', color: '#EC4899' }, 8: { name: 'VIP', color: '#EF4444' },
};

export default function UsersTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [d, setD] = useState<any>(null);
  const [ld, setLd] = useState(true);
  const load = useCallback(() => {
    fetch('/api/admin/v2?tab=users').then(r => r.json()).then(v => { setD(v); setLd(false); }).catch(() => setLd(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (ld) return <div style={{ textAlign: 'center', padding: 80, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>불러오는 중...</div>;
  if (!d) return <div style={{ textAlign: 'center', padding: 80 }}>⚠️ 로드 실패</div>;

  const { users = [], lifecycle: lc = {} as any, interests: ints = [], engagement: eng = {} as any } = d;
  const realUsers = users.filter((u: any) => !u.is_seed);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* ═══ 요약 KPI ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
        {[
          { l: '전체', v: lc.total || realUsers.length, c: '#3B7BF6' },
          { l: '온보딩', v: lc.onboarded || 0, c: '#10B981' },
          { l: '프로필', v: lc.profileCompleted || 0, c: '#8B5CF6' },
          { l: '재방문', v: lc.returning || 0, c: '#06B6D4' },
        ].map(k => (
          <div key={k.l} style={{ textAlign: 'center', background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 0' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: k.c, lineHeight: 1 }}>{k.v}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* ═══ 가입경로 + 지역 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <div style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>가입경로</div>
          {Object.entries(lc.providers || {}).sort((a: any, b: any) => b[1] - a[1]).map(([p, c]: any) => (
            <div key={p} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '1px 0' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{providerIcon[p] || '🔑'} {p}</span>
              <span style={{ fontWeight: 700, color: '#E2E8F0' }}>{c}</span>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>지역</div>
          {(lc.cities || []).slice(0, 5).map(([city, cnt]: any) => (
            <div key={city} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '1px 0' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>{city}</span>
              <span style={{ fontWeight: 700, color: '#E2E8F0' }}>{cnt}</span>
            </div>
          ))}
          {(lc.cities || []).length === 0 && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>미설정</div>}
        </div>
      </div>

      {/* ═══ 참여 지표 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
        {[
          { l: '북마크', v: eng.bookmarks, i: '📌' },
          { l: '관심종목', v: eng.stockWatch, i: '⭐' },
          { l: '검색', v: eng.searches, i: '🔍' },
          { l: '공유', v: eng.shares, i: '📤' },
          { l: 'PWA설치', v: eng.pwaInstalls, i: '📱' },
          { l: '이메일구독', v: eng.emailSubs || 0, i: '📧' },
        ].map(k => (
          <div key={k.l} style={{ textAlign: 'center', background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6, padding: '5px 0' }}>
            <div style={{ fontSize: 11 }}>{k.i}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: (k.v || 0) > 0 ? '#10B981' : 'rgba(255,255,255,0.12)' }}>{k.v || 0}</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* ═══ 유저 카드 — 전체 펼침 ═══ */}
      <div style={{ fontSize: 11, fontWeight: 800, color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <span>👤</span> 실 유저 ({realUsers.length}명) — 최근 가입순
      </div>

      {realUsers.map((u: any) => {
        const g = gradeLabel[u.grade || 1] || gradeLabel[1];
        const daysSinceJoin = Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400000);
        const isActive = u.last_active_at && daysSinceJoin <= 7;

        return (
          <div key={u.id} style={{
            background: 'rgba(12,21,40,0.65)', border: `1px solid ${isActive ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)'}`,
            borderRadius: 10, padding: '10px 12px',
          }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? '#10B981' : 'rgba(255,255,255,0.1)', flexShrink: 0, boxShadow: isActive ? '0 0 6px rgba(16,185,129,0.4)' : 'none' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>{u.nickname}</span>
              <span style={{ fontSize: 9, color: g.color, fontWeight: 600, background: `${g.color}15`, padding: '1px 6px', borderRadius: 8 }}>{g.name}</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{providerIcon[u.provider] || '🔑'}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>{fmt(u.created_at)}</span>
              {u.last_active_at && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)' }}>→{ago(u.last_active_at)}</span>}
            </div>

            {/* 상태 뱃지 */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              <Badge ok={u.onboarded} label="온보딩" />
              <Badge ok={u.profile_completed} label="프로필" />
              {u.residence_city && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: 'rgba(59,123,246,0.1)', color: '#3B7BF6' }}>📍 {u.residence_city}</span>}
              {u.signup_source && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}>🔗 {u.signup_source}</span>}
            </div>

            {/* 활동 지표 */}
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '4px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <Stat icon="📝" val={u.posts_count || 0} label="글" warn />
              <Stat icon="💬" val={u.comments_count || 0} label="댓글" warn />
              <Stat icon="⭐" val={u.watchlist_count || 0} label="종목" warn />
              <Stat icon="🏠" val={u.apt_bm_count || 0} label="단지" warn />
              <Stat icon="📌" val={u.blog_bm_count || 0} label="저장" warn />
              <Stat icon="📅" val={u.attendance_count || 0} label="출석" warn />
              <Stat icon="💰" val={u.points || 0} label="P" />
            </div>

            {/* 관심사 */}
            {u.interests && u.interests.length > 0 && (
              <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                {(u.interests as string[]).map((i: string) => (
                  <span key={i} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)' }}>{i}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ═══ 관심 등록 ═══ */}
      {ints.length > 0 && <>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span>❤️</span> 관심 등록 ({ints.length})
        </div>
        {ints.map((i: any, idx: number) => (
          <div key={idx} style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
            <div>
              <span style={{ color: '#E2E8F0', fontWeight: 600 }}>{i.siteName}</span>
              <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 6 }}>{i.siteRegion}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>{i.guest_name || '회원'}</span>
              {i.notification_enabled && <span style={{ fontSize: 9, color: '#10B981' }}>🔔</span>}
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9 }}>{ago(i.created_at)}</span>
            </div>
          </div>
        ))}
      </>}
    </div>
  );
}
