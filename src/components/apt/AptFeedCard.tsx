'use client';
// s269e V2.1: 컴팩트 그리드 카드. 이미지 92→72px, padding/font/gap 축소.

import Link from 'next/link';

export type FeedItem = {
  id: string;
  section: 'subscription' | 'unsold' | 'redev' | string;
  badge_label: string;
  badge_color: 'blue' | 'coral' | 'purple' | string;
  title: string;
  region: string | null;
  meta: string | null;
  image_url: string | null;
  href: string;
  dday: number | null;
  is_new: boolean;
  is_urgent: boolean;
  created_at: string | null;
};

const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  blue:   { bg: 'linear-gradient(135deg, #E6F1FB 0%, #B5D4F4 100%)', color: '#185FA5' },
  coral:  { bg: 'linear-gradient(135deg, #FAECE7 0%, #F5C4B3 100%)', color: '#993C1D' },
  purple: { bg: 'linear-gradient(135deg, #EEEDFE 0%, #CECBF6 100%)', color: '#534AB7' },
};

const BADGE_TEXT_COLOR: Record<string, string> = {
  blue: '#0C447C', coral: '#993C1D', purple: '#3C3489',
};

function categoryIcon(section: string): string {
  if (section === 'subscription') return '🏢';
  if (section === 'unsold') return '🏠';
  if (section === 'redev') return '🏗';
  return '🏢';
}

export default function AptFeedCard({ item }: { item: FeedItem }) {
  const style = CATEGORY_STYLE[item.badge_color] ?? CATEGORY_STYLE.blue;
  const badgeColor = BADGE_TEXT_COLOR[item.badge_color] ?? BADGE_TEXT_COLOR.blue;

  return (
    <Link href={item.href} style={{
      display: 'block',
      background: 'var(--bg-surface, #FFFFFF)',
      border: '0.5px solid var(--border-base, #E5E7EB)',
      borderRadius: 7,
      overflow: 'hidden',
      textDecoration: 'none',
      color: 'inherit',
    }}>
      <div style={{
        position: 'relative',
        height: 72,
        background: item.image_url ? `url(${item.image_url}) center/cover` : style.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: style.color, fontSize: 22,
      }}>
        {!item.image_url && <span style={{ opacity: 0.7 }}>{categoryIcon(item.section)}</span>}
        <div style={{ position: 'absolute', top: 5, left: 5 }}>
          <span style={{
            fontSize: 9.5, padding: '1.5px 5px', borderRadius: 3, fontWeight: 500,
            background: 'rgba(255,255,255,0.92)', color: badgeColor,
          }}>{item.badge_label}</span>
        </div>
        {item.is_new && (
          <div style={{ position: 'absolute', top: 5, right: 5 }}>
            <span style={{
              fontSize: 8.5, padding: '1.5px 4px', borderRadius: 3, fontWeight: 500,
              background: '#1D9E75', color: 'white', letterSpacing: '0.3px',
            }}>NEW</span>
          </div>
        )}
        {item.dday !== null && item.dday !== undefined && (
          <div style={{ position: 'absolute', bottom: 5, right: 5 }}>
            <span style={{
              fontSize: 9, padding: '1.5px 5px', borderRadius: 3, fontWeight: 500,
              background: item.is_urgent ? '#E24B4A' : 'rgba(0,0,0,0.7)',
              color: 'white',
            }}>
              {item.dday < 0 ? '마감' : `D-${item.dday}`}
            </span>
          </div>
        )}
      </div>
      <div style={{ padding: '6px 8px 8px' }}>
        <div style={{
          fontSize: 11.5, fontWeight: 500, lineHeight: 1.25,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: 'var(--text-primary, #111827)',
          marginBottom: 2,
        }}>{item.title}</div>
        {item.region && (
          <div style={{
            fontSize: 10, color: 'var(--text-secondary, #6B7280)', marginBottom: 2,
          }}>{item.region}</div>
        )}
        {item.meta && (
          <div style={{
            fontSize: 11, fontWeight: 500, color: 'var(--text-primary, #111827)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{item.meta}</div>
        )}
      </div>
    </Link>
  );
}
