import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * 부실 블로그 글 DB 데이터 기반 재작성 (AI 크레딧 불필요)
 * 
 * 패턴별 처리:
 * 1. 주가 전망 (stock, 650건) — stock_quotes + stock_price_history 데이터 활용
 * 2. 배당 분석 (stock, 286건) — stock_quotes 데이터 활용
 * 3. 시공사 목록 (apt, 176건) — apt_subscriptions 데이터 활용
 * 4. 역세권 추천 (apt, 183건) — apt_sites 데이터 활용
 * 5. 섹터 가이드 (stock, 17건) — stock_quotes 섹터별 데이터
 * 6. 기타 부동산 (apt, 272건) — apt_sites/apt_subscriptions 활용
 * 
 * 호출: POST /api/admin/blog-enrich?limit=20
 */

function fmtAmount(n: number): string {
  if (!n || n === 0) return '-';
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (n >= 1e8) return `${Math.round(n / 1e8).toLocaleString()}억`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}만`;
  return n.toLocaleString();
}

function fmtPrice(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
}

async function enrichStockPost(admin: any, post: any): Promise<string | null> {
  // 제목에서 종목명 추출
  const nameMatch = post.title.match(/^(.+?)\s*(주가|배당|전망|분석)/);
  if (!nameMatch) return null;
  const stockName = nameMatch[1].trim();

  const { data: stock } = await admin.from('stock_quotes')
    .select('symbol, name, market, price, change_pct, change_amt, volume, market_cap, sector, description')
    .ilike('name', `%${stockName}%`).limit(1).single();

  if (!stock) return null;

  const { data: history } = await admin.from('stock_price_history')
    .select('date, close_price, volume, change_pct')
    .eq('symbol', stock.symbol)
    .order('date', { ascending: false }).limit(30);

  const prices = (history || []).map((h: any) => Number(h.close_price)).filter(Boolean);
  const high30 = prices.length ? Math.max(...prices) : 0;
  const low30 = prices.length ? Math.min(...prices) : 0;
  const avg30 = prices.length ? Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length) : 0;
  const vol30 = (history || []).map((h: any) => Number(h.volume || 0));
  const avgVol = vol30.length ? Math.round(vol30.reduce((a: number, b: number) => a + b, 0) / vol30.length) : 0;

  const price = Number(stock.price);
  const changePct = Number(stock.change_pct || 0);
  const mktCap = Number(stock.market_cap || 0);
  const isUp = changePct > 0;

  const isDividend = post.title.includes('배당');

  if (isDividend) {
    return `## ${stock.name} (${stock.symbol}) 배당 분석 2026

### 기업 개요

${stock.name}은(는) ${stock.market} 시장에 상장된 ${stock.sector || '기업'}입니다. ${stock.description ? stock.description.slice(0, 200) : `현재 주가는 ${price.toLocaleString()}원이며, 시가총액은 ${fmtAmount(mktCap)}원 규모입니다.`}

현재 주가 **${price.toLocaleString()}원**, 시가총액 **${fmtAmount(mktCap)}원**으로 ${stock.sector || stock.market} 시장에서 활발하게 거래되고 있습니다.

### 최근 30일 주가 동향

최근 한 달간 ${stock.name}의 주가는 **최저 ${low30.toLocaleString()}원 ~ 최고 ${high30.toLocaleString()}원** 사이에서 움직였습니다. 30일 평균 주가는 **${avg30.toLocaleString()}원**이며, 현재가 대비 ${price > avg30 ? `${((price / avg30 - 1) * 100).toFixed(1)}% 높은` : `${((1 - price / avg30) * 100).toFixed(1)}% 낮은`} 수준입니다.

일평균 거래량은 **${avgVol.toLocaleString()}주**로, ${avgVol > 100000 ? '활발한 거래가 이루어지고 있어 유동성 측면에서 안정적입니다.' : '거래량이 다소 적은 편이므로 매매 시 호가 스프레드에 주의가 필요합니다.'}

