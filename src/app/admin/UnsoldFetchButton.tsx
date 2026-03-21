'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function UnsoldFetchButton({ hasKey }: { hasKey: boolean }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleFetch = async () => {
    setLoading(true); setResult('');
    try {
      const sb = createSupabaseBrowser();
      const { data: session } = await sb.auth.getSession();
      const token = session.session?.access_token ?? '';

      const res = await fetch('/api/admin/trigger-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: '/api/cron/crawl-unsold-molit' }),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        setResult(`✅ 미분양 ${data.inserted ?? 0}건 수집 (${data.month ?? ''})`);
      } else {
        setResult(`❌ ${data.error || '실패'}`);
      }
    } catch { setResult('❌ 요청 실패'); }
    setLoading(false);
  };

  return (
    <div>
      <button onClick={handleFetch} disabled={loading} style={{
        width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
        background: loading ? 'var(--bg-hover)' : 'var(--brand)',
        color: loading ? 'var(--text-tertiary)' : 'var(--text-inverse)',
        fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
      }}>
        {loading ? '수집 중... (최대 60초)' : '🔄 전국 미분양 데이터 수집 (통계누리)'}
      </button>
      {result && <div style={{ fontSize: 12, color: result.startsWith('✅') ? 'var(--success)' : 'var(--error)', marginTop: 6 }}>{result}</div>}
    </div>
  );
}
