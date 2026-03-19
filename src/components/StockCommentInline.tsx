'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface StockComment {
  id: string;
  content: string;
  created_at: string;
  profiles?: { nickname: string | null } | null;
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return m + '분 전';
  if (m < 1440) return Math.floor(m / 60) + '시간 전';
  return Math.floor(m / 1440) + '일 전';
}

export default function StockCommentInline({ symbol, stockName }: { symbol: string; stockName: string }) {
  const [comments, setComments] = useState<StockComment[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      if (data.session) setUserId(data.session.user.id);
    });
    sb.from('stock_comments')
      .select('id, content, created_at, profiles:user_id(nickname)')
      .eq('symbol', symbol)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setComments(data as any); });
  }, [symbol]);

  const handleSend = async () => {
    if (!input.trim() || !userId || sending) return;
    setSending(true);
    const sb = createSupabaseBrowser();
    const { data, error } = await sb.from('stock_comments')
      .insert({ symbol, user_id: userId, content: input.trim() })
      .select('id, content, created_at, profiles:user_id(nickname)')
      .single();
    if (!error && data) {
      setComments(prev => [data as any, ...prev].slice(0, 5));
      setInput('');
    }
    setSending(false);
  };

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
        💬 {stockName} 한줄평
      </div>

      {userId ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value.slice(0, 150))}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder="한줄평을 남겨보세요 (150자)"
            style={{
              flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-base)',
              color: 'var(--text-primary)', boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', fontSize: 12,
              fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              background: 'var(--brand)', color: 'var(--text-inverse)',
              opacity: sending || !input.trim() ? 0.5 : 1,
            }}
          >{sending ? '...' : '등록'}</button>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
          로그인 후 한줄평을 남길 수 있어요
        </div>
      )}

      {comments.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: 16 }}>
          아직 한줄평이 없어요. 첫 번째 한줄평을 남겨보세요!
        </div>
      ) : (
        comments.map(c => (
          <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {(c.profiles as any)?.nickname ?? '사용자'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{timeAgo(c.created_at)}</span>
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>{c.content}</div>
          </div>
        ))
      )}
    </div>
  );
}
