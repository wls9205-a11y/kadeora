/**
 * HighPriceCarousel
 *
 * 신고가 단지 가로 스크롤 카드. 사진 + 단지명 + 거래가 + 변동률.
 * 모바일에서 가장 효과적, 데스크톱에서도 그대로 사용.
 */

import Link from 'next/link';
import { CoverImage } from '../shared/CoverImage';
import { formatKrwShort, formatPercent } from '../utils';
import type { TransactionItem } from '../types';

type Props = {
  items: TransactionItem[];
};

export function HighPriceCarousel({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div
      className="aptr-scroll-x"
      style={{
        display: 'flex',
        gap: '8px',
        paddingBottom: '4px',
      }}
    >
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="aptr-link-reset aptr-focus"
          style={{
            display: 'block',
            background: 'var(--aptr-bg-card)',
            border: '0.5px solid var(--aptr-border-subtle)',
            borderRadius: 'var(--aptr-radius-md)',
            overflow: 'hidden',
            minWidth: '180px',
            flexShrink: 0,
            boxShadow: 'var(--aptr-shadow-card)',
          }}
        >
          <div style={{ position: 'relative', height: '90px' }}>
            <CoverImage site={item.site} aspectRatio="auto" showKindLabel={false} />
            {item.changePct ? (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  left: '6px',
                  fontSize: '9px',
                  padding: '2px 6px',
                  background: 'var(--aptr-badge-green-bg)',
                  color: 'var(--aptr-badge-green-fg)',
                  borderRadius: 'var(--aptr-radius-xs)',
                  fontWeight: 500,
                }}
              >
                {formatPercent(item.changePct)}
              </span>
            ) : null}
          </div>
          <div style={{ padding: '9px 11px' }}>
            <div
              className="aptr-text-clip"
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--aptr-text-primary)',
              }}
            >
              {item.site.name}
            </div>
            <div
              className="aptr-num"
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--aptr-text-primary)',
                marginTop: '1px',
              }}
            >
              {formatKrwShort(item.price)}
            </div>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--aptr-text-tertiary)',
                marginTop: '2px',
              }}
            >
              {item.areaSqm}㎡{item.floor ? ` ${item.floor}층` : ''}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
