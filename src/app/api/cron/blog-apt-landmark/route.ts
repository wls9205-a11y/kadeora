import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function generateFaqSchema(apt: any) {
  const faqs = [
    { q: `${apt.name} 현재 매매 시세는?`, a: `${apt.name}의 ${apt.size_py || '주요'}평형 기준 매매가는 약 ${apt.price_buy || '시세 확인 필요'}입니다. 최근 거래 동향과 호가를 함께 확인하시길 권합니다.` },
    { q: `${apt.name} 주변 학군은?`, a: `${apt.name} 인근에는 ${apt.school_name || '학교'}가 있으며, 도보 ${apt.school_dist || '약 10분'} 거리입니다. ${apt.school_note || '학군 평가는 지역 내 상위권입니다.'}` },
    { q: `${apt.name} 교통 여건은?`, a: `가장 가까운 역은 ${apt.station || '인근역'}으로 도보 ${apt.station_dist || '약 10분'} 거리입니다. ${apt.transport_note || '대중교통 접근성이 양호합니다.'}` },
    { q: `${apt.name} 투자 전망은?`, a: `${apt.investment_note || `${apt.district || apt.region} 지역 내 대장 아파트로 안정적 가치가 기대됩니다.`} 다만, 부동산 투자는 개인 상황에 따라 신중히 판단하시기 바랍니다.` },
  ]
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  })
}

function generateLandmarkBlog(apt: any): string {
  const name = apt.name || '단지'
  const region = apt.region || ''
  const district = apt.district || ''
  const year = apt.built_year || '-'
  const households = apt.households || '-'
  const sizePy = apt.size_py || '-'
  const priceBuy = apt.price_buy || '시세 확인 필요'
  const priceRent = apt.price_rent || '시세 확인 필요'
  const station = apt.station || '인근역'
  const stationDist = apt.station_dist || '도보 약 10분'
  const schoolName = apt.school_name || '인근 학교'
  const schoolDist = apt.school_dist || '도보 약 10분'

  return `## ${name} 단지 개요

| 항목 | 내용 |
|------|------|
| 단지명 | ${name} |
| 위치 | ${region} ${district} |
| 준공연도 | ${year} |
| 세대수 | ${households}세대 |
| 대표 평형 | ${sizePy}평 |

${region} ${district}에 위치한 ${name}은(는) 지역을 대표하는 랜드마크 아파트입니다. ${year}년에 준공되었으며 총 ${households}세대 규모의 대단지입니다. 주거 환경과 입지 조건이 우수하여 실거주자와 투자자 모두에게 높은 관심을 받고 있습니다.

## 시세 현황 (매매·전세)

| 구분 | 가격 |
|------|------|
| 매매가 (${sizePy}평 기준) | ${priceBuy} |
| 전세가 (${sizePy}평 기준) | ${priceRent} |

${name}의 ${sizePy}평형 기준 매매가는 약 ${priceBuy}이며, 전세가는 약 ${priceRent} 수준입니다. ${apt.price_note || '최근 거래량과 호가 추이를 함께 확인하는 것이 중요합니다.'} 부동산 시세는 시장 상황에 따라 변동될 수 있으므로 실거래가 확인을 권합니다.

## 교통 여건

가장 가까운 역은 **${station}**으로 **${stationDist}** 거리에 있습니다. ${apt.transport_note || `${region} 주요 업무지구로의 접근성이 좋으며, 버스 노선도 다양하게 운행되고 있습니다.`}

대중교통뿐 아니라 주요 도로와의 접근성도 양호하여 자가용 이용 시에도 편리합니다. 향후 교통 인프라 개선 계획이 있다면 추가적인 가치 상승 요인이 될 수 있습니다.

## 학군 분석

인근 학교로는 **${schoolName}**이(가) **${schoolDist}** 거리에 위치하고 있습니다. ${apt.school_note || '학군 평가는 지역 내 상위권으로 자녀 교육을 중시하는 가정에 적합합니다.'}

교육 환경은 부동산 가치에 중요한 영향을 미치는 요소입니다. 학원가 밀집도와 통학 편의성도 함께 고려하시기 바랍니다.

## 투자 포인트

${apt.investment_note || `${name}은(는) ${district} 지역의 대장 아파트로서 안정적인 자산 가치를 유지하고 있습니다. 대단지 프리미엄과 우수한 입지 조건이 강점입니다.`}

주요 투자 포인트:
- **입지**: ${region} ${district} 핵심 주거지역
- **규모**: ${households}세대 대단지 프리미엄
- **교통**: ${station} ${stationDist}
- **학군**: ${schoolName} ${schoolDist}

## 자주 묻는 질문 (FAQ)

### ${name} 현재 매매 시세는?
${sizePy}평형 기준 매매가는 약 ${priceBuy}입니다. 최근 거래 동향과 호가를 함께 확인하시길 권합니다.

### ${name} 주변 학군은 어떤가요?
인근에 ${schoolName}이(가) ${schoolDist} 거리에 있으며, ${apt.school_note || '학군 평가는 지역 내 상위권입니다.'}

### ${name} 교통은 편리한가요?
가장 가까운 역은 ${station}으로 ${stationDist} 거리입니다. ${apt.transport_note || '대중교통 접근성이 양호합니다.'}

### ${name} 투자 가치는?
${apt.investment_note || `${district} 지역 내 대장 아파트로 안정적 가치가 기대됩니다.`} 다만, 부동산 투자는 개인 상황에 따라 신중히 판단하시기 바랍니다.

---

> **면책고지**: 본 콘텐츠는 정보 제공 목적으로 작성되었으며 투자 권유가 아닙니다. 시세 정보는 실제와 다를 수 있으며, 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다. 데이터 출처: 국토교통부 실거래가, 한국부동산원.`
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRETT || process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data: apts, error: fetchErr } = await supabase
      .from('landmark_apts')
      .select('*')
      .eq('blog_generated', false)

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!apts || apts.length === 0) return NextResponse.json({ ok: true, created: 0, message: 'No pending landmark apts' })

    const blogPosts = apts.map(apt => ({
      slug: apt.blog_slug,
      title: `${apt.region} ${apt.district} ${apt.name} 완전 분석 — 시세·학군·교통·투자 전망 (2026)`,
      content: generateLandmarkBlog(apt),
      category: 'apt',
      cron_type: 'apt-landmark',
      meta_description: `${apt.name} 매매 전세 시세 학군 교통 투자전망 2026`,
      tags: apt.tags || [apt.region, apt.district, apt.name],
      faq_schema: generateFaqSchema(apt),
      is_published: true,
    }))

    const { error: insertErr } = await supabase
      .from('blog_posts')
      .upsert(blogPosts, { onConflict: 'slug', ignoreDuplicates: true })

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    const slugs = apts.map(a => a.blog_slug)
    await supabase
      .from('landmark_apts')
      .update({ blog_generated: true })
      .in('blog_slug', slugs)

    console.log(`[blog-apt-landmark] Created ${blogPosts.length} posts`)
    return NextResponse.json({ ok: true, created: blogPosts.length })
  } catch (e: any) {
    console.error('[blog-apt-landmark]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
