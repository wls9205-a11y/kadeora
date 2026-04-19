'use client';

/**
 * UsersListV2 — v_admin_user_list 기반 유저 리스트 + 360도 상세 모달
 *
 * 기존 UsersTab 대체 아닌 추가 섹션. AdminShell 에서 탭으로 분리해 사용.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

type SortKey = 'signup_at' | 'last_active_at' | 'grade' | 'points' | 'influence_score';

interface UserRow {
  user_id: string;
  nickname: string;
  email?: string | null;
  provider?: string | null;
  grade?: number | null;
  points?: number | null;
  streak?: number | null;
  signup_at?: string | null;
  last_active_at?: string | null;
  onboarded?: boolean | null;
  is_premium?: boolean | null;
  is_seed?: boolean | null;
  is_banned?: boolean | null;
  is_dormant_14d?: boolean | null;
  is_excluded?: boolean | null;
  signup_source?: string | null;
  pv_7d?: number | null;
  cta_clicks_7d?: number | null;
  engagement_avg?: number | null;
}

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('ko-KR') : '—');
const ago = (d?: string | null) => {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  return s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분' : s < 86400 ? Math.floor(s / 3600) + '시간' : Math.floor(s / 86400) + '일';
};
const pillStyle = (ok: boolean): React.CSSProperties => ({
  fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
  background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
  color: ok ? '#10B981' : 'rgba(255,255,255,0.3)',
});

export default function UsersListV2() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('signup_at');
  const [asc, setAsc] = useState(false);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [onboarded, setOnboarded] = useState<'' | 'true' | 'false'>('');
  const [premium, setPremium] = useState<'' | 'true' | 'false'>('');
  const [seed, setSeed] = useState<'' | 'true' | 'false'>('');
  const [dormant, setDormant] = useState<'' | 'true' | 'false'>('');
  const [provider, setProvider] = useState('');
  const [grade, setGrade] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const buildUrl = useCallback(() => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    sp.set('sort', sort);
    if (asc) sp.set('asc', '1');
    sp.set('limit', String(limit));
    sp.set('offset', String(offset));
    if (onboarded) sp.set('onboarded', onboarded);
    if (premium) sp.set('is_premium', premium);
    if (seed) sp.set('is_seed', seed);
    if (dormant) sp.set('is_dormant', dormant);
    if (provider) sp.set('provider', provider);
    if (grade) sp.set('grade', grade);
    return `/api/admin/user-list?${sp.toString()}`;
  }, [q, sort, asc, limit, offset, onboarded, premium, seed, dormant, provider, grade]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(buildUrl())
      .then(async (r) => {
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) setError(j?.error || 'fetch failed');
        else {
          setRows(j.rows || []);
          setTotal(j.total || 0);
          setError(null);
        }
      })
      .catch((e) => !cancelled && setError(String(e?.message || e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [buildUrl]);

  const openDetail = async (uid: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const r = await fetch(`/api/admin/user-detail/${uid}`);
      const j = await r.json();
      setDetail(j?.detail || null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setDetailLoading(false);
    }
  };

  const pageInfo = useMemo(() => {
    const from = rows.length === 0 ? 0 : offset + 1;
    const to = offset + rows.length;
    return `${from}–${to} / ${total.toLocaleString()}`;
  }, [rows.length, offset, total]);

  return (
    <div style={{ color: 'var(--text-primary, #e5e7eb)', padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input
          placeholder="닉네임/이메일 검색"
          value={q}
          onChange={(e) => { setOffset(0); setQ(e.target.value); }}
          style={inputStyle()}
        />
        <select value={provider} onChange={(e) => { setOffset(0); setProvider(e.target.value); }} style={inputStyle()}>
          <option value="">provider 전체</option>
          <option value="kakao">kakao</option>
          <option value="google">google</option>
          <option value="naver">naver</option>
          <option value="apple">apple</option>
        </select>
        <select value={grade} onChange={(e) => { setOffset(0); setGrade(e.target.value); }} style={inputStyle()}>
          <option value="">grade 전체</option>
          {[1,2,3,4,5,6,7,8].map((g) => <option key={g} value={g}>grade {g}</option>)}
        </select>
        <TriFilter label="온보딩" value={onboarded} set={setOnboarded} onSet={() => setOffset(0)} />
        <TriFilter label="프리미엄" value={premium} set={setPremium} onSet={() => setOffset(0)} />
        <TriFilter label="시드" value={seed} set={setSeed} onSet={() => setOffset(0)} />
        <TriFilter label="휴면14d" value={dormant} set={setDormant} onSet={() => setOffset(0)} />
        <select value={sort} onChange={(e) => { setOffset(0); setSort(e.target.value as SortKey); }} style={inputStyle()}>
          <option value="signup_at">가입일</option>
          <option value="last_active_at">최근 접속</option>
          <option value="grade">등급</option>
          <option value="points">포인트</option>
          <option value="influence_score">영향력</option>
        </select>
        <button onClick={() => setAsc((v) => !v)} style={btnStyle()}>
          {asc ? '오름' : '내림'}
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{pageInfo}</span>
      </div>

      {error && <div style={{ color: '#F87171', fontSize: 12, marginBottom: 8 }}>{error}</div>}

      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
            <tr>
              {['닉네임','provider','grade','points','streak','가입','최근','온보','프리','시드','정지','소스','PV7d','CTA7d','몰입'].map((h) => (
                <th key={h} style={thStyle()}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={15} style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.4)' }}>로딩 중…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={15} style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.4)' }}>결과 없음</td></tr>
            ) : rows.map((u) => (
              <tr key={u.user_id} onClick={() => openDetail(u.user_id)} style={{ cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={tdStyle()}>
                  <div style={{ fontWeight: 700 }}>{u.nickname}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{u.email || u.user_id.slice(0, 8)}</div>
                </td>
                <td style={tdStyle()}>{u.provider || '—'}</td>
                <td style={tdStyle()}>{u.grade ?? '—'}</td>
                <td style={tdStyle()}>{(u.points ?? 0).toLocaleString()}</td>
                <td style={tdStyle()}>{u.streak ?? 0}</td>
                <td style={tdStyle()}>{fmt(u.signup_at)}</td>
                <td style={tdStyle()}>{ago(u.last_active_at)}</td>
                <td style={tdStyle()}><span style={pillStyle(!!u.onboarded)}>on</span></td>
                <td style={tdStyle()}><span style={pillStyle(!!u.is_premium)}>P</span></td>
                <td style={tdStyle()}><span style={pillStyle(!!u.is_seed)}>seed</span></td>
                <td style={tdStyle()}><span style={pillStyle(!!u.is_banned)}>ban</span></td>
                <td style={tdStyle()}>{u.signup_source || '—'}</td>
                <td style={tdStyle()}>{u.pv_7d ?? 0}</td>
                <td style={tdStyle()}>{u.cta_clicks_7d ?? 0}</td>
                <td style={tdStyle()}>{Number(u.engagement_avg ?? 0).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} style={btnStyle()}>← 이전</button>
        <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} style={btnStyle()}>다음 →</button>
      </div>

      {detailOpen && (
        <div
          onClick={() => setDetailOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(900px, 100%)', maxHeight: '90vh', overflowY: 'auto',
              background: 'var(--bg-surface, #0f172a)', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>유저 360°</h2>
              <button onClick={() => setDetailOpen(false)} style={btnStyle()}>닫기</button>
            </div>
            {detailLoading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>로딩 중…</div>
            ) : !detail ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>데이터 없음</div>
            ) : (
              <DetailPanels detail={detail} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailPanels({ detail }: { detail: any }) {
  const sections: Array<{ title: string; key: string }> = [
    { title: '기본 정보', key: 'profile' },
    { title: '인증', key: 'auth' },
    { title: '30일 활동', key: 'activity_30d' },
    { title: '최근 이벤트', key: 'recent_events' },
    { title: '최근 CTA', key: 'recent_cta' },
    { title: '콘텐츠', key: 'content' },
    { title: '포인트 히스토리', key: 'points_history' },
    { title: '알림/관심', key: 'notifications' },
    { title: '위험 플래그', key: 'risk_flags' },
  ];
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {sections.map((s) => {
        const v = detail?.[s.key];
        if (v == null) return null;
        return (
          <div key={s.key} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'rgba(255,255,255,0.85)' }}>{s.title}</div>
            <pre style={{ fontSize: 11, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'rgba(255,255,255,0.7)' }}>
{JSON.stringify(v, null, 2)}
            </pre>
          </div>
        );
      })}
    </div>
  );
}

function TriFilter({ label, value, set, onSet }: { label: string; value: '' | 'true' | 'false'; set: (v: '' | 'true' | 'false') => void; onSet?: () => void }) {
  return (
    <select value={value} onChange={(e) => { onSet?.(); set(e.target.value as '' | 'true' | 'false'); }} style={inputStyle()}>
      <option value="">{label} 전체</option>
      <option value="true">{label} O</option>
      <option value="false">{label} X</option>
    </select>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    fontSize: 12, padding: '6px 10px', borderRadius: 6,
    background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary, #e5e7eb)',
    border: '1px solid rgba(255,255,255,0.08)', outline: 'none',
  };
}
function btnStyle(): React.CSSProperties {
  return {
    fontSize: 12, padding: '6px 12px', borderRadius: 6,
    background: 'rgba(255,255,255,0.06)', color: 'inherit',
    border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
  };
}
function thStyle(): React.CSSProperties {
  return { padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' };
}
function tdStyle(): React.CSSProperties {
  return { padding: '8px 10px', whiteSpace: 'nowrap' };
}
