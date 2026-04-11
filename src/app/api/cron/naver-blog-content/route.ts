import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL, AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * 네이버 블로그 콘텐츠 자동 생성 크론
 * 
 * - kadeora.app 블로그 인기글 중 미발행분을 네이버 블로그 최적화 HTML로 변환
 * - 네이버 SEO 최적화: 제목 25자 이내, 키워드 3-5회, 이미지 6-13개, 본문 600-800자
 * - 어드민에서 "복사" 버튼 → 네이버 블로그에 붙여넣기
 * - 하루 3건 생성 (크론 1회당 3건)
 */

const BATCH_SIZE = 3;

async function handler(req: NextRequest) {
  const sb = getSupabaseAdmin();

  // 이미 발행된 slug 목록
  const { data: existing } = await (sb as any).from('naver_syndication').select('blog_slug');
  const existingSlugs = new Set((existing || []).map((e: any) => e.blog_slug));

  // 조회수 상위 블로그 포스트 중 미발행분
  const { data: posts } = await sb.from('blog_posts')
    .select('id, slug, title, content, excerpt, category, tags, cover_image, image_alt, author_name, published_at, view_count, meta_description')
    .eq('is_published', true)
    .not('published_at', 'is', null)
    .order('view_count', { ascending: false })
    .limit(100);

  const candidates = (posts || []).filter((p: any) => !existingSlugs.has(p.slug));
  const batch = candidates.slice(0, BATCH_SIZE);

  if (batch.length === 0) {
    return NextResponse.json({ ok: true, message: 'No new posts to syndicate', count: 0 });
  }

  let success = 0;
  const errors: string[] = [];

  for (const post of batch) {
    try {
      const naverContent = await generateNaverContent(post);
      
      await (sb as any).from('naver_syndication').insert({
        blog_post_id: post.id,
        blog_slug: post.slug,
        original_title: post.title,
        naver_title: naverContent.title,
        naver_html: naverContent.html,
        naver_tags: naverContent.tags,
        category: post.category,
        target: 'both',
        blog_status: 'pending',
        cafe_status: 'pending',
      });

      success++;
    } catch (e: any) {
      errors.push(`${post.slug}: ${e.message}`);
    }
  }

  return NextResponse.json({ ok: true, success, errors, total: batch.length });
}

async function generateNaverContent(post: any): Promise<{ title: string; html: string; tags: string[] }> {
  const SITE = SITE_URL;
  const catLabel: Record<string, string> = { stock: '주식', apt: '부동산', unsold: '미분양', finance: '재테크', general: '생활' };
  const category = catLabel[post.category] || '정보';
  
  // 본문에서 마크다운 제거
  const plainContent = (post.content || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_|`~>\[\]]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 3000);

  const ogImage = post.cover_image?.startsWith('http') 
    ? post.cover_image 
    : `${SITE}/api/og?title=${encodeURIComponent((post.title || '').slice(0, 50))}&design=2&category=${post.category}`;

  // AI로 네이버 블로그 최적화 변환
  const prompt = `다음 블로그 글을 네이버 블로그에 최적화된 HTML로 변환하세요.

## 원본 글
제목: ${post.title}
카테고리: ${category}
본문:
${plainContent}

## 네이버 블로그 최적화 규칙 (반드시 준수)
1. 제목: 25자 이내, 핵심 키워드를 맨 앞에 배치
2. 본문 구조: H2 소제목 4-6개로 구분, 각 섹션 150-200자
3. 키워드: 제목의 핵심 키워드를 본문에 3-5회 자연스럽게 반복
4. 이미지 위치: 각 H2 섹션 사이에 이미지 플레이스홀더 [IMAGE] 삽입 (총 6-8개)
5. 마지막에 "📌 더 자세한 정보는 카더라(kadeora.app)에서 확인하세요" 문구 + 링크 포함
6. 해시태그: 관련 태그 5-8개 추출

## 출력 형식 (JSON)
{
  "title": "네이버 최적화 제목 (25자 이내)",
  "html": "네이버 블로그용 HTML (이미지 플레이스홀더 포함)",
  "tags": ["태그1", "태그2", ...]
}

JSON만 출력하세요. 다른 텍스트 없이.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: AI_MODEL_HAIKU,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // 이미지 플레이스홀더를 실제 OG 이미지로 교체
    let html = parsed.html || '';
    const ogSquare = `${SITE}/api/og-square?title=${encodeURIComponent((post.title || '').slice(0, 40))}&category=${post.category}`;
    const images = [ogImage, ogSquare];
    let imgIdx = 0;
    html = html.replace(/\[IMAGE\]/g, () => {
      const img = images[imgIdx % images.length];
      imgIdx++;
      return `<p style="text-align:center"><img src="${img}" alt="${post.image_alt || post.title}" style="max-width:100%;border-radius:8px" /></p>`;
    });

    // 하단 CTA 링크 보강
    if (!html.includes('kadeora.app')) {
      html += `\n<p><br /></p>\n<p>📌 <strong>더 자세한 분석은 <a href="${SITE}/blog/${post.slug}?utm_source=naver_blog&utm_medium=syndication" target="_blank" rel="noopener">카더라(kadeora.app)</a>에서 확인하세요!</strong></p>`;
    }

    return {
      title: (parsed.title || post.title).slice(0, 25),
      html,
      tags: parsed.tags || (post.tags || []).slice(0, 8),
    };
  } catch {
    // AI 실패 시 기본 변환
    const fallbackHtml = `
<h2>${post.title}</h2>
<p style="text-align:center"><img src="${ogImage}" alt="${post.image_alt || post.title}" style="max-width:100%;border-radius:8px" /></p>
<p>${(post.excerpt || post.meta_description || '').slice(0, 300)}</p>
<p><br /></p>
<p>📌 <strong>전문은 <a href="${SITE}/blog/${post.slug}?utm_source=naver_blog&utm_medium=syndication" target="_blank" rel="noopener">카더라(kadeora.app)</a>에서 확인하세요!</strong></p>`;

    return {
      title: (post.title || '').slice(0, 25),
      html: fallbackHtml,
      tags: (post.tags || []).slice(0, 8),
    };
  }
}

export const GET = (req: NextRequest) => withCronLogging('naver-blog-content', () => handler(req));
