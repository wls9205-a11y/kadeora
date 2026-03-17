'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface Props { roomKey: string; roomTitle: string }

const GRADE_EMOJI: Record<number, string> = {
  1:'🌱', 2:'📡', 3:'🏘️', 4:'🏠', 5:'⚡', 6:'🔥', 7:'💎', 8:'🌟', 9:'👑', 10:'🚀',
};

export default function MiniDiscuss({ roomKey, roomTitle }: Props) {
  const [messages, setMessages] = useState<{ id: number; content: string; created_at: string; profiles?: { nickname?: string; grade?: number } }[]>([]);
  const [input, setInput] = useState('');
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowser();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    loadMessages();
  }, [roomKey]);

  const loadMessages = async () => {
    const { data: room } = await supabase.from('discussion_rooms').select('id').eq('room_key', roomKey).maybeSingle();
    if (!room) return;
    const { data: msgs } = await supabase.from('discussion_messages')
      .select('id, content, created_at, profiles(nickname, grade)')
      .eq('room_id', room.id).order('created_at', { ascending: false }).limit(15);
    setMessages((msgs ?? []).reverse());
  };

  const sendMessage = async () => {
    if (!input.trim() || !user || loading) return;
    setLoading(true);
    let { data: room } = await supabase.from('discussion_rooms').select('id').eq('room_key', roomKey).maybeSingle();
    if (!room) {
      const { data: newRoom } = await supabase.from('discussion_rooms').insert({
        room_key: roomKey, display_name: roomTitle,
        room_type: roomKey.startsWith('stock_') ? 'stock' : roomKey.startsWith('apt_') ? 'apt' : 'free',
        is_active: true,
      }).select('id').single();
      room = newRoom;
    }
    if (room) {
      await supabase.from('discussion_messages').insert({ room_id: room.id, author_id: user.id, content: input.trim() });
      setInput('');
      await loadMessages();
    }
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
        💬 {roomTitle}
      </div>
      <div style={{ background: 'var(--bg-hover)', borderRadius: 12, padding: 12, marginBottom: 10, maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 16 }}>첫 번째 의견을 남겨보세요 👋</div>
        ) : messages.map(m => (
          <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{GRADE_EMOJI[m.profiles?.grade ?? 1]}</span>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginRight: 6 }}>{m.profiles?.nickname ?? '익명'}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.5 }}>{m.content}</div>
            </div>
          </div>
        ))}
      </div>
      {user ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="의견을 남겨보세요..." maxLength={200}
            style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text-primary)', fontSize: 14 }} />
          <button onClick={sendMessage} disabled={loading || !input.trim()}
            style={{ background: input.trim() ? 'var(--brand)' : 'var(--bg-hover)', color: input.trim() ? 'var(--text-inverse)' : 'var(--text-tertiary)', border: 'none', borderRadius: 20, padding: '10px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {loading ? '...' : '전송'}
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 12, background: 'var(--bg-hover)', borderRadius: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
          <a href="/login" style={{ color: 'var(--brand)', fontWeight: 700, textDecoration: 'none' }}>로그인</a> 후 참여할 수 있어요
        </div>
      )}
    </div>
  );
}
