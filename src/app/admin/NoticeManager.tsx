'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function NoticeManager() {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const sb = createSupabaseBrowser();
      await sb.from('site_notices').update({ is_active: false }).eq('is_active', true);
      await sb.from('site_notices').insert({ content: content.trim(), is_active: true });
      setResult('공지 등록 완료!');
      setContent('');
    } catch { setResult('등록 실패'); }
    setSaving(false);
  };

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📢 공지 전광판 관리</h2>
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="전광판에 표시할 공지 내용" rows={2}
        style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      <button onClick={handleSave} disabled={saving || !content.trim()}
        style={{ marginTop: 8, padding: '10px 0', width: '100%', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        {saving ? '저장 중...' : '공지 등록'}
      </button>
      {result && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{result}</div>}
    </div>
  );
}
