'use client';
import { useState, useEffect, useCallback } from 'react';

function ago(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

export default function UsersTab({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch('/api/admin/v2?tab=users').then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading || !data || data.error) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>로딩 중...</div>;

  const { users, lifecycle, interests, engagement } = data;

  return (
    <div>
      {/* 라이프사이클 퍼널 */}
      <div className="adm-sec">👤 사용자 라이프사이클</div>
      <div className="adm-card">
        {[
          { label: '가입', value: lifecycle.total, pct: 100, color: 'var(--brand)' },
          { label: '온보딩', value: lifecycle.onboarded, pct: lifecycle.total > 0 ? (lifecycle.onboarded / lifecycle.total) * 100 : 0, color: '#8B5CF6' },
          { label: '프로필', value: lifecycle.profileCompleted, pct: lifecycle.total > 0 ? (lifecycle.profileCompleted / lifecycle.total) * 100 : 0, color: '#F59E0B' },
          { label: '재방문', value: lifecycle.returning, pct: lifecycle.total > 0 ? (lifecycle.returning / lifecycle.total) * 100 : 0, color: lifecycle.returning > 0 ? '#10B981' : '#EF4444' },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ minWidth: 50, fontSize: 12, color: 'var(--text-secondary)' }}>{s.label}</span>
            <div style={{ flex: 1, height: 16, background: 'var(--bg-hover)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(s.pct, 1)}%`, background: s.color, borderRadius: 4 }} />
            </div>
            <span style={{ minWidth: 50, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>
              {s.value}명 <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({Math.round(s.pct)}%)</span>
            </span>
          </div>
        ))}
        {lifecycle.returning === 0 && (
          <div style={{ fontSize: 11, color: '#EF4444', marginTop: 6, textAlign: 'center' }}>
            ⚠️ 전원 가입 후 재방문 없음 — 온보딩 후 가치 전달 부재
          </div>
        )}
      </div>

      {/* 가입 경로 + 지역 */}
      <div className="adm-kpi">
        <div className="adm-kpi-c">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>가입 경로</div>
          {Object.entries(lifecycle.providers || {}).map(([k, v]: [string, any]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
              <span style={{ fontWeight: 600 }}>{v}명</span>
            </div>
          ))}
        </div>
        <div className="adm-kpi-c">
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>지역 분포</div>
          {(lifecycle.cities || []).map(([city, cnt]: [string, number]) => (
            <div key={city} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{city}</span>
              <span style={{ fontWeight: 600 }}>{cnt}명</span>
            </div>
          ))}
        </div>
      </div>

      {/* 관심단지 등록 현황 */}
      <div className="adm-sec">🏢 관심단지 등록 현황</div>
      <div className="adm-card">
        {(interests || []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>등록 없음</div>
        ) : (
          (interests || []).map((i: any, idx: number) => (
            <div key={idx} style={{ padding: '8px 0', borderBottom: idx < interests.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{i.siteName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {i.siteRegion} · {i.is_member ? '회원' : '비회원'}{i.guest_name ? ` · ${i.guest_name}` : ''}{i.guest_city ? ` · ${i.guest_city}` : ''} · {ago(i.created_at)}
              </div>
            </div>
          ))
        )}
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, textAlign: 'center' }}>
          {(interests || []).length}건 등록 · 비회원 게스트 등록 {(interests || []).filter((i: any) => !i.is_member).length}건
        </div>
      </div>

      {/* 참여 지표 */}
      <div className="adm-sec">💎 사용자 참여</div>
      <div className="adm-kpi-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {[
          { icon: '📌', label: '북마크', value: engagement.bookmarks, sub: `${engagement.bookmarkUsers}명` },
          { icon: '📈', label: '주식워치', value: engagement.stockWatch, sub: engagement.stockWatch === 0 ? '미사용' : '' },
          { icon: '🔍', label: '검색', value: engagement.searches, sub: '' },
          { icon: '🔗', label: '공유', value: engagement.shares, sub: '' },
          { icon: '📲', label: 'PWA', value: engagement.pwaInstalls, sub: '설치' },
        ].map((e, i) => (
          <div key={i} className="adm-kpi-c" style={{ padding: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: e.value === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{e.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{e.icon} {e.label}</div>
            {e.sub && <div style={{ fontSize: 9, color: e.value === 0 ? '#EF4444' : 'var(--text-tertiary)' }}>{e.sub}</div>}
          </div>
        ))}
      </div>

      {/* 실유저 타임라인 */}
      <div className="adm-sec">📋 실유저 타임라인</div>
      <div className="adm-card" style={{ padding: '8px 14px' }}>
        {(users || []).map((u: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 12 }}>
            <span style={{ minWidth: 50, color: 'var(--text-tertiary)', fontSize: 10 }}>{ago(u.created_at)}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.nickname || '(없음)'}</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 4 }}>{u.provider}</span>
            {u.residence_city && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{u.residence_city}</span>}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: u.last_active_at ? '#10B981' : '#EF4444' }}>
              {u.last_active_at ? '활성' : '이탈'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
