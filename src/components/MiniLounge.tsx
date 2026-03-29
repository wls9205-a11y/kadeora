'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';

interface Msg {
  id: number;
  content: string;
  created_at: string;
  author_id: string;
  nickname: string;
  is_mine: boolean;
}

const ROOM_KEY = 'kadeora_lounge';
const MAX_MESSAGES = 20;

export default function MiniLounge() {
  const { userId, profile } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [roomId, setRoomId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sb = createSupabaseBrowser();

  // 방 로드 + 최근 메시지
  useEffect(() => {
    (async () => {
      const { data: room } = await sb
        .from('discussion_rooms')
        .select('id')
        .eq('room_key', ROOM_KEY)
        .single();
      if (!room) return;
      setRoomId(room.id);

      const { data: messages } = await sb
        .from('discussion_messages')
        .select('id, content, created_at, author_id, profiles!discussion_messages_author_id_fkey(nickname)')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false })
        .limit(MAX_MESSAGES);

      if (messages) {
        setMsgs(
          messages.reverse().map((m: any) => ({
            id: m.id,
            content: m.content,
            created_at: m.created_at,
            author_id: m.author_id,
            nickname: (m.profiles as any)?.nickname || '익명',
            is_mine: m.author_id === userId,
          }))
        );
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
      }
    })();
  }, [userId]);

  // 실시간 구독
  useEffect(() => {
    if (!roomId) return;

    const ch = sb
      .channel('mini-lounge-' + roomId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'discussion_messages',
          filter: 'room_id=eq.' + roomId,
        },
        async (payload) => {
          const m = payload.new as any;
          // 이미 내가 보낸 optimistic 메시지면 스킵
          const { data: p } = await sb
            .from('profiles')
            .select('nickname')
            .eq('id', m.author_id)
            .single();
          setMsgs((prev) => {
            // 중복 방지
            if (prev.some((msg) => msg.id === m.id)) return prev;
            const next = [
              ...prev,
              {
                id: m.id,
                content: m.content,
                created_at: m.created_at,
                author_id: m.author_id,
                nickname: p?.nickname || '익명',
                is_mine: m.author_id === userId,
              },
            ];
            return next.slice(-MAX_MESSAGES);
          });
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current?.scrollHeight, behavior: 'smooth' }), 50);
        }
      )
      .subscribe();

    // Presence로 온라인 수 추적
    const presenceCh = sb.channel('lounge-presence', {
      config: { presence: { key: userId || 'anon-' + Math.random().toString(36).slice(2, 6) } },
    });
    presenceCh
      .on('presence', { event: 'sync' }, () => {
        setOnlineCount(Object.keys(presenceCh.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceCh.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      sb.removeChannel(ch);
      sb.removeChannel(presenceCh);
    };
  }, [roomId, userId]);

  // 메시지 전송
  const send = useCallback(async () => {
    if (!input.trim() || !userId || !roomId || sending) return;
    const text = input.trim();
    if (text.length > 200) return;
    setInput('');
    setSending(true);

    const { error } = await sb.from('discussion_messages').insert({
      room_id: roomId,
      author_id: userId,
      content: text,
      is_anonymous: false,
      message_type: 'text',
    });

    if (error) setInput(text);
    setSending(false);
  }, [input, userId, roomId, sending, sb]);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>💬 라운지</span>
          {onlineCount > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: 'var(--accent-green)',
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block' }} />
              {onlineCount}
            </span>
          )}
        </div>
        <Link href="/discussion/theme/kadeora_lounge" style={{
          fontSize: 9, color: 'var(--text-tertiary)', textDecoration: 'none',
        }}>
          전체화면 →
        </Link>
      </div>

      {/* 메시지 영역 */}
      <div
        ref={scrollRef}
        style={{
          height: 220,
          overflowY: 'auto',
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          scrollbarWidth: 'thin',
        }}
      >
        {msgs.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '40px 0',
            color: 'var(--text-tertiary)', fontSize: 11,
          }}>
            아직 대화가 없어요<br />첫 메시지를 남겨보세요 👋
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} style={{ fontSize: 11, lineHeight: 1.5 }}>
            <span style={{
              fontWeight: 700,
              color: m.is_mine ? 'var(--brand)' : 'var(--text-secondary)',
              marginRight: 4,
            }}>
              {m.is_mine ? '나' : m.nickname}
            </span>
            <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{m.content}</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 9, marginLeft: 4 }}>{fmtTime(m.created_at)}</span>
          </div>
        ))}
      </div>

      {/* 입력 영역 */}
      {userId ? (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '6px 8px',
          display: 'flex',
          gap: 4,
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(); }}
            placeholder="메시지 입력..."
            maxLength={200}
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'var(--bg-hover)',
              borderRadius: 6, padding: '6px 8px',
              fontSize: 11, color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            style={{
              padding: '4px 10px', borderRadius: 6, border: 'none',
              background: input.trim() ? 'var(--brand)' : 'var(--bg-hover)',
              color: input.trim() ? '#fff' : 'var(--text-tertiary)',
              fontSize: 11, fontWeight: 700, cursor: input.trim() ? 'pointer' : 'default',
              flexShrink: 0,
            }}
          >
            전송
          </button>
        </div>
      ) : (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '10px 12px', textAlign: 'center',
        }}>
          <Link href="/login" style={{
            fontSize: 11, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600,
          }}>
            로그인하고 대화 참여하기 →
          </Link>
        </div>
      )}
    </div>
  );
}
