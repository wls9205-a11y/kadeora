import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { checkBlogQuality } from '@/lib/blog-quality-gate';
import { diversifyPrompt } from '@/lib/blog-prompt-diversity';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * 카더라 선점 콘텐츠 자동 발행 크론
 * 
 * upcoming_projects 테이블에서 아직 블로그 글이 없는 현장을 찾아
 * "팩트(✅) + 카더라(💬) + 데이터 분석(📊)" 3단 구조로 선점 콘텐츠 생성
 * 
 * 주 2회 (화·금 09시) 실행, 1회 1~2건 생성
 */

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-upcoming-projects', async () => {
    const admin = getSupabaseAdmin();

    // 블로그 글이 아직 없는 선점 대상 현장 조회
    const { data: projects } = await (admin as any).from('upcoming_projects')
      .select('*')
      .is('blog_post_id', null)
      .in('status', ['rumor', 'announced'])
      .order('interest_score', { ascending: false })
      .limit(3);

    if (!projects || projects.length === 0) {
      return { processed: 0, metadata: { reason: 'no_upcoming_without_blog' } };
    }

    let created = 0;
    const results: { project: string; slug: string; score: number }[] = [];

    for (const project of projects) {
      try {
        // 주변 시세 데이터 수집
        let nearbyData = '';
        if (project.sigungu) {
          const { data: nearby } = await (admin as any).from('apt_complex_profiles')
            .select('apt_name, avg_sale_price_pyeong, built_year, total_households')
            .eq('sigungu', project.sigungu)
            .not('avg_sale_price_pyeong', 'is', null)
            .order('total_households', { ascending: false })
            .limit(5);
          if (nearby && nearby.length > 0) {
            nearbyData = `\n## 주변 시세 데이터 (팩트 — apt_complex_profiles):\n| 단지명 | 평당가(만원) | 입주년도 | 세대수 |\n|---|---|---|---|\n`;
            nearby.forEach((n: any) => {
              nearbyData += `| ${n.apt_name} | ${n.avg_sale_price_pyeong?.toLocaleString() ?? '-'} | ${n.built_year ?? '-'} | ${n.total_households?.toLocaleString() ?? '-'} |\n`;
            });
          }
        }

        const systemPrompt = `당신은 "카더라" 부동산 정보 플랫폼의 전문 기자입니다.
아직 공식 분양 전이지만 관심이 높은 현장에 대해 심층 분석 글을 작성하세요.

## 현장 정보:
- 현장명: ${project.brand_name || project.project_name}
- 위치: ${project.location_full}
- 시공사: ${project.builder || '미확정'}
- 규모: ${project.scale || '미확정'}
- 세대수: ${project.total_units || '미확정'}
- 현재 상태: ${project.status === 'rumor' ? '루머/소문 단계' : '공식 발표됨'}
- 예상 분양가: ${project.estimated_price_pyeong ? `평당 ${project.estimated_price_pyeong.toLocaleString()}만원 추정` : '미확정'}
- 예상 분양 시기: ${project.estimated_launch_date || '미확정'}
${nearbyData}

## 출력 구조 (필수):

### 도입부
왜 이 현장이 주목받고 있는지 1~2문장으로 시작

### ✅ 확인된 사항 (팩트)
위치, 시공사, 규모 등 공식 발표되거나 확인된 정보만

### 💬 카더라 (미확인 정보)
"~라고 하더라", "~로 알려져 있다" 등 한정 표현 필수
예상 분양가, 분양 시기, 평면 구성 소문 등

### 📊 주변 시세 비교 분석
주변 시세 데이터를 기반으로 예상 분양가의 적정성 분석
마크다운 표로 비교

### 청약 전략 가이드
가점/추첨 예상, 자금 계획 시뮬레이션

### ❓ 자주 묻는 질문 (3~5개)
각 질문에 대한 현재까지 알려진 정보 기반 답변

### 🔗 관련 정보
내부 링크 5개+:
- [청약 가점 계산 →](/apt/diagnose)
- [취득세 계산기 →](/calc/real-estate/acquisition-tax)
- [전체 청약 일정 →](/apt)
- [${project.sigungu || '부동산'} 블로그 →](/blog?category=apt)
- [커뮤니티 토론 →](/feed)

## 출력 규칙:
- 순수 마크다운만 (인라인 HTML style 금지)
- 최소 5,000자
- "## 목차" 섹션 금지
- ## 제목에 **볼드** 금지
- 글 끝에 면책: "> ⚠️ 이 정보는 공식 발표 전 수집된 것으로 변동될 수 있습니다. 투자 결정은 공식 자료를 직접 확인 후 본인의 판단 하에 이루어져야 합니다."`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY!,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: AI_MODEL_HAIKU,
            max_tokens: 6000,
            messages: [{ role: 'user', content: diversifyPrompt(systemPrompt) }],
          }),
        });

        if (!res.ok) {
          if (res.status === 529 || res.status === 402) break;
          continue;
        }
        const data = await res.json();
        const content = data.content?.[0]?.text;
        if (!content || content.length < 3000) continue;

        // 품질 게이트
        const quality = checkBlogQuality(content, 'apt');
        if (!quality.pass) {
          console.warn(`[blog-upcoming] Quality fail: ${project.project_name} (${quality.score}점)`);
          continue;
        }

        // 슬러그 생성
        const nameSlug = (project.brand_name || project.project_name)
          .replace(/[^가-힣a-zA-Z0-9\s]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          .toLowerCase();
        const slug = `upcoming-${nameSlug}-${Date.now().toString(36)}`;

        const title = `${project.brand_name || project.project_name}, 분양 전 알아야 할 모든 것 — 예상 분양가·입지·전망 (2026)`;
        const cleanText = content.replace(/[#|*\n\r\-\[\]\(\)/]/g, ' ').replace(/\s+/g, ' ').trim();

        // 블로그 글 삽입
        const { data: inserted, error: insertError } = await admin.from('blog_posts').insert({
          title,
          slug,
          content,
          category: 'apt',
          sub_category: '청약·분양',
          tags: [project.brand_name || project.project_name, project.sigungu, project.builder, '분양예정', '카더라'].filter(Boolean),
          is_published: false, // 큐에 넣어서 publish-queue가 발행
          source_type: 'upcoming',
          source_ref: project.project_name,
          author_name: '카더라 부동산팀',
          author_role: '선점 분석',
          cover_image: project.rendering_image_url || `/api/og?title=${encodeURIComponent(title.slice(0, 60))}&category=apt&design=${1 + Math.floor(Math.random() * 6)}`,
          meta_description: cleanText.slice(0, 120) + ' — 카더라',
          excerpt: cleanText.slice(0, 150),
          reading_time_min: Math.max(3, Math.ceil(content.length / 1500)),
          seo_score: quality.score,
          seo_tier: quality.tier,
        }).select('id').single();

        if (insertError || !inserted) {
          console.warn(`[blog-upcoming] Insert blocked: ${project.project_name}`, insertError?.message);
          // Mark as attempted (-1) to prevent infinite retry
          await (admin as any).from('upcoming_projects')
            .update({ blog_post_id: -1, updated_at: new Date().toISOString() })
            .eq('id', project.id);
          continue;
        }

        // upcoming_projects에 blog_post_id 연결
        await (admin as any).from('upcoming_projects')
          .update({ blog_post_id: inserted.id, updated_at: new Date().toISOString() })
          .eq('id', project.id);

        created++;
        results.push({ project: project.project_name, slug, score: quality.score });
        console.info(`[blog-upcoming] ✅ ${project.project_name} → ${slug} (${quality.score}점)`);
      } catch (err: any) {
        console.error(`[blog-upcoming] Error: ${project.project_name}`, err.message);
      }
    }

    return { processed: created, created, metadata: { results } };
  });

  return NextResponse.json(result);
}
