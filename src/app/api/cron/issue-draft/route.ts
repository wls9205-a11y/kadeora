export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { submitIndexNow } from '@/lib/indexnow';
import { selectDraftTemplate } from '@/lib/issue-scoring';
import { SITE_URL } from '@/lib/constants';
import { isBlockedImageUrl } from '@/lib/image-pipeline';
// s189: SEO 마스터 (내부링크/EAT 외부인용은 master 가 내부 호출) + 관련 hub footer
import { runBlogSeoMaster } from '@/lib/blog-seo-master';
import { appendRelatedHubFooter } from '@/lib/internal-link-injector';
// s239 Phase 0: LLM 사용량 추적 (fire-and-forget, main flow 영향 0)
import { getFreshnessContext, deriveFreshnessFields } from '@/lib/blog/freshness-context';
import { dbw } from '@/lib/cron-db-log';
import { anthropicFetch, llmCategoryOfContent } from '@/lib/llm/gateway';
import { sortForGeneration } from '@/lib/content/realestate-priority';
import { isLeadEligible } from '@/lib/apt/lead-eligibility';
import { reviewHoldOf, reviewSwitches, isReviewHoldReason, SCAN2_NAMESPACES } from '@/lib/content/review-hold';
import { injectStageSection, injectDataSection } from '@/lib/content/stage-phrase';
import { repairLinks, exciseCompact, scanDraft2, enforceTitleSpec, PROMPT_LEAK_MARKER, extractInternalLinks, HARD_HOLD_RULES, LOCAL_EDIT_RULES, type Scan2Defect } from '@/lib/content/draft-scan2';

/**
 * BN-B2 §4·§5 — 현장 글 축약 규격(raw_data.template='site_compact'). 제도 상수 블록은 싣지 않는다(loadIssueContext).
 * 청약 요건·세제·대출·전매·재당첨·세액공제 같은 제도 일반론은 현장 글에서 빼고 상위 경로로만 안내한다 —
 * 오류 표면적(112524 전매 「제한 없음」·112528 월세 공제율)·전 현장 중복 콘텐츠·생성 비용을 한꺼번에 줄인다.
 */
const COMPACT_SITE_RULES = `
## 현장 글 목차 규격 (이 순서 그대로)
1. 3줄 요약 — 단지명(제안 여부)·구역·현재 단계
2. ## 현장 개요 — 단지명·시공사·사업 성격·위치(시·구·동까지만)·세대수(블록 값, 없으면 「미정」)
3. ## 사업 단계 — 제목만 두고 본문은 한 문장 이하로 둔다(시스템이 확정 문형으로 채운다). 다른 섹션에서도 블록의 「사업 단계(확정)」와 다른 단계·조합 구성 여부를 쓰지 않는다
⛔ 조합원 자격은 「사업 단계」 섹션에 시스템이 넣는 문형만 따른다 — 재개발은 「토지 또는 건축물 소유자(토지등소유자)」, 재건축은 「건축물 및 그 부속토지 소유자 중 재건축사업에 동의한 사람」(도시정비법 제2조 제9호·제39조). 재개발 문형을 재건축 현장에 쓰지 않는다. 세입자·거주자가 조합원이 된다고 쓰지 않는다.
⛔ 블록의 사업 단계가 조합설립인가 이후면 조합은 «이미 있다». 「조합 설립 후」「조합 구성」「조합원 모집」「조합 설립·인가를 거쳐」처럼 조합이 아직 없다는 전제의 문장을 어디에도 쓰지 않는다(BN-C 9편 중 4편). 남은 일정은 「사업 단계」 섹션이 적은 절차만 가리킨다.
⛔ 기관명은 「한국부동산원」(옛 「한국감정원」 금지). 데이터 출처는 「국토교통부 실거래가 공개시스템」만.
4. ## 주변 거래 데이터 — 제목만 두고 본문은 한 문장 이하(시스템이 블록 값으로 채운다). 중위 거래가는 이 섹션 밖(요약·FAQ)에서 반복하지 않는다
5. ## 자주 묻는 질문 — 4~6문항(7문항 이상 금지), 현장 사실만. 시세·중위 거래가를 묻는 문항을 만들지 않는다(거래 데이터는 위 섹션에만)
6. 관심 고객 안내 — 현장 상세 링크로 청약·일정 알림 받기
⛔ 위 1~6 과 면책 외의 H2 섹션을 더하지 않는다(「분양가 및 계약 조건」「입지와 교통」「특성과 리스크」 등 금지).
⛔ 제도 일반론 섹션을 만들지 않는다: 청약 자격·가점, 취득세·양도세·월세 세액공제, LTV·DSR·중도금 대출, 전매제한·재당첨, 시나리오 전망.
   필요하면 한 줄로 [청약 가점 계산기](/apt/diagnose) · [카더라 계산기](/calc) 링크만 단다.
⛔ 지리 서술 금지 — 지하철역·역세권 이름·권역(「동부산」·「서면권」 등)을 쓰지 않는다. 위치는 시·구·동까지만.
⛔ 운영 메모 금지 — 「글감」·「선택 조건」·「이 글의 조건상」 같은 제작 과정 표현을 쓰지 않는다.
`;

/** BN-B §3-B — 생성 시점 외부 이미지 삽입 중단(insertImages 머리말 참조). */
const EXTERNAL_IMAGE_INSERT_DISABLED = true;
import { editOutNumbers, editScan2Defects, loadIssueContext, buildIssueAllow, verifyIssueDraft, type IssueContext } from '@/lib/content/issue-context';
import { parseSalePeriod } from '@/lib/apt/sale-period';
import { periodWindow } from '@/lib/apt/upcoming-sales';
import { naverOpenApiFetch } from '@/lib/naver/openapi';

/**
 * issue-draft v2 — AI 기사 생성 + 자동 발행 + 이미지 + 피드 포스트
 *
 * 세션 108 전면 수정:
 * - A1: og-infographic 제거 → 마크다운 하이라이트 블록
 * - A2: blog_posts.is_published 강제 UPDATE (비공개 버그 수정)
 * - A3: AI 에러 로깅 + retry_count 재시도 (최대 3회)
 * - A5: 네이버 이미지 검색 → 실사진 삽입
 * - B1: withCronLogging 적용
 * - B3: FAQ 필수 강화 + max_tokens 12000
 * - B4: MAX_PER_RUN 15, 스케줄 every 7min
 * - C2: seo_tier 기본 'A'
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

/* ═══════════ 킬스위치 체크 ═══════════ */

async function getAutoPublishConfig(sb: any) {
  try {
    const { data } = await sb.from('blog_publish_config')
      .select('auto_publish_enabled, auto_publish_min_score, auto_publish_blocked_categories')
      .eq('id', 1).single();
    return data || { auto_publish_enabled: true, auto_publish_min_score: 40, auto_publish_blocked_categories: [] };
  } catch {
    return { auto_publish_enabled: true, auto_publish_min_score: 40, auto_publish_blocked_categories: [] };
  }
}

/* ═══════════ 네이버 이미지 검색 ═══════════ */

