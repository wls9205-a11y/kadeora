"use client";
import { useState, useEffect, useCallback } from "react";

const ago = (d: string) => { if(!d) return '—'; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); return s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분' : s < 86400 ? Math.floor(s / 3600) + '시간' : Math.floor(s / 86400) + '일'; };
const fmt = (d: string) => d ? new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '—';
const Badge = ({ ok, label }: { ok: boolean; label: string }) => <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, fontWeight: 600, background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)', color: ok ? '#10B981' : 'rgba(255,255,255,0.15)' }}>{ok ? '✓' : '✗'}{label}</span>;
const Tag = ({ text, color = 'rgba(255,255,255,0.25)', bg = 'rgba(255,255,255,0.04)' }: { text: string; color?: string; bg?: string }) => <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 5, background: bg, color, whiteSpace: 'nowrap' }}>{text}</span>;
const Stat = ({ icon, val, label, warn }: { icon: string; val: number | string; label: string; warn?: boolean }) => <div style={{ textAlign: 'center', minWidth: 32 }}><div style={{ fontSize: 9 }}>{icon}</div><div style={{ fontSize: 12, fontWeight: 800, color: warn && val === 0 ? 'rgba(255,255,255,0.12)' : '#E2E8F0', lineHeight: 1 }}>{val}</div><div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>{label}</div></div>;

const pIcon: Record<string, string> = { kakao: '💬', google: '🔵', naver: '🟢', apple: '🍎' };
const gLabel: Record<number, { n: string; c: string }> = { 1:{n:'새싹',c:'#10B981'}, 2:{n:'묘목',c:'#34D399'}, 3:{n:'나무',c:'#06B6D4'}, 4:{n:'숲',c:'#3B82F6'}, 5:{n:'산',c:'#8B5CF6'}, 6:{n:'달',c:'#F59E0B'}, 7:{n:'별',c:'#EC4899'}, 8:{n:'VIP',c:'#EF4444'} };
const iLabel: Record<string, string> = { stock:'📈주식', apt:'🏠부동산', redev:'🏗재개발', news:'📰뉴스', tax:'🧾세금', crypto:'₿암호화폐', side:'💼부업', saving:'🐷저축', finance:'💰재테크' };
const aLabel: Record<string, string> = { '20s':'20대', '30s':'30대', '40s':'40대', '50s':'50대', '60+':'60대+' };