### 배당 투자 관점

배당주 투자는 꾸준한 현금흐름을 기대할 수 있다는 점에서 매력적입니다. 특히 ${stock.name}처럼 ${stock.sector || '해당 업종'} 분야의 기업은 사업 안정성을 기반으로 지속적인 배당이 가능합니다.

배당 투자 시 고려해야 할 핵심 지표:

- **배당수익률**: 주가 대비 연간 배당금의 비율. 일반적으로 은행 예금 금리보다 높으면 매력적으로 평가합니다.
- **배당성향**: 당기순이익 대비 배당금 비율. 30~50%가 적정선으로, 너무 높으면 지속 가능성이 떨어질 수 있습니다.
- **배당 지속성**: 최근 5년간 꾸준히 배당을 지급했는지 확인하세요. 무배당 전환 이력이 있다면 주의가 필요합니다.

### 투자 시 유의사항

${stock.name}에 투자를 고려하신다면 다음 사항을 반드시 확인하세요.

1. **실적 추이**: 매출액과 영업이익이 꾸준히 성장하고 있는지 확인하세요. 배당의 원천은 결국 기업 실적입니다.
2. **부채비율**: 부채비율이 과도하게 높은 기업은 경기 침체 시 배당 삭감 위험이 있습니다.
3. **업종 전망**: ${stock.sector || '해당'} 섹터의 전반적인 시장 전망과 경쟁 환경을 파악하세요.
4. **환율 영향**: ${stock.market === 'NYSE' || stock.market === 'NASDAQ' ? '해외 주식이므로 원/달러 환율 변동이 실질 수익에 영향을 미칩니다.' : '원자재 수입 비중이 높은 기업이라면 환율 변동에 민감할 수 있습니다.'}

### 카더라에서 더 알아보기

[${stock.name} 실시간 시세 →](/stock/${stock.symbol})에서 일간·주간·월간 차트와 투자자별 수급 데이터를 확인할 수 있습니다. 관심 종목으로 등록하면 시세 변동 알림도 받을 수 있습니다.

---

> ⚠️ 본 글은 투자 권유가 아니며, 투자의 책임은 본인에게 있습니다. 투자 결정 전 반드시 다양한 정보를 확인하세요.`;
  }

  // 주가 전망
  return `## ${stock.name} (${stock.symbol}) 주가 분석 및 전망 2026

### 기업 개요

${stock.name}은(는) ${stock.market} 시장에 상장된 ${stock.sector || '기업'}입니다. ${stock.description ? stock.description.slice(0, 200) : `현재 주가는 ${price.toLocaleString()}원이며, 시가총액은 ${fmtAmount(mktCap)}원 규모입니다.`}

| 항목 | 수치 |
|------|------|
| 현재가 | ${price.toLocaleString()}원 |
| 전일대비 | ${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}% |
| 시가총액 | ${fmtAmount(mktCap)}원 |
| 섹터 | ${stock.sector || '-'} |
| 시장 | ${stock.market} |

### 최근 30일 주가 추이

최근 한 달간 **${stock.name}**의 주가는 **${low30.toLocaleString()}원(최저) ~ ${high30.toLocaleString()}원(최고)** 구간에서 움직였습니다.

- 30일 평균가: **${avg30.toLocaleString()}원**
- 현재가 대비: ${price > avg30 ? `평균보다 **${((price / avg30 - 1) * 100).toFixed(1)}% 높은** 수준` : `평균보다 **${((1 - price / avg30) * 100).toFixed(1)}% 낮은** 수준`}
- 30일 변동폭: **${high30 > 0 ? ((high30 - low30) / low30 * 100).toFixed(1) : 0}%**
- 일평균 거래량: **${avgVol.toLocaleString()}주**

${high30 - low30 > avg30 * 0.2 ? '최근 한 달간 변동성이 높은 편으로, 단기 매매 시 리스크 관리에 주의가 필요합니다.' : '비교적 안정적인 흐름을 보이고 있어 중장기 투자자에게 유리한 환경입니다.'}