async function searchNaverImages(query: string, count = 5): Promise<{ url: string; alt: string }[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  try {
    const res = await naverOpenApiFetch('cron/issue-draft', `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${count}&sort=sim&filter=large`, {
      headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[issue-draft] Naver Image API error: ${res.status} | query="${query}"`);
      return [];
    }
    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      url: (item.link || '').replace('http://', 'https://'),
      alt: item.title?.replace(/<[^>]+>/g, '') || query,
    // s268(3): 자체 필터가 daumcdn·tistory 둘뿐이라 뉴스사 핫링크가 그대로 통과했다.
    // image-pipeline 의 차단 목록을 같이 쓴다 — 후보를 만드는 자리는 모두 같은 자를 쓴다.
    })).filter((img: any) => img.url && !isBlockedImageUrl(img.url));
  } catch (err: any) {
    console.error(`[issue-draft] Naver fetch error: ${err.message} | query="${query}"`);
    return [];
  }
}

/* ═══════════ AI 기사 생성 (v2: 에러 로깅 + og-infographic 제거) ═══════════ */

/** A2 — 실패 사유 5분류. 「왜 못 만들었나」가 로그에 남아야 B1 에서 판단할 수 있다. */
/* BG-0(2026-08-31) — 'model_error' 하나에 «성질이 다른 넷» 이 뭉쳐 있었다:
   API 4xx(요청이 거절됨) · API 5xx(서버 문제) · 키 없음 · 빈 응답 · 예외.
   14일 실측에서 issue-draft 는 성공 597 · 에러 3,001(83%) 인데, 그 3,001 이
   «무엇인지» 를 아무도 말할 수 없었다 — 사유가 한 낱말로 뭉개져 있었기 때문이다.
   ⚠️ 기존 값 'model_error' 는 «지우지 않는다» — issue_alerts.fail_reason 에 쌓여 있다.
      새 값을 더할 뿐이고, 옛 행은 「가르기 전에 쌓인 것」으로 읽는다. */
export type DraftFailReason =
  | 'model_error'   // (레거시) 8/31 이전에 쌓인 뭉친 값
  | 'api_4xx'       // API 가 요청을 거절 — 같은 요청을 다시 보내도 같은 답이다
  | 'api_5xx'       // API 쪽 일시 장애 — 재시도에 의미가 있다
  | 'quota'         // LLM 관문 쿼터(합성 429). API 거절이 아니다 — 재시도 횟수를 «쓰지 않고» 미룬다
  | 'no_key'
  | 'empty_text'
  | 'exception'
  | 'parse' | 'token_limit' | 'duplicate' | 'no_match';
type GenResult = { title: string; content: string; slug: string; keywords: string[]; meta_description: string; infographic_data: Record<string, any> };

async function generateArticle(issue: any, bigEventContext = '', siteContext = '', sourceText = '', constantsBlock = ''): Promise<{ article: GenResult | null; failReason: DraftFailReason | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error('[issue-draft] ANTHROPIC_API_KEY missing'); return { article: null, failReason: 'no_key' }; }

  const template = selectDraftTemplate(issue.category, issue.issue_type);
  const isPreempt = ['pre_announcement', 'preempt_coverage', 'new_subscription', 'search_spike'].includes(issue.issue_type);
  const catKo = issue.category === 'apt' ? '부동산' : issue.category === 'stock' ? '주식' : '경제';
  // BN-B2 §4 — 현장 글 축약 규격(템플릿 다이어트). 오류의 8할이 현장 사실이 아니라 제도 일반론 장문에서 나왔다.
  const compact = issue.raw_data?.template === 'site_compact';

  // [P0-FACT] big_event context를 system prompt 최상단에 강제 삽입
  const systemPrompt = `${bigEventContext ? bigEventContext + '\n' : ''}당신은 카더라(kadeora.app)의 수석 데이터 에디터입니다. ${isPreempt ? '분양 선점형 심층 분석' : catKo + ' 심층 분석'} 기사를 작성합니다.

규칙:
- 분량: ${compact ? '2,300~4,500자 (현장 사실 중심 — 제도 일반론을 쓰지 않는다)' : isPreempt ? '6,000~8,000자 (충분히 깊이 있게)' : '5,000~7,000자 (충분히 깊이 있게)'}
- H2 섹션: ${compact ? '4~6개' : '6~10개'} (## 형식)
${issue.category === 'apt' ? '- 마크다운 표는 «이 글의 현장» 데이터 블록에 표가 될 행이 있을 때만 만든다. 없으면 표를 만들지 않는다. 표는 많아도 5개 이하' : '- 마크다운 표(|---|): 최소 2개 (비교 분석 필수)'}
${compact ? '' : `- 핵심 수치 강조: **굵은 숫자**와 퍼센트를 적극 활용
- 각 섹션 첫 문장에 핵심 수치 배치
`}- 면책 조항 포함 (투자 판단은 본인 책임)
- 데이터 출처 명시
- 특정 종목/단지 매수·매도 권유 절대 금지
- "오를 것이다", "내릴 것이다" 등 단정적 전망 금지
- 원본 뉴스 문장 그대로 사용 금지 — 팩트만 추출하여 새 문장
- 카더라 내부 링크 3개 이상: [텍스트](/apt), [텍스트](/stock), [텍스트](/blog) 등
${isPreempt ? `
## 선점형 콘텐츠 특별 규칙:
- 입지·일정·사업 단계를 깊이 있게. 분양가·경쟁률은 데이터 블록에 있을 때만 쓴다(F1)
- 주변 시세는 데이터 블록의 «시군구 실거래 집계» 줄만 인용한다 — 개별 단지 시세를 지어내지 않는다
- 청약 전략 가이드 섹션 포함 (가점/추첨, 자금계획)
- "이 정보는 공식 발표 전 수집된 것으로 변동될 수 있습니다" 면책 포함
` : ''}
${issue.category === 'apt' ? `
## 부동산 규격 (LB-5 · 네이버 검색 최적화)
- 제목은 «사람이 실제로 검색하는 말» 로 25~30자: 「{지역 지명} {현장명} {분양일정|분양가|조합원분양|시공사|입주예정}」
  ⛔ 「부울경」 같은 내부 용어를 제목·본문에 쓰지 않는다. 부산·해운대구처럼 «구체 지명» 만 쓴다.
  ⛔ 이름을 하이픈에서 자르지 않는다 — 「범천1-1구역」을 「범천1」로 쓰면 다른 현장이 된다.
- 본문 첫머리에 «3줄 요약» 을 둔다(검색 스니펫용, 각 줄 한 문장).
- 「공급 정보」 표를 하나 둔다: 세대수 · 시공사 · 예상 일정 · 위치. 모르는 값은 「미정」이라고 쓴다.
⛔ 수치 규율(EX-A · 수치 출처율 100%) — 금액·연월·퍼센트는 「이 글의 현장」 블록과 원문 요약에 «있는 값» 만 쓴다.
   추정치·예시 금액·「A아파트」 같은 가상 단지·블록보다 정밀한 시기(「3분기」를 「9월」로)를 쓰지 않는다.
   예시 금액 서술 금지 — 「5억원 취득 시 ○○만원」·「분양가×10%」 같은 가정 계산을 쓰지 않는다(비율·계산 방법만 말로).
   이 규율을 어긴 숫자가 하나라도 있으면 발행 전 검증기가 글 전체를 막는다.
⛔ 사실 규율 — 예정명은 «확정 발표된 것» 만 단정한다. 시공사 선정 «전» 의 이름이면
   반드시 「제안 단지명」이라고 밝힌다. 확정과 제안을 섞으면 그 현장을 영영 잘못 부르게 된다.
⛔ 일정 규율 — 사업 일정표·타임라인에 «이 글의 현장» 블록에 없는 연도·반기를 넣지 않는다(「준공 2030 전후」 금지).
   확정 일정이 없으면 단계 이름만 순서대로 쓰고 시기는 「모집공고 후 확정」 문형으로만 쓴다.
⛔ 표기 규율 — 글감의 내부 표기(발행 경로·트랙·배치 이름, 괄호 속 운영 메모)를 본문·요약에 옮기지 않는다.
   내부 링크는 «이 글의 현장» 블록의 현장 링크와 /apt · /blog · /calc 같은 상위 경로만 쓴다 — /blog/<영문 이름> 같은 글 주소를 지어내지 않는다.
${compact ? COMPACT_SITE_RULES : ''}
${siteContext ? `
## 이 글의 현장 ${PROMPT_LEAK_MARKER}
${siteContext}` : ''}
${constantsBlock ? `
## 제도 상수(전국 공통 · 출처·기준일 있음 — 인용 시 기준일을 함께 쓴다)
${constantsBlock}` : ''}
` : ''}
${compact ? '' : `## 구조 가이드:
- 도입부: 핵심 팩트 1~2줄 → 배경 설명
- 본론: 데이터 테이블 + 분석 의견 교차
- 결론: 전망 시나리오 (긍정/부정/중립 3가지)
`}
⚠️ FAQ는 **필수**입니다. 누락 시 기사가 발행되지 않습니다.
반드시 "## 자주 묻는 질문" 섹션을 포함하고, Q./A. 형식으로 ${compact ? '4~6개(현장 사실 질문만)' : '5~8개'} 작성하세요.
구글/네이버 FAQPage 리치스니펫용이므로 형식을 정확히 지켜주세요.
${issue.category === 'apt' ? `
## FAQ 규격 (AB-2 · AI 브리핑 인용)
- 질문은 «사람이 실제로 검색창에 치는 말» 로: 「{현장명} 분양가는 얼마인가요?」「{현장명} 분양 일정은 언제인가요?」「{현장명} 시공사는 어디인가요?」 형태
- 답의 «첫 문장» 이 질문에 바로 답하는 정의형 문장이어야 한다(「{현장명}의 시공사는 ○○입니다.」). 배경 설명은 그 뒤에
- 숫자(세대수·층수·일정)를 넣고, 보도·공고에서 온 값은 «기준일» 을 괄호로 적는다(예: 「2026년 10월 분양예정(2026-09-10 보도 기준)」)
- 분양가가 미공개면 금액을 쓰지 않는다 — 「분양가 미공개·모집공고 후 확정」
- 「이 글의 현장」의 사업 성격이 일반 분양이면 질문·답 어디에도 「구역」을 쓰지 않는다
` : ''}

기사 유형: ${template}
카테고리: ${catKo}

${getFreshnessContext()}`;

  // s238: title 다양화 컨텍스트 — sub_category/region/월 토큰 prepend.
  // similar_title (pg_trgm 0.35) 차단 95건/주 회복 목적. "{단지명} 분양 분석 | {지역}"
  // 패턴이 자기들끼리 매칭되던 회귀 회피.
  const SUB_CATEGORY_LABEL: Record<string, string> = {
    preempt_coverage: '청약 선점 가이드',
    pre_announcement: '예비 공고 분석',
    new_subscription: '신규 청약',
    search_spike: '검색 급등 분석',
    policy_change: '정책 변경',
    rate_decision: '금리 결정',
    earnings: '실적',
    ma: 'M&A',
    price_change: '가격 변동',
    price_surge: '급등',
    inheritance_tax: '상속·증여',
    fx_change: '환율',
    unsold: '미분양',
    trending_gap: '핫이슈 격차',
  };
  const subLabel = (issue.sub_category && SUB_CATEGORY_LABEL[issue.sub_category]) || '';
  const regionTokens = [issue.region_sido, issue.region_sigungu].filter(Boolean).join(' ');
  // ⚠️ EX-A2 — 부동산 제목에 «이번 달» 토큰을 넣지 않는다. 「2026년 9월 분양일정」은 분양 시기로 읽히는데
  //    원문 시기는 「3분기」·「10월」일 수 있다(BP-B 1회차 실측). 게이트는 이번 달을 허용하므로 여기서 막는다.
  //    EX-B ② — 대신 «데이터 유래» 시기 토큰: 이 글 현장 블록의 esp 원문 그대로의 정밀도(「2026년 3분기」). 지난 시기·esp 없음이면 넣지 않는다.
  const espRaw = /^- 예상 분양 시기: (\S+)/m.exec(siteContext)?.[1] ?? '';
  const espWin = espRaw ? periodWindow(espRaw) : null;
  const nowYmKst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7);
  const espLabel = espWin && espWin.end >= nowYmKst ? (parseSalePeriod(espRaw)?.label ?? '') : '';
  const monthLabel = issue.category === 'apt' ? espLabel : `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월`;
  const titleHint = [subLabel, regionTokens, monthLabel].filter(Boolean).join(' · ');

  const userPrompt = `다음 이슈에 대해 데이터 분석 블로그 기사를 작성하세요.

제목: ${issue.title}
요약: ${issue.summary}
핵심 키워드: ${(issue.detected_keywords || []).join(', ')}
관련 대상: ${(issue.related_entities || []).join(', ')}
${titleHint ? `타이틀 보조 토큰: ${titleHint}` : ''}
원본 데이터: ${JSON.stringify({ ...(issue.raw_data || {}), blocked_draft: undefined, source_text: undefined, number_shadow: undefined,
  // BN-B §3 D — 운영 키는 모델에 보이지 않는다(배치명·트랙·게이트 기록이 본문 누출원). title_spec 은 제목 칸에서 따로 준다.
  batch: undefined, bp70_count: undefined, scan2: undefined, regen_after: undefined, gate_result: undefined, first_unverified: undefined,
  checked: undefined, edit_pending: undefined, title_spec: undefined, complex_name_src: undefined, doc: undefined }).slice(0, 2000)}
출처 URL: ${(issue.source_urls || []).join(', ')}
${sourceText ? `
원문 발췌(출처 기사 본문 — 숫자는 여기와 위 데이터에 있는 것만 쓴다. 문장은 그대로 옮기지 말고 새 문장으로):
${sourceText}
` : ''}
요구사항:
1. ${issue.category === 'apt' ? '마크다운 표는 데이터 블록에 표가 될 행이 있을 때만(없으면 표 없음)' : '비교 분석 마크다운 테이블 최소 2개'}
2. ${issue.category === 'apt' ? '전망은 수치 없이 조건별 서술로(긍정/중립/부정) — 새 숫자·예상 금액 금지' : '3가지 시나리오 전망 (긍정/중립/부정)'}
3. "## 자주 묻는 질문" 섹션 + Q./A. 형식 5~8개 (필수!)
4. 관련 카더라 페이지 내부 링크 3개+ (마크다운 [텍스트](/경로) 형식)
5. 이미지 삽입 금지 — 이미지는 자동으로 추가됩니다
${titleHint ? `6. 제목에 다음 토큰 중 최소 2개 포함 (다양성 ↑, 중복 차단 회피): ${titleHint.split(' · ').filter(Boolean).map(t => `"${t}"`).join(', ')}` : ''}

응답 형식 (JSON만, 다른 텍스트 없이):
{
  "title": "${issue.raw_data?.title_spec
    ? String(issue.raw_data.title_spec)
    : issue.category === 'apt'
    ? `검색어형 제목 25~30자 — 「{지역 지명} {현장명} {분양일정|분양가|조합원분양|시공사|입주예정}」. 하이픈 절단 금지`
    : 'SEO 최적화 제목 (40~60자, | 구분자)'}${titleHint ? `, 반드시 [${titleHint}] 중 2개 이상 포함` : ''}",
  "slug": "url-safe-slug-한글가능",
  "keywords": ["키워드1", "키워드2", ...최소 5개],
  "meta_description": "검색 결과에 노출될 설명 (120~160자)",
  "content": "마크다운 본문 전체 (5000자 이상)"
}`;

  // s239 Phase 0: LLM 사용량 추적 — duration + usage 로깅 (fire-and-forget)
  const llmStart = Date.now();
  try {
    const res = await anthropicFetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 12000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
    }, { caller: 'issue-draft', category: llmCategoryOfContent(issue?.category), postId: null, metadata: { issue_id: issue?.id ?? null } });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[issue-draft] AI API ${res.status}: ${errBody.slice(0, 200)}`);
      /* ⛔⛔ BG-0 — 응답 «본문» 을 DB 에 남긴다.
         이 한 줄이 없어서 14일 3,001건의 400 이 «왜» 400 인지 아무도 몰랐다.
         console.error 는 남았지만 런타임 로그는 보존 기간·조회 예산에 걸려
         「3일 전 그 장애가 무엇이었나」에 답하지 못한다. 판정에 쓸 사실은 DB 에 둔다.
         ⚠️ 400 의 본문에는 사유가 «문장으로» 들어 있다(잘못된 파라미터인지, 한도인지).
            그 문장이 곧 수리 대상을 정한다 — 없으면 추측만 남는다. */
      // ⚠️ 관문 쿼터의 합성 429 는 api_4xx 가 아니다(2026-09-15 실측: 주식·경제 몫 소진으로 48h 59건이
      //    재시도 3회를 «쿼터로» 다 쓰고 ai_failed 로 영구 소각됐다). 헤더로 가려 미룬다.
      if (res.headers.get('x-kadeora-quota')) return { article: null, failReason: 'quota' };
      return { article: null, failReason: res.status >= 500 ? 'api_5xx' : 'api_4xx' };
    }
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    if (!text) { console.error('[issue-draft] AI returned empty text'); return { article: null, failReason: 'empty_text' }; }

    // JSON 파싱 (```json 제거)
    const clean = text.replace(/```json|```/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error(`[issue-draft] JSON parse failed for issue ${issue.id}: ${(parseErr as Error).message}`, clean.slice(0, 200));
      // ⚠️ 응답이 max_tokens 에서 «잘려서» 파싱이 깨진 것과 모델이 형식을 어긴 것은 다른 문제다.
      //    stop_reason 을 봐야 구분된다. 섞어 두면 「파서를 고쳐야 하나 한도를 올려야 하나」를 못 가린다.
      const truncated = data?.stop_reason === 'max_tokens';
      return { article: null, failReason: truncated ? 'token_limit' : 'parse' };
    }

    if (!parsed.title || !parsed.content) {
      console.error(`[issue-draft] Missing title/content for issue ${issue.id}`);
      return { article: null, failReason: 'parse' };
    }

    return { failReason: null, article: {
      title: parsed.title,
      content: parsed.content,
      slug: parsed.slug || parsed.title.replace(/[^가-힣a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase(),
      keywords: parsed.keywords || issue.detected_keywords || [],
      meta_description: parsed.meta_description || '',
      infographic_data: {},
    } };
  } catch (e) {
    console.error('[issue-draft] AI generation exception:', (e as Error).message);
    return { article: null, failReason: 'exception' };
  }
}

/* ═══════════ 콘텐츠 보강 (v2: og-infographic 제거 → 마크다운 하이라이트) ═══════════ */

function enrichVisuals(content: string, issue: any): string {
  let enriched = content;
  const keywords = (issue.detected_keywords || []).slice(0, 5);
  const entities = (issue.related_entities || []).join(', ') || (issue.title || '').slice(0, 20);
  const category = issue.category || 'general';

  // 1. 깨진 og-infographic 참조 전부 제거
  enriched = enriched.replace(/!\[[^\]]*\]\([^)]*og-infographic[^)]*\)\n?/g, '');

  // 2. 도입부에 핵심 요약 하이라이트 블록 (인포그래픽 대체)
  if (!enriched.includes('> **📊') && !enriched.includes('> **🏠') && !enriched.includes('> **📈')) {
    const icon = category === 'apt' ? '🏠' : category === 'stock' ? '📈' : '💡';
    const summaryBlock = `\n> **${icon} 핵심 요약** | ${keywords.slice(0, 3).join(' · ') || entities}\n> ${issue.summary ? issue.summary.slice(0, 120) : '이 기사의 핵심 포인트를 확인하세요.'}\n\n`;

    const firstH2 = enriched.indexOf('\n## ');
    if (firstH2 > 0) {
      enriched = enriched.slice(0, firstH2) + '\n' + summaryBlock + enriched.slice(firstH2);
    }
  }

  // 3. 테이블이 없으면 → 핵심 지표 요약 테이블 자동 삽입
  // BN-B4 ⑥ — 부동산 글엔 메타 표(대상·카테고리·핵심 키워드·분석 시점)를 넣지 않는다 — 운영 메타 노출(D 계보).
  if (!enriched.includes('|---') && category !== 'apt') {
    const catLabel: Record<string, string> = { apt: '부동산', stock: '주식/금융', finance: '재테크', economy: '경제' };
    const summaryTable = `\n\n| 항목 | 내용 |\n|---|---|\n| 대상 | ${entities} |\n| 카테고리 | ${catLabel[category] || '분석'} |\n| 핵심 키워드 | ${keywords.join(', ') || '분석, 전망'} |\n| 분석 시점 | ${new Date().toISOString().slice(0, 10)} |\n| 출처 | 카더라 데이터 분석 |\n\n`;
    const firstH2End = enriched.indexOf('\n', enriched.indexOf('\n## ') + 4);
    if (firstH2End > 0) {
      enriched = enriched.slice(0, firstH2End + 1) + summaryTable + enriched.slice(firstH2End + 1);
    } else {
      enriched += summaryTable;
    }
  }

  // 4. 카더라 내부링크 부족하면 → 하단에 추가
  const internalLinkCount = (enriched.match(/\]\(\//g) || []).length;
  if (internalLinkCount < 2) {
    const linkBlocks: Record<string, string> = {
      apt: `\n\n---\n\n## 관련 정보\n\n- [카더라 청약 일정 →](/apt)\n- [전국 실거래가 조회 →](/apt?tab=transaction)\n- [청약 가점 계산기 →](/apt/diagnose)\n- [카더라 블로그 →](/blog?category=apt)\n\n`,
      stock: `\n\n---\n\n## 관련 정보\n\n- [실시간 주식 시세 →](/stock)\n- [종목 비교 분석 →](/stock/compare)\n- [카더라 블로그 →](/blog?category=stock)\n- [투자 커뮤니티 →](/feed)\n\n`,
    };
    enriched += linkBlocks[category] || linkBlocks.stock || linkBlocks.apt;
  }

  return enriched;
}

/* ═══════════ 이미지 삽입 (본문 H2 사이에 실사진) ═══════════ */

async function insertImages(content: string, title: string, keywords: string[], category: string, blogPostId: number | null, sb: any): Promise<string> {
  // ⛔ BN-B 판독 §3-B(2026-09-19) — 이 함수는 네이버 이미지 검색 URL 을 차단 목록·관련도 채점·Storage 재호스팅
  //   없이 본문(최대 3장)과 cover_image 에 그대로 핫링크했다. 정식 파이프라인(image-pipeline · issue-image-attach)의
  //   완전한 우회로다. 실측: 30일 issue-draft 502편(발행 131)이 외부 스톡 이미지·외부 커버 — 112517 에 유튜브 썸네일
  //   (「광화문 래미안 … 마이너 갤러리」). S8/S9 에서 걷어낸 외부 스크랩 계보의 살아 있던 유입구.
  //   이미지는 issue-image-attach(정식 파이프라인)에 맡긴다. 아래 본문은 복원 참고용으로만 남긴다.
  if (EXTERNAL_IMAGE_INSERT_DISABLED) return content;
  const query = keywords.slice(0, 2).join(' ') || title.replace(/[[\]|()]/g, '').slice(0, 20);
  const searchQuery = category === 'apt' ? `${query} 아파트 단지` : category === 'stock' ? `${query} 주식 차트` : `${query} 경제`;
  const images = await searchNaverImages(searchQuery, 5);
  if (images.length === 0) return content;

  let enriched = content;
  const h2Matches = [...enriched.matchAll(/^## .+$/gm)];

  // H2 2개마다 이미지 1장 삽입 (최대 3장)
  let inserted = 0;
  for (let i = 2; i < h2Matches.length && inserted < 3 && inserted < images.length; i += 2) {
    const match = h2Matches[i];
    if (match.index !== undefined) {
      const img = images[inserted];
      const imgBlock = `\n\n![${img.alt}](${img.url})\n\n`;
      enriched = enriched.slice(0, match.index) + imgBlock + enriched.slice(match.index);
      // 이후 매치 인덱스가 밀리므로 offset 조정
      for (let j = i + 1; j < h2Matches.length; j++) {
        if (h2Matches[j].index !== undefined) {
          (h2Matches[j] as any).index += imgBlock.length;
        }
      }
      inserted++;
    }
  }

  // blog_post_images DB에 저장
  if (blogPostId && images.length > 0) {
    const imageInserts = images.slice(0, inserted + 1).map((img, i) => ({
      post_id: blogPostId,
      image_url: img.url,
      alt_text: img.alt,
      image_type: 'stock_photo',
      position: i,
    }));
    try { dbw('issue-draft', 'blog_post_images.insert@369', await (sb as any).from('blog_post_images').insert(imageInserts)); } catch {}
  }

  // 커버 이미지 교체 (position 0)
  if (blogPostId && images.length > 0) {
    try {
      dbw('issue-draft', 'blog_posts.update@375', await sb.from('blog_posts').update({
        cover_image: images[0].url,
        image_alt: images[0].alt,
      }).eq('id', blogPostId));
    } catch {}
  }

  return enriched;
}

/* ═══════════ 팩트 검증 (s261: category-aware) ═══════════ */

// 카테고리별 금지 표현. apt 도메인에서 "목표가/적정가"는 분양가 분석 정상 표현이라 허용.
const BANNED_BY_CATEGORY: Record<string, string[]> = {
  apt: ['매수 추천', '매도 추천', '반드시 오를', '반드시 내릴', '급등 예상', '급락 예상',
        '꼭 사야', '꼭 팔아야', '확정수익률', '원금보장'],
  unsold: ['매수 추천', '매도 추천', '반드시 오를', '반드시 내릴', '확정수익률', '원금보장'],
  redev: ['매수 추천', '매도 추천', '반드시 오를', '반드시 내릴', '확정수익률', '원금보장'],
  stock: ['매수 추천', '매도 추천', '반드시 오를', '반드시 내릴', '급등 예상', '급락 예상',
          '목표가', '적정가', '저점 매수', '물타기', '꼭 사야', '꼭 팔아야', '확정수익률'],
  finance: ['확정수익률', '원금보장', '반드시', '꼭 사야'],
  tax: ['확정수익률', '원금보장'],
  economy: ['확정수익률', '원금보장'],
  general: ['확정수익률', '원금보장'],
};

function factCheck(
  content: string,
  rawData: Record<string, any>,
  category: string = 'general',
  locationLock?: { sigungu?: string | null; dong?: string | null; address?: string | null }
): { passed: boolean; details: Record<string, any> } {
  const issues: string[] = [];

  // 1) 카테고리별 금지 표현
  const banned = BANNED_BY_CATEGORY[category] || BANNED_BY_CATEGORY.general;
  for (const word of banned) {
    if (content.includes(word)) issues.push(`금지표현(${category}): ${word}`);
  }

  // 2) 분량
  if (content.length < 1500) issues.push('분량부족');

  // 3) FAQ
  if (!content.includes('Q.') && !content.includes('자주 묻는') && !content.includes('❓') && !content.includes('FAQ')) {
    issues.push('FAQ누락');
  }

  // 4) s261: 위치 잠금 검증 — apt 카테고리에서 정확한 시군구·동 등장 확인
  if ((category === 'apt' || category === 'unsold' || category === 'redev') && locationLock) {
    const { sigungu, dong, address } = locationLock;
    // 시군구가 주소 데이터에 있는데 본문에 등장 안 하면 location_drift 표시
    if (sigungu && !content.includes(sigungu)) {
      issues.push(`location_drift_sigungu:${sigungu}_누락`);
    }
    // 동 정보 있으면 본문에 한 번 이상 등장해야 함
    if (dong && dong.length >= 2 && !content.includes(dong)) {
      issues.push(`location_drift_dong:${dong}_누락`);
    }
    // 주소에 명시된 시군구와 다른 시군구가 본문에 자주 등장하면 환각
    // (예: 마산합포구 단지인데 본문에 "진해구"가 3회 이상)
    if (address) {
      const KNOWN_GU = ['진해구','마산합포구','마산회원구','성산구','의창구','중구','동구','서구','남구','북구','강서구','강동구','수영구','해운대구','연제구','부산진구','사하구','사상구','금정구','기장군','일산동구','일산서구','분당구','수정구','중원구'];
      const addressLower = (address || '').toLowerCase();
      for (const gu of KNOWN_GU) {
        // 주소에 이 구가 안 등장하지만 본문에 3회 이상 등장 → 환각
        if (!addressLower.includes(gu.toLowerCase()) && (content.match(new RegExp(gu, 'g')) || []).length >= 3) {
          issues.push(`location_drift_wrong_gu:${gu}`);
          break; // 1건만 표시
        }
      }
    }
  }

  return { passed: issues.length === 0, details: { issues, content_length: content.length, category } };
}

/* ═══════════ 피드 포스트 생성 ═══════════ */

async function createOfficialFeedPost(sb: any, issue: any, blogSlug: string) {
  const { data: systemUser } = await sb.from('profiles').select('id').eq('nickname', '카더라').limit(1).maybeSingle();
  if (!systemUser) return;
  const prefixMap: Record<string, string> = { apt: '🏠', stock: '📊', finance: '💰', tax: '📋', economy: '🌐', life: '🏃' };
  const prefix = prefixMap[issue.category] || '📰';
  const entities = (issue.related_entities || []).join(', ');
  const title = issue.title.length > 50 ? issue.title.slice(0, 50) + '...' : issue.title;
  const content = `${prefix} [속보] ${title}\n\n${issue.summary || ''}\n\n상세 분석 👉 ${SITE_URL}/blog/${blogSlug}`;
  dbw('issue-draft', 'posts.insert@462', await sb.from('posts').insert({
    author_id: systemUser.id, title: `[속보] ${entities || '이슈'} 분석`,
    content: content.slice(0, 500),
    category: issue.category === 'apt' ? 'realestate' : issue.category === 'stock' ? 'stock' : 'finance',
    is_anonymous: false, created_at: new Date().toISOString(),
  }));
}

/* ═══════════ 뻘글 스케줄링 ═══════════ */

async function scheduleBuzzPosts(sb: any, issueId: string, score: number) {
  const personas = ['curious', 'self_deprecating', 'question', 'calculator', 'sharer', 'realist'];
  const selected = personas.sort(() => Math.random() - 0.5).slice(0, 1);
  const now = Date.now();
  dbw('issue-draft', 'scheduled_feed_posts.insert@476', await (sb as any).from('scheduled_feed_posts').insert(selected.map((persona, i) => ({
    issue_id: issueId, persona_type: persona,
    scheduled_at: new Date(now + (8 + i * 10) * 60 * 1000).toISOString(), is_published: false,
  }))));
}

/* ═══════════ 메인: 이슈 1건 처리 ═══════════ */

async function processOneIssue(sb: any, issue: any, config: any): Promise<{ decision: string; title?: string; score: number; slug?: string }> {
  // CAS lock
  const retryCount = issue.retry_count || 0;
  const { data: lockResult } = await (sb as any).from('issue_alerts')
    .update({ is_processed: true, processed_at: new Date().toISOString(), retry_count: retryCount })
    .eq('id', issue.id).eq('is_processed', false).select('id');
  if (!lockResult || lockResult.length === 0) return { decision: 'race', score: issue.final_score };

  /* ══ A5-6 엔티티 관문 (2026-08-27) — AI 를 «부르기 전에» 막는다 ══════════════
   *
   * 부동산 이슈인데 어느 현장 얘긴지 특정이 안 되면 글을 쓰지 않는다.
   * 지금까지는 그런 이슈도 초안을 만들었고, 그 결과 「부산 아파트 시장 분석」 같은
   * 주인 없는 글이 쌓였다. 그런 글은 어느 현장 페이지에도 붙지 못하고 리드도 못 만든다.
   *
   * ⚠️ 관문을 «AI 호출 앞» 에 둔 것이 핵심이다. 뒤에 두면 토큰을 쓰고 나서 버린다.
   *
   * ⛔ 예외는 정책·시황 두 종류뿐이고 «월 10편 상한» 이 있다. 상한이 없으면
   *    「전부 policy 로 분류해서 통과」라는 우회로가 생긴다.
   */
  if (issue.category === 'apt') {
    const exempt = issue.sub_category === 'policy' || issue.sub_category === 'market';
    if (exempt) {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const { count } = await (sb as any).from('issue_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('category', 'apt').in('sub_category', ['policy', 'market'])
        .not('publish_decision', 'is', null)
        .gte('processed_at', monthStart.toISOString());
      if ((count ?? 0) >= 10) {
        dbw('issue-draft', 'issue_alerts.update@gate_quota', await (sb as any).from('issue_alerts')
          .update({ publish_decision: 'no_entity', fail_reason: 'no_match', block_reason: `policy_market_monthly_cap:${count}` })
          .eq('id', issue.id));
        return { decision: 'no_entity_quota', score: issue.final_score };
      }
    } else if (!issue.apt_site_id) {
      // ⚠️ 이미 현장이 지정된 글감(CV-N 이벤트·BP 발행 글감)은 제목으로 «다시» 맞추지 않는다.
      //    다시 맞추면 예정명 제목(「힐스테이트 거제시그니처」)이 매칭에 실패해 no_entity 로 버려지거나 다른 현장으로 덮인다.
      const { data: matched } = await (sb as any).rpc('match_apt_site', { p_text: issue.title });
      if (!matched) {
        dbw('issue-draft', 'issue_alerts.update@gate_no_entity', await (sb as any).from('issue_alerts')
          .update({ publish_decision: 'no_entity', fail_reason: 'no_match' })
          .eq('id', issue.id));
        return { decision: 'no_entity', score: issue.final_score };
      }
      dbw('issue-draft', 'issue_alerts.update@gate_matched', await (sb as any).from('issue_alerts')
        .update({ apt_site_id: matched })
        .eq('id', issue.id));
      issue.apt_site_id = matched;
    }
  }

  /* ABG 증분 2 §2 — 같은 현장 사전 차단. 게시 후 유사도 검사(check_blog_similarity 는 게시글만 본다)로는
   * 같은 현장 글감 두 개가 동시에 생성·게시되는 걸 못 막았다(거제 112430·112432 실증 — 제목 유사도 0.65·FAQ 3문 동일).
   * 같은 apt_site_id 의 «살아 있는» 글감·초안·게시글이 있으면 나중 글감을 hold — 선행 글 게시 후 분화 여부는 사람이 판정한다.
   * 살아 있음 = 편집 대기/중 · 판정 전(먼저 생긴 것) · 게시글 · 사유 없는 비공개 초안. 환각·중복·대체로 내린 글은 죽은 것으로 본다. */
  if (issue.apt_site_id) {
    const { data: siblings } = await (sb as any).from('issue_alerts')
      .select('id, blog_post_id, publish_decision, created_at')
      .eq('apt_site_id', issue.apt_site_id).neq('id', issue.id).limit(30);
    const sib = (siblings ?? []) as Array<{ id: string; blog_post_id: number | null; publish_decision: string | null; created_at: string }>;
    const postIds = sib.map((x) => x.blog_post_id).filter((v): v is number => !!v);
    const livePosts = new Set<number>();
    if (postIds.length > 0) {
      const { data: posts } = await (sb as any).from('blog_posts').select('id, is_published, auto_unpublished_reason').in('id', postIds);
      for (const bp of (posts ?? []) as Array<{ id: number; is_published: boolean; auto_unpublished_reason: string | null }>) {
        if (bp.is_published || !bp.auto_unpublished_reason || isReviewHoldReason(bp.auto_unpublished_reason)) livePosts.add(bp.id);
      }
    }
    const blocker = sib.find((x) =>
      (x.blog_post_id && livePosts.has(x.blog_post_id))
      || x.publish_decision === 'edit_pending' || x.publish_decision === 'editing'
      || (!x.publish_decision && !x.blog_post_id && Date.parse(x.created_at) < Date.parse(issue.created_at)));
    if (blocker) {
      dbw('issue-draft', 'issue_alerts.update@same_site_pending', await (sb as any).from('issue_alerts')
        .update({ publish_decision: 'same_site_pending', block_reason: `hold:same_site_pending:${blocker.id}${blocker.blog_post_id ? `:post_${blocker.blog_post_id}` : ''}` })
        .eq('id', issue.id));
      return { decision: 'same_site_pending', score: issue.final_score };
    }
  }

  // 중복 체크
  const issueKeywords: string[] = issue.detected_keywords || [];
  const skipReasons: string[] = [];
  if (issueKeywords.length >= 1) {
    const since24h = new Date(Date.now() - 24 * 3600000).toISOString();
    const { data: recentBlogs } = await sb.from('blog_posts')
      .select('id, title, tags, cron_type').eq('is_published', true)
      .eq('category', issue.category === 'economy' ? 'finance' : issue.category)
      .gte('created_at', since24h).limit(50);
    if (recentBlogs) {
      const GENERIC = new Set(['청약','분양','아파트','부동산','투자','시세','분석','전망','부산','서울','경기','인천','대구','대전','광주','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주','수도권','지방','매매','전세','월세','실거래','재개발','재건축','미분양','stock','apt','finance']);
      for (const blog of recentBlogs) {
        const blogTags: string[] = blog.tags || [];
        const overlap = issueKeywords.filter((k: string) => !GENERIC.has(k) && (blogTags.includes(k) || (blog.title || '').includes(k)));
        if (overlap.length >= 3) { skipReasons.push(`keyword_overlap:${blog.id}:${overlap.join(',')}`); break; }
      }
    }
    if (skipReasons.length === 0) {
      try {
        const { data: simBlogs } = await sb.rpc('check_blog_similarity', { p_title: issue.title, p_threshold: 0.35 });
        if (simBlogs && simBlogs.length > 0) skipReasons.push(`title_similar:${simBlogs[0].id}:${simBlogs[0].title?.slice(0, 30)}`);
      } catch {}
    }
  }
  if (skipReasons.length > 0) {
    dbw('issue-draft', 'issue_alerts.update@517', await (sb as any).from('issue_alerts').update({ publish_decision: 'duplicate_blog', block_reason: skipReasons.join(' | '), is_processed: true, fail_reason: 'duplicate' }).eq('id', issue.id));
    return { decision: 'duplicate', score: issue.final_score };
  }

  // [P0-FACT] big_event 팩트 블록 · 현장 블록 · 원문 · 제도 상수 — 생성 프롬프트와 게이트가 같은 문맥을 본다
  const ctx = await loadIssueContext(sb, issue);
  const { siteContext, sourceText, constantsBlock, bigEventContext } = ctx;
  const { article, failReason } = await generateArticle(issue, bigEventContext, siteContext, sourceText, constantsBlock);
  if (!article) {
    // A3: 재시도 로직 — retry_count < 3이면 is_processed=false로 리셋
    if (failReason === 'quota') {
      // 재시도 횟수를 올리지 않고 큐로 되돌린다 — 쿼터가 풀리는 날 그대로 다시 뽑힌다.
      dbw('issue-draft', 'issue_alerts.update@quota', await (sb as any).from('issue_alerts').update({ is_processed: false, publish_decision: null, fail_reason: 'quota' }).eq('id', issue.id));
      return { decision: 'quota_deferred', score: issue.final_score };
    }
    const newRetry = retryCount + 1;
    if (newRetry < 3) {
      dbw('issue-draft', 'issue_alerts.update@530', await (sb as any).from('issue_alerts').update({ is_processed: false, publish_decision: null, retry_count: newRetry, fail_reason: failReason }).eq('id', issue.id));
      return { decision: `ai_failed_retry_${newRetry}`, score: issue.final_score };
    }
    dbw('issue-draft', 'issue_alerts.update@533', await (sb as any).from('issue_alerts').update({ publish_decision: 'ai_failed', retry_count: newRetry, fail_reason: failReason }).eq('id', issue.id));
    return { decision: 'ai_failed_final', score: issue.final_score };
  }

  // BN 4차 판독 ⑥' — 「사업 단계」 섹션 본문을 확정 문형으로 교체(축약 규격). 게이트·스캔2 가 교체본을 본다.
  if (ctx.stageText) article.content = injectStageSection(article.content, ctx.stageText);
  // BN-B4 ②·① — 거래 데이터 문형 주입 + 섹션 절제(LLM 0). 절제 목록은 스캔2 기록으로.
  let excised: string[] = [];
  if (ctx.compact) {
    article.content = injectDataSection(article.content, ctx.dataText ?? null);
    const ex = exciseCompact(article.content, enforceTitleSpec(article.title, issue.raw_data).title);
    article.content = ex.content; excised = ex.removed;
  }

  // BN-2 ⑤ — 제목 규격(BN 글감만). 게이트가 «바뀐 제목» 을 보게 여기서 먼저.
  const titleFix = enforceTitleSpec(article.title, issue.raw_data);
  article.title = titleFix.title;

  // EX-A ③ — 수치 출처율 100%. LLM 원문(시각화·SEO 보강 «전») 을 그 글에 준 텍스트와 대조한다.
  //   ⚠️ 부동산은 막는다. 주식·경제는 «섀도»(기록만).
  // ABG X-2 — 감산 편집은 «편집 회차» 로 넘긴다. 생성 회차 안에서 편집까지 하면 건당 ~240s 라 회전당 1건에 갇혔다.
  const allow = buildIssueAllow(ctx, issue);
  const gate = verifyIssueDraft(article.title, article.content, allow);
  if (!gate.ok && issue.category === 'apt') {
    if (!gate.titleGate.ok) {
      // 제목 위반은 편집(본문만)으로 못 고친다 — 곧바로 차단
      await blockNumberUnverified(sb, issue, article, gate.unverified, gate.unverified, gate.checked, false);
      return { decision: 'number_unverified', score: issue.final_score, title: article.title };
    }
    dbw('issue-draft', 'issue_alerts.update@edit_pending', await (sb as any).from('issue_alerts').update({
      publish_decision: 'edit_pending', fail_reason: null,
      raw_data: { ...(issue.raw_data ?? {}), edit_pending: { at: new Date().toISOString(), article, first_unverified: gate.bodyGate.unverified, checked: gate.checked } },
    }).eq('id', issue.id));
    return { decision: 'edit_pending', score: issue.final_score, title: article.title };
  }
  if (issue.category === 'apt') {
    const s2 = await scan2Log(sb, article, ctx, titleFix.replaced);
    const base = { gate_result: 'passed_first', first_unverified: [], checked: gate.checked, ...(excised.length ? { sections_removed: excised } : {}) };
    if (shouldScan2Edit(issue, s2.scan2.defects)) return queueScan2Edit(sb, issue, article, s2.scan2.defects, base);
    return finalizeArticle(sb, issue, config, article, { ...base, ...s2 });
  }
  const gateLog = { number_shadow: { ok: gate.ok, checked: gate.checked, unverified: gate.unverified.slice(0, 30), had_source_text: !!sourceText } };
  return finalizeArticle(sb, issue, config, article, gateLog);
}

/**
 * BN-B2 §3 — 스캔2 편집 회차. 조건 ② 국소 결함만(LOCAL_EDIT_RULES), 서술·구조형이 하나라도 섞이면 편집하지 않는다(재생성).
 * 글감당 1회(raw_data.scan2_edit_done). BN 글감만.
 */
function shouldScan2Edit(issue: any, defects: Scan2Defect[]): boolean {
  return SCAN2_NAMESPACES.has(reviewHoldOf(issue)?.namespace as any) && !issue.raw_data?.scan2_edit_done
    && defects.length > 0 && defects.every((d) => LOCAL_EDIT_RULES.has(d.rule));
}

async function queueScan2Edit(sb: any, issue: any, article: GenResult, defects: Scan2Defect[], base: Record<string, unknown>) {
  dbw('issue-draft', 'issue_alerts.update@scan2_edit_pending', await (sb as any).from('issue_alerts').update({
    publish_decision: 'edit_pending', fail_reason: null,
    raw_data: { ...(issue.raw_data ?? {}), edit_pending: { at: new Date().toISOString(), kind: 'scan2', article, defects, base } },
  }).eq('id', issue.id));
  return { decision: 'edit_pending', score: issue.final_score, title: article.title };
}

/** 스캔2 편집 1회 → 수치 게이트 재판정(통과 못 하면 원문 유지) → 전체 재스캔 → 마무리. edited_out 이력은 판독 입력. */
async function processScan2Edit(sb: any, issue: any, config: any, pending: any) {
  const article: GenResult = pending.article;
  const defects: Scan2Defect[] = pending.defects ?? [];
  const ctx: IssueContext = await loadIssueContext(sb, issue);
  const allow = buildIssueAllow(ctx, issue);
  let used = article;
  let edited = false;
  const revised = await editScan2Defects(article.content, defects, issue);
  if (revised) {
    const g = verifyIssueDraft(article.title, revised, allow);
    // 주입 블록 보호 — LLM 편집이 확정 문형을 건드려도 다시 씌운다
    const guarded = ctx.compact ? injectDataSection(injectStageSection(revised, ctx.stageText ?? null), ctx.dataText ?? null) : revised;
    if (g.ok) { used = { ...article, content: guarded }; edited = true; }
  }
  const s2 = await scan2Log(sb, used, ctx, null);
  issue.raw_data = { ...(issue.raw_data ?? {}), edit_pending: undefined, scan2_edit_done: true };
  const gateLog = { ...(pending.base ?? { gate_result: 'passed_first' }), scan2: { ...s2.scan2, edited, edited_out: defects } };
  return finalizeArticle(sb, issue, config, used, gateLog);
}

/** 차단 기록 — 막힌 초안은 blog_posts 에 넣지 않는다(미발행 수문). 판독용으로 글감 행에만 남긴다. */
async function blockNumberUnverified(sb: any, issue: any, article: GenResult, firstUnverified: string[], unverified: string[], checked: number, edited: boolean) {
  const raw = { ...(issue.raw_data ?? {}), edit_pending: undefined };
  dbw('issue-draft', 'issue_alerts.update@number_gate', await (sb as any).from('issue_alerts').update({
    publish_decision: 'number_unverified', fail_reason: 'number_unverified',
    block_reason: `수치 출처 미확인 ${unverified.length}/${checked}: ${unverified.slice(0, 12).join(' · ')}`.slice(0, 500),
    raw_data: { ...raw, blocked_draft: { at: new Date().toISOString(), title: article.title, first_unverified: firstUnverified, edited, unverified, checked, content: article.content.slice(0, 16000) } },
  }).eq('id', issue.id));
}

/**
 * ABG X-2 — 편집 회차: edit_pending 1건. 문맥을 다시 읽어 «같은 게이트» 를 만들고, 감산 편집 1회 → 재판정.
 * 잠금은 publish_decision edit_pending→editing CAS. 통과면 생성 회차와 같은 마무리(finalizeArticle).
 */
async function processEditIssue(sb: any, issue: any, config: any): Promise<{ decision: string; title?: string; score: number; slug?: string }> {
  const { data: lock } = await (sb as any).from('issue_alerts')
    .update({ publish_decision: 'editing', processed_at: new Date().toISOString() })
    .eq('id', issue.id).eq('publish_decision', 'edit_pending').select('id');
  if (!lock || lock.length === 0) return { decision: 'race', score: issue.final_score };
  const pending = issue.raw_data?.edit_pending;
  if (pending?.kind === 'scan2' && pending?.article?.content) return processScan2Edit(sb, issue, config, pending);
  const article: GenResult | undefined = pending?.article;
  if (!article?.title || !article?.content) {
    dbw('issue-draft', 'issue_alerts.update@edit_missing', await (sb as any).from('issue_alerts').update({ publish_decision: 'ai_failed', fail_reason: 'parse' }).eq('id', issue.id));
    return { decision: 'edit_missing', score: issue.final_score };
  }
  const titleFix = enforceTitleSpec(article.title, issue.raw_data);
  article.title = titleFix.title;
  const ctx: IssueContext = await loadIssueContext(sb, issue);
  const allow = buildIssueAllow(ctx, issue);
  const first = verifyIssueDraft(article.title, article.content, allow);
  const firstUnverified: string[] = pending.first_unverified ?? first.bodyGate.unverified;
  let final = first;
  let edited = false;
  if (!first.ok && first.titleGate.ok) {
    const revised = await editOutNumbers(article.content, first.bodyGate.unverified, issue);
    if (revised) {
      edited = true;
      const guarded = ctx.compact ? injectDataSection(injectStageSection(revised, ctx.stageText ?? null), ctx.dataText ?? null) : revised;
      const second = verifyIssueDraft(article.title, guarded, allow);
      if (second.ok) article.content = guarded;
      final = second;
    }
  }
  if (!final.ok) {
    await blockNumberUnverified(sb, issue, article, firstUnverified, final.unverified, final.checked, edited);
    return { decision: 'number_unverified', score: issue.final_score, title: article.title };
  }
  issue.raw_data = { ...(issue.raw_data ?? {}), edit_pending: undefined };
  const s2 = await scan2Log(sb, article, ctx, titleFix.replaced);
  const base = { gate_result: edited ? 'passed_after_edit' : 'passed_first', first_unverified: firstUnverified.slice(0, 20), checked: first.checked };
  // 수치 편집 뒤 스캔2 국소 결함이 남으면 다음 편집 회차로(한 회차에 LLM 편집 두 번은 300s 에 못 든다)
  if (shouldScan2Edit(issue, s2.scan2.defects)) return queueScan2Edit(sb, issue, article, s2.scan2.defects, base);
  return finalizeArticle(sb, issue, config, article, { ...base, ...s2 });
}

/** BN-2 §4 스캔2 기록. 강제(hold)는 BN 글감만 — 그 밖의 부동산 글감은 섀도(기록만)다. */
async function scan2Log(sb: any, article: GenResult, ctx: IssueContext, titleReplaced: string | null) {
  const defects: Scan2Defect[] = scanDraft2({ title: article.title, content: article.content, siteContext: ctx.siteContext, constantsBlock: ctx.constantsBlock, compact: ctx.compact });
  // ⑦ 링크 실존 — `/apt/<slug>` 는 활성 현장, `/blog/<slug>` 는 존재하는 글. 영문 일반명(`/blog/redev-basic`)은 LLM 창작 패턴(112520).
  try {
    const { apt, blog, badRoutes } = extractInternalLinks(article.content);
    for (const r of badRoutes) defects.push({ rule: 'link', text: r });
    if (apt.length > 0) {
      const { data } = await (sb as any).from('apt_sites').select('slug').in('slug', apt.slice(0, 50)).eq('is_active', true);
      const ok = new Set(((data ?? []) as Array<{ slug: string }>).map((r) => r.slug));
      for (const s of apt) if (!ok.has(s)) defects.push({ rule: 'link', text: `/apt/${s}` });
    }
    if (blog.length > 0) {
      const { data } = await (sb as any).from('blog_posts').select('slug').in('slug', blog.slice(0, 50));
      const ok = new Set(((data ?? []) as Array<{ slug: string }>).map((r) => r.slug));
      for (const s of blog) if (!ok.has(s)) defects.push({ rule: 'link', text: `/blog/${s}` });
    }
  } catch (e: any) {
    console.warn('[issue-draft] scan2 link check failed:', e?.message);
  }
  // BN 6차 판독 ② — 축약 규격: 비실존 링크는 결정적으로 치환(LLM 0)하고 link 결함에서 뺀다. 치환 목록은 기록.
  let links_repaired: string[] | undefined;
  const invalid = defects.filter((d) => d.rule === 'link').map((d) => d.text);
  if (ctx.compact && invalid.length > 0) {
    const r = repairLinks(article.content, invalid, ctx.siteSlug ?? null);
    if (r.repaired.length > 0) {
      article.content = r.content;
      links_repaired = r.repaired;
      for (let k = defects.length - 1; k >= 0; k--) if (defects[k].rule === 'link' && r.repaired.includes(defects[k].text)) defects.splice(k, 1);
    }
  }
  return { scan2: { at: new Date().toISOString(), defects: defects.slice(0, 30), title_replaced: titleReplaced, ...(links_repaired ? { links_repaired } : {}) } };
}

/** 게이트 통과 이후 — 시각화·SEO·적재·이미지·발행. 생성 회차와 편집 회차가 공유한다. */
async function finalizeArticle(sb: any, issue: any, config: any, article: GenResult, gateLog: Record<string, unknown>): Promise<{ decision: string; title?: string; score: number; slug?: string }> {
  // 통과 기록(3분해 계측) — 부동산은 1차 통과/편집 후 통과, 그 외는 섀도 위반 로그
  issue.raw_data = { ...(issue.raw_data ?? {}), ...gateLog };
  dbw('issue-draft', 'issue_alerts.update@number_log', await (sb as any).from('issue_alerts')
    .update({ raw_data: issue.raw_data }).eq('id', issue.id));

  article.content = enrichVisuals(article.content, issue);

  // s189: SEO 마스터 — 발행 직전 위생 검사 + 자동 보강 (내부링크/EAT/meta/alt/tags)
  // 실패해도 발행은 진행, hub_mapping 은 insertImages 직후 RPC 가 한 번 더 보장.
  let seoEnriched = article.content;
  let seoMetaDesc = (article as any).meta_description || '';
  let seoImageAlt = `${article.title} — 카더라 분석`;
  try {
    const seoCategory = (['apt', 'stock', 'finance', 'general'] as const).includes(issue.category as any)
      ? issue.category : (issue.category === 'tax' || issue.category === 'economy' ? 'finance' : 'general');
    const beforeLen = article.content.length;
    const seoRes = await runBlogSeoMaster(getSupabaseAdmin(), {
      title: article.title,
      content: article.content,
      category: seoCategory,
      slug: article.slug,
      meta_description: seoMetaDesc,
      tags: article.keywords,
      primary_keyword: (issue.detected_keywords || [])[0],
    });
    // BN §3-A — 푸터 현장은 글감 현장 + 본문에 걸린 현장만(appendRelatedHubFooter 가 활성 실존 확인).
    let footerSiteSlug: string | null = null;
    if (issue.apt_site_id) {
      const { data: fs } = await (sb as any).from('apt_sites').select('slug').eq('id', issue.apt_site_id).maybeSingle();
      footerSiteSlug = fs?.slug ?? null;
    }
    seoEnriched = await appendRelatedHubFooter(getSupabaseAdmin(), seoRes.enriched.content, { category: seoCategory, siteSlug: footerSiteSlug });
    seoMetaDesc = seoRes.enriched.meta_description;
    seoImageAlt = seoRes.enriched.image_alt;

    // s195: enrich 결과 진단 — silent fail 케이스 식별 (이전 발행글 hub link 0% 부작용)
    const hubLinksAfter = (seoEnriched.match(/\]\(\/(apt|blog|stock)/g) || []).length;
    const externalAfter = (seoEnriched.match(/\]\(https?:\/\/(?!kadeora)/g) || []).length;
    const hasHubFooter = seoEnriched.includes('## 관련 정보') || seoEnriched.includes('## 관련 페이지');
    const hasCitations = seoEnriched.includes('## 📊 데이터 출처') || seoEnriched.includes('## 데이터 출처');
    console.log(`[issue-draft] seo-master before=${beforeLen} after=${seoEnriched.length} hub_links=${hubLinksAfter} external=${externalAfter} hub_footer=${hasHubFooter} citations=${hasCitations} passes=${seoRes.passes} score=${seoRes.score}`);

    if (!seoRes.passes) {
      console.warn(`[issue-draft] seo-master gate failed for "${article.title.slice(0,30)}":`, seoRes.failed_checks.join(' | '));
    }
  } catch (seoErr: any) {
    console.error('[issue-draft] seo-master failed (continuing):', seoErr?.stack || seoErr?.message);
  }

  // s261: location lock 데이터 수집 (apt 카테고리에서 fact_check가 환각 검출에 사용)
  let locationLock: { sigungu?: string | null; dong?: string | null; address?: string | null } | undefined;
  if (issue.category === 'apt' || issue.category === 'unsold' || issue.category === 'redev') {
    try {
      // related_entities 첫 항목이 단지명 → apt_subscriptions / apt_sites 매칭
      const complexName = (issue.related_entities || [])[0];
      if (complexName) {
        const { data: sub } = await (sb as any)
          .from('apt_subscriptions')
          .select('hssply_adres, supply_addr')
          .ilike('house_nm', `%${complexName}%`)
          .limit(1)
          .maybeSingle();
        const { data: site } = await (sb as any)
          .from('apt_sites')
          .select('sigungu, dong, address')
          .ilike('name', `%${complexName}%`)
          .limit(1)
          .maybeSingle();
        const fullAddr = (sub?.hssply_adres || sub?.supply_addr || site?.address || '') as string;
        // 주소에서 시군구·동 추출
        const guMatch = fullAddr.match(/([가-힣]+(시|군))\s*([가-힣]+(구|군))?/);
        const dongMatch = fullAddr.match(/([가-힣]+동)\s/);
        locationLock = {
          sigungu: site?.sigungu || (guMatch ? (guMatch[3] || guMatch[1]) : null),
          dong: site?.dong || (dongMatch ? dongMatch[1] : null),
          address: fullAddr || null,
        };
      }
    } catch (locErr: any) {
      console.warn(`[issue-draft] location lookup failed:`, locErr?.message);
    }
  }

  const check = factCheck(seoEnriched, issue.raw_data || {}, issue.category || 'general', locationLock);

  // EX-A ④ · BN-1 ② — 판독 모드 글감(BP 허브 · BN 허브)은 판독 전까지 «비공개 초안» 으로만 만든다.
  //   app_config <ns>.hub_publish_enabled 가 정확히 true 일 때만 자동 발행 경로를 탄다(기본 보류). review-hold.ts 참조.
  const reviewHold = reviewHoldOf(issue);
  const holdPublishOn = reviewHold ? (await reviewSwitches(sb))[reviewHold.namespace] : true;
  // BN-2 §4 — 스캔2 결함이 있는 BN 초안은 스위치가 열려 있어도 hold(사유 …:scan2). 결함분은 재생성 대상.
  const scan2Defects: Scan2Defect[] = (gateLog as any)?.scan2?.defects ?? [];
  const scan2Hold = !!reviewHold && SCAN2_NAMESPACES.has(reviewHold.namespace) && scan2Defects.length > 0;
  // BN-B §3 A·C — 외부 이미지·미실존 링크는 모든 부동산 글감에서 즉시 hold(섀도 없음).
  const hardHold = issue.category === 'apt' && scan2Defects.some((d) => HARD_HOLD_RULES.has(d.rule));
  const canAutoPublish = holdPublishOn && !scan2Hold && !hardHold && config.auto_publish_enabled
    && issue.final_score >= (config.auto_publish_min_score ?? 40)
    && !issue.block_reason && check.passed
    && !(config.auto_publish_blocked_categories || []).includes(issue.category);

  const blogCategory = (['apt', 'stock', 'finance', 'general'] as const).includes(issue.category as any)
    ? issue.category : (issue.category === 'tax' || issue.category === 'economy' ? 'finance' : 'general');
  const designBase: Record<string, number[]> = { apt: [1,2,4,6], stock: [2,3,5,6], finance: [1,3,4,5], general: [1,2,3,4] };
  const designs = designBase[blogCategory] || designBase.general;
  const titleHash = article.title.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const design = designs[titleHash % designs.length];
  const coverImage = `${SITE_URL}/api/og?title=${encodeURIComponent(article.title)}&category=${blogCategory}&author=${encodeURIComponent('카더라')}&design=${design}`;

  // BP-B — 글감이 가리키는 현장을 허브로 «못박는다». 자동 선택(본문 첫 리드 가능 링크)은 비교 대상으로 건
  //   다른 현장을 허브로 잡을 수 있다. 리드폼이 서는 단계일 때만(아니면 자동 선택에 맡긴다).
  let hubForIssue: string | null = null;
  if (issue.apt_site_id) {
    const { data: hubSite } = await (sb as any).from('apt_sites').select('slug, lifecycle_stage, is_active').eq('id', issue.apt_site_id).maybeSingle();
    if (hubSite?.is_active && isLeadEligible(hubSite.lifecycle_stage)) hubForIssue = hubSite.slug;
  }

  // BN 4회차 — slug 유일성. 재생성은 LLM 이 옛 초안과 같은 slug 를 고를 수 있다(사직5 sajik5-redev-hillstate-busan).
  //   중복이면 INSERT 가 실패하고 아래 «slug 로 기존 글 찾기» 가 옛 글을 붙잡아 새 본문으로 덮어썼다(112541). 미리 접미사로 비킨다.
  if (article.slug) {
    const { data: taken } = await (sb as any).from('blog_posts').select('id').eq('slug', article.slug).maybeSingle();
    if (taken) article.slug = `${article.slug}-${Date.now().toString(36)}`;
  }

  const insertResult = await safeBlogInsert(sb, {
    ...(hubForIssue ? { hub_apt_slug: hubForIssue } : {}),
    slug: article.slug, title: article.title, content: seoEnriched,
    category: blogCategory as any, tags: article.keywords,
    source_type: 'auto_issue', cron_type: 'issue-draft',
    source_ref: (issue.source_urls || [])[0],
    meta_description: (() => {
      // s189: seo-master 결과 우선, 80자 미만이면 title 보강
      const desc = seoMetaDesc || (article as any).meta_description || (issue.summary || '').slice(0, 160);
      return desc.length >= 80 ? desc : `${desc} — ${article.title}`.slice(0, 160);
    })(),
    meta_keywords: article.keywords.join(','),
    cover_image: coverImage, image_alt: seoImageAlt,
    is_published: canAutoPublish,
    // s261: 선점 우선순위 — final_score 그대로 priority_score 로 사용. 70+ 면 daily_limit 우회
    priority_score: Math.min(100, Math.max(0, Number(issue.final_score) || 0)),
    ...deriveFreshnessFields({ isSeasonal: true, targetYear: new Date().getFullYear() }),
  } as any);

  let blogPostId: number | null = (insertResult.id ? Number(insertResult.id) : null);
  if (!blogPostId && article.slug) {
    // ⚠️ 방금 이 실행이 넣은 글만(10분 이내 생성) — 예전 글을 붙잡아 새 본문으로 덮어쓰지 않는다(112541 사고).
    try {
      const { data: found } = await sb.from('blog_posts').select('id, created_at').eq('slug', article.slug).maybeSingle();
      if (found && Date.now() - Date.parse(found.created_at) < 10 * 60_000) blogPostId = found.id;
    } catch {}
  }

  // s195: safeBlogInsert 내부 enrichContent 가 우리 seoEnriched 를 덮어쓸 위험 차단.
  // 강제 UPDATE 로 content/meta/alt 를 seo-master 결과로 확정.
  if (blogPostId) {
    try {
      const { error: forceErr } = await sb.from('blog_posts').update({
        content: seoEnriched,
        meta_description: seoMetaDesc,
        image_alt: seoImageAlt,
      }).eq('id', blogPostId);
      console.log(`[issue-draft] forced content update post=${blogPostId} len=${seoEnriched.length} err=${forceErr?.message ?? 'none'}`);
    } catch (e: any) {
      console.warn(`[issue-draft] forced update failed post=${blogPostId}:`, e?.message);
    }
  }

  // BN-1 ② — 판독 대기 초안에 사유 도장. DB 가드('hold:%')가 blog-auto-publish 등 모든 공개 경로를 막는다.
  if (reviewHold?.stampReason && (!holdPublishOn || scan2Hold) && blogPostId) {
    dbw('issue-draft', 'blog_posts.update@review_hold', await (sb as any).from('blog_posts')
      .update({ auto_unpublished_reason: scan2Hold ? `${reviewHold.reason}:scan2` : reviewHold.reason, auto_publish_eligible: false })
      .eq('id', blogPostId).eq('is_published', false));
  } else if (hardHold && blogPostId) {
    dbw('issue-draft', 'blog_posts.update@scan2_hard', await (sb as any).from('blog_posts')
      .update({ auto_unpublished_reason: 'hold:scan2_hard', auto_publish_eligible: false })
      .eq('id', blogPostId).eq('is_published', false));
  }

  // A2: 자동 발행 결정 시 blog_posts 반드시 공개 처리 (is_published 상태 무관)
  if (canAutoPublish && blogPostId) {
    try {
      dbw('issue-draft', 'blog_posts.update@665', await sb.from('blog_posts').update({
        is_published: true,
        published_at: new Date().toISOString(),
        seo_tier: 'A',
      }).eq('id', blogPostId));
    } catch (pubErr) {
      console.error(`[issue-draft] force publish failed for ${blogPostId}:`, (pubErr as Error).message);
    }
  }

  // A5: 이미지 삽입 (네이버 검색 → 본문 + 커버 교체) — s189: seoEnriched 사용
  if (blogPostId) {
    let finalContent = seoEnriched;
    try {
      finalContent = await insertImages(seoEnriched, article.title, article.keywords, blogCategory, blogPostId, sb);
    } catch (imgErr) {
      console.warn('[issue-draft] image insert failed:', (imgErr as Error).message);
    }

    // s190: image-attach 백로그 청산 전까지 issue-draft 가 단독으로 image≥5 보장.
    // 부족하면 OG variant URL 을 데이터 출처 섹션 위(또는 본문 끝)에 추가.
    try {
      const imgCount = (finalContent.match(/!\[.*?\]\(.*?\)/g) || []).length;
      if (imgCount < 5) {
        const need = 5 - imgCount;
        const variants: string[] = [];
        for (let i = 0; i < need; i++) {
          const variantDesign = ((titleHash + i + 1) % 6) + 1;
          const variantUrl = `${SITE_URL}/api/og?title=${encodeURIComponent(article.title + ' ' + (i + 1))}&category=${blogCategory}&design=${variantDesign}`;
          variants.push(`![${article.title} OG ${i + 1}](${variantUrl})`);
        }
        const sourceIdx = finalContent.search(/##\s+데이터\s+출처/);
        if (sourceIdx > 0) {
          finalContent = finalContent.slice(0, sourceIdx) + variants.join('\n\n') + '\n\n' + finalContent.slice(sourceIdx);
        } else {
          finalContent = finalContent + '\n\n' + variants.join('\n\n');
        }
      }
    } catch (padErr) {
      console.warn('[issue-draft] image padding failed:', (padErr as Error).message);
    }

    if (finalContent !== seoEnriched) {
      dbw('issue-draft', 'blog_posts.update@708', await sb.from('blog_posts').update({ content: finalContent }).eq('id', blogPostId));
    }

    // s195: 최종 이미지 카운트 검증 — DB 에서 다시 읽어 확인. 부족하면 마지막 한 번 더 padding.
    try {
      const { data: finalPost } = await sb.from('blog_posts').select('content').eq('id', blogPostId).single();
      const finalImg = (finalPost?.content?.match(/!\[.*?\]\(.*?\)/g) || []).length;
      console.log(`[issue-draft] final image check post=${blogPostId} imgs=${finalImg} title="${article.title.slice(0,40)}"`);
      if (finalPost?.content && finalImg < 5) {
        const need = 5 - finalImg;
        const variants: string[] = [];
        for (let i = 0; i < need; i++) {
          const variantDesign = ((titleHash + i + 1) % 6) + 1;
          const variantUrl = `${SITE_URL}/api/og?title=${encodeURIComponent(article.title + ' ' + (i + 1))}&category=${blogCategory}&design=${variantDesign}`;
          variants.push(`![${article.title} ${i + 1}](${variantUrl})`);
        }
        const sourceIdx = finalPost.content.search(/##\s+데이터\s+출처|## 📊 데이터/);
        const padded = sourceIdx > 0
          ? finalPost.content.slice(0, sourceIdx) + variants.join('\n\n') + '\n\n' + finalPost.content.slice(sourceIdx)
          : finalPost.content + '\n\n' + variants.join('\n\n');
        const { error: padErr2 } = await sb.from('blog_posts').update({ content: padded }).eq('id', blogPostId);
        console.log(`[issue-draft] final padding post=${blogPostId} added=${need} err=${padErr2?.message ?? 'none'}`);
      }
    } catch (e: any) {
      console.warn(`[issue-draft] final image check failed post=${blogPostId}:`, e?.message);
    }

    // s189: hub_mapping RPC — 본문 entity 매칭으로 blog_hub_mapping 영구 적용 (멱등)
    // s195: RPC 결과 카운트 + 에러 로깅 (silent fail 식별)
    try {
      const { data: mappingResult, error: mErr } = await (sb as any).rpc('inject_hub_mapping_for_post', { p_post_id: blogPostId });
      console.log(`[issue-draft] hub_mapping post=${blogPostId} result=${JSON.stringify(mappingResult ?? null).slice(0,120)} err=${mErr?.message ?? 'none'}`);
    } catch (mapErr: any) {
      console.warn('[issue-draft] inject_hub_mapping_for_post exception:', mapErr?.message);
    }
  }

  const insertFailed = !insertResult.success && !blogPostId;
  dbw('issue-draft', 'issue_alerts.update@746', await (sb as any).from('issue_alerts').update({
    is_published: (canAutoPublish && !!blogPostId),
    publish_decision: canAutoPublish && !!blogPostId ? 'auto' : canAutoPublish ? 'auto_failed' : !!blogPostId ? 'draft' : 'failed',
    block_reason: insertFailed ? (insertResult.message || insertResult.reason || 'safeBlogInsert failed') : null,
    blog_post_id: blogPostId, draft_title: article.title, draft_content: seoEnriched,
    draft_slug: article.slug, draft_keywords: article.keywords,
    infographic_data: {},
    draft_template: selectDraftTemplate(issue.category, issue.issue_type),
    fact_check_passed: check.passed, fact_check_details: check.details,
    published_at: canAutoPublish && !!blogPostId ? new Date().toISOString() : null,
    // s194: 발행 성공 시 retry_count 0 reset — image-attach 단계의 retry<3 가드가
    // 이전 ai_failed 누적 카운트를 들고 가지 않도록.
    retry_count: blogPostId ? 0 : (issue.retry_count || 0),
  }).eq('id', issue.id));

  if (canAutoPublish && blogPostId) {
    await createOfficialFeedPost(sb, issue, article.slug);
    await scheduleBuzzPosts(sb, issue.id, issue.final_score);
    try { await submitIndexNow([`${SITE_URL}/blog/${article.slug}`]); } catch {}
  }

  return { decision: canAutoPublish ? 'auto_published' : !!blogPostId ? 'draft_saved' : 'failed', title: article.title, score: issue.final_score, slug: article.slug };
}

/* ═══════════ 핸들러 ═══════════ */

/**
 * ABG X-2 — 동시 처리 풀. 건당 대부분이 LLM 대기라 직렬이면 회전당 1~2건에 갇힌다.
 * startCutoffMs 이후에는 «새 건을 시작하지 않는다»(진행 중인 건은 끝낸다) — 300s 한도 방어.
 */
async function runPool<T>(items: T[], worker: (item: T) => Promise<void>, opts: { concurrency: number; startCutoffMs: number; start: number; canStart?: () => boolean }): Promise<string | null> {
  let next = 0;
  let stopped: string | null = null;
  const lane = async () => {
    while (next < items.length) {
      const elapsed = Date.now() - opts.start;
      if (elapsed > opts.startCutoffMs) { stopped = stopped ?? `elapsed_${Math.round(elapsed / 1000)}s_over_preempt`; return; }
      if (opts.canStart && !opts.canStart()) { stopped = stopped ?? 'hit_published_cap'; return; }
      const item = items[next++];
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency, items.length) }, lane));
  return stopped;
}

/**
 * ABG X-2 — 편집 회차(?mode=edit). 생성 회차가 수치 게이트에서 넘긴 edit_pending 을 감산 편집 1회 → 재판정 → 마무리.
 * 스케줄은 pg_cron(생성 회차와 5분 어긋나게). 기록은 cron_logs 'issue-draft-edit' — 회전당 처리 건수는 이 축으로 잰다.
 */
async function editHandler() {
  return withCronLogging('issue-draft-edit', async () => {
    const sb = getSupabaseAdmin();
    const config = await getAutoPublishConfig(sb);
    const start = Date.now();
    // 편집 중 죽은 잠금(editing) 회수 — 8분 경과·6시간 이내만 edit_pending 으로 되돌린다
    const staleBefore = new Date(Date.now() - 8 * 60_000).toISOString();
    const windowFrom = new Date(Date.now() - 6 * 3600_000).toISOString();
    dbw('issue-draft', 'issue_alerts.update@edit_reclaim', await (sb as any).from('issue_alerts')
      .update({ publish_decision: 'edit_pending' })
      .eq('publish_decision', 'editing').is('blog_post_id', null)
      .lt('processed_at', staleBefore).gt('processed_at', windowFrom));
    const { data: pool } = await (sb as any).from('issue_alerts')
      .select('*').eq('publish_decision', 'edit_pending')
      .order('processed_at', { ascending: true }).limit(6);
    const items = (pool ?? []) as any[];
    const results: any[] = [];
    let published = 0;
    const stopped = await runPool(items, async (issue) => {
      try {
        const r = await processEditIssue(sb, issue, config);
        results.push(r);
        if (r.decision === 'auto_published') published++;
      } catch (e) {
        console.error(`[issue-draft] edit error ${issue.id}:`, e);
        results.push({ decision: 'error', score: issue.final_score });
      }
    }, { concurrency: 3, startCutoffMs: 150_000, start });
    return {
      processed: results.length, created: published,
      failed: results.filter((r) => r.decision.includes('failed') || r.decision === 'error').length,
      metadata: {
        mode: 'edit', eligible: items.length, published,
        stopped_reason: stopped ?? 'all_processed', elapsed_ms: Date.now() - start,
        reasons: results.reduce((acc: Record<string, number>, r) => { acc[r.decision] = (acc[r.decision] ?? 0) + 1; return acc; }, {}),
        results: results.map((r) => ({ decision: r.decision, title: r.title?.slice(0, 40) })),
      },
    };
  });
}

async function handler(req: NextRequest) {
  if (req.nextUrl.searchParams.get('mode') === 'edit') return NextResponse.json(await editHandler());
  const result = await withCronLogging('issue-draft', async () => {
    const sb = getSupabaseAdmin();
    const config = await getAutoPublishConfig(sb);
    const _start = Date.now();
    const MAX_PER_RUN = 15;

    /* BG-0 — 문턱에서 «몇 개가» 떨어졌는지를 센다.
       예전에는 이 update 가 조용히 지나가서 「25점 미만 몇 건이 잘렸나」를 알 수 없었다.
       ⚠️ 동작은 그대로다. 세기만 더한다(관측 계약 · S9 로깅 계열). */
    const { count: scannedTotal } = await (sb as any).from('issue_alerts')
      .select('id', { count: 'exact', head: true }).eq('is_processed', false);

    /* EX-B — 타임아웃 잠금 회수. 함수가 300s 에 죽으면 CAS 잠금(is_processed=true)만 남고 판정이 비어 글감이 영구 소실된다.
       최근 6시간 · 8분 이상 묵은 «판정 없는 잠금» 만 1회 되돌리고, 두 번째 타임아웃이면 timeout 으로 닫는다.
       ⛔ 6시간 밖의 과거 잔존분(4/13~9/8 219건)은 건드리지 않는다 — 한꺼번에 되살리면 생산 수문이 열린다. */
    {
      const staleBefore = new Date(Date.now() - 8 * 60_000).toISOString();
      const windowFrom = new Date(Date.now() - 6 * 3600_000).toISOString();
      // ⚠️ supabase-js 는 필터를 update() «뒤» 에 건다
      const stale = (q: any) => q
        .eq('is_processed', true).is('publish_decision', null).is('blog_post_id', null)
        .lt('processed_at', staleBefore).gt('processed_at', windowFrom);
      dbw('issue-draft', 'issue_alerts.update@timeout_close',
        await stale((sb as any).from('issue_alerts').update({ publish_decision: 'timeout', fail_reason: 'timeout' })).eq('fail_reason', 'timeout_lock'));
      dbw('issue-draft', 'issue_alerts.update@timeout_reclaim',
        await stale((sb as any).from('issue_alerts').update({ is_processed: false, fail_reason: 'timeout_lock' })).or('fail_reason.is.null,fail_reason.neq.timeout_lock'));
    }

    const belowThreshold = await (sb as any).from('issue_alerts')
      .update({ is_processed: true, publish_decision: 'below_threshold', processed_at: new Date().toISOString() })
      .eq('is_processed', false).lt('final_score', 25).select('id');
    dbw('issue-draft', 'issue_alerts.update@780', belowThreshold);
    const belowThresholdN = belowThreshold?.data?.length ?? 0;

    // 미처리 이슈 조회 — LB-4 우선순위로 «앱에서» 정렬한다.
    // ⚠️ DB order 하나로는 P순위(미래지향 축)를 표현할 수 없어 후보를 넉넉히 받아 정렬한다.
    // ⛔ 문턱(final_score ≥ 25)에 CV-N 이벤트를 «예외» 로 둔다. 그 행은 감지 직후라
    //    점수가 아직 붙지 않았는데, P1(이름이 태어나는 순간)이 문턱에서 잘리면
    //    이 트랙 전체가 무의미해진다 — 실제로 잘리고 있었다(2026-09-08 실측).
    const { data: pool } = await (sb as any).from('issue_alerts')
      .select('*')
      .eq('is_processed', false)
      .or('final_score.gte.25,source_type.eq.cvn_name_event')
      // ABG 증분 — 쿼터 보류분 기아 방지. 쿼터로 되돌아간 행은 점수 그대로 매 회차 상위 60을 다시 채워
      //   부동산 글감이 1시간+ 풀에 못 들었다(2026-09-15 05:10~06:20Z 회차 전부 quota_deferred 15). 60분에 한 번만 다시 본다.
      .or(`fail_reason.is.null,fail_reason.neq.quota,processed_at.lt.${new Date(Date.now() - 60 * 60_000).toISOString()}`)
      .order('final_score', { ascending: false })
      .limit(MAX_PER_RUN * 4);
    const issues = sortForGeneration<any>((pool ?? []) as any[])
      .slice(0, MAX_PER_RUN)
      .map((x) => x.row);

    if (!issues || issues.length === 0) {
      return {
        processed: 0, created: 0, failed: 0,
        metadata: {
          message: 'no pending issues',
          scanned: scannedTotal ?? 0,
          eligible: 0,
          reasons: belowThresholdN > 0 ? { below_threshold: belowThresholdN } : {},
        },
      };
    }

    const results: any[] = [];
    let published = 0;

    // 세션 138 → EX-B → ABG X-2: Vercel 300s 방어.
    //  - 편집은 편집 회차로 분리(생성 회차 건당 = 생성 ~60-120s + 마무리 ~20s).
    //  - 3줄 동시 처리 · 130s 이후 새 건 시작 금지 → 최악 130 + 140 = 270s.
    //  - auto_published 회차 상한 2 는 유지(시작 시점 판정).
    const MAX_PUBLISHED_PER_RUN = 2;
    const stoppedReason = await runPool(issues, async (issue) => {
      try {
        const r = await processOneIssue(sb, issue, config);
        results.push(r);
        if (r.decision === 'auto_published') published++;
      } catch (e) {
        console.error(`[issue-draft] error processing ${issue.id}:`, e);
        results.push({ decision: 'error', score: issue.final_score });
      }
    }, { concurrency: 3, startCutoffMs: 130_000, start: _start, canStart: () => published < MAX_PUBLISHED_PER_RUN });

    return {
      processed: results.length,
      created: published,
      failed: results.filter(r => r.decision.includes('failed')).length,
      metadata: {
        published,
        stopped_reason: stoppedReason ?? 'all_processed',
        elapsed_ms: Date.now() - _start,
        remaining_queue: Math.max(0, issues.length - results.length),
        /* BG-0 관측 계약 — scanned / eligible / created / 사유별 롤업.
           ⚠️ results[] 는 «건별» 이라 길고 잘릴 수 있다. 판정에 쓰는 것은 이 롤업이고,
              results[] 는 개별 추적용으로 남긴다. 한 쿼리로 사유 분포가 나와야 한다. */
        scanned: scannedTotal ?? 0,
        eligible: issues.length,
        created: published,
        reasons: results.reduce((acc: Record<string, number>, r) => {
          acc[r.decision] = (acc[r.decision] ?? 0) + 1;
          return acc;
        }, belowThresholdN > 0 ? { below_threshold: belowThresholdN } : {}),
        results: results.map(r => ({ decision: r.decision, score: r.score, title: r.title?.slice(0, 40) })),
      },
    };
  });
  return NextResponse.json(result);
}

export const GET = withCronAuth(handler);
