'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

const EMOJIS = ['😮', '💡', '👍', '🔥', '😢', '🤔'];

export default function OneLinerSection({ postId }: { postId: number }) {
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState('👍');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getUser().then(({ data }) => setUser(data.user));
    sb.from('comments')
      .select('id, content, likes_count, created_at, author_id, profiles!comments_author_id_fkey(nickname)')
      .eq('post_id', postId).eq('comment_type', 'oneliner').eq('is_deleted', false)
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setItems(data || []));
  }, [postId]);

  const submit = async () => {
    if (!text.trim() || !user) return;
    setLoading(true);
    const sb = createSupabaseBrowser();
    const content = `${emoji} ${text.slice(0, 50)}`;
    const { data: newItem } = await sb.from('comments')
      .insert({ post_id: postId, author_id: user.id, content, comment_type: 'oneliner' })
      .select('id, content, likes_count, created_at, author_id, profiles!comments_author_id_fkey(nickname)')
      .single();
    if (newItem) setItems(prev => [newItem, ...prev]);
    setText('');
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
        💬 한줄평 <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>{items.length}</span>
      </div>
      {user ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)} style={{
                padding: '4px 8px', borderRadius: 20, border: `1px solid ${emoji === e ? 'var(--brand)' : 'var(--border)'}`,
                background: emoji === e ? 'var(--brand)' : 'transparent', fontSize: 16, cursor: 'pointer',
              }}>{e}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={text} onChange={e => setText(e.target.value.slice(0, 50))} placeholder="한 줄로 남겨보세요 (50자)"
              onKeyDown={e => e.key === 'Enter' && submit()}
              style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 14 }} />
            <button onClick={submit} disabled={loading || !text.trim()}
              style={{ padding: '8px 16px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>등록</button>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8 }}>
          <a href="/login" style={{ color: 'var(--brand)' }}>로그인</a> 후 한줄평을 남길 수 있어요
        </div>
      )}
      {items.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <div>
            <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{item.content}</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>{(item.profiles as any)?.nickname}</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>♥ {item.likes_count || 0}</span>
        </div>
      ))}
    </div>
  );
}
