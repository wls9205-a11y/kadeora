'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import type { User } from '@supabase/supabase-js';
import ChatRoom from './ChatRoom';

export default function DiscussClient() {
  const [user, setUser] = useState<User | null>(null);
  const [myNickname, setMyNickname] = useState<string | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        const { data: p } = await sb.from('profiles').select('nickname').eq('id', u.id).single();
        setMyNickname(p?.nickname ?? null);
      }
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* 라운지 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, var(--brand) 0%, #ff8c42 100%)',
        borderRadius: 16, padding: '20px 24px', marginBottom: 16, color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28 }}>☕</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>카더라 라운지</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.9 }}>
              지금 이 순간, 모두가 나누는 소문과 정보
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
            🟢 실시간
          </div>
        </div>
      </div>
      <ChatRoom user={user} myNickname={myNickname} />
    </div>
  );
}
