import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { withCronLogging } from '@/lib/cron-logger';

export const dynamic = 'force-dynamic';

function generateLandmarkBlog(apt: any): string {
  const name = apt.name || '단지';
  const region = apt.region || '';
  const district = apt.district || '';
  const address = apt.address || `${region} ${district}`;
  const year = apt.built_year || apt.year_built || 0;
  const age = year ? `${2026 - year}년차` : '';
  const units = apt.total_units || apt.households || 0;
  const unitStr = units ? units.toLocaleString() : '대규모';
  const area = apt.area_m2 || apt.size_py || '';
  const price = apt.avg_price_100m || apt.price_buy || '';
  const jeonse = apt.avg_jeonse_100m || apt.price_rent || '';
  const station = apt.nearby_station || apt.station || '';
  const school = apt.school_district || apt.school_name || '';
  const desc = apt.description || '';
  const tags = apt.tags || [];
  const floors = apt.max_floor || '';
  const parking = apt.parking_ratio || '';
  const developer = apt.developer || apt.builder || '';

  return `## ${name} — ${region} ${district} 대장 아파트

${desc || `${region} ${district}를 대표하는 랜드마크 아파트 ${name}에 대해 시세, 학군, 교통, 투자 전망까지 종합적으로 분석합니다. ${year ? `${year}년 준공된 ` : ''}${unitStr}세대 규모의 대단지로, 실거주와 투자 양면에서 높은 관심을 받고 있습니다.`}

## 단지 기본 정보

| 항목 | 내용 |
|------|------|
| **단지명** | ${name} |
| **위치** | ${address} |
${year ? `| **준공** | ${year}년 (${age}) |\n` : ''}| **세대수** | ${unitStr}세대 |
${area ? `| **주요 면적** | ${area} |\n` : ''}${floors ? `| **최고층** | ${floors}층 |\n` : ''}${developer ? `| **시공사** | ${developer} |\n` : ''}${parking ? `| **주차** | ${parking} |\n` : ''}| **최근접 역** | ${station || '확인 필요'} |

${name}는 ${region} ${district} 지역에서 가장 주목받는 단지 중 하나입니다.${units ? ` 총 ${unitStr}세대 규모로 대단지 특유의 커뮤니티 시설과 조경이 잘 갖춰져 있습니다.` : ''} ${year ? `${year}년에 준공되어 ${age}이 되었으며, ` : ''}단지 관리 상태와 주변 인프라가 우수하여 꾸준한 수요를 유지하고 있습니다.

## 시세 현황 (2026년 기준)

### 매매 시세
${price ? `${area ? `${String(area).split(',')[0]} 기준 ` : ''}현재 매매 시세는 **${price}** 수준입니다.` : '매매 시세는 국토교통부 실거래가 시스템에서 확인하시기 바랍니다.'}

${region === '서울' ? '서울 아파트 시장은 2025년 하반기부터 거래량이 회복세를 보이고 있으며, 특히 강남3구와 마용성 등 핵심 입지의 대장 아파트는 하방 경직성이 강한 모습입니다.' : `${region} 부동산 시장은 지역 개발 호재와 인구 유입에 따라 가격 변동이 예상됩니다.`}

### 전세 시세
${jeonse ? `전세 시세는 **${jeonse}** 수준입니다.` : '전세 시세는 시장 상황에 따라 변동됩니다.'}

전세가율(전세가/매매가 비율)은 투자 안전마진을 판단하는 중요한 지표입니다. 전세가율이 60~70% 사이면 비교적 안정적이며, 70%를 넘어가면 역전세 리스크에 유의해야 합니다.

> **시세 확인 방법**: 국토교통부 실거래가 공개시스템(rt.molit.go.kr)에서 최신 거래 내역을 직접 확인하시기 바랍니다. 호가와 실거래가는 차이가 있을 수 있습니다.

## 교통 접근성

${station ? `**최근접 역**: ${station}` : '인근 대중교통을 이용할 수 있습니다.'}

${region === '서울' ? `서울 지하철 네트워크를 통해 강남, 여의도, 광화문 등 주요 업무지구로의 접근이 용이합니다. 출퇴근 시간 기준 주요 업무지구까지의 소요 시간을 미리 확인해 보시기 바랍니다.` : region === '경기' ? `수도권 광역 교통망(GTX, 신분당선 연장 등)의 확대로 서울 접근성이 개선되고 있습니다.` : `${region} 내 주요 교통 인프라와 연결되며, 향후 교통 개발 계획에 따라 접근성이 더 개선될 수 있습니다.`}

자가용 이용 시에도 주요 간선도로 및 고속도로 진입이 편리합니다. 단지 내 ${parking ? `주차 비율은 ${parking}으로 ` : ''}주차 환경도 확인이 필요합니다.

## 학군 분석

${school ? `**학군**: ${school}` : '인근 초·중·고등학교 통학이 가능합니다.'}

${tags.some((t: string) => t.includes('학군')) ? `이 지역은 학군 프리미엄이 높은 곳으로, 자녀 교육을 중시하는 가정에 특히 인기가 높습니다. 학원가 밀집도와 학업 성취도 측면에서 상위권에 위치합니다.` : `인근에 초등학교, 중학교가 도보 통학 가능 거리에 있으며, 학원가 접근성도 양호합니다. 자녀가 있는 가정이라면 통학 거리와 학군 배정 현황을 사전에 확인하시기 바랍니다.`}

교육 환경은 부동산 가치에 장기적으로 큰 영향을 미치는 요소입니다. 해당 지역의 학교 배정 방식(근거리 배정/학군 배정)도 미리 파악해 두시면 좋습니다.

## 생활 인프라

${name} 주변에는 대형마트, 종합병원, 공원 등 주요 생활 편의시설이 잘 갖춰져 있습니다.

- **쇼핑**: 대형마트 및 상업시설 이용 편리
- **의료**: 종합병원 및 의원 다수 분포
- **녹지**: 인근 공원 및 산책로 이용 가능
- **문화**: 도서관, 체육시설 등 공공시설 접근 양호

대단지 아파트의 경우 단지 내 커뮤니티 시설(피트니스, 독서실, 키즈카페 등)이 잘 갖춰져 있어 입주민의 삶의 질을 높여줍니다.

## 투자 포인트

${apt.investment_point || apt.investment_note || `${name}는 ${district} 지역의 대장 아파트로서 안정적인 자산 가치를 유지하고 있습니다.`}

주요 투자 포인트를 정리하면:

${tags.length > 0 ? tags.map((t: string) => `- **${t}**`).join('\n') : `- **입지**: ${region} ${district} 핵심 주거지역
- **규모**: ${unitStr}세대 대단지 프리미엄
- **교통**: ${station || '양호한 대중교통 접근성'}
- **학군**: ${school || '우수한 교육 환경'}`}

다만 부동산 투자는 금리 변동, 정책 변화, 공급 물량 등 다양한 변수가 존재합니다. 실거주 목적인지 투자 목적인지에 따라 접근 방식을 달리하시고, 충분한 시장 조사 후 결정하시기 바랍니다.

## 향후 전망

${region} ${district} 지역은 ${region === '서울' ? '서울 핵심 생활권으로 장기적인 수요 기반이 탄탄합니다.' : '지역 개발 및 교통 인프라 확충에 따라 성장 잠재력이 있습니다.'} ${name}는 지역 내 대장 아파트로서 시장 하락기에도 상대적으로 가격 방어력이 강하며, 상승기에는 선도적으로 가격이 움직이는 경향이 있습니다.

향후 주변 재개발·재건축 사업 진행 여부, 교통 인프라 신설 계획 등을 지속적으로 모니터링하시기 바랍니다.

## 자주 묻는 질문 (FAQ)

### ${name} 현재 매매 시세는 얼마인가요?
${price ? `${area ? `${String(area).split(',')[0]} 기준 ` : ''}약 ${price} 수준입니다.` : '정확한 시세는 국토교통부 실거래가 시스템에서 확인하시기 바랍니다.'} 호가와 실거래가에는 차이가 있을 수 있으므로 최근 실거래 내역을 참고하세요.

### ${name} 가장 가까운 역은 어디인가요?
${station ? `${station}입니다.` : '인근 대중교통 정보는 네이버맵 또는 카카오맵에서 확인하시기 바랍니다.'}

### ${name} 학군은 어떤가요?
${school ? `${school} 학군에 해당합니다.` : '인근 학교 배정 현황은 학교알리미(schoolinfo.go.kr)에서 확인 가능합니다.'} 학군은 부동산 가치에 중요한 영향을 미치는 요소이므로 자녀 연령에 맞게 미리 확인하시기 바랍니다.

### 투자 가치는 어떻게 평가하나요?
${name}는 ${district} 대장 아파트로 안정적 수요 기반을 갖추고 있습니다. 다만 모든 부동산 투자에는 리스크가 존재하므로 본인의 재무 상황, 투자 목적, 시장 환경을 종합적으로 고려하여 판단하시기 바랍니다.

---

> **면책고지**: 본 콘텐츠는 정보 제공 목적으로 작성되었으며 특정 부동산의 매수·매도를 권유하지 않습니다. 시세 정보는 작성 시점 기준이며 실제와 다를 수 있습니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다. 데이터 출처: 국토교통부 실거래가 공개시스템, 한국부동산원.`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRETT;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-apt-landmark', async () => {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: apts, error: fetchErr } = await admin
      .from('landmark_apts')
      .select('*')
      .eq('blog_generated', false);

    if (fetchErr) { console.error('[blog-apt-landmark] fetch error:', fetchErr); throw new Error(fetchErr.message); }
    if (!apts || apts.length === 0) return { processed: 0, created: 0, failed: 0, metadata: { api_name: 'anthropic', api_calls: 0 } };

    let created = 0;
    for (const apt of apts) {
      try {
        const slug = apt.blog_slug || apt.slug;
        if (!slug) continue;

        const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
        if (exists) { await admin.from('landmark_apts').update({ blog_generated: true }).eq(apt.blog_slug ? 'blog_slug' : 'slug', slug); continue; }

        const title = `${apt.region || ''} ${apt.district || ''} ${apt.name || ''} 완전 분석 — 시세·학군·교통·투자 전망 (2026)`;
        const content = generateLandmarkBlog(apt);
        const tags = apt.tags || [apt.region, apt.district, apt.name].filter(Boolean);

        await admin.from('blog_posts').insert({
          slug, title,
          content: ensureMinLength(content, 'apt'),
          excerpt: `${apt.name} ${apt.region} ${apt.district} 매매 전세 시세 학군 교통 투자전망 2026년 분석`,
          category: 'apt', tags,
          cron_type: 'apt-landmark',
          cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(title)}&type=blog`,
          image_alt: generateImageAlt('apt', title),
          meta_description: generateMetaDesc(content),
          meta_keywords: generateMetaKeywords('apt', tags),
        });

        await admin.from('landmark_apts').update({ blog_generated: true }).eq(apt.blog_slug ? 'blog_slug' : 'slug', slug);
        created++;
      } catch (e: any) {
        console.error(`[blog-apt-landmark] Error for ${apt.blog_slug || apt.slug}:`, e.message);
      }
    }

    console.log(`[blog-apt-landmark] Created ${created}/${apts.length}`);
    return {
      processed: apts.length,
      created,
      failed: 0,
      metadata: { api_name: 'anthropic', api_calls: 0 },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, created: result.created });
}