### 핵심 투자 포인트

**${stock.name}** 투자 시 주목해야 할 핵심 요소:

1. **시가총액 ${fmtAmount(mktCap)}원**: ${mktCap > 1e13 ? '대형주로 분류되며, 기관투자자와 외국인의 관심이 높습니다. 변동성이 상대적으로 낮아 안정적인 투자가 가능합니다.' : mktCap > 5e11 ? '중형주로 성장성과 안정성을 동시에 갖추고 있습니다.' : '소형주로 높은 성장 잠재력이 있지만, 변동성도 클 수 있습니다.'}

2. **섹터 위치**: ${stock.sector || stock.market} 분야는 ${isUp ? '최근 긍정적인 모멘텀을 받고 있어' : '시장 전반의 조정 속에서'} 투자자들의 관심이 ${isUp ? '높아지고' : '변화하고'} 있습니다.

3. **거래량 분석**: 일평균 거래량 ${avgVol.toLocaleString()}주는 ${avgVol > 500000 ? '매우 활발한 수준으로, 대규모 매매에도 유동성 문제가 없습니다.' : avgVol > 50000 ? '적절한 수준이며, 일반 개인투자자의 매매에는 충분합니다.' : '다소 적은 편이므로 대량 매매 시 슬리피지(체결가 차이)에 유의하세요.'}

### 리스크 요인

모든 투자에는 리스크가 따릅니다. ${stock.name} 투자 전 다음 요인들을 고려하세요:

- **시장 리스크**: 글로벌 경기 변동, 금리 정책 변화, 환율 변동이 주가에 영향을 미칠 수 있습니다.
- **업종 리스크**: ${stock.sector || '해당 업종'}의 경쟁 심화, 규제 변화, 기술 변화에 따른 리스크를 점검하세요.
- **개별 리스크**: 실적 미달, 경영 이슈, 대주주 변동 등 기업 고유의 리스크를 확인하세요.

### 투자 전략 제안

| 투자 성향 | 전략 |
|----------|------|
| 단기 (1~3개월) | ${price < avg30 ? '현재 30일 평균 이하이므로 기술적 반등을 노린 매수 전략 고려' : '고점 부담이 있으므로 조정 시 분할 매수 검토'} |
| 중기 (3~12개월) | 분기 실적과 섹터 모멘텀을 확인하며 포지션 관리 |
| 장기 (1년 이상) | 기업의 펀더멘털과 산업 성장성에 기반한 장기 보유 전략 |

### 카더라에서 더 알아보기

[${stock.name} 실시간 시세 →](/stock/${stock.symbol})에서 일간·주간·월간 차트, 투자자별 수급 데이터, 52주 신고가/신저가 정보를 확인할 수 있습니다.

---

> ⚠️ 본 글은 투자 권유가 아닌 정보 제공 목적이며, 모든 투자 판단과 손익은 투자자 본인에게 귀속됩니다.`;
}

async function enrichAptPost(admin: any, post: any): Promise<string | null> {
  // 제목에서 지역/시공사 추출
  const isBuilder = post.title.includes('시공 아파트');
  const isStation = post.title.includes('역세권');
  
  if (isBuilder) {
    const builderMatch = post.title.match(/^(.+?)\s*시공/);
    const builder = builderMatch?.[1]?.trim();
    if (!builder) return null;

    const { data: subs } = await admin.from('apt_subscriptions')
      .select('house_nm, region_nm, tot_supply_hshld_co, mvn_prearnge_ym, total_households, house_type_info')
      .ilike('constructor_nm', `%${builder}%`)
      .order('rcept_bgnde', { ascending: false }).limit(10);

    const sites = subs || [];
    const totalUnits = sites.reduce((s: number, r: any) => s + (r.total_households || r.tot_supply_hshld_co || 0), 0);
    const regions = [...new Set(sites.map((s: any) => s.region_nm))];

    return `## ${builder} 시공 아파트 전국 현황 2026

