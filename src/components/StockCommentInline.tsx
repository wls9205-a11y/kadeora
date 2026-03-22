'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface StockComment {
  id: string;
  author_id: string;
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

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const colors = ['var(--accent-blue)','var(--accent-yellow)','var(--accent-green)','var(--accent-purple)','#FB7185','#22D3EE','var(--accent-orange)','#2DD4BF'];
  return colors[Math.abs(h) % colors.length];
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
      .select('id, author_id, content, created_at, profiles:author_id(nickname)')
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
      .insert({ symbol, author_id: userId, content: input.trim() })
      .select('id, author_id, content, created_at, profiles:author_id(nickname)')
      .single();
    if (!error && data) {
      setComments(prev => [data as any, ...prev].slice(0, 5));
      setInput('');
    }
    setSending(false);
  };

  const deleteComment = async (id: string) => {
    const sb = createSupabaseBrowser();
    await sb.from('stock_comments').delete().eq('id', id).eq('author_id', userId);
    setComments(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div>
      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
        💬 {stockName} 한줄평
      </div>

      {userId ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value.slice(0, 100))}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder="한줄평 남기기 (100자)"
            style={{
              flex: 1, padding: '8px 12px', fontSize: 'var(--fs-sm)', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-base)',
              color: 'var(--text-primary)', boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', fontSize: 'var(--fs-sm)',
              fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              background: 'var(--brand)', color: 'var(--text-inverse)',
              opacity: sending || !input.trim() ? 0.5 : 1,
            }}
          >{sending ? '...' : '등록'}</button>
        </div>
      ) : (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 12 }}>
          <a href="/login" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>로그인</a>하고 한줄평을 남겨보세요
        </div>
      )}

      {comments.length === 0 ? (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textAlign: 'center', padding: 16 }}>
          아직 한줄평이 없어요. 첫 번째 한줄평을 남겨보세요!
        </div>
      ) : (
        comments.map(c => {
          const nick = (c.profiles as any)?.nickname ?? '사용자';
          return (
            <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background: avatarColor(nick), display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#fff',
                  }}>{nick[0]}</div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{nick}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{timeAgo(c.created_at)}</span>
                  {userId === c.author_id && (
                    <button onClick={() => deleteComment(c.id)} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>삭제</button>
                  )}
                </div>
              </div>
              <div style={{ color: 'var(--text-secondary)', marginLeft: 30 }}>{c.content}</div>
            </div>
          );
        })
      )}
    </div>
  );
}
