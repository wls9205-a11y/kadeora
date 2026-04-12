import { buildFinancePrompt, generateAndValidate } from '@/lib/blog-prompt-templates';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/constants';

export const maxDuration = 300;

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('blog-subscription-monthly', async () => {
    const sb = getSupabaseAdmin();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = `${year}년 ${month}월`;
    const slug = `subscription-schedule-${year}-${String(month).padStart(2, '0')}`;

    // 중복 체크
    const { data: ex } = await sb.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
    if (ex) return { created: 0, reason: 'already_exists' };

    // 이번달 + 다음달 청약 조회
    const { data: subs } = await (sb as any).from('apt_subscriptions')
      .select('house_manage_no,house_nm,hssply_adres,tot_suply_hshldco,rcept_bgnde,rcept_endde,przwner_presnatn_de')
      .gte('rcept_bgnde', `${year}${String(month).padStart(2, '0')}01`)
      .lte('rcept_bgnde', `${year}${String(month + 1 > 12 ? 1 : month + 1).padStart(2, '0')}28`)
      .order('rcept_bgnde', { ascending: true })
      .limit(30);

    const title = `${monthStr} 청약 일정 총정리 — 주요 단지·접수기간·당첨 발표일`;
    const subList = (subs || []).map((s: any) => {
      const bgnDate = s.rcept_bgnde ? `${s.rcept_bgnde.slice(0,4)}.${s.rcept_bgnde.slice(4,6)}.${s.rcept_bgnde.slice(6,8)}` : '미정';
      const endDate = s.rcept_endde ? `${s.rcept_endde.slice(0,4)}.${s.rcept_endde.slice(4,6)}.${s.rcept_endde.slice(6,8)}` : '미정';
      return `### ${s.house_nm}
- **위치**: ${s.hssply_adres || '미정'}
- **세대수**: ${(s.tot_suply_hshldco || 0).toLocaleString()}세대
- **접수기간**: ${bgnDate} ~ ${endDate}
${s.przwner_presnatn_de ? `- **당첨 발표**: ${s.przwner_presnatn_de.slice(0,4)}.${s.przwner_presnatn_de.slice(4,6)}.${s.przwner_presnatn_de.slice(6,8)}` : ''}`;
    }).join('\n\n');

    const content = `## ${monthStr} 청약 일정

${monthStr}에 진행되는 주요 아파트 청약 일정을 정리했습니다. 총 ${(subs || []).length}개 단지의 청약이 예정되어 있습니다.

## 주요 청약 단지

${subList || '이번 달 등록된 청약 일정이 없습니다.'}

## 청약 준비 체크리스트

1. **청약통장 가입기간** 확인 — 지역별 최소 가입기간이 다릅니다
2. **청약 가점** 계산 — [청약 가점 계산기](${SITE_URL}/calc/real-estate/subscription-score)로 미리 확인
3. **자금 계획** — [취득세 계산기](${SITE_URL}/calc/property-tax/acquisition-tax)로 총 비용 파악
4. **특별공급 자격** — 신혼부부·다자녀·노부모 등 해당 여부 확인

## 관련 정보

- [전국 청약 정보](${SITE_URL}/apt)
- [청약 가점 계산기](${SITE_URL}/calc/real-estate/subscription-score)
- [분양가 분석](${SITE_URL}/blog?category=apt)
`;

    const res = await safeBlogInsert(sb, {
      slug,
      title,
      content,
      category: 'apt',
      tags: ['청약', `${month}월 청약`, '청약 일정', '아파트 분양', '2026'],
      source_type: 'subscription-monthly',
      cron_type: 'blog-subscription-monthly',
      data_date: now.toISOString().slice(0, 10),
      meta_description: generateMetaDesc(content, title, 'apt'),
      meta_keywords: generateMetaKeywords('apt', ['청약', `${month}월`, '일정']),
      is_published: true,
    });

    return { created: res.success ? 1 : 0 };
  });
  return NextResponse.json(result, { status: 200 });
}