export default function UsersTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [d, setD] = useState<any>(null);
  const [ld, setLd] = useState(true);
  useEffect(() => { fetch('/api/admin/v2?tab=users').then(r => r.json()).then(v => { setD(v); setLd(false); }).catch(() => setLd(false)); }, []);

  if (ld) return <div style={{ textAlign: 'center', padding: 80, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>불러오는 중...</div>;
  if (!d) return <div style={{ textAlign: 'center', padding: 80 }}>⚠️ 로드 실패</div>;

  const { users = [], lifecycle: lc = {} as any, interests: ints = [], engagement: eng = {} as any } = d;
  const realUsers = users.filter((u: any) => !u.is_seed);

  // 통계 집계
  const genderMap: Record<string, number> = {};
  const ageMap: Record<string, number> = {};
  const cityMap: Record<string, number> = {};
  const interestMap: Record<string, number> = {};
  let marketingYes = 0, premiumCount = 0, pushCount = 0;

  for (const u of realUsers) {
    if (u.gender) genderMap[u.gender] = (genderMap[u.gender] || 0) + 1;
    if (u.age_group) ageMap[u.age_group] = (ageMap[u.age_group] || 0) + 1;
    if (u.residence_city) cityMap[u.residence_city] = (cityMap[u.residence_city] || 0) + 1;
    if (u.marketing_agreed) marketingYes++;
    if (u.is_premium) premiumCount++;
    if ((u.push_count || 0) > 0) pushCount++;
    for (const i of (u.interests || [])) interestMap[i] = (interestMap[i] || 0) + 1;
  }

  const sortedEntries = (obj: Record<string, number>) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>

      {/* ═══ KPI 4열 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
        {[
          { l: '전체', v: realUsers.length, c: '#3B7BF6' },
          { l: '온보딩', v: lc.onboarded || 0, c: '#10B981' },
          { l: '프로필', v: lc.profileCompleted || 0, c: '#8B5CF6' },
          { l: '재방문', v: lc.returning || 0, c: '#06B6D4' },
        ].map(k => (
          <div key={k.l} style={{ textAlign: 'center', background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '7px 0' }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: k.c, lineHeight: 1 }}>{k.v}</div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* ═══ 인구통계 4열 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
        {/* 가입경로 */}
        <div style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>가입경로</div>
          {Object.entries(lc.providers || {}).sort((a: any, b: any) => b[1] - a[1]).map(([p, c]: any) => (
            <div key={p} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '1px 0' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>{pIcon[p]||'🔑'}{p}</span>
              <span style={{ fontWeight: 700, color: '#E2E8F0' }}>{c}</span>
            </div>
          ))}
        </div>
        {/* 지역 */}
        <div style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>지역</div>
          {sortedEntries(cityMap).length > 0 ? sortedEntries(cityMap).slice(0, 4).map(([c, n]) => (
            <div key={c} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '1px 0' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>{c}</span>
              <span style={{ fontWeight: 700, color: '#E2E8F0' }}>{n}</span>
            </div>
          )) : <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)' }}>미설정</div>}
        </div>
        {/* 나이대 */}
        <div style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>나이대</div>
          {sortedEntries(ageMap).length > 0 ? sortedEntries(ageMap).map(([a, n]) => (
            <div key={a} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '1px 0' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>{aLabel[a]||a}</span>
              <span style={{ fontWeight: 700, color: '#E2E8F0' }}>{n}</span>
            </div>
          )) : <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)' }}>미설정</div>}
        </div>
        {/* 성별 */}
        <div style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>성별</div>
          {sortedEntries(genderMap).length > 0 ? sortedEntries(genderMap).map(([g, n]) => (
            <div key={g} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '1px 0' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>{g === 'male' ? '♂남' : g === 'female' ? '♀여' : g}</span>
              <span style={{ fontWeight: 700, color: '#E2E8F0' }}>{n}</span>
            </div>
          )) : <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)' }}>미설정</div>}
        </div>
      </div>

      {/* ═══ 관심사 + 참여 ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <div style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 8px' }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>관심사 분포</div>
          {sortedEntries(interestMap).length > 0 ? sortedEntries(interestMap).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '1px 0' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>{iLabel[k]||k}</span>
              <span style={{ fontWeight: 700, color: '#E2E8F0' }}>{v}</span>
            </div>
          )) : <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)' }}>미설정</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 4 }}>
          {[
            { l: '마케팅동의', v: marketingYes, i: '📧' },
            { l: '프리미엄', v: premiumCount, i: '👑' },
            { l: '푸시구독', v: pushCount, i: '🔔' },
            { l: '이메일구독', v: eng.emailSubs || 0, i: '✉️' },
          ].map(k => (
            <div key={k.l} style={{ textAlign: 'center', background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6, padding: '5px 0' }}>
              <div style={{ fontSize: 10 }}>{k.i}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: k.v > 0 ? '#10B981' : 'rgba(255,255,255,0.12)' }}>{k.v}</div>
              <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)' }}>{k.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 유저 카드 ═══ */}
      <div style={{ fontSize: 10, fontWeight: 800, color: '#E2E8F0', marginTop: 2 }}>👤 실 유저 ({realUsers.length}명)</div>

      {realUsers.map((u: any) => {
        const g = gLabel[u.grade || 1] || gLabel[1];
        const daysSince = Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400000);
        const isActive = u.last_active_at && (Date.now() - new Date(u.last_active_at).getTime()) < 7 * 86400000;

        return (
          <div key={u.id} style={{
            background: 'rgba(12,21,40,0.65)', borderRadius: 10, padding: '8px 10px',
            border: `1px solid ${isActive ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)'}`,
          }}>
            {/* Row 1: 이름 + 등급 + 소셜 + 가입일 + 최근접속 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: isActive ? '#10B981' : 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#E2E8F0' }}>{u.nickname}</span>
              <span style={{ fontSize: 8, color: g.c, fontWeight: 600, background: `${g.c}15`, padding: '0 5px', borderRadius: 6 }}>{g.n}</span>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>{pIcon[u.provider] || '🔑'}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.18)' }}>{fmt(u.created_at)}</span>
              {u.last_active_at && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.12)' }}>→{ago(u.last_active_at)}</span>}
            </div>

            {/* Row 2: 상태뱃지 + 인구통계 */}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
              <Badge ok={u.onboarded} label="온보딩" />
              <Badge ok={u.profile_completed} label="프로필" />
              <Badge ok={u.marketing_agreed} label="마케팅" />
              {u.is_premium && <Tag text="👑프리미엄" color="#F59E0B" bg="rgba(245,158,11,0.1)" />}
              {u.residence_city && <Tag text={`📍${u.residence_city}${u.residence_district ? ' ' + u.residence_district : ''}`} color="#3B7BF6" bg="rgba(59,123,246,0.08)" />}
              {u.age_group && <Tag text={aLabel[u.age_group]||u.age_group} color="#8B5CF6" bg="rgba(139,92,246,0.08)" />}
              {u.gender && <Tag text={u.gender === 'male' ? '♂' : u.gender === 'female' ? '♀' : u.gender} color="#06B6D4" bg="rgba(6,182,212,0.08)" />}
              {u.signup_source && <Tag text={`🔗${u.signup_source}`} color="#8B5CF6" bg="rgba(139,92,246,0.08)" />}
              {u.streak_days > 0 && <Tag text={`🔥${u.streak_days}일연속`} color="#EF4444" bg="rgba(239,68,68,0.08)" />}
            </div>

            {/* Row 3: 활동 지표 */}
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '3px 0', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
              <Stat icon="📝" val={u.posts_count || 0} label="글" warn />
              <Stat icon="💬" val={u.comments_count || 0} label="댓글" warn />
              <Stat icon="⭐" val={u.watchlist_count || 0} label="종목" warn />
              <Stat icon="🏠" val={u.apt_bm_count || 0} label="단지" warn />
              <Stat icon="📌" val={u.blog_bm_count || 0} label="저장" warn />
              <Stat icon="📅" val={u.attendance_count || 0} label="출석" warn />
              <Stat icon="💰" val={u.points || 0} label="P" />
              {u.influence_score > 0 && <Stat icon="⚡" val={u.influence_score} label="영향력" />}
            </div>

            {/* Row 4: 관심사 */}
            {u.interests && u.interests.length > 0 && (
              <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                {(u.interests as string[]).map((i: string) => (
                  <Tag key={i} text={iLabel[i]||i} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ═══ 관심 등록 ═══ */}
      {ints.length > 0 && <>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#E2E8F0', marginTop: 2 }}>❤️ 관심 등록 ({ints.length})</div>
        {ints.map((i: any, idx: number) => (
          <div key={idx} style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: '5px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
            <div><span style={{ color: '#E2E8F0', fontWeight: 600 }}>{i.siteName}</span><span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>{i.siteRegion}</span></div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {i.notification_enabled && <span style={{ fontSize: 8, color: '#10B981' }}>🔔</span>}
              <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 8 }}>{ago(i.created_at)}</span>
            </div>
          </div>
        ))}
      </>}
    </div>
  );
}