### 시공사 소개

${builder}은(는) 전국 **${sites.length}개 현장**에서 아파트를 시공한 건설사입니다. 총 **${regions.length}개 지역**에 걸쳐 사업을 전개하고 있으며, 누적 시공 세대수는 약 **${totalUnits.toLocaleString()}세대**에 달합니다.

건설사의 시공 실적은 아파트 품질과 입주 후 관리에 직접적인 영향을 미치므로, 청약 및 매수를 고려할 때 중요한 판단 기준이 됩니다.

### 전국 시공 현장 목록

${sites.map((s: any, i: number) => {
  const hti = Array.isArray(s.house_type_info) ? s.house_type_info : [];
  const prices = hti.map((t: any) => t.lttot_top_amount).filter((p: number) => p > 0);
  const pMin = prices.length ? Math.min(...prices) : 0;
  const pMax = prices.length ? Math.max(...prices) : 0;
  return `**${i + 1}. ${s.house_nm}** (${s.region_nm})
- 총세대수: ${(s.total_households || s.tot_supply_hshld_co || 0).toLocaleString()}세대
- 입주예정: ${s.mvn_prearnge_ym ? `${s.mvn_prearnge_ym.slice(0, 4)}년 ${parseInt(s.mvn_prearnge_ym.slice(4, 6))}월` : '미정'}
${pMax > 0 ? `- 분양가: ${fmtPrice(pMin)}~${fmtPrice(pMax)}` : ''}`;
}).join('\n\n')}

### 지역별 분포

${regions.map(r => {
  const cnt = sites.filter((s: any) => s.region_nm === r).length;
  const units = sites.filter((s: any) => s.region_nm === r).reduce((sum: number, s: any) => sum + (s.total_households || s.tot_supply_hshld_co || 0), 0);
  return `- **${r}**: ${cnt}개 현장, ${units.toLocaleString()}세대`;
}).join('\n')}

### ${builder} 선택 시 체크포인트

1. **시공 품질**: 기존 입주 단지의 하자 보수 이력과 입주민 평가를 확인하세요. 국토교통부 하자심사분쟁조정위원회 자료가 참고됩니다.
2. **A/S 대응**: 입주 후 하자 보수 대응 속도와 품질이 실제 거주 만족도에 큰 영향을 미칩니다.
3. **브랜드 가치**: 시공사 브랜드에 따라 향후 매매 시 프리미엄이 달라질 수 있습니다. 1군 건설사의 경우 평균 5~10% 높은 시세를 형성합니다.
4. **재무 안정성**: 시공사의 재무 상태가 불안정하면 공사 지연이나 품질 저하 위험이 있습니다.

### 카더라에서 더 알아보기

카더라에서는 **2,695개 청약 현장**의 시공사 정보, 분양가, 일정을 한눈에 비교할 수 있습니다. [청약 정보 보기 →](/apt)

---

> ⚠️ 본 글은 정보 제공 목적이며, 특정 건설사를 추천하거나 비방하는 내용이 아닙니다. 투자 판단은 본인 책임입니다.`;
  }

  if (isStation) {
    const regionMatch = post.title.match(/^(.+?)\s*역세권/);
    const region = regionMatch?.[1]?.trim();
    if (!region) return null;

    const { data: sites } = await admin.from('apt_sites')
      .select('name, region, sigungu, total_units, price_min, price_max, move_in_date, nearby_station')
      .or(`region.ilike.%${region}%,sigungu.ilike.%${region}%`)
      .eq('is_active', true)
      .not('nearby_station', 'is', null)
      .order('price_max', { ascending: false }).limit(15);

    const stationSites = sites || [];

    return `## ${region} 역세권 아파트 추천 2026

### 역세권 아파트란?

역세권 아파트는 지하철역에서 **도보 10분(약 500m) 이내**에 위치한 아파트를 말합니다. 역세권 아파트는 다음과 같은 장점이 있습니다:

