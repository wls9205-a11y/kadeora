import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { safeBlogInsert } from '@/lib/blog-safe-insert';

export const maxDuration = 120;

/**
 * 월간 시황 리포트 자동 생성 크론
 * 매월 2일 07:00 실행 (vercel.json)
 * 주요 시군구별 전월 거래 동향을 블로그로 자동 발행
 */
export async function GET() {
  const result = await withCronLogging('monthly-market-report', async () => {
    const sb = getSupabaseAdmin();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed, 전월
    const prevMonth = month === 0 ? 12 : month;
    const prevYear = month === 0 ? year - 1 : year;
    const monthLabel = `${prevYear}년 ${prevMonth}월`;

    // 거래 활발한 상위 20개 시군구
    const { data: topSigungu } = await (sb as any).from('apt_complex_profiles')
      .select('region_nm, sigungu')
      .not('age_group', 'is', null).not('sigungu', 'is', null)
      .gt('sale_count_1y', 0)
      .order('sale_count_1y', { ascending: false }).limit(2000);

    const sgMap = new Map<string, number>();
    for (const r of (topSigungu || [])) {
      const k = `${r.region_nm}|${r.sigungu}`;
      sgMap.set(k, (sgMap.get(k) || 0) + 1);
    }
    const topAreas = Array.from(sgMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    let created = 0;
    for (const [key] of topAreas) {
      const [region, sigungu] = key.split('|');
      if (!region || !sigungu) continue;

      // 이미 이번 달 리포트 있는지 확인
      const slug = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${region}-${sigungu}-시황`.replace(/\s+/g, '-');
      const { data: existing } = await sb.from('blog_posts')
        .select('id').eq('slug', slug).maybeSingle();
      if (existing) continue;

      // 시군구 데이터 집계
      const { data: profiles } = await (sb as any).from('apt_complex_profiles')
        .select('apt_name, latest_sale_price, latest_jeonse_price, jeonse_ratio, sale_count_1y, age_group, price_change_1y')
        .eq('region_nm', region).eq('sigungu', sigungu)
        .not('age_group', 'is', null).gt('latest_sale_price', 0)
        .order('sale_count_1y', { ascending: false }).limit(500);

      if (!profiles || profiles.length < 10) continue;

      const avgPrice = Math.round(profiles.reduce((s: number, p: any) => s + p.latest_sale_price, 0) / profiles.length);
      const withJR = profiles.filter((p: any) => p.jeonse_ratio > 0);
      const avgJR = withJR.length > 0 ? Math.round(withJR.reduce((s: number, p: any) => s + Number(p.jeonse_ratio), 0) / withJR.length * 10) / 10 : 0;
      const totalTrades = profiles.reduce((s: number, p: any) => s + (p.sale_count_1y || 0), 0);
      const withPC = profiles.filter((p: any) => p.price_change_1y != null);
      const avgPC = withPC.length > 0 ? Math.round(withPC.reduce((s: number, p: any) => s + Number(p.price_change_1y), 0) / withPC.length * 10) / 10 : 0;
      const newBuilt = profiles.filter((p: any) => p.age_group === '신축').length;
      const top3 = profiles.slice(0, 3);

      const fmtAmt = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}억` : `${v.toLocaleString()}만`;
      const title = `${monthLabel} ${sigungu} 아파트 시장 동향 — 평균 ${fmtAmt(avgPrice)}, 거래 ${totalTrades}건`;

      const body = `# ${monthLabel} ${region} ${sigungu} 아파트 시장 동향

## 핵심 요약

${region} ${sigungu}의 ${monthLabel} 아파트 시장을 분석합니다. 총 ${profiles.length}개 단지, 평균 매매가 ${fmtAmt(avgPrice)}, 전세가율 ${avgJR}%, 최근 1년 거래 ${totalTrades.toLocaleString()}건입니다.${avgPC !== 0 ? ` 1년 평균 가격 변동률은 ${avgPC > 0 ? '+' : ''}${avgPC}%입니다.` : ''}

## 가격 동향

${sigungu} 아파트의 평균 매매가는 **${fmtAmt(avgPrice)}**입니다.${avgPC > 0 ? ` 전년 대비 ${avgPC}% 상승하며 상승세를 이어가고 있습니다.` : avgPC < 0 ? ` 전년 대비 ${Math.abs(avgPC)}% 하락하며 조정 국면에 있습니다.` : ''}

평균 전세가율은 **${avgJR}%**로, ${avgJR > 70 ? '갭투자 위험이 높은 수준입니다. 역전세 리스크에 주의가 필요합니다.' : avgJR > 55 ? '보통 수준입니다.' : avgJR > 0 ? '안정적인 수준으로, 매매 대비 전세가 저렴한 편입니다.' : '데이터가 부족합니다.'}

## 거래량

최근 1년간 매매 거래는 총 **${totalTrades.toLocaleString()}건**으로, ${totalTrades > 500 ? '활발한 거래가 이루어지고 있습니다.' : totalTrades > 100 ? '보통 수준의 거래량을 보이고 있습니다.' : '거래가 다소 침체된 모습입니다.'}

## 주요 단지

${top3.map((p: any, i: number) => `${i + 1}. **${p.apt_name}** — 매매가 ${fmtAmt(p.latest_sale_price)}${p.jeonse_ratio ? `, 전세가율 ${p.jeonse_ratio}%` : ''}${p.price_change_1y ? `, 변동률 ${Number(p.price_change_1y) > 0 ? '+' : ''}${p.price_change_1y}%` : ''}`).join('\n')}

## 단지 구성

- 전체 단지: ${profiles.length}개
- 신축(5년 이내): ${newBuilt}개 (${Math.round(newBuilt / profiles.length * 100)}%)
- 시세 보유: ${profiles.length}개

## 투자 참고

${avgJR > 65 ? `${sigungu}의 전세가율이 ${avgJR}%로 높은 편이므로, 갭투자 시 역전세 리스크를 충분히 고려해야 합니다.` : `${sigungu}의 전세가율이 ${avgJR}%로 ${avgJR > 50 ? '적정' : '낮은'} 수준이므로, 실수요 관점에서 매력적인 지역입니다.`}

> 데이터 출처: 국토교통부 실거래가 공개시스템. 본 분석은 투자 권유가 아닙니다. 투자 판단은 투자자 본인의 책임입니다.

---
*${sigungu} 아파트 시세를 더 자세히 보려면 [${sigungu} 단지별 시세 비교](/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)})를 확인하세요.*
`;

      const tags = [region, sigungu, '아파트', '시황', '실거래가', '전세가율', monthLabel];
      const excerpt = `${monthLabel} ${region} ${sigungu} 아파트 시장 동향. 평균 매매가 ${fmtAmt(avgPrice)}, 전세가율 ${avgJR}%, 거래 ${totalTrades}건.`;

      const result = await safeBlogInsert(sb, {
        slug,
        title,
        content: body,
        excerpt,
        category: 'apt',
        tags,
        source_type: 'monthly-report',
        cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(`${monthLabel} ${sigungu} 시황`)}&design=2&subtitle=${encodeURIComponent(`평균 ${fmtAmt(avgPrice)} · 거래 ${totalTrades}건`)}&author=${encodeURIComponent('카더라')}&category=apt`,
        image_alt: `${monthLabel} ${sigungu} 아파트 시장 동향 분석`,
        is_published: true,
      });

      if (result.success) created++;
    }

    return { created, targetAreas: topAreas.length };
  });

  return NextResponse.json({ ok: true, ...result });
}
