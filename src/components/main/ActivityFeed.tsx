/**
 * ActivityFeed — 실거래+미분양+재개발 통합 활동 stream (server).
 * 시간순(최근순) 합쳐서 최대 12행. 색 점 카테고리.
 */
import type { MainTransaction, MainUnsold, MainRedev } from './types';

interface Props {
  transactions: MainTransaction[];
  unsold: MainUnsold[];
  redev: MainRedev[];
}

type FeedItem =
  | { kind: 'transaction'; date: string; text: string }
  | { kind: 'unsold'; date: string; text: string }
  | { kind: 'redev'; date: string; text: string };

const DOT_COLOR = {
  transaction: 'var(--accent-green, #22c55e)',
  unsold: 'var(--accent-orange, #f97316)',
  redev: 'var(--accent-purple, #a855f7)',
};

function fmtAmount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
}

export default function ActivityFeed({ transactions, unsold, redev }: Props) {
  const items: FeedItem[] = [
    ...transactions.map<FeedItem>((t) => ({
      kind: 'transaction',
      date: t.deal_date,
      text: `${t.apt_name} ${t.region || ''} ${fmtAmount(t.deal_amount)} (${t.deal_date})`,
    })),
    ...unsold.map<FeedItem>((u) => ({
      kind: 'unsold',
      date: '',
      text: `${u.house_nm} 미분양 ${u.remaining ?? '-'}/${u.total ?? '-'}세대${u.discount_pct ? ` (할인 ${u.discount_pct}% 가능)` : ''}`,
    })),
    ...redev.map<FeedItem>((r) => ({
      kind: 'redev',
      date: r.next_milestone_date || '',
      text: `${r.district_name} 재개발 단계 ${r.stage ?? '-'}/6${r.constructor ? ` (${r.constructor})` : ''}`,
    })),
  ];

  // 날짜 desc 정렬 (없으면 끝으로)
  items.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  const sliced = items.slice(0, 12);

  return (
    <section style={{ padding: 16, background: 'var(--bg-base)' }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>최근 활동</h2>
      {sliced.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 12, textAlign: 'center', border: '0.5px solid var(--border)', borderRadius: 8 }}>
          최근 활동 없음
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' }}>
          {sliced.map((it, i) => (
            <li
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderBottom: i === sliced.length - 1 ? 'none' : '0.5px solid var(--border)',
                fontSize: 12, color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: DOT_COLOR[it.kind], flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
