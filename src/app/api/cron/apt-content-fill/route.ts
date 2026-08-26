import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { lifecycleLabel } from '@/lib/apt/lifecycle-label';

export const maxDuration = 120;

/**
 * R3-3 · content_score < 40 인 현장의 `description` · `faq_items` 를 채운다.
 *
 * ── 왜 필요한가 ──────────────────────────────────────────────────────────
 * `/apt/[id]` 는 `content_score < 40` 이면 스스로 `noindex` 를 선언한다(page.tsx:720).
 * 그런데 그 구간에 «광고 랜딩» 이 38곳 들어 있다 — 검색엔진에 제출조차 않는 페이지를
 * 돈 주고 사람에게 보여주는 셈이다. 결손은 전부 description(100자 미만)과
 * faq_items(3개 미만)이고, 이 둘은 «연결로는 오르지 않는다». 글이 있어야 오른다.
 *
 * 배점(sync-apt-sites Step 5): description ≥100자 +10 · ≥200자 +3 ·
 *                              faq_items ≥3개 +10 · ≥5개 +3
 *
 * ── ⛔ AI 창작 금지 ───────────────────────────────────────────────────────
 * `lib/apt/ad-safety.ts` 가 「광고 랜딩에서 미확인 정보를 렌더하지 않는다」를 명시한다.
 * 대상의 상당수가 «광고 랜딩» 이다. 없는 값을 문장으로 지어내면 표시·광고법 문제로
 * 직결되고 심사 반려 한 번에 계정이 묶인다.
 *
 * 그래서 이 크론은 **DB 에 있는 확정 필드만 문장으로 조립한다.**
 *   · 값이 없으면 그 문장을 «뺀다». 길이를 채우려고 늘리지 않는다.
 *   · FAQ 도 «답이 DB 에 있는 질문만» 만든다. 3개를 못 채우면 못 채운 채로 둔다.
 *   · 추측·전망·평가 표현을 쓰지 않는다(「유망하다」「기대된다」 따위).
 *
 * ⚠️ `content_score` 를 직접 UPDATE 하지 않는다. 채운 뒤 sync-apt-sites 가 재계산한다.
 */

type Site = {
  id: string;
  name: string | null;
  region: string | null;
  sigungu: string | null;
  dong: string | null;
  site_type: string | null;
  lifecycle_stage: string | null;
  total_units: number | null;
  builder: string | null;
  developer: string | null;
  address: string | null;
  price_min: number | null;
  price_max: number | null;
  move_in_date: string | null;
  source_ids: Record<string, string> | null;
  description: string | null;
  faq_items: unknown;
};

const TYPE_LABEL: Record<string, string> = {
  subscription: '분양',
  redevelopment: '정비사업',
  unsold: '미분양',
  landmark: '랜드마크',
  complex: '기존 단지',
  trade: '실거래',
};

/** 만원 단위를 사람이 읽는 문자열로. */
function money(v: number): string {
  return v >= 10000 ? `${(v / 10000).toFixed(1)}억원` : `${v.toLocaleString()}만원`;
}

/** 「부산 해운대구 우동」처럼 «있는 것만» 이어 붙인다. */
function place(s: Site): string {
  return [s.region, s.sigungu, s.dong].filter(Boolean).join(' ');
}

/**
 * 확정 필드만으로 설명문을 조립한다.
 * ⚠️ 문장을 «추가» 할 때는 그 값이 DB 에 실제로 있는지부터 확인할 것.
 */
function buildDescription(s: Site): string | null {
  const name = (s.name || '').trim();
  if (!name) return null;

  const stage = lifecycleLabel(s.lifecycle_stage);
  const redevStage = s.source_ids?.redev_stage || null;
  const loc = place(s);
  const typeLabel = s.site_type ? TYPE_LABEL[s.site_type] : null;

  const sentences: string[] = [];

  // ① 무엇이고 어디인가
  if (loc && typeLabel) sentences.push(`${name}은(는) ${loc}에 위치한 ${typeLabel} 현장입니다.`);
  else if (loc) sentences.push(`${name}은(는) ${loc}에 위치한 현장입니다.`);
  else if (typeLabel) sentences.push(`${name}은(는) ${typeLabel} 현장입니다.`);
  else return null;   // 이름만 있는 현장은 조립하지 않는다

  // ② 지금 어느 단계인가
  if (redevStage) sentences.push(`현재 사업 단계는 ${redevStage}입니다.`);
  else if (stage) sentences.push(`현재 ${stage} 단계입니다.`);

  // ③ 규모
  if (s.total_units && s.total_units > 0) {
    sentences.push(`총 ${s.total_units.toLocaleString()}세대 규모로 계획되어 있습니다.`);
  }

  // ④ 누가 짓는가
  if (s.builder && s.developer && s.builder !== s.developer) {
    sentences.push(`시공사는 ${s.builder}, 시행사는 ${s.developer}입니다.`);
  } else if (s.builder) {
    sentences.push(`시공사는 ${s.builder}입니다.`);
  } else if (s.developer) {
    sentences.push(`시행사는 ${s.developer}입니다.`);
  }

  // ⑤ 분양가 — 있는 값만. 한쪽만 있으면 한쪽만 쓴다
  if (s.price_min && s.price_max && s.price_min !== s.price_max) {
    sentences.push(`분양가는 ${money(s.price_min)}부터 ${money(s.price_max)}까지로 공고되었습니다.`);
  } else if (s.price_min || s.price_max) {
    sentences.push(`분양가는 ${money((s.price_min || s.price_max) as number)}으로 공고되었습니다.`);
  }

  // ⑥ 입주 예정
  if (s.move_in_date) sentences.push(`입주 예정일은 ${s.move_in_date}입니다.`);

  // ⑦ 위치 상세 — 주소가 «사업지» 라고 단정하지 않는다.
  //    정비사업 주소는 조합 사무실인 경우가 있어 「소재지」라고만 적는다(R2 실측).
  if (s.address && s.address.length > 5) sentences.push(`소재지는 ${s.address}입니다.`);

  // ⑧ 이 페이지에서 «실제로» 볼 수 있는 것만 적는다
  sentences.push(`${name}의 일정과 분양가, 세대수, 주변 실거래가를 카더라에서 확인할 수 있습니다.`);

  const text = sentences.join(' ');
  return text.length >= 100 ? text : null;   // 100자를 못 넘기면 쓰지 않는다
}