- **교통 편의성**: 출퇴근 시간 절약, 대중교통 의존도 낮춤
- **시세 프리미엄**: 비역세권 대비 평균 10~20% 높은 매매가
- **임대 수요**: 교통 편의로 전세·월세 수요가 안정적
- **향후 가치**: 신규 노선 개통 시 추가 상승 기대

### ${region} 지역 역세권 아파트 현황

${region} 지역에는 총 **${stationSites.length}개** 역세권 아파트 현장이 등록되어 있습니다.

${stationSites.slice(0, 10).map((s: any, i: number) => `**${i + 1}. ${s.name}** (${s.sigungu || s.region})
- 총세대수: ${(s.total_units || 0).toLocaleString()}세대
- 인근역: ${s.nearby_station || '확인 중'}
${s.price_min || s.price_max ? `- 시세: ${s.price_min ? fmtPrice(s.price_min) : ''}${s.price_min && s.price_max ? ' ~ ' : ''}${s.price_max ? fmtPrice(s.price_max) : ''}` : ''}
${s.move_in_date ? `- 입주: ${s.move_in_date.slice(0, 4)}년 ${parseInt(s.move_in_date.slice(4, 6))}월` : ''}`).join('\n\n')}

### 역세권 아파트 선택 시 체크리스트

1. **실제 도보 거리**: 네이버 지도나 카카오맵으로 실제 도보 시간을 확인하세요. 직선거리와 실제 거리는 차이가 있을 수 있습니다.
2. **노선 확인**: 환승역 여부, 급행 정차 여부에 따라 편의성이 크게 달라집니다.
3. **출구 위치**: 역 출구와 아파트 동 사이의 거리도 중요합니다. 가장 먼 동은 역세권이 아닐 수 있습니다.
4. **소음 문제**: 지하철 선로와 너무 가까우면 소음·진동 문제가 있을 수 있으므로, 저층보다 중·고층을 추천합니다.
5. **주변 개발**: GTX, 신규 지하철 노선 등 교통 호재가 예정된 지역은 장기적으로 가치 상승이 기대됩니다.

### 카더라에서 더 알아보기

카더라에서는 전국 **34,500개 아파트 단지**의 위치, 시세, 교통 정보를 한눈에 비교할 수 있습니다. [아파트 시세 보기 →](/apt/complex)

---

> ⚠️ 본 글은 정보 제공 목적이며, 특정 아파트를 추천하는 내용이 아닙니다. 투자 판단은 본인 책임입니다.`;
  }

  return null;
}

async function enrichSectorGuide(admin: any, post: any): Promise<string | null> {
  const sectorMatch = post.title.match(/^(.+?)\s*관련주/);
  const sector = sectorMatch?.[1]?.trim();
  if (!sector) return null;

  const { data: stocks } = await admin.from('stock_quotes')
    .select('symbol, name, market, price, change_pct, market_cap, sector, description')
    .ilike('sector', `%${sector}%`)
    .order('market_cap', { ascending: false }).limit(10);

  const list = stocks || [];
  const totalCap = list.reduce((s: number, st: any) => s + Number(st.market_cap || 0), 0);
  const avgPct = list.length ? list.reduce((s: number, st: any) => s + Number(st.change_pct || 0), 0) / list.length : 0;

  return `## ${sector} 관련주 완전 가이드 2026

### ${sector} 섹터 개요

${sector} 섹터에는 현재 **${list.length}개 종목**이 등록되어 있습니다. 합산 시가총액은 약 **${fmtAmount(totalCap)}원**, 섹터 평균 등락률은 **${avgPct > 0 ? '+' : ''}${avgPct.toFixed(2)}%**입니다.

${sector} 섹터는 ${avgPct > 1 ? '최근 강한 상승 모멘텀을 보이고 있어 투자자들의 관심이 집중되고 있습니다.' : avgPct > 0 ? '안정적인 흐름을 유지하고 있으며, 중장기 관점에서 긍정적인 시그널이 나타나고 있습니다.' : '조정 국면에 있으나, 밸류에이션 매력이 부각되고 있는 시점입니다.'}

