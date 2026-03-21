import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const TEMPLATES = [
  { cat: 'stock', titleFn: (d: string) => `오늘의 코스피 시황 (${d})`, tagsFn: () => ['코스피', '주식시황', '오늘장'] },
  { cat: 'stock', titleFn: (d: string) => `코스닥 주요 종목 동향 (${d})`, tagsFn: () => ['코스닥', '주식동향'] },
  { cat: 'stock', titleFn: (d: string) => `오늘 급등/급락 종목 TOP 5 (${d})`, tagsFn: () => ['급등주', '급락주', '주식'] },
  { cat: 'stock', titleFn: (d: string) => `섹터별 수익률 분석 (${d})`, tagsFn: () => ['섹터분석', '반도체', '2차전지'] },
  { cat: 'stock', titleFn: (d: string) => `미국 증시 마감 요약 (${d})`, tagsFn: () => ['나스닥', '다우존스', 'S&P500', '미국주식'] },
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    const dateSlug = new Date().toISOString().slice(0, 10);

    const { data: stocks } = await admin.from('stock_quotes').select('name, symbol, change_pct, price, market').order('market_cap', { ascending: false }).limit(30);
    const kospi = (stocks ?? []).filter(s => s.market === 'KOSPI');
    const kosdaq = (stocks ?? []).filter(s => s.market === 'KOSDAQ');
    const movers = [...(stocks ?? [])].sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0)).slice(0, 5);

    const contents = [
      // 코스피 시황
      `## 코스피 주요 종목 (${today})\n\n| 종목 | 현재가 | 등락률 |\n|---|---|---|\n${kospi.slice(0, 10).map(s => `| ${s.name} | ${s.price?.toLocaleString()} | ${(s.change_pct ?? 0) > 0 ? '▲' : '▼'} ${Math.abs(s.change_pct ?? 0).toFixed(2)}% |`).join('\n')}\n\n---\n\n[카더라에서 실시간 시세 확인하기 →](/stock)\n\n> 투자 권유가 아니며 참고용입니다.`,
      // 코스닥
      `## 코스닥 주요 종목 (${today})\n\n| 종목 | 현재가 | 등락률 |\n|---|---|---|\n${kosdaq.slice(0, 10).map(s => `| ${s.name} | ${s.price?.toLocaleString()} | ${(s.change_pct ?? 0) > 0 ? '▲' : '▼'} ${Math.abs(s.change_pct ?? 0).toFixed(2)}% |`).join('\n')}\n\n---\n\n[카더라 주식 페이지 →](/stock)\n\n> 투자 권유가 아니며 참고용입니다.`,
      // 급등락
      `## 오늘 급등/급락 종목 (${today})\n\n| 순위 | 종목 | 등락률 |\n|---|---|---|\n${movers.map((s, i) => `| ${i + 1} | ${s.name} | ${(s.change_pct ?? 0) > 0 ? '▲' : '▼'} ${Math.abs(s.change_pct ?? 0).toFixed(2)}% |`).join('\n')}\n\n---\n\n[종목 상세 보기 →](/stock/${movers[0]?.symbol ?? ''})\n[카더라 피드에서 토론하기 →](/feed?category=stock)\n\n> 투자 권유가 아니며 참고용입니다.`,
      // 섹터
      `## 섹터별 주요 종목 (${today})\n\n오늘의 섹터별 대표 종목 동향을 정리했습니다.\n\n${kospi.slice(0, 5).map(s => `- **${s.name}**: ${s.price?.toLocaleString()}원 (${(s.change_pct ?? 0) > 0 ? '+' : ''}${(s.change_pct ?? 0).toFixed(2)}%)`).join('\n')}\n\n---\n\n[카더라 주식 →](/stock)\n\n> 참고용 정보입니다.`,
      // 미국주식
      `## 미국 증시 요약 (${today})\n\n| 지수/종목 | 가격 | 등락률 |\n|---|---|---|\n${(stocks ?? []).filter(s => s.market === 'NYSE' || s.market === 'NASDAQ').slice(0, 8).map(s => `| ${s.name} | $${s.price?.toLocaleString()} | ${(s.change_pct ?? 0) > 0 ? '▲' : '▼'} ${Math.abs(s.change_pct ?? 0).toFixed(2)}% |`).join('\n')}\n\n---\n\n[카더라에서 해외 종목 보기 →](/stock)\n\n> 투자 권유가 아니며 참고용입니다.`,
    ];

    let created = 0;
    for (let i = 0; i < TEMPLATES.length; i++) {
      const t = TEMPLATES[i];
      const slug = `${t.cat}-${dateSlug}-${i + 1}`;
      const { data: existing } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (existing) continue;

      const blogTitle = t.titleFn(today);
      await admin.from('blog_posts').insert({
        slug, title: blogTitle, content: contents[i],
        excerpt: contents[i].slice(0, 100).replace(/[#|*\n]/g, ''),
        category: t.cat, tags: t.tagsFn(), source_type: 'auto',
        cron_type: 'daily', data_date: dateSlug,
        cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(blogTitle)}&type=blog`,
      });
      created++;
    }

    // 종목별 개별 블로그 (등락률 ±3% 이상)
    const bigMovers = (stocks ?? []).filter(s => Math.abs(s.change_pct ?? 0) >= 3);
    for (const s of bigMovers.slice(0, 5)) {
      const stockSlug = `stock-${s.symbol}-${dateSlug}`;
      const { data: se } = await admin.from('blog_posts').select('id').eq('slug', stockSlug).maybeSingle();
      if (se) continue;
      const dir = (s.change_pct ?? 0) > 0 ? '급등' : '급락';
      const stockTitle = `${s.name} ${dir} ${Math.abs(s.change_pct ?? 0).toFixed(1)}% — ${today} 분석`;
      const stockContent = `## ${s.name} (${s.symbol}) ${dir} ${Math.abs(s.change_pct ?? 0).toFixed(2)}%\n\n| 항목 | 값 |\n|---|---|\n| 현재가 | ${s.price?.toLocaleString()} |\n| 등락률 | ${(s.change_pct ?? 0) > 0 ? '▲' : '▼'} ${Math.abs(s.change_pct ?? 0).toFixed(2)}% |\n| 시장 | ${s.market} |\n\n---\n\n[${s.name} 종목 상세 →](/stock/${s.symbol})\n[주식 토론 →](/feed?category=stock)\n[전체 시세 보기 →](/stock)\n\n> 투자 권유가 아니며 참고용입니다.`;
      await admin.from('blog_posts').insert({
        slug: stockSlug, title: stockTitle, content: stockContent,
        excerpt: `${s.name} ${dir} ${Math.abs(s.change_pct ?? 0).toFixed(1)}%. ${today} 시세 분석.`,
        category: 'stock', tags: [s.name, dir, s.market, '주식'], source_type: 'auto',
        cron_type: 'daily-stock', data_date: dateSlug, source_ref: s.symbol,
        cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(stockTitle)}&type=blog`,
      });
      created++;
    }

    return NextResponse.json({ ok: true, created });
  } catch (err) {
    console.error('[blog-daily]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
