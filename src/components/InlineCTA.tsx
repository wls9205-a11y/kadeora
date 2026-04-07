'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useEffect, useRef } from 'react';
import { trackConversion } from '@/lib/track-conversion';

interface InlineCTAProps {
  type: 'stock' | 'apt' | 'blog' | 'feed';
  entityName?: string;
  entityId?: string;
  price?: string;
  extra?: string;
}

const MESSAGES: Record<string, { icon: string; title: (n?: string) => string; sub: (p?: string, e?: string) => string; btn: string; color: string }> = {
  stock: {
    icon: 'bell',
    title: (n) => `${n || '종목'} 가격 변동 알림`,
    sub: (p, e) => `현재가 ${p || ''} 기준 ±3% 변동 시 즉시 알림${e ? `\n${e}` : ''}`,
    btn: '카카오로 무료 시작',
    color: '#3B82F6',
  },
  apt: {
    icon: 'home',
    title: (n) => `${n || '단지'} 청약 알림`,
    sub: (p, e) => `청약 마감 D-7 / 당첨 발표 / 분양가 변동 알림${e ? `\n${e}` : ''}`,
    btn: '카카오로 무료 알림 받기',
    color: '#10B981',
  },
  blog: {
    icon: 'bookmark',
    title: (n) => n ? `${n} 업데이트 알림` : '이 분석 저장 + 업데이트 알림',
    sub: () => '새 분석이 올라오면 알림으로 바로 확인하세요',
    btn: '카카오로 무료 시작',
    color: '#3B82F6',
  },
  feed: {
    icon: 'chat',
    title: () => '이 토론에 의견을 남겨보세요',
    sub: () => '카카오 3초 가입으로 댓글, 좋아요, 알림 이용 가능',
    btn: '참여하기',
    color: '#8B5CF6',
  },
};

const ICONS: Record<string, string> = {
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
};

export default function InlineCTA({ type, entityName, entityId, price, extra }: InlineCTAProps) {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current && !userId && !loading) {
      tracked.current = true;
      trackConversion('cta_view', 'inline_cta', { category: type, pagePath: pathname });
    }
  }, [userId, loading, type, pathname]);

  if (loading || userId) return null;

  const m = MESSAGES[type];
  const url = `/login?redirect=${encodeURIComponent(pathname)}`;

  return (
    <div style={{
      background: 'var(--bg-surface, #0F1A2E)',
      border: `1px solid ${m.color}25`,
      borderRadius: 'var(--radius-lg, 12px)',
      padding: '14px 16px',
      margin: '16px 0',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${m.color}12`, display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={m.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: ICONS[m.icon] }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
            {m.title(entityName)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
            {m.sub(price, extra)}
          </div>
          <Link href={url} onClick={() => trackConversion('cta_click', 'inline_cta', { category: type })}
            style={{
              display: 'inline-block', marginTop: 10,
              padding: '8px 20px', borderRadius: 20,
              background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)',
              fontSize: 12, fontWeight: 700, textDecoration: 'none',
            }}>
            {m.btn}
          </Link>
        </div>
      </div>
    </div>
  );
}
