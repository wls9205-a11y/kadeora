'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

type DateFilter = 'today' | 'week' | 'month';
const dateFilterLabel: Record<DateFilter, string> = { today: '오늘', week: '이번주', month: '이번달' };

function getDateRange(filter: DateFilter): string {
  const now = new Date();
  if (filter === 'today') return now.toISOString().slice(0, 10);
  if (filter === 'week') return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

const sectionHeader: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 };
const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 };

function DateFilterButtons({ value, onChange }: { value: DateFilter; onChange: (v: DateFilter) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {(['today', 'week', 'month'] as DateFilter[]).map(f => (
        <button key={f} onClick={() => onChange(f)} style={{
          padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          background: value === f ? 'var(--brand)' : 'var(--bg-hover)',
          color: value === f ? '#fff' : 'var(--text-secondary)',
        }}>{dateFilterLabel[f]}</button>
      ))}
    </div>
  );
}

// ============ UNSOLD FETCH ============
function UnsoldSection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [unsoldCount, setUnsoldCount] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [recentUnsold, setRecentUnsold] = useState<any[]>([]);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.from('unsold_apts').select('id', { count: 'exact', head: true }).eq('is_active', true)
      .then(({ count }) => setUnsoldCount(count ?? 0));
    // Load recent unsold entries for history
    sb.from('unsold_apts').select('region_nm, sigungu_nm, house_nm, tot_unsold_hshld_co, created_at')
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setRecentUnsold(data || []));
  }, []);

  const handleFetch = async () => {
    setLoading(true); setResult('');
    try {
      const res = await fetch('/api/admin/fetch-unsold', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setResult(data.message || '수집 완료');
        // Refresh count
        createSupabaseBrowser().from('unsold_apts').select('id', { count: 'exact', head: true }).eq('is_active', true)
          .then(({ count }) => setUnsoldCount(count ?? 0));
      } else {
        setResult(data.error || data.message || '실패');
      }
    } catch { setResult('요청 실패'); }
    setLoading(false);
    setTimeout(() => setResult(''), 3000);
  };

  const filteredHistory = recentUnsold.filter(u => {
    if (!u.created_at) return false;
    return u.created_at >= getDateRange(dateFilter);
  });

  return (
    <div style={card}>
      <h2 style={sectionHeader}>🏗️ 미분양 데이터 수집</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, background: 'var(--bg-hover)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>활성 미분양 데이터</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)', margin: '4px 0' }}>{unsoldCount ?? '--'}건</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.6 }}>
        data.go.kr에서 미분양주택현황 API 키 발급 후 Vercel 환경변수 UNSOLD_API_KEY에 등록하면 전국 미분양 데이터를 자동 수집합니다
      </div>
      <button onClick={handleFetch} disabled={loading} style={{
        width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
        background: loading ? 'var(--bg-hover)' : 'var(--brand)',
        color: loading ? 'var(--text-tertiary)' : '#fff',
        fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
      }}>
        {loading ? '수집 중... (최대 30초)' : '전국 미분양 데이터 수집'}
      </button>
      {result && <div style={{ fontSize: 12, color: result.includes('실패') ? 'var(--error)' : 'var(--success)', marginTop: 6 }}>{result}</div>}

      {/* History Toggle */}
      <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <button onClick={() => setShowHistory(p => !p)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, padding: 0,
        }}>
          미분양 수집 내역 {showHistory ? '▲' : '▼'}
        </button>
        {showHistory && (
          <div style={{ marginTop: 8 }}>
            <DateFilterButtons value={dateFilter} onChange={setDateFilter} />
            <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-sunken)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>지역</th>
                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>시군구</th>
                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>단지명</th>
                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>미분양</th>
                    <th style={{ padding: '6px 10px', fontWeight: 600 }}>수집일</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)' }}>해당 기간 내역 없음</td></tr>
                  ) : filteredHistory.map((u: any, i: number) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-hover)' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{u.region_nm}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{u.sigungu_nm}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{u.house_nm}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>{u.tot_unsold_hshld_co}세대</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-tertiary)' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ APT CACHE REFRESH ============
function AptCacheSection() {
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState('');

  const handleRefresh = async () => {
    setRefreshing(true); setResult('');
    try {
      const res = await fetch('/api/apt-proxy?refresh=true');
      if (res.ok) {
        setResult('부동산 캐시가 갱신되었습니다');
      } else {
        setResult('캐시 갱신 실패');
      }
    } catch { setResult('요청 실패'); }
    setRefreshing(false);
    setTimeout(() => setResult(''), 3000);
  };

  return (
    <div style={card}>
      <h2 style={sectionHeader}>🏠 부동산 캐시 관리</h2>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.6 }}>
        부동산 데이터 캐시를 수동으로 갱신합니다. 기본 캐시 TTL: 300초 (5분)
      </div>
      <button onClick={handleRefresh} disabled={refreshing} style={{
        width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
        background: refreshing ? 'var(--bg-hover)' : 'var(--brand)',
        color: refreshing ? 'var(--text-tertiary)' : '#fff',
        fontSize: 13, fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer',
      }}>
        {refreshing ? '갱신 중...' : '부동산 캐시 갱신'}
      </button>
      {result && <div style={{ fontSize: 12, color: result.includes('실패') ? 'var(--error)' : 'var(--success)', marginTop: 6 }}>{result}</div>}
    </div>
  );
}

// ============ MAIN PAGE ============
export default function AdminRealEstatePage() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>🏠 부동산</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <UnsoldSection />
        <AptCacheSection />
      </div>
    </div>
  );
}
