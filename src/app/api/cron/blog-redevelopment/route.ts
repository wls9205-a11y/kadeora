import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function generateRedevelopmentBlog(zone: any): string {
  const name = zone.zone_name || '구역'
  const region = zone.region || ''
  const district = zone.district || ''
  const zoneType = zone.zone_type || '재개발'
  const stage = zone.stage || '추진 중'
  const builder = zone.builder || '미정'
  const estCost = zone.est_contribution || '미정'
  const totalUnits = zone.total_units || '-'
  const estCompletion = zone.est_completion || '미정'

  const stageSteps = ['구역지정', '조합설립', '사업시행인가', '관리처분인가', '착공', '준공']
  const currentIdx = stageSteps.findIndex(s => stage.includes(s))
  const progressPct = currentIdx >= 0 ? Math.round(((currentIdx + 1) / stageSteps.length) * 100) : 30

  return `## ${region} ${name} ${zoneType} 개요

| 항목 | 내용 |
|------|------|
| 구역명 | ${name} |
| 위치 | ${region} ${district} |
| 사업 유형 | ${zoneType} |
| 현재 단계 | ${stage} |
| 시공사 | ${builder} |
| 총 세대수 (예정) | ${totalUnits} |
| 예상 완공 | ${estCompletion} |

${region} ${district}에 위치한 ${name} ${zoneType} 구역은 현재 **${stage}** 단계에 있습니다. ${zone.overview || `본 구역은 노후 주거환경 개선과 도시 재생을 목표로 추진되고 있으며, 완공 시 ${totalUnits}세대 규모의 새로운 주거단지가 조성될 예정입니다.`}

## 진행 단계

| 단계 | 상태 |
|------|------|
${stageSteps.map((s, i) => `| ${s} | ${i <= currentIdx ? '✅ 완료' : i === currentIdx + 1 ? '🔄 진행 중' : '⬜ 예정'} |`).join('\n')}

전체 진행률: **약 ${progressPct}%**

${zoneType} 사업은 구역지정부터 준공까지 일반적으로 10~15년이 소요됩니다. 현재 ${stage} 단계로, ${currentIdx >= 3 ? '사업이 상당히 진행된 상태입니다.' : '초기 단계로 향후 변동 가능성이 있습니다.'}

## 시공사 정보

시공사는 **${builder}**${builder === '미정' ? '로 아직 선정되지 않았습니다. 시공사 선정은 사업 추진의 중요한 이정표이며, 브랜드 아파트 여부에 따라 분양가와 시세에 영향을 미칩니다.' : `(으)로 선정되었습니다. ${zone.builder_note || '시공 능력과 브랜드 가치가 단지의 미래 가치에 긍정적 영향을 줄 것으로 기대됩니다.'}`}

## 예상 분담금

조합원 예상 분담금은 **${estCost}** 수준입니다. ${zone.cost_note || '분담금은 감정평가, 분양가, 공사비 등에 따라 변동될 수 있으므로 조합 공지를 확인하시기 바랍니다.'}

분담금 산정 시 고려사항:
- 종전 자산 감정평가액
- 분양 예정가 및 일반분양 수익
- 공사비 및 사업비
- 이주비 대출 이자

## 투자 전망

${zone.investment_note || `${name} 구역은 ${region} ${district}의 입지적 장점을 갖추고 있어, 사업 완료 시 상당한 가치 상승이 기대됩니다. 다만 ${zoneType} 사업 특성상 사업 지연, 추가 분담금 등의 리스크도 존재합니다.`}

## ${zoneType} 절차 안내

1. **구역지정**: 지자체가 정비구역으로 지정
2. **조합설립인가**: 토지 등 소유자 동의로 조합 설립
3. **사업시행인가**: 건축 설계 등 사업계획 확정
4. **관리처분인가**: 분양 설계, 분담금 확정
5. **착공**: 이주 완료 후 철거 및 신축 공사
6. **준공 및 입주**: 사용검사 후 입주 시작

## 자주 묻는 질문 (FAQ)

### ${name} 현재 어느 단계인가요?
현재 **${stage}** 단계입니다. 전체 진행률은 약 ${progressPct}% 수준입니다.

### 예상 분담금은 얼마인가요?
현재 기준 예상 분담금은 약 ${estCost}이나, 공사비 변동 등에 따라 달라질 수 있습니다.

### 투자 시 주의할 점은?
${zoneType} 투자는 사업 지연, 추가 분담금, 조합 분쟁 등의 리스크가 있습니다. 조합 재무 상태와 사업 진행 현황을 꼼꼼히 확인하시기 바랍니다.

---

> **면책고지**: 본 콘텐츠는 정보 제공 목적으로 작성되었으며 투자 권유가 아닙니다. 사업 진행 상황과 분담금은 변동될 수 있으며, 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다. 데이터 출처: 각 지자체 정비사업 공시, 조합 공지.`
}

function generateFaqSchema(zone: any) {
  const name = zone.zone_name || '구역'
  const stage = zone.stage || '추진 중'
  const estCost = zone.est_contribution || '미정'
  return JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: `${name} 현재 어느 단계인가요?`, acceptedAnswer: { '@type': 'Answer', text: `현재 ${stage} 단계입니다.` } },
      { '@type': 'Question', name: `${name} 예상 분담금은?`, acceptedAnswer: { '@type': 'Answer', text: `예상 분담금은 약 ${estCost}입니다.` } },
      { '@type': 'Question', name: `${name} 투자 시 주의할 점은?`, acceptedAnswer: { '@type': 'Answer', text: '사업 지연, 추가 분담금, 조합 분쟁 등의 리스크가 있으므로 꼼꼼한 확인이 필요합니다.' } },
    ],
  })
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRETT || process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  try {
    const { data: zones, error: fetchErr } = await supabase
      .from('redevelopment_zones')
      .select('*')
      .eq('blog_generated', false)

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!zones || zones.length === 0) return NextResponse.json({ ok: true, created: 0, message: 'No pending redevelopment zones' })

    const blogPosts = zones.map(zone => ({
      slug: zone.blog_slug,
      title: `${zone.region} ${zone.zone_name} ${zone.zone_type} 현황 — 진행 단계·시공사·분담금·투자 전망 (2026)`,
      content: generateRedevelopmentBlog(zone),
      category: 'apt',
      cron_type: 'redevelopment',
      meta_description: `${zone.zone_name} ${zone.zone_type} 진행단계 시공사 분담금 투자전망 2026`,
      tags: zone.tags || [zone.region, zone.zone_name, zone.zone_type],
      faq_schema: generateFaqSchema(zone),
      is_published: true,
    }))

    const { error: insertErr } = await supabase
      .from('blog_posts')
      .upsert(blogPosts, { onConflict: 'slug', ignoreDuplicates: true })

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    await supabase.from('redevelopment_zones').update({ blog_generated: true }).in('blog_slug', zones.map(z => z.blog_slug))

    console.log(`[blog-redevelopment] Created ${blogPosts.length} posts`)
    return NextResponse.json({ ok: true, created: blogPosts.length })
  } catch (e: any) {
    console.error('[blog-redevelopment]', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
