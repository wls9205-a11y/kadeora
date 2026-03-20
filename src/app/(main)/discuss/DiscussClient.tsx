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
      <div style={{
        background: 'linear-gradient(135deg, var(--brand) 0%, #ff8c42 100%)',
        borderRadius: 14, padding: '14px 20px', marginBottom: 12, color: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 24 }}>☕</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>카더라 라운지</h1>
            <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.9 }}>지금 이 순간, 모두가 나누는 소문과 정보</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>🟢 실시간</div>
        </div>
      </div>
      {/* 라운지 면책 안내 */}
      <div style={{
        fontSize: 11, color: 'var(--text-tertiary)', padding: '6px 12px',
        marginBottom: 8, lineHeight: 1.5,
        background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)',
      }}>
        투자 관련 대화는 개인 의견이며, 특정 종목 매수/매도 권유는 금지됩니다. 허위사실 유포 시 자본시장법에 의해 처벌받을 수 있습니다.
      </div>
      <ChatRoom user={user} myNickname={myNickname} />
    </div>
  );
}
