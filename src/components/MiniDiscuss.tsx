'use client';
import { useState, useEffect, useRef } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface Message {
  id: number;
  content: string;
  created_at: string;
  author_id: string;
  profiles: { nickname: string; grade: number } | null;
}

interface Props { roomKey: string; roomTitle: string }

const GRADE_EMOJI: Record<number, string> = {
  1:'🌱',2:'📡',3:'🏘️',4:'🏠',5:'⚡',6:'🔥',7:'💎',8:'🌟',9:'👑',10:'🚀',
};

export default function MiniDiscuss({ roomKey, roomTitle }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createSupabaseBrowser();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    initRoom();
  }, [roomKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initRoom = async () => {
    const { data: room } = await supabase.from('discussion_rooms').select('id').eq('room_key', roomKey).maybeSingle();
    if (room) {
      setRoomId(room.id);
      loadMessages(room.id);
      const channel = supabase.channel(`mini-${roomKey}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'discussion_messages', filter: `room_id=eq.${room.id}` }, () => loadMessages(room.id))
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  };

  const loadMessages = async (rId: number) => {
    const { data } = await supabase.from('discussion_messages')
      .select('id, content, created_at, author_id, profiles(nickname, grade)')
      .eq('room_id', rId).order('created_at', { ascending: true }).limit(30);
    setMessages((data as Message[]) ?? []);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !userId || sending) return;
    setSending(true);
    setError(null);
    try {
      let rId = roomId;
      if (!rId) {
        const roomType = roomKey.startsWith('stock_') ? 'stock' : roomKey.startsWith('apt_') ? 'apt' : 'theme';
        const { data: newRoom, error: roomErr } = await supabase.from('discussion_rooms')
          .insert({ room_key: roomKey, display_name: roomTitle, room_type: roomType, is_active: true })
          .select('id').single();
        if (roomErr || !newRoom) { setError('토론방 생성 실패'); setSending(false); return; }
        rId = newRoom.id;
        setRoomId(rId);
      }
      const { error: msgErr } = await supabase.from('discussion_messages')
        .insert({ room_id: rId, author_id: userId, content: text });
      if (msgErr) { setError('전송 실패'); } else { setInput(''); if (rId) loadMessages(rId); }
    } catch { setError('오류 발생'); }
    setSending(false);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        💬 {roomTitle}
        {messages.length > 0 && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>{messages.length}개</span>}
      </div>
      <div style={{ background: 'var(--bg-hover)', borderRadius: 12, padding: 12, marginBottom: 10, maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: '16px 0' }}>첫 번째 의견을 남겨보세요 👋</div>
        ) : messages.map(m => (
          <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{GRADE_EMOJI[m.profiles?.grade ?? 1]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{m.profiles?.nickname ?? '익명'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{m.content}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--error)', marginBottom: 8 }}>{error}</div>}
      {userId ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="의견을 남겨보세요..." maxLength={200}
            style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text-primary)', fontSize: 14 }} />
          <button onClick={handleSend} disabled={sending || !input.trim()}
            style={{ background: input.trim() && !sending ? 'var(--brand)' : 'var(--bg-hover)', color: input.trim() && !sending ? 'var(--text-inverse)' : 'var(--text-tertiary)', border: 'none', borderRadius: 20, padding: '10px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {sending ? '...' : '전송'}
          </button>
        </div>
      ) : (
        <a href="/login" style={{ display: 'block', textAlign: 'center', padding: 12, background: 'var(--bg-hover)', borderRadius: 12, fontSize: 13, color: 'var(--brand)', fontWeight: 700, textDecoration: 'none' }}>로그인 후 참여하기 →</a>
      )}
    </div>
  );
}
