"use client";
import { useState, useEffect } from "react";

const ago = (d: string) => { if(!d) return '—'; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); return s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분' : s < 86400 ? Math.floor(s / 3600) + '시간' : Math.floor(s / 86400) + '일'; };
const fmt = (d: string) => d ? new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '—';
const Badge = ({ ok, label }: { ok: boolean; label: string }) => <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)', fontWeight: 600, background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)', color: ok ? '#10B981' : 'rgba(255,255,255,0.15)' }}>{ok ? '✓' : '✗'}{label}</span>;
const Tag = ({ text, color = 'rgba(255,255,255,0.25)', bg = 'rgba(255,255,255,0.04)' }: { text: string; color?: string; bg?: string }) => <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: bg, color, whiteSpace: 'nowrap' }}>{text}</span>;
const Stat = ({ icon, val, label, warn }: { icon: string; val: number | string; label: string; warn?: boolean }) => <div style={{ textAlign: 'center', minWidth: 32 }}><div style={{ fontSize: 10 }}>{icon}</div><div style={{ fontSize: 12, fontWeight: 800, color: warn && val === 0 ? 'rgba(255,255,255,0.12)' : '#E2E8F0', lineHeight: 1 }}>{val}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>{label}</div></div>;

const pIcon: Record<string, string> = { kakao: '💬', google: '🔵', naver: '🟢', apple: '🍎' };
const gLabel: Record<number, { n: string; c: string }> = { 1:{n:'새싹',c:'#10B981'}, 2:{n:'묘목',c:'#34D399'}, 3:{n:'나무',c:'#06B6D4'}, 4:{n:'숲',c:'#3B82F6'}, 5:{n:'산',c:'#8B5CF6'}, 6:{n:'달',c:'#F59E0B'}, 7:{n:'별',c:'#EC4899'}, 8:{n:'VIP',c:'#EF4444'} };
const iLabel: Record<string, string> = { stock:'📈주식', apt:'🏠부동산', redev:'🏗재개발', news:'📰뉴스', tax:'🧾세금', crypto:'₿암호화폐', side:'💼부업', saving:'🐷저축', finance:'💰재테크' };
const aLabel: Record<string, string> = { '20s':'20대', '30s':'30대', '40s':'40대', '50s':'50대', '60+':'60대+' };

type Filter = 'all' | 'real' | 'seed';

