'use client';
import { useState, useEffect, useCallback } from 'react';

const GRADE_LABEL: Record<number, string> = { 1: '새싹', 2: '묘목', 3: '가지', 4: '나무', 5: '숲', 6: '산', 7: '하늘', 8: '별', 9: '은하', 10: '우주' };
const GRADE_COLOR: Record<number, string> = { 1: '#6B7280', 2: '#10B981', 3: '#3B82F6', 4: '#8B5CF6', 5: '#F59E0B', 6: '#EF4444', 7: '#EC4899', 8: '#F97316', 9: '#06B6D4', 10: '#FFD700' };

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
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const load = useCallback(() => {
    fetch('/api/admin/v2?tab=users').then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading || !data) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>로딩 중...</div>;

  const { users, lifecycle, interests, engagement } = data;
  const totalProviders = Object.values(lifecycle.providers || {}).reduce((s: number, v: any) => s + v, 0) as number;

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
            <span style={{ minWidth: 55, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>
              {s.value}명 <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>({Math.round(s.pct)}%)</span>
            </span>
          </div>
        ))}
        {lifecycle.returning === 0 && (
          <div style={{ fontSize: 11, color: '#EF4444', marginTop: 6, textAlign: 'center' }}>
            ⚠️ 전원 가입 후 재방문 없음
          </div>
        )}
      </div>

      {/* 가입 경로 + 지역 + 등급 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, margin: '10px 0' }}>
        {/* 가입 경로 */}
        <div className="adm-kpi-c">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>가입 경로</div>
          {Object.entries(lifecycle.providers || {}).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]: [string, any]) => (
            <div key={k} style={{ marginBottom: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{k || '?'}</span>
                <span style={{ fontWeight: 600 }}>{Math.round((v / totalProviders) * 100)}%</span>
              </div>
              <div style={{ height: 3, background: 'var(--bg-hover)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${(v / totalProviders) * 100}%`, background: k === 'kakao' ? '#FEE500' : k === 'google' ? '#4285F4' : 'var(--brand)', borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>

        {/* 지역 분포 */}
        <div className="adm-kpi-c">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>지역</div>
          {(lifecycle.cities || []).slice(0, 5).map(([city, cnt]: [string, number]) => (
            <div key={city} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '1px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{city}</span>
              <span style={{ fontWeight: 600 }}>{cnt}</span>
            </div>
          ))}
        </div>

        {/* 등급 분포 */}
        <div className="adm-kpi-c">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>등급</div>
          {(lifecycle.grades || []).map((g: any) => (
            <div key={g.grade} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: GRADE_COLOR[g.grade] || '#666', display: 'inline-block' }} />
              <span style={{ flex: 1, fontSize: 10, color: 'var(--text-secondary)' }}>Lv{g.grade} {GRADE_LABEL[g.grade] || ''}</span>
              <span style={{ fontSize: 10, fontWeight: 600 }}>{g.count}</span>
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
                {i.siteRegion} · {i.is_member ? '회원' : '비회원'} · {ago(i.created_at)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 참여 지표 */}
      <div className="adm-sec">💎 사용자 참여</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '10px 0' }}>
        {[
          { icon: '📌', label: '북마크', value: engagement.bookmarks, sub: `${engagement.bookmarkUsers}명` },
          { icon: '📈', label: '주식워치', value: engagement.stockWatch, sub: engagement.stockWatch === 0 ? '미사용' : '' },
          { icon: '🔍', label: '검색', value: engagement.searches },
          { icon: '🔗', label: '공유', value: engagement.shares },
          { icon: '📲', label: 'PWA', value: engagement.pwaInstalls },
        ].map((e, i) => (
          <div key={i} className="adm-kpi-c" style={{ padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: e.value === 0 ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{e.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{e.icon} {e.label}</div>
            {e.sub && <div style={{ fontSize: 9, color: e.value === 0 ? '#EF4444' : 'var(--text-tertiary)' }}>{e.sub}</div>}
          </div>
        ))}
      </div>

      {/* 실유저 타임라인 */}
      <div className="adm-sec">📋 실유저 ({lifecycle.total}명)</div>
      <div className="adm-card" style={{ padding: '4px 14px', maxHeight: 400, overflowY: 'auto' }}>
        {(users || []).map((u: any, i: number) => (
          <div key={i}
            onClick={() => setSelectedUser(selectedUser?.id === u.id ? null : u)}
            style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: GRADE_COLOR[u.grade] || '#666' }} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.nickname || '(없음)'}</span>
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 4 }}>{u.provider}</span>
              {u.residence_city && <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{u.residence_city}</span>}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: u.last_active_at ? '#10B981' : '#EF4444' }}>
                {u.last_active_at ? '활성' : '이탈'}
              </span>
            </div>

            {/* 유저 상세 드릴다운 */}
            {selectedUser?.id === u.id && (
              <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-hover)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <div>가입: {new Date(u.created_at).toLocaleDateString('ko-KR')}</div>
                <div>등급: Lv{u.grade} {GRADE_LABEL[u.grade] || ''} · 포인트: {u.points || 0}P</div>
                <div>온보딩: {u.onboarded ? '✅' : '❌'} · 프로필: {u.profile_completed ? '✅' : '❌'}</div>
                <div>마지막 활동: {u.last_active_at ? ago(u.last_active_at) : '없음'}</div>
                <div>가입 후: {Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400000)}일 경과</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
