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

    const mkTable = (items: typeof kospi, prefix = '') => items.map(s => `| ${prefix}[${s.name}](/stock/${s.symbol}) | ${s.price?.toLocaleString()} | ${(s.change_pct ?? 0) > 0 ? '▲' : '▼'} ${Math.abs(s.change_pct ?? 0).toFixed(2)}% |`).join('\n');
    const upCount = kospi.filter(s => (s.change_pct ?? 0) > 0).length;
    const downCount = kospi.filter(s => (s.change_pct ?? 0) < 0).length;

    const contents = [
      // 코스피 시황 (1500자+)
      `## 코스피 시가총액 상위 종목 시세 (${today})\n\n${today} 기준 **코스피** 시가총액 상위 10개 종목의 시세를 정리했습니다. 오늘 코스피 주요 종목 중 상승 종목은 **${upCount}개**, 하락 종목은 **${downCount}개**입니다.\n\n최근 글로벌 경제 지표와 환율 흐름에 따라 **코스피 시장**의 변동성이 확대되고 있습니다. 특히 반도체, 2차전지 등 주요 섹터의 움직임에 주목할 필요가 있습니다.\n\n---\n\n### 코스피 시총 TOP 10\n\n| 종목 | 현재가 | 등락률 |\n|---|---|---|\n${mkTable(kospi.slice(0, 10))}\n\n---\n\n### 시장 분석\n\n${kospi[0] ? `**${kospi[0].name}**은 ${kospi[0].price?.toLocaleString()}원으로 ${(kospi[0].change_pct ?? 0) > 0 ? '상승' : (kospi[0].change_pct ?? 0) < 0 ? '하락' : '보합'} 마감했습니다.` : ''} 시가총액 상위 종목들의 흐름은 전체 시장 방향을 가늠하는 중요한 지표입니다.\n\n투자 결정 시에는 개별 종목의 실적, 업종 전망, 글로벌 매크로 환경 등을 종합적으로 고려하시기 바랍니다.\n\n---\n\n### 관련 정보\n\n- [카더라 **실시간 주식 시세** →](/stock)\n- [주식 커뮤니티 **토론** →](/feed?category=stock)\n- [**관심 종목 알림** 받기 →](/login)\n\n카더라에서 매일 업데이트되는 시세 정보를 확인하고, 커뮤니티에서 다른 투자자들의 의견도 들어보세요.\n\n> 투자 권유가 아니며 참고용입니다. 모든 투자 판단과 손익은 투자자 본인에게 귀속됩니다.`,
      // 코스닥 (1500자+)
      `## 코스닥 시가총액 상위 종목 시세 — ${today} 동향 분석\n\n${today} 기준 **코스닥** 시가총액 상위 10개 종목의 시세를 정리했습니다. 코스닥은 **바이오, IT, 2차전지** 관련 종목이 주를 이루며, 코스피 대비 변동성이 크고 개별 종목 이슈에 민감한 시장입니다.\n\n코스닥 종목 중 상승 종목은 **${kosdaq.filter(s => (s.change_pct ?? 0) > 0).length}개**, 하락 종목은 **${kosdaq.filter(s => (s.change_pct ?? 0) < 0).length}개**로 집계되었습니다. 최근 코스닥 시장은 테마주 중심의 순환매가 이어지고 있어, 업종별 차별화 움직임에 주목할 필요가 있습니다.\n\n---\n\n### 코스닥 주요 종목 시세\n\n| 종목 | 현재가 | 등락률 |\n|---|---|---|\n${mkTable(kosdaq.slice(0, 10))}\n\n---\n\n### 코스닥 시장 분석\n\n코스닥 시장은 **성장주 중심**으로 구성되어 있어 실적 시즌이나 정책 변화에 민감하게 반응합니다. 특히 **바이오 섹터**의 임상 결과, **IT 섹터**의 수주 소식, **2차전지 섹터**의 원자재 가격 변동 등이 개별 종목에 큰 영향을 미칩니다.\n\n중소형주 투자 시에는 다음 사항을 꼼꼼히 확인하세요:\n\n1. **거래량 추이**: 거래량이 급증하는 종목은 단기 이슈가 있을 수 있습니다\n2. **재무 건전성**: 부채비율, 영업이익률 등 기본적인 재무 지표를 확인하세요\n3. **대주주 지분율**: 대주주 지분 변동(매각/취득)은 중요한 시그널입니다\n4. **업종 동향**: 개별 종목보다 업종 전체 흐름을 먼저 파악하세요\n\n코스닥은 코스피 대비 **유동성 리스크**가 크므로, 포지션 사이징에 더욱 신중할 필요가 있습니다.\n\n---\n\n### 관련 정보\n\n- [카더라 **실시간 주식 시세** →](/stock)\n- [**코스닥 종목 토론** →](/feed?category=stock)\n- [**관심 종목 알림** 받기 →](/login)\n\n카더라에서 매일 업데이트되는 코스닥 시세를 확인하고, 커뮤니티에서 다른 투자자들의 의견도 들어보세요.\n\n> 투자 권유가 아니며 참고용입니다. 모든 투자 판단과 손익은 투자자 본인에게 귀속됩니다.`,
      // 급등락
      `## 오늘의 급등/급락 종목 TOP 5 (${today})\n\n${today} 주식 시장에서 **등락률이 가장 큰 종목** 5개를 정리했습니다. 급등·급락 종목은 단기 이슈나 수급 변화에 의한 것이 많으므로, 투자 시 원인 분석이 필수입니다.\n\n---\n\n### 등락률 TOP 5\n\n| 순위 | 종목 | 등락률 |\n|---|---|---|\n${movers.map((s, i) => `| ${i + 1} | [**${s.name}**](/stock/${s.symbol}) | ${(s.change_pct ?? 0) > 0 ? '▲' : '▼'} **${Math.abs(s.change_pct ?? 0).toFixed(2)}%** |`).join('\n')}\n\n---\n\n### 급등락 분석 포인트\n\n급등 종목은 **실적 서프라이즈, 대규모 수주, 정책 수혜** 등의 호재가 있을 수 있고, 급락 종목은 **실적 미달, 대주주 지분 매각, 업종 하락** 등의 악재가 반영된 경우가 많습니다.\n\n단기 급등주에 추격 매수하기보다는, 변동 원인을 확인한 후 중장기 관점에서 접근하는 것이 바람직합니다.\n\n---\n\n- [종목 상세 보기 →](/stock/${movers[0]?.symbol ?? ''})\n- [주식 토론 →](/feed?category=stock)\n- [관심 종목 **알림** 받기 →](/login)\n\n> 투자 권유가 아니며 참고용입니다.`,
      // 섹터 (1500자+)
      `## 섹터별 대표 종목 동향 — ${today} 업종 분석\n\n${today} 기준 **섹터별 대표 종목**의 시세 동향을 정리했습니다. 섹터(업종) 흐름은 개별 종목을 선정할 때 가장 먼저 확인해야 할 중요한 분석 요소입니다. 같은 업종 내에서도 기업별 실적 차이에 따라 주가 움직임이 크게 다를 수 있으므로, 섹터 전체 방향과 개별 종목의 차별화를 함께 봐야 합니다.\n\n오늘 시장에서는 코스피 시총 상위 종목들을 중심으로 다양한 섹터의 흐름이 엇갈렸습니다. 아래에서 주요 종목별 현재가와 등락률을 확인해보세요.\n\n---\n\n### 주요 종목 현황\n\n| 종목 | 현재가 | 등락률 |\n|---|---|---|\n${kospi.slice(0, 10).map(s => `| [**${s.name}**](/stock/${s.symbol}) | ${s.price?.toLocaleString()}원 | ${(s.change_pct ?? 0) > 0 ? '▲' : '▼'} ${Math.abs(s.change_pct ?? 0).toFixed(2)}% |`).join('\n')}\n\n---\n\n### 업종별 분석 포인트\n\n**반도체 섹터**: 글로벌 AI 수요 확대에 따라 메모리·파운드리 업종의 실적 개선 기대가 유지되고 있습니다. 다만 재고 사이클과 가격 동향을 지속 모니터링할 필요가 있습니다.\n\n**2차전지 섹터**: 전기차 판매량과 배터리 소재 가격이 주가에 직접 영향을 미칩니다. 양극재, 음극재, 전해질 등 밸류체인 전반의 흐름을 함께 살펴보세요.\n\n**바이오 섹터**: 임상 결과 발표, FDA 승인 일정 등 이벤트 드리븐 성격이 강합니다. 중장기 투자 관점에서 파이프라인의 가치를 평가하는 것이 중요합니다.\n\n---\n\n### 관련 정보\n\n- [카더라 **전체 시세** →](/stock)\n- [섹터별 **토론** →](/feed?category=stock)\n- [**관심 종목 알림** 받기 →](/login)\n\n카더라에서 매일 섹터별 동향을 확인하고, 투자 판단에 참고하세요.\n\n> 투자 권유가 아니며 참고용입니다. 모든 투자 판단과 손익은 투자자 본인에게 귀속됩니다.`,
      // 미국주식 (1500자+)
      `## 미국 증시 마감 요약 — ${today} NYSE·NASDAQ 동향\n\n${today} 기준 **미국 증시** 주요 종목의 마감 시세를 정리했습니다. 미국 시장의 흐름은 다음 날 **국내 증시 개장가**에 직접적인 영향을 미치므로, 해외 투자자뿐 아니라 국내 투자자도 반드시 확인해야 할 지표입니다.\n\n미국 시장은 **뉴욕증권거래소(NYSE)**와 **나스닥(NASDAQ)**으로 나뉘며, 최근에는 AI·반도체·빅테크 종목의 비중이 시장 전체 방향을 좌우하고 있습니다.\n\n---\n\n### 미국 주요 종목 시세\n\n| 종목 | 가격 | 등락률 |\n|---|---|---|\n${(stocks ?? []).filter(s => s.market === 'NYSE' || s.market === 'NASDAQ').slice(0, 10).map(s => `| [**${s.name}**](/stock/${s.symbol}) | $${s.price?.toLocaleString()} | ${(s.change_pct ?? 0) > 0 ? '▲' : '▼'} ${Math.abs(s.change_pct ?? 0).toFixed(2)}% |`).join('\n')}\n\n---\n\n### 미국 시장 분석\n\n**매크로 환경**: 미국 **연준(Fed)**의 금리 정책, **고용 지표**(비농업 고용, 실업률), **CPI**(소비자물가지수) 등이 시장 방향을 좌우합니다. 금리 인하 기대가 높아지면 성장주(테크)가 강세를 보이고, 인플레이션 우려가 커지면 가치주와 방어주가 선호됩니다.\n\n**빅테크 실적**: 애플, 마이크로소프트, 엔비디아, 아마존, 메타 등 **매그니피센트 7** 종목의 실적 시즌에는 나스닥 변동성이 특히 확대됩니다. 이들의 실적은 한국 반도체·IT 섹터에도 직접적인 영향을 줍니다.\n\n**환율 리스크**: 해외 주식 투자 시 **원/달러 환율** 변동도 수익률에 큰 영향을 미칩니다. 환율이 상승(원화 약세)하면 해외 자산의 원화 환산 가치가 올라가고, 환율이 하락하면 반대입니다.\n\n---\n\n### 관련 정보\n\n- [카더라 **해외 종목** 시세 →](/stock)\n- [해외주식 **토론** →](/feed?category=stock)\n- [**종목 알림** 받기 →](/login)\n- [카더라 **블로그**에서 더 보기 →](/blog?category=stock)\n\n카더라에서 매일 업데이트되는 미국 증시 요약을 확인하고, 국내 시장에 미칠 영향을 미리 파악하세요.\n\n> 투자 권유가 아니며 참고용입니다. 모든 투자 판단과 손익은 투자자 본인에게 귀속됩니다.`,
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
      const dirArrow = (s.change_pct ?? 0) > 0 ? '▲' : '▼';
      const absPct = Math.abs(s.change_pct ?? 0).toFixed(2);
      const stockTitle = `${s.name} ${dir} ${Math.abs(s.change_pct ?? 0).toFixed(1)}% — ${today} 시세·분석·전망`;
      const stockContent = `## ${s.name} (${s.symbol}) ${dir} ${absPct}% — ${today}

${today} **${s.name}**(${s.symbol})이 전일 대비 **${dirArrow} ${absPct}%** ${dir}하며 시장의 주목을 받고 있습니다. 현재가는 **${s.price?.toLocaleString()}${s.market === 'NYSE' || s.market === 'NASDAQ' ? '달러' : '원'}**입니다.

${(s.change_pct ?? 0) > 0 ? `이번 상승은 실적 개선 기대감, 업종 전반의 호조, 또는 수급 변화 등 복합적인 요인이 작용한 것으로 보입니다. 다만, 단기 급등 후에는 차익 실현 매물이 나올 수 있으므로 주의가 필요합니다.` : `하락의 원인으로는 실적 우려, 업종 하락, 대외 변수 등이 거론되고 있습니다. 단기 낙폭이 큰 만큼 반등 가능성도 열려 있지만, 추가 하락 리스크도 함께 고려해야 합니다.`}

---

### 종목 정보

| 항목 | 내용 |
|---|---|
| **종목명** | ${s.name} (${s.symbol}) |
| **현재가** | ${s.price?.toLocaleString()} |
| **등락률** | ${dirArrow} **${absPct}%** |
| **시장** | ${s.market} |

---

### 분석 포인트

1. **${dir} 원인 분석**: ${(s.change_pct ?? 0) > 0 ? '호재성 뉴스, 기관/외국인 매수세, 업종 모멘텀 등을 확인하세요.' : '악재 뉴스, 기관 매도, 업종 약세 등의 원인을 파악하세요.'}

2. **섹터 동향**: **${s.name}**이 속한 ${s.market} 시장의 동종 업종 흐름도 함께 살펴보는 것이 중요합니다. 개별 종목의 움직임이 섹터 전체 흐름인지, 개별 이슈인지 구분하세요.

3. **최근 추세**: 단일 거래일의 급등락보다 **최근 5일~1개월간의 추세**를 함께 확인하는 것이 합리적인 판단에 도움이 됩니다.

---

### 관련 정보

- [**${s.name}** 종목 상세 시세 →](/stock/${s.symbol})
- [주식 **커뮤니티 토론** →](/feed?category=stock)
- [**전체 시세** 보기 →](/stock)
- [**종목 알림** 받기 →](/login)

카더라에서 ${s.name}의 시세와 커뮤니티 반응을 실시간으로 확인해보세요.

> 투자 권유가 아니며 참고용입니다. 모든 투자 판단과 손익은 투자자 본인에게 귀속됩니다.`;
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