export default function UsersTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [d, setD] = useState<any>(null);
  const [ld, setLd] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => { fetch('/api/admin/v2?tab=users').then(r => r.json()).then(v => { setD(v); setLd(false); }).catch(() => setLd(false)); }, []);

  if (ld) return <div style={{ textAlign: 'center', padding: 80, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>불러오는 중...</div>;
  if (!d) return <div style={{ textAlign: 'center', padding: 80 }}>⚠️ 로드 실패</div>;

  const { users = [], lifecycle: lc = {} as any, interests: ints = [], engagement: eng = {} as any } = d;
  const realUsers = users.filter((u: any) => !u.is_seed);
  const seedUsers = users.filter((u: any) => u.is_seed);
  const filtered = filter === 'real' ? realUsers : filter === 'seed' ? seedUsers : users;

  // 통계 (실유저만)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* KPI 5열 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4 }}>
        {[
          { l: '실유저', v: realUsers.length, c: '#3B7BF6' },
          { l: '시드', v: seedUsers.length, c: '#6B7280' },
          { l: '온보딩', v: lc.onboarded || 0, c: '#10B981' },
          { l: '프로필', v: lc.profileCompleted || 0, c: '#8B5CF6' },
          { l: '재방문', v: lc.returning || 0, c: '#06B6D4' },
        ].map(k => (
          <div key={k.l} style={{ textAlign: 'center', background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', padding: '7px 0' }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: k.c, lineHeight: 1 }}>{k.v}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* 인구통계 4열 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
        {[
          { t: '가입경로', data: Object.entries(lc.providers || {}).sort((a: any, b: any) => b[1] - a[1]), fmt: ([p, c]: any) => [pIcon[p]||'🔑', p, c] },
          { t: '지역', data: sortedEntries(cityMap).slice(0, 4), fmt: ([c, n]: any) => ['', c, n] },
          { t: '나이대', data: sortedEntries(ageMap), fmt: ([a, n]: any) => ['', aLabel[a]||a, n] },
          { t: '성별', data: sortedEntries(genderMap), fmt: ([g, n]: any) => ['', g==='male'?'♂남':g==='female'?'♀여':g, n] },
        ].map(sec => (
          <div key={sec.t} style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', padding: '6px 8px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>{sec.t}</div>
            {sec.data.length > 0 ? sec.data.map((e: any) => { const [icon, label, val] = sec.fmt(e); return (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '1px 0' }}>
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>{icon}{label}</span>
                <span style={{ fontWeight: 700, color: '#E2E8F0' }}>{val}</span>
              </div>
            );}) : <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)' }}>미설정</div>}
          </div>
        ))}
      </div>

      {/* 관심사 + 참여 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <div style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', padding: '6px 8px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>관심사 분포</div>
          {sortedEntries(interestMap).length > 0 ? sortedEntries(interestMap).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '1px 0' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)' }}>{iLabel[k]||k}</span>
              <span style={{ fontWeight: 700, color: '#E2E8F0' }}>{v}</span>
            </div>
          )) : <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)' }}>미설정</div>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 4 }}>
          {[
            { l: '마케팅동의', v: marketingYes, i: '📧' },
            { l: '프리미엄', v: premiumCount, i: '👑' },
            { l: '푸시구독', v: pushCount, i: '🔔' },
            { l: '이메일구독', v: eng.emailSubs || 0, i: '✉️' },
          ].map(k => (
            <div key={k.l} style={{ textAlign: 'center', background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 'var(--radius-sm)', padding: '5px 0' }}>
              <div style={{ fontSize: 10 }}>{k.i}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: k.v > 0 ? '#10B981' : 'rgba(255,255,255,0.12)' }}>{k.v}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{k.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 필터 토글 */}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {([['all', `👤 전체 (${users.length})`], ['real', `✅ 실유저 (${realUsers.length})`], ['seed', `🤖 시드 (${seedUsers.length})`]] as const).map(([f, l]) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            flex: 1, padding: '6px 0', fontSize: 10, fontWeight: 700, borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
            background: filter === f ? (f === 'seed' ? 'rgba(107,114,128,0.2)' : 'rgba(59,123,246,0.15)') : 'rgba(255,255,255,0.03)',
            color: filter === f ? (f === 'seed' ? '#9CA3AF' : '#3B7BF6') : 'rgba(255,255,255,0.25)',
          }}>{l}</button>
        ))}
      </div>

      {/* 유저 카드 */}
      {filtered.map((u: any) => {
        const g = gLabel[u.grade || 1] || gLabel[1];
        const isActive = u.last_active_at && (Date.now() - new Date(u.last_active_at).getTime()) < 7 * 86400000;
        const isSeed = u.is_seed;
        return (
          <div key={u.id} style={{
            background: isSeed ? 'rgba(107,114,128,0.06)' : 'rgba(12,21,40,0.65)',
            borderRadius: 10, padding: '8px 10px',
            border: `1px solid ${isSeed ? 'rgba(107,114,128,0.15)' : isActive ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)'}`,
            opacity: isSeed ? 0.7 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: isSeed ? '#6B7280' : isActive ? '#10B981' : 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: isSeed ? '#9CA3AF' : '#E2E8F0' }}>{u.nickname}</span>
              {isSeed && <Tag text="🤖시드" color="#EF4444" bg="rgba(239,68,68,0.12)" />}
              {!isSeed && <span style={{ fontSize: 10, color: g.c, fontWeight: 600, background: `${g.c}15`, padding: '0 5px', borderRadius: 'var(--radius-sm)' }}>{g.n}</span>}
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{pIcon[u.provider] || '🔑'}</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>{fmt(u.created_at)}</span>
              {u.last_active_at && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.12)' }}>→{ago(u.last_active_at)}</span>}
            </div>
            {!isSeed && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
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
            )}
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
            {u.interests && u.interests.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                {(u.interests as string[]).map((i: string) => <Tag key={i} text={iLabel[i]||i} />)}
              </div>
            )}
          </div>
        );
      })}

      {/* 관심 등록 */}
      {ints.length > 0 && <>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#E2E8F0', marginTop: 2 }}>❤️ 관심 등록 ({ints.length})</div>
        {ints.map((i: any, idx: number) => (
          <div key={idx} style={{ background: 'rgba(12,21,40,0.65)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', padding: '5px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
            <div><span style={{ color: '#E2E8F0', fontWeight: 600 }}>{i.siteName}</span><span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>{i.siteRegion}</span></div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {i.notification_enabled && <span style={{ fontSize: 10, color: '#10B981' }}>🔔</span>}
              <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10 }}>{ago(i.created_at)}</span>
            </div>
          </div>
        ))}
      </>}
    </div>
  );
}
