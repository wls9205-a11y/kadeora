'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import Link from 'next/link';

interface LiveMessage {
  id: number;
  content: string;
  nickname: string;
  avatarColor: string;
  roomName: string;
  roomId: number;
}

export default function LoungeLivePreview() {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [roomName, setRoomName] = useState('');
  const [roomId, setRoomId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const sb = createSupabaseBrowser();

      // 가장 활발한 토론방 찾기 (최근 1시간 메시지 가장 많은 방)
      const since = new Date(Date.now() - 3600000).toISOString();
      const { data: activeRoom } = await (sb as any).from('discussion_messages')
        .select('room_id, discussion_rooms!discussion_messages_room_id_fkey(name)')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!activeRoom || activeRoom.length === 0) return;

      // 가장 많이 등장하는 room_id
      const roomCounts: Record<number, { count: number; name: string }> = {};
      activeRoom.forEach((m: any) => {
        const rid = m.room_id;
        if (!roomCounts[rid]) roomCounts[rid] = { count: 0, name: m.discussion_rooms?.name || '라운지' };
        roomCounts[rid].count++;
      });
      const topRoom = Object.entries(roomCounts).sort((a, b) => b[1].count - a[1].count)[0];
      if (!topRoom) return;

      const topRoomId = Number(topRoom[0]);
      setRoomId(topRoomId);
      setRoomName(topRoom[1].name);
      setParticipantCount(topRoom[1].count);

      // 해당 방의 최근 메시지 3개
      const { data: msgs } = await (sb as any).from('discussion_messages')
        .select('id, content, profiles!discussion_messages_author_id_fkey(nickname)')
        .eq('room_id', topRoomId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (msgs) {
        const colors = ['#7C3AED', '#0F766E', '#854F0B', '#DC2626', '#2563EB'];
        setMessages(msgs.reverse().map((m: any, i: number) => ({
          id: m.id,
          content: (m.content || '').slice(0, 60),
          nickname: m.profiles?.nickname || '익명',
          avatarColor: colors[i % colors.length],
          roomName: topRoom[1].name,
          roomId: topRoomId,
        })));
      }
    };
    load();
  }, []);

  if (messages.length === 0) return null;

  return (
    <Link href={roomId ? `/discuss/${roomId}` : '/discuss'} style={{ display: 'block', textDecoration: 'none', color: 'inherit', marginBottom: 10 }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(167,139,250,0.15)', borderRadius: 'var(--radius-card)', padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#A78BFA', display: 'inline-block', animation: 'livePulse 1.5s infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA' }}>라운지 LIVE</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>· {roomName}</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{participantCount}명 참여</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)', marginBottom: 'var(--sp-sm)' }}>
          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: m.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                {m.nickname[0]}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginRight: 4 }}>{m.nickname}</span>
                {m.content}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: '#A78BFA', textAlign: 'right' }}>참여하기 →</div>
      </div>
      <style>{`@keyframes livePulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </Link>
  );
}
