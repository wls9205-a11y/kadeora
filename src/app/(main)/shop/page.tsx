import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: '아이템 상점',
  description: '포인트로 아이템을 구매하세요. 확성기, 프로필 뱃지, 닉네임 꾸미기 등',
  alternates: { canonical: SITE_URL + '/shop' },
  openGraph: {
    title: '아이템 상점 | 카더라', description: '포인트로 아이템을 구매하세요',
    url: SITE_URL + '/shop', siteName: '카더라', locale: 'ko_KR', type: 'website',
    images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent('아이템 상점')}&design=2&category=shop`, width: 1200, height: 630 }],
  },
  other: { 'naver:author': '카더라', 'og:updated_time': new Date().toISOString(), 'article:section': '커뮤니티' },
};

const ITEMS = [
  { href: '/shop/megaphone', emoji: '📢', title: '확성기', desc: '내 글을 피드 상단에 고정', price: '500P', available: true, color: '#FFD43B' },
  { href: '#', emoji: '🏅', title: '프로필 뱃지', desc: '닉네임 옆 특별 뱃지 표시', price: '1,000P', available: false, color: '#C084FC' },
  { href: '#', emoji: '🎨', title: '닉네임 컬러', desc: '닉네임을 원하는 색으로', price: '800P', available: false, color: '#F472B6' },
  { href: '#', emoji: '✨', title: '프리미엄 이모지', desc: '특별 이모지 댓글 사용', price: '300P', available: false, color: '#00E5FF' },
];

export default function ShopPage() {
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 4px' }}>🛒 아이템 상점</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px' }}>포인트를 모아 아이템을 구매하세요</p>

      <div style={{ display: 'grid', gap: 12 }}>
        {ITEMS.map(item => (
          <Link key={item.title} href={item.href} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: 16,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 14, textDecoration: 'none', color: 'inherit',
            opacity: item.available ? 1 : 0.5,
            transition: 'border-color 0.15s',
            pointerEvents: item.available ? 'auto' : 'none',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26,
            }}>{item.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</span>
                {!item.available && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>준비중</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.desc}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: item.available ? item.color : 'var(--text-tertiary)', flexShrink: 0 }}>
              {item.price}
            </div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-hover)', borderRadius: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          💡 포인트 획득 방법: 출석체크(10P), 글쓰기(20P), 댓글(5P), 좋아요 받기(3P)
        </div>
      </div>
    </div>
  );
}
