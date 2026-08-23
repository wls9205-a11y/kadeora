// v3 커밋5 — /stock 상단 큐레이션 카드 (3건).
//
// 목록 행이 못 담는 것: 점수의 '근거'. 숫자 하나만 보여주면 왜 84점인지 알 수 없다.
//
// ⚠️ 설계안의 `뉴스 12건 · 거래량 3.1배` 같은 원시 수치는 넣지 못했다.
//    stock_issue_scores.reasons 는 {tag, value(0..1 정규화)} 뿐이라
//    원본 건수·배수가 남아 있지 않다 (lib/issue/types.ts:17).
//    있는 것으로 근거를 말한다 — 기여도 순 근거 칩 + 각 항목의 상대 비중.
//    원시 수치를 쓰려면 매트뷰에 컬럼 추가가 선행돼야 한다.

import Link from 'next/link';
import { getStockTone, stockChipStyle, formatChangePct } from '@/lib/stockColor';
import { scoreToDisplay } from '@/lib/issue/calc';
import { REASON_LABELS, REASON_MIN_VALUE } from '@/lib/issue/labels';
import WarningLabel from '@/components/issue/WarningLabel';
import type { StockIssueScore } from '@/lib/issue/types';

export default function StockCurationCard({ data }: { data: StockIssueScore }) {
  const tone = getStockTone(data.change_pct);
  const chip = stockChipStyle(tone);
  const display = scoreToDisplay(data.score);

  const grounds = (Array.isArray(data.reasons) ? data.reasons : [])
    .filter(r => typeof r?.value === 'number' && r.value >= REASON_MIN_VALUE && REASON_LABELS[r.tag])
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  return (
    <article
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
        background: 'var(--bg-surface)', padding: '12px 13px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span className={display >= 80 ? 'kd-lrow-k is-hot' : 'kd-lrow-k'} style={{ width: 'auto', padding: '4px 9px', fontSize: 12 }}>
          {display}
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-tertiary)' }}>이슈 점수</span>
        <WarningLabel warning={data.warning} />
      </div>

      <Link
        href={`/stock/${data.symbol}`}
        style={{
          display: 'block', fontSize: 14, fontWeight: 700, lineHeight: 1.35,
          letterSpacing: '-.02em', color: 'var(--text-primary)', textDecoration: 'none', marginBottom: 3,
        }}
      >
        {data.name}
      </Link>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 9 }}>
        <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
          {data.price != null ? Number(data.price).toLocaleString() : '-'}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: chip.color }}>
          {formatChangePct(data.change_pct)}
        </span>
      </div>

      {/* 점수의 근거 — 기여도 순. 값은 0..1 정규화라 % 로만 말할 수 있다. */}
      {grounds.length > 0 && (
        <ul style={{ margin: 'auto 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
          {grounds.map(g => (
            <li key={g.tag} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--text-tertiary)' }}>
              <span style={{ flexShrink: 0, width: 34, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {REASON_LABELS[g.tag]}
              </span>
              <span style={{ flex: 1, height: 4, borderRadius: 999, background: 'var(--bg-sunken)', overflow: 'hidden' }}>
                <span
                  style={{
                    display: 'block', height: '100%', borderRadius: 999,
                    width: `${Math.round(Math.min(1, g.value) * 100)}%`,
                    background: 'var(--brand)',
                  }}
                />
              </span>
              <span style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(Math.min(1, g.value) * 100)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
