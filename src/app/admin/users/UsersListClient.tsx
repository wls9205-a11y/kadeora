'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface UserRow {
  id: string;
  nickname?: string | null;
  full_name?: string | null;
  provider?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
  last_active_at?: string | null;
  points?: number | null;
  grade?: number | null;
  grade_title?: string | null;
  posts_count?: number | null;
  followers_count?: number | null;
  region_text?: string | null;
  signup_source?: string | null;
  is_seed?: boolean;
  is_admin?: boolean;
  is_banned?: boolean;
  is_deleted?: boolean;
  kakao_channel_added?: boolean;
}

interface UsersResponse {
  users?: UserRow[];
  total?: number;
  page?: number;
  per_page?: number;
}

const FILTERS: { key: string; label: string }[] = [
  { key: 'all',            label: '전체' },
  { key: 'real',           label: '진짜' },
  { key: 'seed',           label: '시드' },
  { key: 'active',         label: '활성' },
  { key: 'kakao_channel',  label: '카카오 채널' },
  { key: 'admin',          label: '어드민' },
  { key: 'deleted',        label: '삭제됨' },
  { key: 'banned',         label: '차단됨' },
];

const SORTS: { key: string; label: string }[] = [
  { key: 'created_desc',  label: '가입 신순' },
  { key: 'created_asc',   label: '가입 오래된순' },
  { key: 'active_desc',   label: '활성 신순' },
  { key: 'points_desc',   label: '포인트 많은순' },
  { key: 'grade_desc',    label: '등급 높은순' },
];

function fmtDate(s?: string | null): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }); } catch { return s.slice(0, 10); }
}

function relTime(s?: string | null): string {
  if (!s) return '—';
  try {
    const ms = Date.now() - new Date(s).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return '방금';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  } catch { return s.slice(0, 10); }
}

const PER_PAGE = 50;

