'use client';
import { useState } from 'react';

export default function UnsoldFetchButton({ hasKey }: { hasKey: boolean }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const handleFetch = async () => {
    setLoading(true); setResult('');
    try {
      const res = await fetch('/api/admin/fetch-unsold', { method: 'POST' });
      const data = await res.json();
      if (data.success) setResult(`✅ ${data.message}`);
      else setResult(`❌ ${data.error || data.message || '실패'}`);
    } catch { setResult('❌ 요청 실패'); }
    setLoading(false);
  };

  if (!hasKey) {
    return (
      <button disabled style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 600, cursor: 'not-allowed' }}>
        API 키 미등록 — 수집 비활성
      </button>
    );
  }

  return (
    <div>
      <button onClick={handleFetch} disabled={loading} style={{
        width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
        background: loading ? 'var(--bg-hover)' : 'var(--brand)',
        color: loading ? 'var(--text-tertiary)' : 'var(--text-inverse)',
        fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
      }}>
        {loading ? '수집 중... (최대 30초)' : '🔄 전국 미분양 데이터 수집'}
      </button>
      {result && <div style={{ fontSize: 12, color: result.startsWith('✅') ? 'var(--success)' : 'var(--error)', marginTop: 6 }}>{result}</div>}
    </div>
  );
}
