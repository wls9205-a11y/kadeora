'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function NoticeManager() {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState('');
  const [preview, setPreview] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = () => {
    createSupabaseBrowser().from('site_notices').select('*').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setHistory(data || []));
  };
  useEffect(loadHistory, []);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true); setResult('');
    try {
      const sb = createSupabaseBrowser();
      await sb.from('site_notices').update({ is_active: false }).eq('is_active', true);
      await sb.from('site_notices').insert({ content: content.trim(), is_active: true });
      setResult('✅ 공지가 등록됐어요!'); setContent(''); setPreview(false); loadHistory();
    } catch { setResult('❌ 저장 실패'); }
    finally { setSaving(false); }
  };

  const reactivate = async (id: number) => {
    const sb = createSupabaseBrowser();
    await sb.from('site_notices').update({ is_active: false }).eq('is_active', true);
    await sb.from('site_notices').update({ is_active: true }).eq('id', id);
    loadHistory();
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
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: saving ? 'var(--bg-hover)' : 'var(--brand)', color: saving ? 'var(--text-tertiary)' : 'var(--text-inverse)', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '저장 중...' : '전광판 등록'}
        </button>
      </div>
      {preview && content.trim() && (
        <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid #1a3a1a' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 10px', background: 'var(--bg-hover)' }}>미리보기</div>
          <div style={{ background: '#0a1a0a', height: 32, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <div style={{ whiteSpace: 'nowrap', animation: 'kd-notice-preview 20s linear infinite', paddingLeft: '100%', fontSize: 12, fontWeight: 600, color: '#4ade80' }}>
              📡&nbsp;{content}<span style={{ margin: '0 48px', color: '#166534' }}>◆</span>📡&nbsp;{content}
            </div>
          </div>
          <style>{`@keyframes kd-notice-preview { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }`}</style>
        </div>
      )}
      {result && <p style={{ marginTop: 8, fontSize: 13, color: result.startsWith('✅') ? 'var(--success)' : 'var(--error)' }}>{result}</p>}

      {/* 공지 발송 내역 */}
      {history.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>📋 공지 내역</div>
          {history.map((n: any) => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.content?.slice(0, 30)}{n.content?.length > 30 ? '...' : ''}</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{new Date(n.created_at).toLocaleDateString('ko-KR')}</span>
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, flexShrink: 0, background: n.is_active ? 'rgba(34,197,94,0.15)' : 'transparent', color: n.is_active ? '#22c55e' : 'var(--text-tertiary)', border: `1px solid ${n.is_active ? '#22c55e' : 'var(--border)'}` }}>
                {n.is_active ? '활성' : '종료'}
              </span>
              {!n.is_active && (
                <button onClick={() => reactivate(n.id)} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>재활성</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
