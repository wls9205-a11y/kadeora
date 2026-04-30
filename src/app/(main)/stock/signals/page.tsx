import { Suspense } from 'react';
import { SITE_URL } from '@/lib/constants';
import { createSupabaseServer } from '@/lib/supabase-server';
import type { Metadata } from 'next';
import Disclaimer from '@/components/Disclaimer';

export const revalidate = 300;

export const metadata: Metadata = {
  // s212 P0-B: template 가 '| 카더라' 자동 추가
  title: '수급 시그널 — 외국인·기관 매매 조합 신호',
  description: '외국인 대량 순매수, 기관 연속 순매수, 개인 투매 후 외인 유입, 숏스퀴즈 후보 등 수급 조합 시그널을 매일 자동 탐지합니다.',
  alternates: { canonical: SITE_URL + '/stock/signals' },
  openGraph: {
    title: '수급 시그널 — 외국인·기관 매매 조합 신호',
    description: '네이버금융에서 보기 어려운 수급 조합 시그널을 AI가 매일 자동 탐지합니다.',
    url: SITE_URL + '/stock/signals',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{
      url: `${SITE_URL}/api/og?title=${encodeURIComponent('수급 시그널')}&subtitle=${encodeURIComponent('외국인·기관 매매 조합 신호')}&category=stock&design=2`,
      width: 1200,
      height: 630,
    }],
  },
  other: {
    'naver:written_time': new Date().toISOString(),
    'naver:author': '카더라',
  },
};

const SIGNAL_LABELS: Record<string, { label: string; emoji: string; description: string }> = {
  foreign_buying_breakout: {
    label: '외국인 대량 순매수',
    emoji: '🌍',
    description: '최근 5일간 외국인 순매수가 통계적 이상치(2σ 이상)를 보이는 종목',
  },
  institution_buying_streak: {
    label: '기관 연속 순매수',
    emoji: '🏦',
    description: '기관이 3영업일 이상 연속으로 순매수 중인 종목',
  },
  individual_capitulation: {
    label: '개인 투매 + 외인 유입',
    emoji: '🔄',
    description: '개인이 대량 매도하는 동시에 외국인이 매수하는 종목 (전형적 바닥 신호 후보)',
  },
  short_cover_candidate: {
    label: '숏커버링 후보',
    emoji: '⚡',
    description: '대차잔고 감소 + 주가 상승 초입 — 숏스퀴즈 가능성',
  },
  flow_reversal: {
    label: '수급 방향 전환',
    emoji: '↩️',
    description: '외국인·기관이 동시에 매도에서 매수로 전환한 종목',
  },
  overheat_reversal: {
    label: '공매도 과열 + 반전',
    emoji: '🔥',
    description: '공매도 과열 종목 지정 후 외국인 매수 전환',
  },
};

async function fetchSignals() {
  const sb = await createSupabaseServer();
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const since = new Date(Date.now() + 9 * 3600000 - 3 * 86400000).toISOString().slice(0, 10);

  const { data } = await (sb as any).from('flow_signals')
    .select('*')
    .gte('signal_date', since)
    .order('strength', { ascending: false })
    .limit(50);

  return data || [];
}

async function fetchStockNames(symbols: string[]) {
  if (!symbols.length) return {};
  const sb = await createSupabaseServer();
  const { data } = await sb.from('stock_quotes')
    .select('symbol, name, price, change_pct')
    .in('symbol', symbols);
  const map: Record<string, any> = {};
  for (const s of data || []) map[s.symbol] = s;
  return map;
}

export default async function SignalsPage() {
  const signals = await fetchSignals();
  const symbols = [...new Set(signals.map((s: any) => s.symbol))] as string[];
  const stockMap = await fetchStockNames(symbols);

  // 시그널 타입별 그룹핑
  const grouped: Record<string, any[]> = {};
  for (const signal of signals) {
    if (!grouped[signal.signal_type]) grouped[signal.signal_type] = [];
    grouped[signal.signal_type].push(signal);
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
        ⚡ 수급 시그널
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
        외국인·기관·개인 수급 데이터에서 AI가 매일 자동으로 탐지하는 조합 신호입니다.
        단순 순매수 수치가 아닌, 여러 조건이 동시에 충족되는 종목만 선별합니다.
      </p>

      {/* JSON-LD FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: '수급 시그널이란?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: '외국인·기관·개인의 일별 순매수/순매도 데이터에서 통계적으로 유의미한 조합 패턴을 자동 탐지한 신호입니다. 단순 순매수 랭킹이 아닌, 여러 조건이 동시에 충족되어야 시그널로 인정됩니다.',
                },
              },
              {
                '@type': 'Question',
                name: '시그널이 매수 추천인가요?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: '아닙니다. 수급 시그널은 정보 제공 목적이며 매매 권유가 아닙니다. 투자 판단의 최종 책임은 투자자 본인에게 있습니다.',
                },
              },
            ],
          }),
        }}
      />

      {signals.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 16px',
          color: 'var(--text-tertiary)',
        }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>📡</p>
          <p>현재 감지된 시그널이 없습니다.</p>
          <p style={{ fontSize: '13px' }}>매일 장 마감 후 16시에 자동 업데이트됩니다.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([type, items]) => {
          const meta = SIGNAL_LABELS[type] || { label: type, emoji: '📊', description: '' };
          return (
            <section key={type} style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
                {meta.emoji} {meta.label}
                <span style={{
                  fontSize: '13px',
                  fontWeight: 400,
                  color: 'var(--text-tertiary)',
                  marginLeft: '8px',
                }}>
                  {items.length}건
                </span>
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                {meta.description}
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '12px',
              }}>
                {items.map((signal: any) => {
                  const stock = stockMap[signal.symbol];
                  return (
                    <a
                      key={signal.id}
                      href={`/stock/${signal.symbol}`}
                      style={{
                        display: 'block',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-md, 8px)',
                        padding: '14px 16px',
                        textDecoration: 'none',
                        color: 'inherit',
                        border: '1px solid var(--border)',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '15px' }}>
                          {stock?.name || signal.symbol}
                        </span>
                        <span style={{
                          fontSize: '12px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: signal.strength >= 7 ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                          color: signal.strength >= 7 ? '#ef4444' : '#3b82f6',
                          fontWeight: 600,
                        }}>
                          강도 {signal.strength}/10
                        </span>
                      </div>

                      {stock && (
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 6px' }}>
                          {stock.price?.toLocaleString()}원
                          <span style={{ color: Number(stock.change_pct) >= 0 ? '#ef4444' : '#3b82f6', marginLeft: '6px' }}>
                            {Number(stock.change_pct) >= 0 ? '+' : ''}{Number(stock.change_pct).toFixed(1)}%
                          </span>
                        </p>
                      )}

                      {signal.interpretation_ko && (
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>
                          {signal.interpretation_ko.slice(0, 120)}
                        </p>
                      )}
                    </a>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      <Disclaimer type="stock" />
    </div>
  );
}
