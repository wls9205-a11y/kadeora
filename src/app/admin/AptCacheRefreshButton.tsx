'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function AptCacheRefreshButton({ hasKey }: { hasKey: boolean }) {
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState('');

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setResult('');
    try {
      const sb = createSupabaseBrowser();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        setResult('로그인이 필요합니다');
        return;
      }

      const res = await fetch('/api/admin/refresh-apt-cache', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const json = await res.json();
      if (json.success) {
        setResult(`갱신 완료 ${json.count}건`);
      } else {
        setResult(`갱신 실패: ${json.error}`);
      }
    } catch {
      setResult('갱신 실패: 네트워크 오류');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
        부동산 데이터 갱신
      </h2>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        청약홈 API에서 최신 데이터를 가져와 apt_cache 테이블에 저장합니다.
      </div>
      {!hasKey && (
        <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 8, padding: '8px 12px', background: 'var(--warning-bg)', borderRadius: 8, border: '1px solid var(--warning)' }}>
          APT_DATA_API_KEY 환경변수가 설정되지 않았습니다. data.go.kr에서 발급 후 등록하세요.
        </div>
      )}
      <button
        onClick={handleRefresh}
        disabled={refreshing || !hasKey}
        style={{
          padding: '10px 20px',
          borderRadius: 8,
          border: 'none',
          background: refreshing ? 'var(--bg-hover)' : 'var(--brand)',
          color: refreshing ? 'var(--text-tertiary)' : 'var(--text-inverse)',
          fontSize: 13,
          fontWeight: 700,
          cursor: refreshing || !hasKey ? 'not-allowed' : 'pointer',
          opacity: !hasKey ? 0.5 : 1,
        }}
      >
        {refreshing ? '갱신 중...' : '부동산 데이터 갱신'}
      </button>
      {result && (
        <p
          style={{
            marginTop: 8,
            fontSize: 13,
            color: result.includes('완료') ? 'var(--success)' : 'var(--error)',
            fontWeight: 600,
          }}
        >
          {result}
        </p>
      )}
    </div>
  );
}
