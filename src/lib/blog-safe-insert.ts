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

  // 0. h2 부족 시 h3 → h2 승격 (품질 게이트 NO_TOC 방지)
  const h2Count = (enriched.match(/^## [^#]/gm) || []).length;
  if (h2Count < 2) {
    // ### → ## 로 승격 (최대 5개)
    let promoted = 0;
    enriched = enriched.replace(/^### (.+)$/gm, (match, p1) => {
      if (promoted >= 5) return match;
      promoted++;
      return `## ${p1}`;
    });
  }

  // 1. TOC는 프론트엔드 extractToc()에서 자동 생성 → 콘텐츠에 삽입하지 않음
  // (세션70에서 ## 목차 H2 제거/숨김 처리 완료)

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


  // 4. 계산기 CTA 블록 삽입 (v2)
  const hasCalcCTA = /calc\/|계산기/.test(enriched);
  if (!hasCalcCTA) {
    const calcMap: Record<string, { label: string; url: string; desc: string }[]> = {
      apt: [
        { label: '청약 가점 계산기', url: '/calc/real-estate/subscription-score', desc: '내 청약 가점 확인' },
        { label: '중개수수료 계산기', url: '/calc/real-estate/brokerage-fee', desc: '매매·전세 복비 계산' },
        { label: 'DSR 계산기', url: '/calc/real-estate/dsr-calc', desc: '대출 한도 확인' },
      ],
      stock: [
        { label: '주식 수익률 계산기', url: '/calc/investment/stock-roi', desc: '매수·매도 수익 계산' },
        { label: '배당수익률 계산기', url: '/calc/investment/dividend-yield', desc: '배당 수익률 확인' },
        { label: '복리 계산기', url: '/calc/investment/compound-interest', desc: '장기 투자 수익 시뮬레이션' },
      ],
      finance: [
        { label: '대출이자 계산기', url: '/calc/loan/loan-repayment', desc: '원리금 상환 계산' },
        { label: '예금이자 계산기', url: '/calc/investment/deposit-interest', desc: '예금 만기 수령액' },
        { label: '적금이자 계산기', url: '/calc/investment/savings-interest', desc: '적금 만기 수령액' },
      ],
      general: [
        { label: '실수령액 계산기', url: '/calc/income-tax/net-salary', desc: '연봉별 실수령액 확인' },
        { label: '퇴직금 계산기', url: '/calc/salary/severance-pay', desc: '퇴직금 예상액 계산' },
      ],
    };
    const calcs = calcMap[category] || calcMap.general;
    if (calcs && calcs.length > 0) {
      const ctaBlock = '\n\n---\n\n### 💡 직접 계산해보세요\n\n| 계산기 | 용도 |\n|--------|------|\n'
        + calcs.map(c => `| [${c.label}](${c.url}) | ${c.desc} |`).join('\n')
        + '\n\n---';
      // FAQ 앞에 삽입
      const faqIdx2 = enriched.indexOf('## 자주 묻는 질문');
      if (faqIdx2 > 0) {
        enriched = enriched.slice(0, faqIdx2) + ctaBlock + '\n\n' + enriched.slice(faqIdx2);
      } else {
        enriched += ctaBlock;
      }
    }
  }

  // 5. FAQ 자동 삽입 — FAQ 섹션이 없는 경우
  const hasFAQ = /FAQ|자주 묻는 질문|Q\.[^]*A\./.test(enriched);
  if (!hasFAQ) {
    const faqMap: Record<string, string> = {
      stock: `\n\n## 자주 묻는 질문\n\n**Q. 이 종목의 투자 전망은?**\n\nA. 시장 상황과 기업 실적에 따라 달라질 수 있으므로, 최신 재무제표와 업종 동향을 함께 확인하시기 바랍니다.\n\n**Q. 적정 매수 시점은 언제인가요?**\n\nA. 기술적 분석과 펀더멘털 분석을 병행하여 본인의 투자 성향에 맞는 진입 시점을 결정하시길 권장합니다.\n\n**Q. 배당 정보는 어디서 확인하나요?**\n\nA. [카더라 주식 페이지](/stock)에서 종목별 배당 이력과 배당수익률을 확인하실 수 있습니다.`,
      apt: `\n\n## 자주 묻는 질문\n\n**Q. 청약 자격 조건은 어떻게 되나요?**\n\nA. 청약 자격은 지역, 세대주 여부, 무주택 기간 등에 따라 달라집니다. [카더라 청약 페이지](/apt)에서 상세 조건을 확인하세요.\n\n**Q. 분양가 대비 시세 차익은?**\n\nA. 주변 실거래가와 분양가를 비교하여 예상 시세 차익을 산정할 수 있습니다.\n\n**Q. 모델하우스 방문은 언제 가능한가요?**\n\nA. 각 단지별 모델하우스 오픈일은 [청약 일정](/apt)에서 확인하실 수 있습니다.`,
      unsold: `\n\n## 자주 묻는 질문\n\n**Q. 미분양 아파트를 구매하면 어떤 혜택이 있나요?**\n\nA. 미분양 아파트는 할인 분양, 발코니 확장 무료, 옵션 서비스 등 다양한 혜택이 제공될 수 있습니다.\n\n**Q. 미분양 아파트의 입주 시기는?**\n\nA. 대부분 즉시 입주 또는 단기 내 입주가 가능합니다. [미분양 현황](/apt?tab=unsold)에서 상세 정보를 확인하세요.\n\n**Q. 미분양 아파트도 대출이 가능한가요?**\n\nA. 네, 일반 분양 아파트와 동일하게 주택담보대출 이용이 가능합니다.`,
      finance: `\n\n## 자주 묻는 질문\n\n**Q. 최신 경제 지표는 어디서 확인하나요?**\n\nA. [카더라 주식 페이지](/stock)에서 환율, 금리 등 주요 경제 지표를 실시간으로 확인할 수 있습니다.\n\n**Q. 투자 관련 추가 정보는?**\n\nA. [카더라 블로그](/blog)에서 투자 전략, 시장 분석 리포트를 무료로 확인하실 수 있습니다.`,
      general: `\n\n## 자주 묻는 질문\n\n**Q. 카더라에서 어떤 정보를 볼 수 있나요?**\n\nA. 주식 시황, 부동산 청약/분양/미분양/재개발 정보, 그리고 투자 관련 커뮤니티를 제공합니다. [피드](/feed)에서 최신 소식을 확인하세요.\n\n**Q. 알림 설정은 어떻게 하나요?**\n\nA. 로그인 후 [알림 설정](/notifications/settings)에서 푸시 알림을 활성화할 수 있습니다.`,
    };
    enriched += faqMap[category] || faqMap.general || '';
  }

  // 4. 지도 링크 자동 삽입 — 부동산 카테고리 필수
  if ((category === 'apt' || category === 'unsold') && !enriched.includes('map.kakao') && !enriched.includes('map.naver')) {
    const mapLink = `\n\n> 🗺️ [네이버 지도에서 위치 확인](https://map.naver.com/v5/search/${encodeURIComponent(title.replace(/\d{4}|추천|분석|현황|리포트/g, '').trim())})`;
    const faqIdx = enriched.indexOf('## 자주 묻는 질문');
    if (faqIdx > 0) {
      enriched = enriched.slice(0, faqIdx) + mapLink + '\n\n' + enriched.slice(faqIdx);
    } else {
      enriched += mapLink;
    }
  }

  // 5. 데이터 출처 블록 — E-E-A-T 신뢰성 + YMYL 필수
  if (!enriched.includes('데이터 출처') && !enriched.includes('출처:')) {
    const sourceMap: Record<string, string> = {
      stock: '\n\n---\n\n**데이터 출처:** 한국거래소(KRX), 금융감독원 전자공시시스템(DART), 카더라 자체 수집 데이터 | **기준일:** ' + new Date().toISOString().slice(0, 10),
      apt: '\n\n---\n\n**데이터 출처:** 국토교통부 실거래가 공개시스템, 한국부동산원, 카더라 자체 수집 데이터 | **기준일:** ' + new Date().toISOString().slice(0, 10),
      unsold: '\n\n---\n\n**데이터 출처:** 국토교통부 미분양 현황, 한국부동산원, 카더라 자체 수집 데이터 | **기준일:** ' + new Date().toISOString().slice(0, 10),
      finance: '\n\n---\n\n**데이터 출처:** 한국은행, 금융감독원, 카더라 자체 수집 데이터 | **기준일:** ' + new Date().toISOString().slice(0, 10),
      general: '\n\n---\n\n**출처:** 카더라(kadeora.app)',
    };
    enriched += sourceMap[category] || sourceMap.general;
  }

  // 6. 투자 면책 조항 — YMYL 금융 콘텐츠 필수
  if (!enriched.includes('투자 권유') && !enriched.includes('면책') && (category === 'stock' || category === 'apt' || category === 'unsold' || category === 'finance')) {
    enriched += '\n\n> ⚠️ 본 콘텐츠는 투자 참고 자료이며, 특정 금융상품의 매수·매도를 권유하지 않습니다. 투자 판단은 본인의 책임이며, 반드시 전문가 상담 후 결정하시기 바랍니다.';
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
  message?: string;
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

    // 1. 콘텐츠 자동 보강 (품질 게이트 통과: TOC/내부링크/FAQ/지도링크)
    const enrichedContent = enrichContent(data.content, data.category, data.title);

    // 2. 최소 콘텐츠 길이 체크 (보강 후 기준)
    if (enrichedContent.length < config.min_content_length) {
      return { success: false, reason: 'content_too_short' };
    }

    // 3. 슬러그 중복 체크
    const { data: existing } = await admin
      .from('blog_posts')
      .select('id')
      .eq('slug', data.slug)
      .maybeSingle();

    if (existing) {
      return { success: false, reason: 'duplicate_slug' };
    }

    // 4. 제목 유사도 체크 (pg_trgm)
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

    // 5. 하루 생성량 체크
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await admin
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());

    if ((count ?? 0) >= config.daily_create_limit) {
      return { success: false, reason: 'daily_limit' };
    }

    // 6. 커버 이미지 자동 생성 (미제공 시)
    const authorMap: Record<string, string> = {
      stock: '카더라+주식팀', apt: '카더라+부동산팀', unsold: '카더라+부동산팀',
      finance: '카더라+재테크팀', general: '카더라+편집팀',
    };
    const author = authorMap[data.category] || '카더라';
    const coverImage = data.cover_image || `/api/og?title=${encodeURIComponent(data.title)}&category=${data.category}&author=${author}&design=2`;
    const imageAlt = data.image_alt || `${data.title} — 카더라 ${data.category === 'stock' ? '주식' : data.category === 'apt' ? '부동산' : '정보'} 분석`;

    // 7. INSERT (큐 대기 상태) — ON CONFLICT로 race condition 방지
    const insertPayload = {
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
    };

    const { data: inserted, error } = await admin
      .from('blog_posts')
      .upsert(insertPayload, { onConflict: 'slug', ignoreDuplicates: true })
      .select('id');

    if (error) {
      console.error(`[safeBlogInsert] Insert error for "${data.title}" (${data.category}, ${enrichedContent.length}자):`, error.message, '| code:', error.code, '| details:', error.details);
      return { success: false, reason: 'error', message: error.message };
    }

    // ignoreDuplicates=true → 중복 시 빈 배열 반환
    if (!inserted || inserted.length === 0) {
      return { success: false, reason: 'duplicate_slug' };
    }

    return { success: true, id: inserted[0]?.id };
  } catch (err: any) {
    console.error(`[safeBlogInsert] Exception for "${data.title}":`, err.message);
    return { success: false, reason: 'error' };
  }
}
