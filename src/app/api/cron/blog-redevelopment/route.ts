import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { withCronLogging } from '@/lib/cron-logger';

export const dynamic = 'force-dynamic';

function generateRedevelopmentBlog(z: any): string {
  const name = z.zone_name || z.name || '구역';
  const region = z.region || '';
  const district = z.district || '';
  const zType = z.zone_type || z.project_type || '재개발';
  const stage = z.progress_stage || z.stage || '추진 중';
  const builder = z.contractors || z.builder || '';
  const estCost = z.estimated_contribution || z.est_contribution || '';
  const units = z.planned_units || z.total_units || 0;
  const unitStr = units ? units.toLocaleString() : '';
  const completion = z.expected_completion || z.est_completion || '';
  const area = z.total_area || '';
  const investment = z.investment_point || z.investment_note || '';
  const desc = z.description || z.overview || '';

  const stageSteps = ['구역지정', '조합설립', '사업시행인가', '관리처분인가', '착공', '준공'];
  const currentIdx = stageSteps.findIndex(s => stage.includes(s));
  const progressPct = currentIdx >= 0 ? Math.round(((currentIdx + 1) / stageSteps.length) * 100) : 30;

  return `## ${region} ${name} ${zType} 사업 개요

${desc || `${region} ${district}에 위치한 ${name}은 현재 ${zType} 사업을 추진 중입니다. ${stage} 단계에 있으며, ${unitStr ? `완공 시 총 ${unitStr}세대 규모의 새로운 주거단지가 조성될 예정입니다.` : '노후 주거환경 개선을 목표로 사업이 진행되고 있습니다.'}`}

## 구역 기본 정보

| 항목 | 내용 |
|------|------|
| **구역명** | ${name} |
| **위치** | ${region} ${district} |
| **사업 유형** | ${zType} |
| **현재 단계** | ${stage} |
${builder ? `| **시공사** | ${builder} |\n` : ''}${unitStr ? `| **총 세대수 (예정)** | ${unitStr}세대 |\n` : ''}${completion ? `| **예상 완공** | ${completion} |\n` : ''}${area ? `| **사업 면적** | ${area} |\n` : ''}${estCost ? `| **예상 분담금** | ${estCost} |\n` : ''}

## 사업 진행 현황

현재 **${stage}** 단계이며, 전체 진행률은 **약 ${progressPct}%**입니다.

${stageSteps.map((s, i) => {
    if (i < currentIdx) return `- ✅ **${s}** — 완료`;
    if (i === currentIdx) return `- 🔄 **${s}** — 현재 단계`;
    return `- ⬜ ${s} — 예정`;
  }).join('\n')}

${zType} 사업은 구역지정부터 준공까지 통상 10~15년이 소요됩니다. ${currentIdx >= 3 ? `현재 ${stage} 단계로 사업이 상당히 진행되었습니다. 관리처분인가 이후에는 이주 및 철거가 시작되며, 사업 속도가 빨라지는 경향이 있습니다.` : currentIdx >= 1 ? `현재 ${stage} 단계로 아직 초중반입니다. 조합 내부 의견 수렴과 인허가 과정에서 지연이 발생할 수 있으므로 진행 상황을 지속적으로 모니터링할 필요가 있습니다.` : `초기 단계로 향후 변동 가능성이 크며, 사업 추진 여부 자체가 불확실할 수 있습니다.`}

## 시공사 정보

${builder ? `시공사는 **${builder}**(으)로 선정되었습니다. 시공사의 브랜드 파워와 시공 능력은 분양가, 입주 후 시세, 단지 품질에 직접적인 영향을 미칩니다. ${builder.includes('삼성') || builder.includes('현대') || builder.includes('대우') || builder.includes('GS') || builder.includes('포스코') || builder.includes('롯데') ? '1군 건설사 브랜드 단지로, 분양 시 높은 경쟁률이 예상됩니다.' : '시공사의 최근 시공 실적과 재무 상태를 확인해 보시기 바랍니다.'}` : `시공사는 아직 선정되지 않았습니다. 시공사 선정은 ${zType} 사업에서 중요한 분기점이며, 1군 건설사 선정 여부에 따라 사업 추진력과 분양가가 크게 달라질 수 있습니다.`}

## 예상 분담금

${estCost ? `조합원 예상 분담금은 **${estCost}** 수준입니다.` : '분담금은 아직 확정되지 않았습니다.'}

분담금 산정 시 주요 변수:
- **종전 자산 감정평가액**: 기존 소유 부동산의 평가 가격
- **분양 예정가**: 일반분양 수익이 높을수록 분담금 감소
- **공사비**: 자재비·인건비 상승 시 분담금 증가 가능
- **이주비 대출 이자**: 이주 기간 동안의 금융 비용

분담금은 관리처분인가 단계에서 구체화되며, 이후에도 공사비 변동 등에 따라 추가 분담금이 발생할 수 있습니다. 반드시 조합 총회 자료와 감정평가 결과를 직접 확인하시기 바랍니다.

## 투자 전망

${investment || `${name} 구역은 ${region} ${district}의 입지적 장점을 갖추고 있어, 사업 완료 시 시세 상승이 기대됩니다. 특히 ${region === '서울' ? '서울 내 재개발·재건축은 신규 공급 수단으로서 꾸준한 수요가 있습니다.' : `${region} 지역 내 노후 주택 비율이 높아 정비사업에 대한 관심이 높습니다.`}`}

**리스크 요인:**
- 사업 지연: 인허가 지연, 조합 내분, 주민 반대 등
- 추가 분담금: 공사비 상승, 분양가 하락 시 조합원 부담 증가
- 정책 변화: 정비사업 관련 규제 변경 가능성
- 시장 변동: 부동산 경기 침체 시 분양 수익 감소

## ${zType} 절차 안내

일반적인 ${zType} 사업은 다음 순서로 진행됩니다:

1. **구역지정**: 지자체가 정비구역으로 지정합니다. 토지등소유자 동의율 충족이 전제 조건입니다.
2. **조합설립인가**: 토지등소유자 75% 이상 동의로 조합을 설립합니다. 정비업체 선정과 함께 본격적인 사업 추진이 시작됩니다.
3. **사업시행인가**: 건축 설계, 교통·환경 영향평가 등을 거쳐 사업계획을 확정합니다.
4. **관리처분인가**: 분양 설계, 종전·종후 자산 평가를 통해 분담금을 확정합니다. 이 단계 이후 이주가 시작됩니다.
5. **착공**: 이주 완료 후 기존 건물을 철거하고 신축 공사를 시작합니다.
6. **준공 및 입주**: 사용검사를 받고 입주를 시작합니다. 소유권 이전 등기가 이루어집니다.

## 자주 묻는 질문 (FAQ)

### ${name} 현재 어느 단계인가요?
현재 **${stage}** 단계입니다. 전체 진행률은 약 ${progressPct}% 수준으로, ${currentIdx >= 3 ? '사업이 본격 추진 단계에 진입했습니다.' : '아직 초중반 단계입니다.'}

### 예상 분담금은 얼마인가요?
${estCost ? `현재 기준 예상 분담금은 약 ${estCost}입니다.` : '분담금은 아직 확정되지 않았습니다.'} 공사비 변동, 분양가 변화 등에 따라 실제 분담금은 달라질 수 있으므로 조합 공지를 지속적으로 확인하시기 바랍니다.

### ${zType} 투자 시 가장 주의할 점은?
사업 지연 리스크가 가장 크며, 추가 분담금 발생 가능성도 고려해야 합니다. 조합의 재무 상태, 시공사 선정 여부, 일반분양 경쟁력을 꼼꼼히 분석한 후 결정하시기 바랍니다.

${completion ? `### 입주 예정 시기는?\n현재 기준 예상 완공은 ${completion}입니다. 다만 사업 일정은 변동될 수 있습니다.\n` : ''}
---

> **면책고지**: 본 콘텐츠는 정보 제공 목적으로 작성되었으며 특정 정비사업 투자를 권유하지 않습니다. 사업 진행 상황과 분담금은 변동될 수 있으며, 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다. 데이터 출처: 각 지자체 정비사업 공시, 조합 공지.`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRETT;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-redevelopment', async () => {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: zones, error: fetchErr } = await admin.from('redevelopment_zones').select('*').eq('blog_generated', false);

    if (fetchErr) { console.error('[blog-redevelopment] fetch error:', fetchErr); throw new Error(fetchErr.message); }
    if (!zones || zones.length === 0) return { processed: 0, created: 0, failed: 0, metadata: { api_name: 'anthropic', api_calls: 0 } };

    let created = 0;
    for (const zone of zones) {
      try {
        const slug = zone.blog_slug || zone.slug;
        if (!slug) continue;

        const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
        if (exists) { await admin.from('redevelopment_zones').update({ blog_generated: true }).eq(zone.blog_slug ? 'blog_slug' : 'slug', slug); continue; }

        const zName = zone.zone_name || zone.name || '';
        const zType = zone.zone_type || zone.project_type || '재개발';
        const title = `${zone.region || ''} ${zName} ${zType} 현황 — 진행 단계·시공사·분담금·투자 전망 (2026)`;
        const content = generateRedevelopmentBlog(zone);
        const tags = zone.tags || [zone.region, zName, zType].filter(Boolean);

        await admin.from('blog_posts').insert({
          slug, title,
          content: ensureMinLength(content, 'apt'),
          excerpt: `${zName} ${zType} ${zone.progress_stage || zone.stage || ''} 시공사 분담금 투자전망 2026`,
          category: 'apt', tags, cron_type: 'redevelopment',
          cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(title)}&type=blog`,
          image_alt: generateImageAlt('apt', title),
          meta_description: generateMetaDesc(content),
          meta_keywords: generateMetaKeywords('apt', tags),
        });

        await admin.from('redevelopment_zones').update({ blog_generated: true }).eq(zone.blog_slug ? 'blog_slug' : 'slug', slug);
        created++;
      } catch (e: any) {
        console.error(`[blog-redevelopment] Error for ${zone.blog_slug || zone.slug}:`, e.message);
      }
    }

    console.log(`[blog-redevelopment] Created ${created}/${zones.length}`);
    return {
      processed: zones.length,
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