export default function UsersListClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const search = sp.get('search') || '';
  const filter = sp.get('filter') || 'all';
  const sort = sp.get('sort') || 'created_desc';
  const page = parseInt(sp.get('page') || '1', 10) || 1;

  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    qs.set('filter', filter);
    qs.set('sort', sort);
    qs.set('page', String(page));
    qs.set('per_page', String(PER_PAGE));
    fetch(`/api/admin/v4/users?${qs.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (j?.ok) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, filter, sort, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setSearchInput(search); }, [search]);

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null || v === '') next.delete(k);
      else next.set(k, v);
    });
    if (!('page' in patch)) next.delete('page');
    router.push(`/admin/users?${next.toString()}`);
  };

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 6,
    border: '1px solid var(--border, #2a2b35)',
    background: 'var(--bg-surface, #1a1b22)',
    color: 'var(--text-primary, #fff)', fontSize: 12,
    outline: 'none',
  };

  return (
    <div style={{
      maxWidth: 1400, margin: '0 auto', padding: 'clamp(12px, 3vw, 24px)',
      display: 'flex', flexDirection: 'column', gap: 12,
      color: 'var(--text-primary, #fff)', background: 'var(--bg-base, #0d0e14)',
      minHeight: '100vh',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link href="/admin" style={{ fontSize: 12, color: 'var(--text-tertiary, #888)', textDecoration: 'none' }}>← 어드민</Link>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>유저 ({total.toLocaleString()})</h1>
      </div>

      {/* 검색바 */}
      <form onSubmit={(e) => { e.preventDefault(); updateParams({ search: searchInput || null, page: '1' }); }}
        style={{ display: 'flex', gap: 6 }}>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="닉네임 / 이름 / uuid / 카카오ID / 구글이메일"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="submit" style={{
          ...inputStyle, cursor: 'pointer',
          background: 'var(--accent, #3b82f6)', color: '#fff', border: 'none', fontWeight: 700,
        }}>검색</button>
        {search && (
          <button type="button" onClick={() => { setSearchInput(''); updateParams({ search: null, page: '1' }); }}
            style={{ ...inputStyle, cursor: 'pointer' }}>초기화</button>
        )}
      </form>

      {/* 필터 칩 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => updateParams({ filter: f.key, page: '1' })}
            style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              background: filter === f.key ? 'var(--accent, #3b82f6)' : 'transparent',
              color: filter === f.key ? '#fff' : 'var(--text-secondary, #ccc)',
              border: `1px solid ${filter === f.key ? 'var(--accent, #3b82f6)' : 'var(--border, #2a2b35)'}`,
            }}
          >{f.label}</button>
        ))}
      </div>

      {/* 정렬 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <span style={{ color: 'var(--text-tertiary, #888)' }}>정렬</span>
        <select
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value, page: '1' })}
          style={inputStyle}
        >
          {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {/* 표 */}
      <div style={{
        borderRadius: 'var(--radius-md, 10px)',
        border: '1px solid var(--border, #2a2b35)',
        background: 'var(--bg-elevated, #1f2028)',
        overflowX: 'auto',
        opacity: loading ? 0.6 : 1,
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
          <thead>
            <tr style={{ color: 'var(--text-tertiary, #888)', textAlign: 'left', borderBottom: '1px solid var(--border, #2a2b35)' }}>
              <th style={{ padding: 8, textAlign: 'left' }}>유저</th>
              <th style={{ padding: 8 }}>제공사</th>
              <th style={{ padding: 8 }}>가입</th>
              <th style={{ padding: 8 }}>활성</th>
              <th style={{ padding: 8, textAlign: 'right' }}>포인트</th>
              <th style={{ padding: 8, textAlign: 'right' }}>등급</th>
              <th style={{ padding: 8 }}>속성</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr
                key={u.id}
                onClick={() => router.push(`/admin/users/${u.id}`)}
                style={{ cursor: 'pointer', borderTop: '1px solid var(--border, #2a2b35)' }}
              >
                <td style={{ padding: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {u.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-surface, #1a1b22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-tertiary, #888)' }}>
                        {(u.nickname || u.full_name || '?').slice(0, 1)}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{u.nickname || '—'}</div>
                      {u.full_name && u.full_name !== u.nickname && (
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary, #888)' }}>{u.full_name}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ padding: 8 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                    background: u.provider === 'kakao' ? 'rgba(254,229,0,0.12)' : u.provider === 'google' ? 'rgba(66,133,244,0.12)' : 'rgba(255,255,255,0.06)',
                    color: u.provider === 'kakao' ? '#fde047' : u.provider === 'google' ? '#60a5fa' : 'var(--text-tertiary, #888)',
                  }}>{u.provider || '—'}</span>
                </td>
                <td style={{ padding: 8, color: 'var(--text-secondary, #ccc)' }}>{fmtDate(u.created_at)}</td>
                <td style={{ padding: 8, color: 'var(--text-secondary, #ccc)' }}>{relTime(u.last_active_at)}</td>
                <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>{(u.points ?? 0).toLocaleString()}</td>
                <td style={{ padding: 8, textAlign: 'right', color: 'var(--text-secondary, #ccc)' }}>{u.grade_title || u.grade || '—'}</td>
                <td style={{ padding: 8 }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {u.is_seed && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(251,146,60,0.12)', color: '#fb923c', fontWeight: 700 }}>시드</span>}
                    {u.is_admin && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.12)', color: '#a78bfa', fontWeight: 700 }}>어드민</span>}
                    {u.kakao_channel_added && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(254,229,0,0.12)', color: '#fde047', fontWeight: 700 }}>채널</span>}
                    {u.is_banned && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(248,113,113,0.12)', color: '#f87171', fontWeight: 700 }}>차단</span>}
                    {u.is_deleted && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.3)', color: 'var(--text-tertiary, #888)', fontWeight: 700 }}>삭제</span>}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary, #888)' }}>해당 조건의 유저가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, fontSize: 12 }}>
        <button
          disabled={page <= 1}
          onClick={() => updateParams({ page: String(Math.max(1, page - 1)) })}
          style={{ ...inputStyle, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}
        >← 이전</button>
        <span style={{ padding: '6px 12px', color: 'var(--text-secondary, #ccc)', fontWeight: 700 }}>
          {page} / {lastPage}
        </span>
        <button
          disabled={page >= lastPage}
          onClick={() => updateParams({ page: String(Math.min(lastPage, page + 1)) })}
          style={{ ...inputStyle, cursor: page >= lastPage ? 'not-allowed' : 'pointer', opacity: page >= lastPage ? 0.4 : 1 }}
        >다음 →</button>
      </div>
    </div>
  );
}
