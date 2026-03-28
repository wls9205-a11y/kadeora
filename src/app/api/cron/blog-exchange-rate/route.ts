export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { withCronAuth } from '@/lib/cron-auth';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

interface ExchangeRate {
  base_currency: string;
  rates: Record<string, number>;
  updated_at: string;
}

interface RateHistory {
  currency_pair: string;
  rate: number;
  recorded_at: string;
}

const MONTHS = [
  { month: '04', label: '4월', focus: '1분기 결산과 신규 환율 흐름' },
  { month: '05', label: '5월', focus: '미국 FOMC 금리 결정과 영향' },
  { month: '06', label: '6월', focus: '상반기 결산과 하반기 환율 방향성' },
  { month: '07', label: '7월', focus: '하반기 전망과 투자 전략' },
] as const;

const CURRENCIES = [
  { code: 'USD', flag: '🇺🇸', label: 'USD/KRW', name: '미국 달러' },
  { code: 'JPY', flag: '🇯🇵', label: 'JPY/KRW', name: '일본 엔' },
  { code: 'EUR', flag: '🇪🇺', label: 'EUR/KRW', name: '유로' },
  { code: 'CNY', flag: '🇨🇳', label: 'CNY/KRW', name: '중국 위안' },
] as const;

function formatRate(rate: number | undefined): string {
  if (!rate) return '-';
  return rate.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildContent(
  monthInfo: typeof MONTHS[number],
  rates: ExchangeRate[],
  history: RateHistory[],
): string {
  const parts: string[] = [];
  const year = '2026';
  const monthLabel = monthInfo.label;

  // Collect current rates from exchange_rates table
  const currentRates: Record<string, number> = {};
  for (const row of rates) {
    if (row.rates) {
      for (const [key, val] of Object.entries(row.rates)) {
        currentRates[key.toUpperCase()] = val;
      }
    }
  }

  const updatedAt = rates[0]?.updated_at
    ? new Date(rates[0].updated_at).toLocaleDateString('ko-KR')
    : '최근';

  parts.push(`## 원달러 환율 전망 ${year}년 ${monthLabel}`);
  parts.push('');
  parts.push(`${year}년 ${monthLabel} 환율 전망을 주요 통화별로 분석합니다. 이번 달은 **${monthInfo.focus}**에 초점을 맞춰 원달러 환율 흐름과 주요 통화 동향을 살펴봅니다. 기준일: ${updatedAt}`);
  parts.push('');

  // KPI: 주요 환율 현황
  parts.push('### 💱 주요 환율 현황');
  parts.push('');
  parts.push('| 통화 | 환율 | 변동 |');
  parts.push('|---|---|---|');
  for (const cur of CURRENCIES) {
    const rate = currentRates[cur.code];
    const rateStr = formatRate(rate);
    // Check history for change
    const pairHistory = history
      .filter((h) => h.currency_pair.toUpperCase().includes(cur.code))
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
    let changeStr = '-';
    if (pairHistory.length >= 2) {
      const latest = pairHistory[0].rate;
      const prev = pairHistory[1].rate;
      const diff = latest - prev;
      const pct = prev > 0 ? ((diff / prev) * 100).toFixed(2) : '0.00';
      const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '-';
      changeStr = `${arrow} ${Math.abs(diff).toFixed(2)} (${diff > 0 ? '+' : ''}${pct}%)`;
    }
    parts.push(`| ${cur.flag} ${cur.label} | ${rateStr} | ${changeStr} |`);
  }
  parts.push('');

  // USD analysis paragraph
  const usdRate = currentRates['USD'];
  if (usdRate) {
    parts.push(`현재 원달러 환율은 **${formatRate(usdRate)}원** 수준입니다. ${monthLabel}에는 ${monthInfo.focus}이(가) 주요 변수로 작용할 것으로 예상됩니다.`);
    parts.push('');
  }

  // History table
  const recentHistory = history
    .filter((h) => h.currency_pair.toUpperCase().includes('USD'))
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
    .slice(0, 10);

  if (recentHistory.length > 0) {
    parts.push('### 📈 환율 추이');
    parts.push('');
    parts.push('최근 원달러 환율 변동 추이입니다.');
    parts.push('');
    parts.push('| 날짜 | USD/KRW |');
    parts.push('|---|---|');
    for (const h of recentHistory) {
      const dateStr = new Date(h.recorded_at).toLocaleDateString('ko-KR');
      parts.push(`| ${dateStr} | ${formatRate(h.rate)} |`);
    }
    parts.push('');
  }

  // 주요 통화별 분석
  parts.push('### 🔍 전망');
  parts.push('');

  if (monthInfo.month === '04') {
    parts.push(`${year}년 1분기가 마무리되면서 ${monthLabel}은 새로운 분기의 시작점입니다. 1분기 동안의 원달러 환율 흐름을 되짚어보면, 미국 연준의 금리 정책과 한국은행의 기준금리 방향이 핵심 변수였습니다.`);
    parts.push('');
    parts.push('4월에는 미국 고용지표와 물가 데이터 발표가 예정되어 있어 환율 변동성이 커질 수 있습니다. 수출 기업의 실적 발표 시즌과 맞물려 원화 수급에도 변화가 예상됩니다. 특히 반도체 업종의 수출 실적이 원화 강세 요인으로 작용할 수 있는지 주목해야 합니다.');
    parts.push('');
    parts.push('엔화는 일본은행(BOJ)의 통화정책 정상화 속도에 따라 변동성이 클 수 있으며, 유로화는 ECB의 금리 인하 시점이 관건입니다. 위안화는 중국 경기 회복 속도와 미중 관계에 영향을 받을 것으로 보입니다.');
  } else if (monthInfo.month === '05') {
    parts.push(`${monthLabel}에는 미국 FOMC(연방공개시장위원회) 정례회의가 예정되어 있어 금리 결정에 시장의 이목이 집중됩니다. 연준의 금리 동결 또는 인하 시그널에 따라 달러화 강약이 결정될 전망입니다.`);
    parts.push('');
    parts.push('금리 인하 기대가 높아지면 달러 약세 → 원화 강세 흐름이 나타날 수 있으며, 반대로 인플레이션 재발 우려가 커지면 달러 강세가 이어질 수 있습니다. 한국은행의 기준금리 결정도 5월 중 예정되어 있어 한미 금리차 변화에 주목해야 합니다.');
    parts.push('');
    parts.push('일본 엔화는 BOJ의 추가 금리 인상 가능성이 엔화 강세 요인이 될 수 있으며, 위안화는 중국 제조업 PMI 등 경기 지표 발표에 따라 방향이 결정될 것으로 예상됩니다.');
  } else if (monthInfo.month === '06') {
    parts.push(`${year}년 상반기가 마무리되는 ${monthLabel}은 반기 결산 시점으로 외환시장의 수급 변화가 예상됩니다. 기업들의 배당 송금, 해외 투자금 환수 등으로 원화 수급이 변동할 수 있습니다.`);
    parts.push('');
    parts.push('상반기 동안의 글로벌 경제 흐름을 점검하고 하반기 환율 방향성을 가늠해보는 시기입니다. 미국 경기 연착륙 여부, 유럽 경기 회복 속도, 중국 경기 부양책 효과 등이 하반기 환율 전망의 핵심 변수입니다.');
    parts.push('');
    parts.push('6월 FOMC 회의에서의 점도표(Dot Plot) 수정 여부가 하반기 달러 방향을 결정짓는 중요한 이벤트가 될 전망입니다.');
  } else {
    parts.push(`${year}년 하반기가 시작되는 ${monthLabel}, 상반기 환율 흐름을 바탕으로 하반기 전망을 정리합니다. 미국 대선 등 정치적 이벤트가 다가오면서 달러화 변동성이 확대될 수 있습니다.`);
    parts.push('');
    parts.push('하반기에는 미국 경기 둔화 속도, 연준의 금리 인하 횟수, 지정학적 리스크 등이 주요 변수로 작용할 전망입니다. 원달러 환율은 글로벌 달러 강세와 한국 수출 실적 사이의 줄다리기가 이어질 것으로 예상됩니다.');
    parts.push('');
    parts.push('엔화는 하반기 BOJ의 통화정책 정상화 로드맵에 따라 강세 전환 가능성이 있으며, 유로화는 ECB의 금리 인하 사이클 진입 이후 유로존 경기 회복 여부가 관건입니다. 위안화는 중국 부동산 시장 안정화와 소비 회복 속도가 핵심 변수입니다.');
  }
  parts.push('');

  // Internal links
  parts.push('### 관련 정보');
  parts.push('');
  parts.push(`- [카더라 시세 정보 →](${SITE_URL}/stock)`);
  parts.push(`- [재테크 블로그 →](${SITE_URL}/blog?category=finance)`);
  parts.push('');

  // Disclaimer
  parts.push('---');
  parts.push('');
  parts.push('> **면책고지**: 본 콘텐츠는 공개된 환율 데이터를 기반으로 정보 제공 목적으로 작성되었으며, 특정 외환 거래를 권유하지 않습니다. 환율은 다양한 요인에 의해 급격히 변동할 수 있으므로, 실제 거래 시에는 실시간 환율을 확인하시기 바랍니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.');

  return parts.join('\n');
}

export const GET = withCronAuth(async (req: NextRequest) => {
  const params = req.nextUrl.searchParams;
  const offset = parseInt(params.get('offset') || '0', 10);
  const limit = parseInt(params.get('limit') || String(MONTHS.length), 10);
  const targetMonths = MONTHS.slice(offset, offset + limit);

  const admin = getSupabaseAdmin();

  // 1. Fetch current exchange rates (only ~2 rows)
  const { data: rates, error: ratesErr } = await admin
    .from('exchange_rates')
    .select('base_currency, rates, updated_at');

  if (ratesErr) {
    console.error('[blog-exchange-rate] rates fetch error:', ratesErr.message);
    return NextResponse.json({ ok: false, error: ratesErr.message });
  }

  // 2. Fetch recent history for trend data
  const { data: history, error: histErr } = await admin
    .from('exchange_rate_history')
    .select('currency_pair, rate, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(200);

  if (histErr) {
    console.error('[blog-exchange-rate] history fetch error:', histErr.message);
    return NextResponse.json({ ok: false, error: histErr.message });
  }

  const exchangeRates = (rates || []) as ExchangeRate[];
  const rateHistory = (history || []) as RateHistory[];

  let created = 0;
  let skipped = 0;

  for (const monthInfo of targetMonths) {
    try {
      const slug = `exchange-rate-outlook-2026-${monthInfo.month}`;
      const title = `원달러 환율 전망 2026년 ${monthInfo.label} — 미국 금리와 원화 흐름 분석`;

      let content = buildContent(monthInfo, exchangeRates, rateHistory);
      content = ensureMinLength(content, 'general', 1500);

      const tags = ['환율', '원달러', 'USD', '금리', 'FOMC', '2026', monthInfo.label];

      const result = await safeBlogInsert(admin, {
        slug,
        title,
        content,
        excerpt: `2026년 ${monthInfo.label} 원달러 환율 전망 — ${monthInfo.focus}. 주요 통화(USD, JPY, EUR, CNY) 환율 현황과 추이 분석.`,
        category: 'finance',
        tags,
        source_type: 'auto',
        cron_type: 'blog-exchange-rate',
        data_date: `2026-${monthInfo.month}`,
        source_ref: 'exchange_rates',
        cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&type=blog`,
        image_alt: generateImageAlt('finance', title),
        meta_description: generateMetaDesc(content),
        meta_keywords: generateMetaKeywords('finance', tags),
        is_published: true,
      });

      if (result.success) {
        created++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      console.error(`[blog-exchange-rate] Error for ${monthInfo.label}:`, err.message);
      skipped++;
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    total: MONTHS.length,
  });
});
