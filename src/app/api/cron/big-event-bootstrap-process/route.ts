/**
 * [CI-v1 Phase 2] big_event_bootstrap_queue 처리 (30분 크론)
 *
 * queue LIMIT 10 을 우선순위 순서대로 꺼내 asset_type 별 처리:
 *   pillar        — Claude Opus, 2500자+ → blog_posts + big_event_registry.pillar_blog_post_id
 *   spoke         — Claude Haiku, 1200자+ → blog_posts + append spoke_blog_post_ids
 *   infographic   — 템플릿 (표 + 수치) → blog_posts
 *   landing       — 템플릿 (지역/키워드 SEO 랜딩) → blog_posts
 *   discussion    — 토론방 성격 blog_posts (sub_category='discussion')
 *
 * 공통:
 *   - validate_blog_post 통과 필수 → safeBlogInsert 경유
 *   - 실패는 queue.status='failed', last_error 기록, attempt_count+1
 *   - 성공은 queue.status='done', completed_at, blog_post_id 기록
 *   - 300s maxDuration, PREEMPT_MS 260s, pillar 는 최대 2건/run
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { AI_MODEL_HAIKU, AI_MODEL_OPUS, ANTHROPIC_VERSION } from '@/lib/constants';

export const maxDuration = 300;
export const runtime = 'nodejs';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MAX_PER_RUN = 10;
const MAX_PILLAR_PER_RUN = 2;
const PREEMPT_MS = 260_000;

interface EventRow {
  id: number;
  slug: string;
  name: string;
  full_name?: string | null;
  region_sido?: string | null;
  region_sigungu?: string | null;
  region_dong?: string | null;
  event_type?: string | null;
  stage?: string | null;
  scale_before?: number | null;
  scale_after?: number | null;
  build_year_before?: number | null;
  build_year_after_est?: number | null;
  key_constructors?: any;
  new_brand_name?: string | null;
  constructor_status?: string | null;
  fact_sources?: any;
  notes?: string | null;
  fact_confidence_score?: number | null;
  spoke_blog_post_ids?: number[] | null;
  estimated_sales_price_min_pyeong?: number | null;
  estimated_sales_price_max_pyeong?: number | null;
}

function buildFactBlock(ev: EventRow): string {
  const constructors = Array.isArray(ev.key_constructors)
    ? ev.key_constructors.join(', ')
    : (ev.key_constructors || '미정');
  const scale = ev.scale_after
    ? `${ev.scale_before ?? '?'} → ${ev.scale_after}+세대`
    : `${ev.scale_before ?? '?'}세대`;
  const brand = ev.new_brand_name
    ? `${ev.new_brand_name} (${ev.constructor_status || 'unconfirmed'})`
    : '미정 (수주 전)';
  const sources = Array.isArray(ev.fact_sources) ? ev.fact_sources.join(' · ') : '카더라 내부 노트';
  return [
    '[절대 팩트 고정 - 바꾸지 말 것]',
    `- 이름: ${ev.name}${ev.full_name ? ` (${ev.full_name})` : ''}`,
    `- 지역: ${ev.region_sido || ''} ${ev.region_sigungu || ''} ${ev.region_dong || ''}`.trim(),
    `- 준공: ${ev.build_year_before ?? '미상'}년`,
    `- 세대: ${scale}`,
    `- 재건축 후 브랜드: ${brand}`,
    `- 시공사: ${constructors}`,
    `- 현 Stage: ${ev.stage ?? '미정'} / 예상 완공: ${ev.build_year_after_est ?? '미정'}`,
    `- 비고: ${ev.notes || ''}`,
    `- 출처: ${sources}`,
    '⚠️ 위 정보를 그대로 인용. 다른 브랜드명/시공사/세대수로 바꾸지 말 것.',
    '⚠️ 확정되지 않은 정보(분양가·완공일)는 "추정"·"예상"·"시나리오" 표기.',
  ].join('\n');
}

async function callClaude(model: string, system: string, user: string, maxTokens: number): Promise<any | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(150_000),
    });
    if (!res.ok) {
      console.error(`[bootstrap-process] Claude ${model} ${res.status}`);
      return null;
    }
    const data = await res.json();
    const text: string = data?.content?.[0]?.text || '';
    if (!text) return null;
    const clean = text.replace(/```json|```/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      return null;
    }
  } catch (err: any) {
    console.error('[bootstrap-process] Claude error:', err?.message);
    return null;
  }
}

async function generatePillar(ev: EventRow): Promise<{ title: string; slug: string; meta: string; content: string } | null> {
  const factBlock = buildFactBlock(ev);
  const system = `${factBlock}

당신은 카더라(kadeora.app) 수석 데이터 에디터입니다. ${ev.event_type || '재건축'} Pillar 심층 기사를 작성합니다.

규칙:
- 분량: 6,000~9,000자 (최소 2,500자 절대 하한)
- H2 섹션 7~10개, 표 3개+, FAQ 10개
- 내부 링크 5개+: /apt, /apt?tab=ongoing, /apt?tab=unsold, /blog, /feed
- 팩트는 위 [절대 팩트 고정] 블록 인용. 추정/예상은 명시.
- 본문 이미지 마크다운 금지 (파이프가 자동 주입)`;

  const user = `대상: ${ev.name} ${ev.region_sigungu || ''} ${ev.event_type || '재건축'}

요구사항:
1) 도입 핵심 팩트 3줄 + 투자자 관점 1줄
2) Stage 진행도 + 남은 단계 일정표
3) 세대수/브랜드/시공사 표
4) 예상 분양가 시나리오 표 (보수/중립/낙관)
5) 조합원 관점 혜택/의무
6) 일반 투자자 관점 기회/리스크
7) FAQ 10개 (Q./A. 형식)
8) 관련 Spoke/카더라 내부 링크

출력 (JSON만):
{
  "title": "45~65자 제목",
  "slug": "영문/한글 slug",
  "meta": "meta_description 140~160자",
  "content": "마크다운 본문 전체"
}`;

  const parsed = await callClaude(AI_MODEL_OPUS, system, user, 16000);
  if (!parsed?.title || !parsed?.content || String(parsed.content).length < 2500) return null;
  return {
    title: String(parsed.title).slice(0, 80),
    slug: String(parsed.slug || `${ev.slug}-pillar-${Date.now()}`).slice(0, 90),
    meta: String(parsed.meta || '').slice(0, 170),
    content: String(parsed.content),
  };
}

async function generateSpoke(ev: EventRow, slotIndex: number): Promise<{ title: string; slug: string; meta: string; content: string } | null> {
  const factBlock = buildFactBlock(ev);
  const spokeAngles = [
    '예상 분양가 시나리오와 주변 시세 비교',
    'Stage별 진행 일정과 주요 이정표',
    '시공사 입찰 현황 및 브랜드 가치 분석',
    '조합원 관점 혜택과 추가 분담금 시뮬레이션',
    '일반 투자자 관점 리스크 요인 총정리',
    '주변 인프라 및 학군·교통 접근성',
    '재건축 후 예상 시세 3가지 시나리오',
    '해당 지역 최근 거래 동향과 호가 추이',
    '유사 단지 재건축 사례 비교 분석',
    '청약·입주권·분양권 매수 체크리스트',
  ];
  const angle = spokeAngles[slotIndex % spokeAngles.length];

  const system = `${factBlock}

당신은 카더라 데이터 에디터입니다. ${ev.event_type || '재건축'} Spoke(서브토픽) 기사를 작성합니다.

규칙:
- 분량: 1,500~2,500자 (최소 1,200자 하한)
- H2 섹션 4~6개, 표 1개+, FAQ 5개
- 내부 링크 3개+: /apt, /blog, /feed 등
- 팩트는 [절대 팩트 고정] 블록 인용`;

  const user = `대상: ${ev.name} ${ev.region_sigungu || ''} / 서브토픽: ${angle}

출력 (JSON만):
{"title": "35~55자 제목", "slug": "slug", "meta": "140~160자", "content": "마크다운"}`;

  const parsed = await callClaude(AI_MODEL_HAIKU, system, user, 6000);
  if (!parsed?.title || !parsed?.content || String(parsed.content).length < 1200) return null;
  return {
    title: String(parsed.title).slice(0, 80),
    slug: String(parsed.slug || `${ev.slug}-spoke-${slotIndex}-${Date.now()}`).slice(0, 90),
    meta: String(parsed.meta || '').slice(0, 170),
    content: String(parsed.content),
  };
}

function buildInfographicContent(ev: EventRow): { title: string; slug: string; meta: string; content: string } {
  const region = `${ev.region_sido || ''} ${ev.region_sigungu || ''}`.trim();
  const title = `${ev.name} ${ev.event_type || '재건축'} 한눈에 — 지표 요약 인포그래픽`;
  const slug = `${ev.slug}-infographic-${Date.now().toString(36)}`;
  const brand = ev.new_brand_name || '미정';
  const constructors = Array.isArray(ev.key_constructors) ? ev.key_constructors.join(', ') : (ev.key_constructors || '미정');
  const scale = ev.scale_after ? `${ev.scale_before ?? '?'} → ${ev.scale_after}+세대` : `${ev.scale_before ?? '?'}세대`;
  const priceMin = ev.estimated_sales_price_min_pyeong ?? '—';
  const priceMax = ev.estimated_sales_price_max_pyeong ?? '—';

  const content = `## ${ev.name} ${ev.event_type || '재건축'} 요약

> 📊 **${region}** ${ev.event_type || '재건축'} 주요 지표를 한눈에 확인하세요.

## 핵심 지표

| 항목 | 내용 |
|------|------|
| 이름 | ${ev.name}${ev.full_name ? ` (${ev.full_name})` : ''} |
| 지역 | ${region} ${ev.region_dong || ''} |
| 사업 유형 | ${ev.event_type || '재건축'} |
| 준공년도 | ${ev.build_year_before ?? '미상'}년 |
| 세대수 변화 | ${scale} |
| 신 브랜드 | ${brand} |
| 시공사 | ${constructors} |
| 현 Stage | ${ev.stage || '미정'} |
| 예상 완공 | ${ev.build_year_after_est || '미정'} |

## 예상 분양가 (평당)

| 시나리오 | 예상가 |
|---------|--------|
| 최소 | ${priceMin}만원 |
| 최대 | ${priceMax}만원 |

> ⚠️ 위 수치는 **추정치**이며, 실제 분양가는 시장 상황과 조합 결정에 따라 달라질 수 있습니다.

## 사업 진행 단계

1. **조합 설립** — 완료 여부 확인
2. **사업시행인가** — 신청/승인 단계
3. **관리처분인가** — 조합원 분양·일반 분양
4. **이주 및 철거** — 세대 이주 완료 → 철거 착공
5. **착공 및 완공** — 일반적으로 착공 후 3~4년

## 관련 정보

- [카더라 청약 일정](/apt)
- [${ev.region_sigungu || '지역'} 아파트 블로그](/blog?category=apt)
- [대형 재건축 이벤트](/apt?tab=big-event)

## 자주 묻는 질문

**Q. 이 지표의 출처는?**

A. 공공 데이터(국토부 실거래, 정비사업 공시)와 카더라 자체 수집 자료 기반입니다. 확정되지 않은 예상치는 "추정" 표기입니다.

**Q. 예상 분양가는 얼마나 신뢰할 수 있나요?**

A. 주변 시세와 최근 유사 단지 분양가를 참고한 범위값으로, 실제 분양 공고 시 변동됩니다. 참고 목적으로만 활용하세요.

**Q. 관심 단지로 등록하려면?**

A. [카더라 청약 페이지](/apt)에서 관심 설정 시, 이정표 단계 변경·뉴스 발생 시 알림을 받을 수 있습니다.

---

**데이터 출처:** 카더라(kadeora.app) 자체 수집 데이터 + 공공 부동산 자료 | **기준일:** ${new Date().toISOString().slice(0, 10)}`;

  return {
    title: title.slice(0, 80),
    slug: slug.slice(0, 90),
    meta: `${ev.name} ${ev.event_type || '재건축'} 핵심 지표를 표로 한눈에 — 세대수, 브랜드, 시공사, 예상 분양가, 단계, 완공 시점까지 카더라 데이터로 정리한 인포그래픽.`.slice(0, 160),
    content,
  };
}

function buildLandingContent(ev: EventRow): { title: string; slug: string; meta: string; content: string } {
  const region = `${ev.region_sido || ''} ${ev.region_sigungu || ''}`.trim();
  const title = `${region} ${ev.name} ${ev.event_type || '재건축'} 최신 정보 총정리`;
  const slug = `${ev.slug}-landing-${Date.now().toString(36)}`;
  const brand = ev.new_brand_name || '미정 (수주 전)';
  const scale = ev.scale_after ? `${ev.scale_before ?? '?'} → ${ev.scale_after}+세대` : `${ev.scale_before ?? '?'}세대`;

  const content = `## ${region} ${ev.name} ${ev.event_type || '재건축'} 랜딩 페이지

> 🔎 **${ev.name}** ${ev.event_type || '재건축'} 사업 현황, 예상 분양가, 일정 정보를 한 곳에서 확인하세요. 카더라가 지속적으로 업데이트합니다.

## 왜 이 단지가 주목받나요?

${ev.name}${ev.full_name ? `(${ev.full_name})` : ''} 는 ${region}에 위치한 ${ev.build_year_before ?? '구'}년 준공 ${ev.scale_before ?? '?'}세대 단지입니다. ${ev.event_type || '재건축'} 사업이 추진되면서 세대수는 ${scale} 규모로 확장될 예정이고, 신 브랜드는 **${brand}** 으로 알려져 있습니다.

## 한눈에 보는 사업 개요

| 항목 | 내용 |
|------|------|
| 위치 | ${region} ${ev.region_dong || ''} |
| 현재 Stage | ${ev.stage || '미정'} |
| 세대수 | ${scale} |
| 예상 완공 | ${ev.build_year_after_est || '미정'} |
| 시공사 | ${Array.isArray(ev.key_constructors) ? ev.key_constructors.join(', ') : (ev.key_constructors || '미정')} |

## 최근 이슈 타임라인

- **조합 설립 및 사업시행인가**: 정비사업 조합을 통해 사업을 추진 중입니다.
- **시공사 선정**: ${ev.constructor_status === 'confirmed' ? '선정 완료' : '입찰 진행'} 단계에 있습니다.
- **분양 예정**: 관리처분인가 이후 일반 분양이 진행될 예정입니다.

## 예상 분양가와 주변 시세 비교

주변 최근 거래 시세와 신축 단지 분양가를 참고할 때, ${ev.name}의 예상 분양가는 평당 ${ev.estimated_sales_price_min_pyeong ?? '—'}~${ev.estimated_sales_price_max_pyeong ?? '—'}만원 범위로 **추정**됩니다. 실제 분양가는 시장 상황·조합 결정에 따라 달라집니다.

## 관심 등록 / 알림 받기

카더라 앱에서 단지를 관심 등록하시면 이정표 단계 변경, 언론 보도, 분양 일정이 확정될 때마다 즉시 알림을 받을 수 있습니다.

- [카더라 청약 일정 전체](/apt)
- [${ev.region_sigungu || '지역'} 부동산 블로그](/blog?category=apt)
- [카더라 커뮤니티](/feed)

## 자주 묻는 질문

**Q. ${ev.name} ${ev.event_type || '재건축'} 은 언제 분양하나요?**

A. 현재 ${ev.stage || '사업 초기'} 단계이며, 관리처분인가 이후 일반 분양이 진행됩니다. 정확한 일정은 조합 결정에 따라 달라지며, 카더라는 단계 변경 시 즉시 업데이트합니다.

**Q. 시공사는 확정됐나요?**

A. 현재 ${ev.constructor_status === 'confirmed' ? '선정 완료' : '선정 전/진행 중'} 상태입니다. 공식 발표 전까지 브랜드명은 변경될 수 있습니다.

**Q. 예상 분양가는 얼마나 정확한가요?**

A. 주변 시세와 유사 단지 분양가를 근거로 한 **추정** 범위이며, 실제 분양가는 시장 여건·조합 결정에 따라 변동됩니다.

**Q. 조합원이 아닌데 매수할 수 있나요?**

A. 사업 단계별로 입주권·분양권 매수 조건이 다릅니다. [청약 가점 계산기](/apt/diagnose)를 참고하여 자격을 확인하세요.

**Q. 투자 리스크는 무엇인가요?**

A. 관리처분인가 지연, 이주 지연, 금리 변동, 시장 하락 등이 대표 리스크입니다. 단정적 수익 전망보다는 시나리오별 분석이 안전합니다.

---

**데이터 출처:** 카더라(kadeora.app) + 공공 부동산 자료 | **기준일:** ${new Date().toISOString().slice(0, 10)}`;

  return {
    title: title.slice(0, 80),
    slug: slug.slice(0, 90),
    meta: `${ev.name} ${ev.event_type || '재건축'} 사업 현황, 예상 분양가, 단계별 일정, 시공사까지 ${region} 핵심 정보를 카더라가 정리한 랜딩 페이지.`.slice(0, 160),
    content,
  };
}

function buildDiscussionContent(ev: EventRow): { title: string; slug: string; meta: string; content: string } {
  const title = `${ev.name} ${ev.event_type || '재건축'} 토론방 — 이슈·루머·현장 정보 공유`;
  const slug = `${ev.slug}-discussion-${Date.now().toString(36)}`;
  const region = `${ev.region_sido || ''} ${ev.region_sigungu || ''}`.trim();

  const content = `## ${ev.name} ${ev.event_type || '재건축'} 토론방

> 💬 **${region}** ${ev.name} 관련 모든 이슈를 한곳에서. 조합원·투자자·지역 주민의 정보 공유와 토론 공간입니다.

## 토론 주제 예시

- **사업 진행 단계** — 인가·이주·착공 관련 현장 소식
- **시공사 선정 동향** — 입찰 참여사와 브랜드 전망
- **분양가·공급 물량** — 예상 분양가와 타 단지 대비 경쟁력
- **주변 시세** — 최근 거래와 호가 동향
- **리스크·체크포인트** — 투자 시 주의할 요소

## 공유 가이드라인

1. **팩트 기반 공유** — 미확인 루머는 "루머"로 명시하고 출처 표기
2. **상호 존중** — 의견 차이는 인정하되 비방·도배 금지
3. **개인정보 보호** — 주민 실명·연락처·가정사 등은 공유 금지
4. **광고·홍보 제한** — 중개/컨설팅 영업 글은 삭제

## 관련 자료

- [${ev.name} Pillar 심층 분석](/blog?q=${encodeURIComponent(ev.name)})
- [카더라 청약 일정](/apt)
- [${ev.region_sigungu || '지역'} 아파트 블로그](/blog?category=apt)
- [카더라 커뮤니티](/feed)

## 자주 묻는 질문

**Q. 누구나 토론에 참여할 수 있나요?**

A. 카더라 회원이면 누구나 참여할 수 있습니다. 조합원·일반 투자자·지역 주민 모두 환영합니다.

**Q. 익명으로 글을 쓸 수 있나요?**

A. 카더라는 기본적으로 닉네임 기반이며, 민감한 주제는 익명 설정도 지원합니다.

**Q. 부적절한 글은 어떻게 신고하나요?**

A. 각 글 우측 상단 "신고" 버튼을 눌러 사유를 선택하면 운영팀이 24시간 내 검토합니다.

**Q. 공식 발표와 루머를 어떻게 구분하나요?**

A. 확정 정보는 🏢 공식 태그, 미확정/제보는 🌀 루머 태그로 구분합니다. 글 작성 시 태그를 선택해 주세요.

**Q. 신규 이정표가 생기면 알림을 받을 수 있나요?**

A. [카더라 앱](/apt)에서 단지를 관심 등록하시면 Stage 변경·뉴스 발생 시 푸시 알림이 발송됩니다.

---

**운영:** 카더라 커뮤니티팀 | **기준일:** ${new Date().toISOString().slice(0, 10)}`;

  return {
    title: title.slice(0, 80),
    slug: slug.slice(0, 90),
    meta: `${ev.name} ${ev.event_type || '재건축'} 관련 최신 이슈, 루머, 현장 정보를 공유하는 카더라 공식 토론방. 조합원·투자자·지역 주민 모두 참여 가능.`.slice(0, 160),
    content,
  };
}

async function insertBlogForEvent(
  sb: any,
  ev: EventRow,
  gen: { title: string; slug: string; meta: string; content: string },
  assetType: 'pillar' | 'spoke' | 'infographic' | 'landing' | 'discussion',
): Promise<{ ok: boolean; id?: number; reason?: string }> {
  const tags = [ev.name, ev.region_sigungu, ev.event_type, ev.new_brand_name, '재건축', assetType]
    .filter(Boolean)
    .slice(0, 6) as string[];
  const subCatMap: Record<string, string> = {
    pillar: ev.event_type || '재건축',
    spoke: 'spoke',
    infographic: 'infographic',
    landing: 'landing',
    discussion: 'discussion',
  };
  const cronTypeMap: Record<string, string> = {
    pillar: 'big-event-bootstrap-pillar',
    spoke: 'big-event-bootstrap-spoke',
    infographic: 'big-event-bootstrap-infographic',
    landing: 'big-event-bootstrap-landing',
    discussion: 'big-event-bootstrap-discussion',
  };

  const result = await safeBlogInsert(sb, {
    slug: gen.slug,
    title: gen.title,
    content: gen.content,
    category: 'apt',
    tags,
    source_type: `big_event_${assetType}`,
    cron_type: cronTypeMap[assetType],
    source_ref: (Array.isArray(ev.fact_sources) ? ev.fact_sources[0] : '') || '',
    meta_description: gen.meta,
    meta_keywords: tags.join(','),
    cover_image: undefined,
    image_alt: `${ev.name} ${ev.event_type || '재건축'} ${assetType}`,
    is_published: false,
  } as any);

  if (!result.success) {
    return { ok: false, reason: `${result.reason}:${result.message || ''}` };
  }
  const id = result.id ? Number(result.id) : undefined;
  if (!id) return { ok: false, reason: 'no_id' };

  // blog_posts 에 sub_category 를 별도로 UPDATE (safeBlogInsert 가 지원 안 함)
  try {
    await sb.from('blog_posts').update({ sub_category: subCatMap[assetType] }).eq('id', id);
  } catch { /* ignore */ }

  return { ok: true, id };
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('big-event-bootstrap-process', async () => {
      const sb = getSupabaseAdmin();
      const start = Date.now();

      const { data: queue, error: qErr } = await (sb as any)
        .from('big_event_bootstrap_queue')
        .select('id, event_id, asset_type, slot_index, attempt_count')
        .eq('status', 'pending')
        .lt('attempt_count', 3)
        .order('event_id', { ascending: true })
        .order('slot_index', { ascending: true })
        .limit(MAX_PER_RUN * 3);

      if (qErr) return { processed: 0, failed: 1, metadata: { error: qErr.message } };
      if (!queue || queue.length === 0) {
        return { processed: 0, metadata: { message: 'no pending queue rows' } };
      }

      // 우선순위: pillar → landing → infographic → spoke → discussion
      const priority: Record<string, number> = { pillar: 0, landing: 1, infographic: 2, spoke: 3, discussion: 4 };
      const sorted = [...queue].sort((a, b) => (priority[a.asset_type] ?? 9) - (priority[b.asset_type] ?? 9));

      const eventIds = Array.from(new Set(sorted.map((q: any) => q.event_id)));
      const { data: events } = await (sb as any)
        .from('big_event_registry')
        .select('id, slug, name, full_name, region_sido, region_sigungu, region_dong, event_type, stage, scale_before, scale_after, build_year_before, build_year_after_est, key_constructors, new_brand_name, constructor_status, fact_sources, notes, fact_confidence_score, spoke_blog_post_ids, estimated_sales_price_min_pyeong, estimated_sales_price_max_pyeong')
        .in('id', eventIds);
      const eventMap = new Map<number, EventRow>();
      for (const e of (events || []) as EventRow[]) eventMap.set(e.id, e);

      const stats = {
        processed: 0, done: 0, failed: 0,
        pillar: 0, spoke: 0, infographic: 0, landing: 0, discussion: 0,
      };
      const samples: any[] = [];
      const failures: string[] = [];
      let pillarDone = 0;

      for (const q of sorted) {
        if (stats.processed >= MAX_PER_RUN) break;
        if (Date.now() - start > PREEMPT_MS) break;
        if (q.asset_type === 'pillar' && pillarDone >= MAX_PILLAR_PER_RUN) continue;

        const ev = eventMap.get(q.event_id);
        if (!ev) {
          await (sb as any).from('big_event_bootstrap_queue').update({
            status: 'failed',
            last_error: 'event_not_found_or_inactive',
            attempt_count: (q.attempt_count || 0) + 1,
          }).eq('id', q.id);
          stats.failed++;
          continue;
        }

        stats.processed++;

        // 선 started_at 스탬프 + CAS lock (status=pending → running)
        const { data: lockRow } = await (sb as any)
          .from('big_event_bootstrap_queue')
          .update({ status: 'running', started_at: new Date().toISOString() })
          .eq('id', q.id)
          .eq('status', 'pending')
          .select('id');
        if (!lockRow || lockRow.length === 0) continue; // 다른 runner 가 잡음

        try {
          let gen: { title: string; slug: string; meta: string; content: string } | null = null;
          const at = String(q.asset_type);
          if (at === 'pillar') {
            gen = await generatePillar(ev);
          } else if (at === 'spoke') {
            gen = await generateSpoke(ev, q.slot_index || 0);
          } else if (at === 'infographic') {
            gen = buildInfographicContent(ev);
          } else if (at === 'landing') {
            gen = buildLandingContent(ev);
          } else if (at === 'discussion') {
            gen = buildDiscussionContent(ev);
          } else {
            throw new Error(`unknown_asset_type:${at}`);
          }
          if (!gen) {
            await (sb as any).from('big_event_bootstrap_queue').update({
              status: 'failed',
              last_error: 'gen_returned_null',
              attempt_count: (q.attempt_count || 0) + 1,
            }).eq('id', q.id);
            stats.failed++;
            failures.push(`${q.id}:${at}:gen_null`);
            continue;
          }

          const ins = await insertBlogForEvent(sb, ev, gen, at as any);
          if (!ins.ok || !ins.id) {
            await (sb as any).from('big_event_bootstrap_queue').update({
              status: 'failed',
              last_error: ins.reason || 'insert_failed',
              attempt_count: (q.attempt_count || 0) + 1,
            }).eq('id', q.id);
            stats.failed++;
            failures.push(`${q.id}:${at}:insert:${ins.reason}`);
            continue;
          }

          // big_event_registry 링크 업데이트
          if (at === 'pillar') {
            await (sb as any)
              .from('big_event_registry')
              .update({ pillar_blog_post_id: ins.id, updated_at: new Date().toISOString() })
              .eq('id', ev.id);
          } else if (at === 'spoke') {
            const currentSpokes: number[] = Array.isArray(ev.spoke_blog_post_ids) ? ev.spoke_blog_post_ids : [];
            const newSpokes = Array.from(new Set([...currentSpokes, ins.id]));
            await (sb as any)
              .from('big_event_registry')
              .update({ spoke_blog_post_ids: newSpokes, updated_at: new Date().toISOString() })
              .eq('id', ev.id);
            ev.spoke_blog_post_ids = newSpokes; // in-memory 반영 (같은 event 여러 spoke 처리 시)
          }

          await (sb as any).from('big_event_bootstrap_queue').update({
            status: 'done',
            blog_post_id: ins.id,
            completed_at: new Date().toISOString(),
            last_error: null,
            attempt_count: (q.attempt_count || 0) + 1,
          }).eq('id', q.id);

          stats.done++;
          (stats as any)[at] = ((stats as any)[at] || 0) + 1;
          if (at === 'pillar') pillarDone++;

          if (samples.length < 5) {
            samples.push({
              queue_id: q.id,
              event: ev.name,
              asset_type: at,
              post_id: ins.id,
              title: gen.title.slice(0, 40),
              content_len: gen.content.length,
            });
          }
        } catch (err: any) {
          await (sb as any).from('big_event_bootstrap_queue').update({
            status: 'failed',
            last_error: (err?.message || 'unknown').slice(0, 500),
            attempt_count: (q.attempt_count || 0) + 1,
          }).eq('id', q.id);
          stats.failed++;
          failures.push(`${q.id}:exception:${err?.message || ''}`);
        }
      }

      return {
        processed: stats.processed,
        created: stats.done,
        failed: stats.failed,
        metadata: {
          ...stats,
          samples,
          sample_failures: failures.slice(0, 5),
          elapsed_ms: Date.now() - start,
        },
      };
    }, { redisLockTtlSec: 330 }),
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
