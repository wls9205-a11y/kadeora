'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function NoticeManager() {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');
  const [preview, setPreview] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true); setResult('');
    try {
      const sb = createSupabaseBrowser();
      await sb.from('site_notices').update({ is_active: false }).eq('is_active', true);
      await sb.from('site_notices').insert({ content: content.trim(), is_active: true });
      setResult('✅ 공지가 등록됐어요!'); setContent(''); setPreview(false);
    } catch { setResult('❌ 저장 실패'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📡 공지 전광판 관리</h2>
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="전광판에 표시할 공지 내용을 입력하세요..." rows={3}
        style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', padding: '10px 12px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={() => setPreview(p => !p)} disabled={!content.trim()}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
          {preview ? '미리보기 닫기' : '👁 미리보기'}
        </button>
        <button onClick={handleSave} disabled={saving || !content.trim()}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: saving ? 'var(--bg-hover)' : 'var(--brand)', color: saving ? 'var(--text-tertiary)' : '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '저장 중...' : '전광판 등록'}
        </button>
      </div>
      {preview && content.trim() && (
        <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid #1a3a1a' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 10px', background: 'var(--bg-hover)' }}>미리보기</div>
          <div style={{ background: '#0a1a0a', height: 32, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <div style={{ whiteSpace: 'nowrap', animation: 'kd-marquee-v2 25s linear infinite', paddingLeft: '100%', fontSize: 12, fontWeight: 600, color: '#4ade80' }}>
              📡&nbsp;{content}&nbsp;&nbsp;&nbsp;◆&nbsp;&nbsp;&nbsp;📡&nbsp;{content}
            </div>
          </div>
        </div>
      )}
      {result && <p style={{ marginTop: 8, fontSize: 13, color: result.startsWith('✅') ? 'var(--success)' : 'var(--error)' }}>{result}</p>}
    </div>
  );
}