type Faq = { q: string; a: string };

/**
 * 답이 DB 에 있는 질문만 만든다.
 * ⚠️ 3개를 못 채우면 «빈손으로» 돌려준다. 억지로 채우지 않는다.
 */
function buildFaq(s: Site): Faq[] {
  const name = (s.name || '').trim();
  const out: Faq[] = [];
  const loc = place(s);
  const stage = lifecycleLabel(s.lifecycle_stage);
  const redevStage = s.source_ids?.redev_stage || null;

  if (loc) out.push({ q: `${name} 위치가 어디인가요?`, a: `${name}은(는) ${loc}에 있습니다.` });
  if (redevStage) out.push({ q: `${name} 현재 사업 단계는 어디인가요?`, a: `${redevStage} 단계입니다.` });
  else if (stage) out.push({ q: `${name} 현재 단계는 어디인가요?`, a: `${stage} 단계입니다.` });
  if (s.total_units && s.total_units > 0) {
    out.push({ q: `${name} 총 세대수는 몇 세대인가요?`, a: `총 ${s.total_units.toLocaleString()}세대입니다.` });
  }
  if (s.builder) out.push({ q: `${name} 시공사는 어디인가요?`, a: `시공사는 ${s.builder}입니다.` });
  if (s.developer) out.push({ q: `${name} 시행사는 어디인가요?`, a: `시행사는 ${s.developer}입니다.` });
  if (s.price_min || s.price_max) {
    const a = s.price_min && s.price_max && s.price_min !== s.price_max
      ? `${money(s.price_min)}부터 ${money(s.price_max)}까지로 공고되었습니다.`
      : `${money((s.price_min || s.price_max) as number)}으로 공고되었습니다.`;
    out.push({ q: `${name} 분양가는 얼마인가요?`, a });
  }
  if (s.move_in_date) out.push({ q: `${name} 입주는 언제인가요?`, a: `입주 예정일은 ${s.move_in_date}입니다.` });
  if (s.address && s.address.length > 5) {
    out.push({ q: `${name} 소재지는 어디인가요?`, a: `소재지는 ${s.address}입니다.` });
  }

  return out.length >= 3 ? out : [];
}

export const GET = withCronAuth(async (_req: NextRequest) => {
  const result = await withCronLogging('apt-content-fill', async () => {
    const sb = getSupabaseAdmin();

    // 배치 50건. content_score 가 «낮은 것부터» — 광고 랜딩이 그쪽에 몰려 있다.
    const { data: sites } = await (sb as any).from('apt_sites')
      .select('id, name, region, sigungu, dong, site_type, lifecycle_stage, total_units, builder, developer, address, price_min, price_max, move_in_date, source_ids, description, faq_items')
      .eq('is_active', true)
      .lt('content_score', 40)
      .order('content_score', { ascending: true })
      .limit(50);

    const rows = (sites || []) as Site[];
    let descFilled = 0;
    let faqFilled = 0;
    let noData = 0;

    for (const s of rows) {
      const patch: Record<string, unknown> = {};

      const hasDesc = !!s.description && s.description.length >= 100;
      if (!hasDesc) {
        const d = buildDescription(s);
        if (d) { patch.description = d; descFilled++; }
      }

      const cur = Array.isArray(s.faq_items) ? s.faq_items : [];
      if (cur.length < 3) {
        const f = buildFaq(s);
        if (f.length >= 3) { patch.faq_items = f; faqFilled++; }
      }

      if (Object.keys(patch).length === 0) { noData++; continue; }
      patch.updated_at = new Date().toISOString();
      const { error } = await (sb as any).from('apt_sites').update(patch).eq('id', s.id);
      if (error) console.error('[apt-content-fill] update fail', error.message?.slice(0, 200));
    }

    console.info(`[apt-content-fill] scanned=${rows.length} desc=${descFilled} faq=${faqFilled} noData=${noData}`);

    return {
      processed: rows.length,
      created: 0,
      updated: descFilled + faqFilled,
      failed: 0,
      // ⚠️ noData 가 크면 «필드가 없어서 못 채우는» 현장이다. 그건 수집 문제이지
      //    이 크론이 고칠 수 있는 것이 아니다. 지어내지 않는다.
      metadata: { scanned: rows.length, descFilled, faqFilled, noData },
    };
  });

  if (!result.success) return NextResponse.json({ ok: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
});
