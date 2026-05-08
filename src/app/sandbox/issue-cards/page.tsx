// s262 Phase B sandbox — 14 컴포넌트 mock 한 화면 렌더 (시각 검증용).
// noindex + dev-only: NODE_ENV !== 'production' 일 때만 200, 그 외 404.

import { notFound } from 'next/navigation';
import StockIssueCard from '@/components/cards/StockIssueCard';
import AptIssueCard from '@/components/cards/AptIssueCard';
import IssueScoreBadge from '@/components/issue/IssueScoreBadge';
import IssueScoreBar from '@/components/issue/IssueScoreBar';
import IssueReasonChips from '@/components/issue/IssueReasonChips';
import WarningLabel from '@/components/issue/WarningLabel';
import CommentChip from '@/components/comments/CommentChip';
import type { StockIssueScore, AptIssueScore } from '@/lib/issue/types';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Issue Cards Sandbox (s262)',
  robots: { index: false, follow: false },
};

const STOCK_MOCK: StockIssueScore[] = [
  {
    symbol: '001440', name: '대한전선', market: 'KOSPI', price: 72400,
    change_pct: 12.95, volume: 17976858, market_cap: null, sector: '에너지',
    score: 0.733,
    reasons: [{ tag: 'vol', value: 0.625 }, { tag: 'chg', value: 1 }, { tag: 'new', value: 0.603 }],
    warning: null,
  },
  {
    symbol: '000500', name: '가온전선', market: 'KOSPI', price: 477000,
    change_pct: 29.97, volume: 255369, market_cap: null, sector: '전기장비',
    score: 0.731,
    reasons: [{ tag: 'vol', value: 0.622 }, { tag: 'chg', value: 1 }, { tag: 'new', value: 0.603 }],
    warning: null,
  },
  {
    symbol: '999999', name: '관리종목 예시', market: 'KOSDAQ', price: 5400,
    change_pct: -28.5, volume: 320000, market_cap: null, sector: '바이오',
    score: 0.55,
    reasons: [{ tag: 'vol', value: 0.8 }, { tag: 'chg', value: 0.7 }, { tag: 'news', value: 0.4 }],
    warning: 'managed_stock',
  },
];

const APT_MOCK: AptIssueScore[] = [
  {
    id: 711053, house_nm: '더샵 관저아르테', region_nm: '대전', mdatrgbn_nm: '대전광역시',
    rcept_bgnde: '2026-05-05', rcept_endde: '2026-05-09', created_at: '2026-05-08T00:00:00Z',
    status: 'ongoing', competition_rate_1st: null, price_per_pyeong: 24500000,
    dday: 0, score: 0.99,
    reasons: [{ tag: 'dday', value: 1 }, { tag: 'new', value: 0.98 }, { tag: 'reg', value: 1 }],
    warning: null,
  },
  {
    id: 999, house_nm: '신규 분양 예시', region_nm: '서울', mdatrgbn_nm: '강남구',
    rcept_bgnde: '2026-05-15', rcept_endde: '2026-05-22', created_at: '2026-05-08T00:00:00Z',
    status: 'upcoming', competition_rate_1st: 32.7, price_per_pyeong: 78000000,
    dday: 13, score: 0.62,
    reasons: [{ tag: 'sub', value: 0.9 }, { tag: 'pol', value: 1 }, { tag: 'new', value: 0.8 }],
    warning: 'new_listing',
  },
];

export default function SandboxIssueCards() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16, background: '#F9FAFB', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>s262 Issue Cards Sandbox</h1>

      <Section title="IssueScoreBadge / Bar (size variants)">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <IssueScoreBadge score={0.85} />
          <IssueScoreBadge score={0.6} />
          <IssueScoreBadge score={0.3} />
          <IssueScoreBadge score={0.85} size="md" />
          <IssueScoreBar score={0.85} />
          <IssueScoreBar score={0.45} />
        </span>
      </Section>

      <Section title="IssueReasonChips">
        <IssueReasonChips
          reasons={[
            { tag: 'vol', value: 0.9 },
            { tag: 'chg', value: 0.7 },
            { tag: 'news', value: 0.5 },
            { tag: 'dday', value: 0.3 },
            { tag: 'pol', value: 0.2 },
            { tag: 'thm', value: 0.1 },
          ]}
        />
      </Section>

      <Section title="WarningLabel (4 종)">
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          <WarningLabel warning="volatility_high" />
          <WarningLabel warning="new_listing" />
          <WarningLabel warning="managed_stock" />
          <WarningLabel warning="unsold_repeat" />
        </span>
      </Section>

      <Section title="CommentChip (zero / count / hot)">
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <CommentChip count={0} />
          <CommentChip count={7} />
          <CommentChip count={42} hot />
        </span>
      </Section>

      <Section title="StockIssueCard">
        {STOCK_MOCK.map((s, i) => (
          <StockIssueCard key={s.symbol} data={s} commentCount={i * 3} commentHot={i === 2} />
        ))}
      </Section>

      <Section title="AptIssueCard">
        {APT_MOCK.map((a, i) => (
          <AptIssueCard key={a.id} data={a} commentCount={i * 5} commentHot={i === 0} />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 6 }}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
