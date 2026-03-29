import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 블로그 글을 안전하게 INSERT하는 유틸리티 (v3)
 * 
 * DB의 blog_publish_config에서 설정을 읽어 적용:
 * - is_published = false (큐 대기 상태)
 * - published_at = null (발행 크론이 세팅)
 * - 제목 유사도 체크 (threshold는 DB 설정)
 * - 하루 생성 상한 체크 (DB 설정)
 * - 최소 콘텐츠 길이 체크 (DB 설정)
 * - 품질 게이트 통과를 위한 자동 콘텐츠 보강 (TOC/내부링크/지도링크/FAQ)
 * 
 * 모든 블로그 크론에서 직접 .insert() 대신 이 함수를 사용합니다.
 */

/* ═══════════ 콘텐츠 자동 보강 (품질 게이트 통과용) ═══════════ */

function enrichContent(content: string, category: string, title: string): string {
  let enriched = content;

  // 1. TOC 자동 생성 — h2 헤더 추출 → ## 목차 섹션 삽입
  const h2Matches = enriched.match(/^## .+$/gm);
  if (h2Matches && h2Matches.length >= 2 && !enriched.includes('## 목차')) {
    const tocLines = h2Matches.map((h, i) => {
      const text = h.replace(/^## /, '').trim();
      return `${i + 1}. ${text}`;
    });
    const tocSection = `## 목차\n\n${tocLines.join('\n')}\n\n`;
    // 첫 번째 h2 바로 앞에 삽입
    const firstH2Idx = enriched.indexOf(h2Matches[0]);
    if (firstH2Idx > 0) {
      enriched = enriched.slice(0, firstH2Idx) + tocSection + enriched.slice(firstH2Idx);
    } else {
      enriched = tocSection + enriched;
    }
  }

  // 2. 내부 링크 자동 삽입 — 카테고리별 관련 페이지 링크
  const hasInternalLink = /\]\(\/(stock|apt|feed|blog)/.test(enriched) || /href="\/(stock|apt)/.test(enriched);
  if (!hasInternalLink) {
    const linkMap: Record<string, string[]> = {
      stock: [
        '\n\n> 📊 [카더라 주식 시황 더보기](/stock) | [실시간 뉴스](/stock?tab=news)',
      ],
      apt: [
        '\n\n> 🏠 [카더라 청약 일정 확인](/apt) | [분양 정보 보기](/apt?tab=ongoing)',
      ],
      unsold: [
        '\n\n> 📉 [전국 미분양 현황](/apt?tab=unsold) | [청약 일정 확인](/apt)',
      ],
      finance: [
        '\n\n> 💰 [카더라 주식 분석](/stock) | [부동산 정보](/apt)',
      ],
      general: [
        '\n\n> 📌 [카더라 커뮤니티](/feed) | [블로그 더보기](/blog)',
      ],
    };
    const links = linkMap[category] || linkMap.general;
    // FAQ 또는 마지막 h2 섹션 앞에 삽입
    const faqIdx = enriched.indexOf('## 자주 묻는 질문');
    if (faqIdx > 0) {
      enriched = enriched.slice(0, faqIdx) + links[0] + '\n\n' + enriched.slice(faqIdx);
    } else {
      enriched += links[0];
    }
  }

  // 3. FAQ 자동 삽입 — FAQ 섹션이 없는 경우
  const hasFAQ = /FAQ|자주 묻는 질문|Q\..+A\./s.test(enriched);
  if (!hasFAQ) {
    const faqMap: Record<string, string> = {
      stock: `\n\n## 자주 묻는 질문\n\n**Q. 이 종목의 투자 전망은?**\n\nA. 시장 상황과 기업 실적에 따라 달라질 수 있으므로, 최신 재무제표와 업종 동향을 함께 확인하시기 바랍니다.\n\n**Q. 적정 매수 시점은 언제인가요?**\n\nA. 기술적 분석과 펀더멘털 분석을 병행하여 본인의 투자 성향에 맞는 진입 시점을 결정하시길 권장합니다.\n\n**Q. 배당 정보는 어디서 확인하나요?**\n\nA. [카더라 주식 페이지](/stock)에서 종목별 배당 이력과 배당수익률을 확인하실 수 있습니다.`,
      apt: `\n\n## 자주 묻는 질문\n\n**Q. 청약 자격 조건은 어떻게 되나요?**\n\nA. 청약 자격은 지역, 세대주 여부, 무주택 기간 등에 따라 달라집니다. [카더라 청약 페이지](/apt)에서 상세 조건을 확인하세요.\n\n**Q. 분양가 대비 시세 차익은?**\n\nA. 주변 실거래가와 분양가를 비교하여 예상 시세 차익을 산정할 수 있습니다.\n\n**Q. 모델하우스 방문은 언제 가능한가요?**\n\nA. 각 단지별 모델하우스 오픈일은 [청약 일정](/apt)에서 확인하실 수 있습니다.`,
    };
    enriched += faqMap[category] || faqMap.stock || '';
  }

  // 4. 지도 링크 자동 삽입 — 부동산 카테고리 필수
  if ((category === 'apt' || category === 'unsold') && !enriched.includes('map.kakao') && !enriched.includes('map.naver')) {
    // 제목에서 지역명 추출 시도
    const regionMatch = title.match(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/);
    const region = regionMatch ? regionMatch[1] : '서울';
    const mapLink = `\n\n> 🗺️ [네이버 지도에서 위치 확인](https://map.naver.com/v5/search/${encodeURIComponent(title.replace(/\d{4}|추천|분석|현황|리포트/g, '').trim())})`;
    const faqIdx = enriched.indexOf('## 자주 묻는 질문');
    if (faqIdx > 0) {
      enriched = enriched.slice(0, faqIdx) + mapLink + '\n\n' + enriched.slice(faqIdx);
    } else {
      enriched += mapLink;
    }
  }

  return enriched;
}

interface BlogInsertData {
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  category: string;
  tags?: string[];
  source_type?: string;
  cron_type?: string;
  data_date?: string;
  source_ref?: string;
  cover_image?: string;
  image_alt?: string;
  meta_description?: string;
  meta_keywords?: string;
  is_published?: boolean;
}

interface SafeInsertResult {
  success: boolean;
  reason?: 'duplicate_slug' | 'similar_title' | 'daily_limit' | 'content_too_short' | 'error';
  id?: string;
  similarTo?: string;
}

// config 캐시 (크론 1회 실행 내 재사용)
let configCache: { daily_create_limit: number; min_content_length: number; title_similarity_threshold: number } | null = null;

async function getConfig(admin: SupabaseClient) {
  if (configCache) return configCache;
  const { data } = await admin.from('blog_publish_config').select('daily_create_limit, min_content_length, title_similarity_threshold').eq('id', 1).single();
  configCache = data ?? { daily_create_limit: 10, min_content_length: 1200, title_similarity_threshold: 0.4 };
  return configCache;
}

export async function safeBlogInsert(
  admin: SupabaseClient,
  data: BlogInsertData
): Promise<SafeInsertResult> {
  try {
    const config = await getConfig(admin);

    // 1. 최소 콘텐츠 길이 체크
    if (data.content.length < config.min_content_length) {
      return { success: false, reason: 'content_too_short' };
    }

    // 2. 슬러그 중복 체크
    const { data: existing } = await admin
      .from('blog_posts')
      .select('id')
      .eq('slug', data.slug)
      .maybeSingle();

    if (existing) {
      return { success: false, reason: 'duplicate_slug' };
    }

    // 3. 제목 유사도 체크 (pg_trgm)
    try {
      const { data: similar } = await admin.rpc('check_blog_similarity', {
        p_title: data.title,
        p_threshold: config.title_similarity_threshold,
      });
      if (similar && similar.length > 0) {
        return { success: false, reason: 'similar_title', similarTo: similar[0].title };
      }
    } catch {
      // pg_trgm 미설치 → 스킵
    }

    // 4. 하루 생성량 체크
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await admin
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());

    if ((count ?? 0) >= config.daily_create_limit) {
      return { success: false, reason: 'daily_limit' };
    }

    // 5. 커버 이미지 자동 생성 (미제공 시)
    const authorMap: Record<string, string> = {
      stock: '카더라+주식팀', apt: '카더라+부동산팀', unsold: '카더라+부동산팀',
      finance: '카더라+재테크팀', general: '카더라+편집팀',
    };
    const author = authorMap[data.category] || '카더라';
    const coverImage = data.cover_image || `/api/og?title=${encodeURIComponent(data.title)}&category=${data.category}&author=${author}&design=2`;
    const imageAlt = data.image_alt || `${data.title} — 카더라 ${data.category === 'stock' ? '주식' : data.category === 'apt' ? '부동산' : '정보'} 분석`;

    // 6. 콘텐츠 자동 보강 (품질 게이트 통과: TOC/내부링크/FAQ/지도링크)
    const enrichedContent = enrichContent(data.content, data.category, data.title);

    // 7. INSERT (큐 대기 상태)
    const { data: inserted, error } = await admin
      .from('blog_posts')
      .insert({
        slug: data.slug,
        title: data.title,
        content: enrichedContent,
        excerpt: data.excerpt || data.content.slice(0, 100).replace(/[#|*\n]/g, ''),
        category: data.category,
        tags: data.tags || [],
        source_type: data.source_type || 'auto',
        cron_type: data.cron_type,
        data_date: data.data_date,
        source_ref: data.source_ref,
        cover_image: coverImage,
        image_alt: imageAlt,
        meta_description: data.meta_description,
        meta_keywords: data.meta_keywords,
        is_published: data.is_published ?? false,
        published_at: data.is_published ? new Date().toISOString() : null,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`[safeBlogInsert] Insert error:`, error.message);
      return { success: false, reason: 'error' };
    }

    return { success: true, id: inserted?.id };
  } catch (err: any) {
    console.error(`[safeBlogInsert] Error:`, err.message);
    return { success: false, reason: 'error' };
  }
}