### 시가총액 상위 종목

| 순위 | 종목명 | 시장 | 현재가 | 등락률 | 시가총액 |
|:---:|--------|:---:|------:|------:|-------:|
${list.map((s: any, i: number) => `| ${i + 1} | ${s.name} | ${s.market} | ${Number(s.price).toLocaleString()}원 | ${Number(s.change_pct) > 0 ? '+' : ''}${Number(s.change_pct).toFixed(1)}% | ${fmtAmount(Number(s.market_cap))} |`).join('\n')}

### 주요 종목 분석

${list.slice(0, 3).map((s: any) => `**${s.name} (${s.symbol})**
${s.description ? s.description.slice(0, 150) + '...' : `${s.market} 상장. 현재가 ${Number(s.price).toLocaleString()}원, 시가총액 ${fmtAmount(Number(s.market_cap))}원.`}
[실시간 시세 보기 →](/stock/${s.symbol})`).join('\n\n')}

### ${sector} 섹터 투자 전략

1. **분산 투자**: 섹터 내에서도 대형주와 중소형주를 섞어 포트폴리오를 구성하세요. 대형주는 안정성을, 중소형주는 성장성을 제공합니다.
2. **실적 모니터링**: 분기 실적 발표 전후로 주가 변동이 커질 수 있습니다. 어닝 서프라이즈(실적 초과)가 예상되는 종목에 주목하세요.
3. **섹터 로테이션**: 경기 사이클에 따라 유망 섹터가 바뀝니다. ${sector} 섹터의 현재 위치를 파악하고 타이밍을 조율하세요.
4. **ETF 활용**: 개별 종목 리스크를 줄이려면 ${sector} 관련 ETF를 활용하는 것도 좋은 방법입니다.

### 리스크 요인

- **규제 리스크**: 정부 정책 변화가 ${sector} 섹터에 미치는 영향을 주시하세요.
- **글로벌 경쟁**: 해외 경쟁사와의 기술 격차, 가격 경쟁력을 확인하세요.
- **원자재 가격**: 원자재 가격 변동이 마진에 미치는 영향을 고려하세요.

### 카더라에서 더 알아보기

[${sector} 섹터 전체 보기 →](/stock?sector=${encodeURIComponent(sector)})에서 실시간 시세, 수급 데이터, 섹터 히트맵을 확인할 수 있습니다.

---

> ⚠️ 본 글은 투자 권유가 아닌 정보 제공 목적이며, 모든 투자 판단과 손익은 투자자 본인에게 귀속됩니다.`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const admin = auth.admin;

  const limit = parseInt(new URL(req.url).searchParams.get('limit') || '20');
  const _ = getSupabaseAdmin();

  const { data: thinPosts } = await (admin as any).rpc('get_thin_blog_posts', { max_len: 800, lim: limit });

  let enriched = 0;
  let failed = 0;

  for (const post of thinPosts) {
    try {
      let newContent: string | null = null;

      if (post.title.includes('관련주 완전 가이드')) {
        newContent = await enrichSectorGuide(admin, post);
      } else if (post.category === 'stock') {
        newContent = await enrichStockPost(admin, post);
      } else if (post.category === 'apt') {
        newContent = await enrichAptPost(admin, post);
      }

      if (newContent && newContent.length >= 1500) {
        const clean = newContent.replace(/[#|*\n\r\-\[\]\(\)/]/g, ' ').replace(/\s+/g, ' ').trim();
        await admin.from('blog_posts').update({
          content: newContent,
          meta_description: clean.slice(0, 120) + ' — 카더라',
          excerpt: clean.slice(0, 150),
          updated_at: new Date().toISOString(),
        }).eq('id', post.id);
        enriched++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    processed: thinPosts.length,
    enriched,
    failed,
    remaining: 1628 - enriched, // approximate
  });
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  return POST(req);
}
