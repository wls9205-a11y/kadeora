/**
 * DiscountCard
 *
 * 미분양 단지 할인 혜택 카드. 분양가→현재가 비교 + 혜택 리스트 + CTA.
 * 미분양 탭의 시그니처 위젯.
 */

import { formatKrwShort } from '../utils';
import type { UnsoldItem } from '../types';

type Props = {
  item: UnsoldItem;
};

export function DiscountCard({ item }: Props) {
  return (
    <div
      style={{
        background: 'var(--aptr-bg-card)',
        border: '0.5px solid var(--aptr-border-subtle)',
        borderRadius: 'var(--aptr-radius-md)',
        padding: '14px',
        boxShadow: 'var(--aptr-shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* 가격 비교 */}
      <div>
        <div
          style={{
            fontSize: '10px',
            color: 'var(--aptr-text-tertiary)',
            letterSpacing: '0.3px',
            marginBottom: '6px',
          }}
        >
          분양가 → 현재가
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
          <span
            className="aptr-num"
            style={{
              fontSize: '12px',
              color: 'var(--aptr-text-tertiary)',
              textDecoration: 'line-through',
            }}
          >
            {formatKrwShort(item.originalPrice)}
          </span>
          <span style={{ color: 'var(--aptr-text-tertiary)', fontSize: '11px' }}>→</span>
          <span
            className="aptr-num"
            style={{
              fontSize: '20px',
              fontWeight: 500,
              color: 'var(--aptr-text-primary)',
              lineHeight: 1,
            }}
          >
            {formatKrwShort(item.currentPrice)}
          </span>
          <span
            className="aptr-num"
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--aptr-negative)',
            }}
          >
            -{item.discountPct}%
          </span>
        </div>
      </div>

      {/* 혜택 리스트 */}
      {item.benefits.length > 0 ? (
        <div>
          <div
            style={{
              fontSize: '10px',
              color: 'var(--aptr-text-tertiary)',
              letterSpacing: '0.3px',
              marginBottom: '6px',
            }}
          >
            할인 혜택
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {item.benefits.map((b) => (
              <div
                key={b.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ color: 'var(--aptr-text-secondary)' }}>{b.label}</span>
                <span
                  className="aptr-num"
                  style={{
                    color: 'var(--aptr-positive)',
                    fontWeight: 500,
                  }}
                >
                  {b.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* CTA */}
      <button
        type="button"
        className="aptr-btn-reset aptr-focus"
        style={{
          padding: '9px',
          background: 'var(--aptr-brand)',
          color: '#FFFFFF',
          borderRadius: 'var(--aptr-radius-sm)',
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '0.2px',
          marginTop: 'auto',
        }}
        onClick={() => alert('상담 신청 (실제 구현 연결)')}
      >
        상담 신청 →
      </button>
    </div>
  );
}
