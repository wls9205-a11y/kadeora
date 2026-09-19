/**
 * issue 글감의 «입력 문맥» 과 수치 게이트 허용 목록 — issue-draft(생성·편집 회차) · issue-retry-stale 공용.
 *
 * ABG X-2·X-3(2026-09-15): 이 함수들은 issue-draft 라우트 안에 있었다. 라우트 파일은 핸들러 외 export 를 못 하므로
 * 다른 생산 경로(retry-stale)가 «같은 검증기» 를 쓰려면 여기로 옮겨야 했다. 동작은 옮기기 전과 같다.
 * ⛔ 게이트 우회 경로 금지 — 글을 blog_posts 에 넣는 경로는 전부 verifyIssueDraft 를 거친다.
 */
import { dbw } from '@/lib/cron-db-log';
import { anthropicFetch, llmCategoryOfContent } from '@/lib/llm/gateway';
import { stripSyntheticPrice } from '@/lib/apt/synthetic-price';
import { buildAllow, verifyNumbers, yearsIn } from '@/lib/content/number-verify';
import { extractArticleText } from '@/lib/content/article-text';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

/* ═══════════ [P0-FACT] big_event_registry 팩트 컨텍스트 조회 ═══════════ */

export async function fetchBigEventContext(sb: any, issue: any): Promise<string> {
  if (issue?.source_type !== 'big_event_registry') return '';
  // big_event id는 raw_data.big_event_id 또는 detected_keywords/related_entities로 잡음
  const rawId = issue?.raw_data?.big_event_id;
  const slugHint = issue?.raw_data?.big_event_slug;
  try {
    let row: any = null;
    if (rawId) {
      const { data } = await (sb as any).from('big_event_registry').select('*').eq('id', rawId).maybeSingle();
      row = data;
    }
    if (!row && slugHint) {
      const { data } = await (sb as any).from('big_event_registry').select('*').eq('slug', slugHint).maybeSingle();
      row = data;
    }
    if (!row) return '';
    const constructors = Array.isArray(row.key_constructors) ? row.key_constructors.join(', ') : (row.key_constructors || '미정');
    const brand = row.new_brand_name
      ? `${row.new_brand_name} (${row.constructor_status || 'unconfirmed'})`
      : '미정 (수주 전)';
    const scale = row.scale_after ? `${row.scale_before ?? '?'} → ${row.scale_after}+세대` : `${row.scale_before ?? '?'}세대`;
    const sources = Array.isArray(row.fact_sources) && row.fact_sources.length > 0
      ? row.fact_sources.join(' · ')
      : '카더라 내부 노트';
    return [
      '',
      '[절대 팩트 고정 - 바꾸지 말 것]',
      `- 이름: ${row.name}${row.full_name ? ` (${row.full_name})` : ''}`,
      `- 지역: ${row.region_sido || ''} ${row.region_sigungu || ''} ${row.region_dong || ''}`.trim(),
      `- 준공: ${row.build_year_before ?? '미상'}년`,
      `- 세대: ${scale}`,
      `- 재건축 후 브랜드: ${brand}`,
      `- 시공사: ${constructors}`,
      `- 현 Stage: ${row.stage ?? '미정'} / 예상 완공: ${row.build_year_after_est ?? '미정'}`,
      `- 비고: ${row.notes || ''}`,
      `- 출처: ${sources}`,
      '⚠️ 위 정보는 그대로 인용하라. 다른 브랜드명/시공사/세대수로 바꾸지 말 것.',
      '⚠️ 확정되지 않은 정보(분양가, 완공일 등)는 "추정", "예상", "시나리오" 임을 명시할 것.',
      '',
    ].join('\n');
  } catch (err: any) {
    console.error('[issue-draft] fetchBigEventContext failed:', err.message);
    return '';
  }
}

/**
 * LB-5 — 현장 컨텍스트. 글이 «어느 현장의 것인지» 를 프롬프트가 알아야
 * 예정명으로 제목을 세우고 현장 상세로 내부링크를 걸 수 있다.
 * ⚠️ 없으면 빈 문자열이다 — 주인 없는 글도 계속 만들어진다(기존 동작 불변).
 */
/** 세대수 conflicting 미해소 여부 — 마지막 units_conflict 가 마지막 units_conflict_closed 보다 뒤면 열림. 조회 실패는 «열림»(싣지 않는 쪽이 안전). */
export async function unitsConflictOpen(sb: any, siteId: string): Promise<boolean> {
  try {
    const { data, error } = await (sb as any).from('apt_site_events').select('event_type, created_at')
      .eq('site_id', siteId).in('event_type', ['units_conflict', 'units_conflict_closed'])
      .order('created_at', { ascending: false }).limit(1);
    if (error) return true;
    return (data ?? [])[0]?.event_type === 'units_conflict';
  } catch {
    return true;
  }
}

export async function buildSiteContext(sb: any, siteId: string | null | undefined): Promise<string> {
  if (!siteId) return '';
  try {
    const { data } = await (sb as any).from('apt_sites')
      .select('slug, name, display_name, sigungu, region, builder, total_units, complex_units, expected_sale_period, expected_sale_period_asof, price_min, price_max, price_source, site_type, source_ids')
      .eq('id', siteId).maybeSingle();
    if (!data) return '';
    // AB-2 · Q-1 — 합성 분양가(지역 채움값)는 싣지 않는다. 비우면 아래 줄이 「미공개」로 안내한다.
    const priced = stripSyntheticPrice(data);
    const isRedev = data.site_type === 'redevelopment' || !!data.source_ids?.redev_id;
    // BN-2 §1-3 — 세대수 conflicting(apt_site_events units_conflict) 이 미해소면 세대수를 싣지 않는다.
    //   해소 = 그 뒤의 units_conflict_closed 이벤트(merge_review_queue → merge_review_closed 관례).
    const unitsOpen = await unitsConflictOpen(sb, siteId);
    const units = unitsOpen ? null : (data.complex_units || data.total_units);
    const disp = (data.display_name || '').trim();
    // display 규격이 「{예정명} — {구역명}」이라 제목에는 앞쪽(예정명)만 쓴다.
    const preferred = (disp.split(' — ')[0] || disp || data.name || '').trim();
    const lines = [
      `- 현장 상세 링크(반드시 1회 이상 사용): [${preferred}](/apt/${data.slug})`,
      `- 표기할 이름: 「${preferred}」 ${preferred !== data.name ? `(구역명: ${data.name})` : ''}`,
      data.sigungu ? `- 지역: ${[data.region, data.sigungu].filter(Boolean).join(' ')}` : '',
      data.builder ? `- 시공사: ${data.builder}` : '- 시공사: 미정(단정하지 말 것)',
      // ABG 증분 2 §4 — 청약 경유 현장의 total_units 는 공고 «공급» 세대수다(sync 덮어쓰기). 총세대로 쓰게 두면 그랑라크 1,153 사고가 된다.
      unitsOpen
        ? '- 세대수: 자료 간 불일치로 확인 중 — 세대수 숫자를 쓰지 않는다(「규모는 확정 발표 후 안내」 문형)'
        : data.complex_units
        ? `- 단지 전체 세대수: ${data.complex_units}세대`
        : units && (data.source_ids?.house_manage_no || data.source_ids?.subscription_id)
          ? `- 공급 세대수(청약 공고 기준): ${units}세대 — 단지 전체 세대수는 미확인. 「총 ${units}세대」라고 쓰지 않는다`
          : units ? `- 세대수: ${units}세대` : '- 세대수: 미정(단정하지 말 것)',
      data.expected_sale_period
        ? `- 예상 분양 시기: ${data.expected_sale_period}${data.expected_sale_period_asof ? ` (${String(data.expected_sale_period_asof).slice(0, 10)} 기준 보도 — 본문·FAQ 에 기준일을 함께 쓴다)` : ''}`
        : '',
      priced.price_min && priced.price_max
        ? `- 분양가: ${priced.price_min.toLocaleString()}만~${priced.price_max.toLocaleString()}만원`
        : '- 분양가: 미공개 — 금액을 추정하거나 단정하지 말 것. 「분양가 미공개·모집공고 후 확정」 문형으로만 쓴다',
      // ABG 증분 4 §4 — 비율 자리를 비워 두면 모델이 관례(「계약금 10%」)로 채운다. 비율 없는 절차 문장을 조립해 준다.
      '- 계약금·중도금·잔금: 비율과 납부 일정은 현장별 입주자모집공고에서 확정됩니다(이 문장 그대로 쓰고 비율·금액 숫자를 붙이지 않는다)',
      isRedev
        ? '- 사업 성격: 정비사업(재개발·재건축) — 「구역」 표현 가능'
        : '- 사업 성격: 일반 분양 현장 — ⛔ 「구역」이라 부르지 않는다(정비구역이 아니다). 「현장」·「단지」로 쓴다',
    ].filter(Boolean);

    // EX-A ① — 실데이터 블록. 글이 쓸 수 있는 «숫자» 는 이 블록과 원문 요약에 있는 것뿐이다(수치 출처율 게이트가 대조).
    //   ⚠️ 없는 줄은 만들지 않는다(AB-1 원칙). 표가 될 행이 없으면 표도 없다.
    if (data.region && data.sigungu) {
      const since = new Date(Date.now() - 183 * 86_400_000).toISOString().slice(0, 10);
      const { data: tx } = await (sb as any).from('apt_transactions')
        .select('deal_amount, deal_date')
        .eq('region_nm', data.region).ilike('sigungu', `%${data.sigungu}%`)
        .gte('deal_date', since).gt('deal_amount', 0)
        .order('deal_date', { ascending: false }).limit(1000);
      const rows = ((tx ?? []) as Array<{ deal_amount: number; deal_date: string }>);
      if (rows.length >= 5) {
        const amts = rows.map((r) => r.deal_amount).sort((x, y) => x - y);
        const median = amts[Math.floor(amts.length / 2)];
        const months = rows.map((r) => String(r.deal_date).slice(0, 7)).sort();
        const fmt = (v: number) => (v >= 10000 ? `${Math.floor(v / 10000)}억${v % 10000 ? ` ${(v % 10000).toLocaleString()}만원` : '원'}` : `${v.toLocaleString()}만원`);
        lines.push(`- 같은 시군구 아파트 실거래(${months[0]}~${months[months.length - 1]}, ${rows.length}건${rows.length === 1000 ? '+' : ''}): 중위 ${fmt(median)} · 최저 ${fmt(amts[0])} · 최고 ${fmt(amts[amts.length - 1])} — 단지를 특정하지 않은 시군구 전체 집계. 인용할 때 기간은 이 괄호의 연월로만 쓰고(「최근 N년」 금지), 최저·최고에 지역·단지 유형 해석을 덧붙이지 않는다`);
      }
    }
    const subId = Number(data.source_ids?.subscription_id);
    if (subId) {
      const { data: sub } = await (sb as any).from('apt_subscriptions')
        .select('rcept_bgnde, rcept_endde, przwner_presnatn_de, mvn_prearnge_ym')
        .eq('id', subId).maybeSingle();
      if (sub?.rcept_bgnde) lines.push(`- 청약 접수: ${sub.rcept_bgnde}${sub.rcept_endde ? ` ~ ${sub.rcept_endde}` : ''} (청약홈 모집공고)`);
      if (sub?.przwner_presnatn_de) lines.push(`- 당첨자 발표: ${sub.przwner_presnatn_de} (청약홈 모집공고)`);
      if (sub?.mvn_prearnge_ym) lines.push(`- 입주 예정: ${String(sub.mvn_prearnge_ym).slice(0, 4)}-${String(sub.mvn_prearnge_ym).slice(4, 6)} (청약홈 모집공고)`);
    }
    return lines.join('\n');
  } catch {
    return '';
  }
}

/**
 * EX-A2 ③ — 출처 기사 본문. 저장된 것이 있으면 그것을(재시도·재생성이 같은 원문을 보게), 없으면 한 번 받아 저장한다.
 * ⚠️ 실패는 조용히 빈 문자열 — 원문이 없다고 글감을 버리지 않는다(허용 목록이 좁아질 뿐이다).
 */
export async function loadSourceText(sb: any, issue: any): Promise<string> {
  const saved = issue.raw_data?.source_text;
  if (typeof saved === 'string' && saved.length > 0) return saved;
  const url = (issue.source_urls || []).find((u: string) => /^https?:\/\//.test(u));
  if (!url) return '';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KadeoraBot/1.0; +https://kadeora.app)' }, signal: AbortSignal.timeout(8000), redirect: 'follow' });
    if (!res.ok) return '';
    const text = extractArticleText(await res.text());
    if (text.length < 80) return '';
    issue.raw_data = { ...(issue.raw_data ?? {}), source_text: text };
    dbw('issue-draft', 'issue_alerts.update@source_text', await (sb as any).from('issue_alerts').update({ raw_data: issue.raw_data }).eq('id', issue.id));
    return text;
  } catch {
    return '';
  }
}

/**
 * EX-A2 ① — 제도 상수 블록(전국 공통 · 출처 행). 확인일(verified_at) 180일 초과 행은 싣지 않고 경고를 남긴다.
 * ⚠️ 낡은 규제 수치는 무수치보다 위험하다 — 빼는 쪽이 기본이다.
 */
export async function loadPolicyConstants(sb: any): Promise<string> {
  try {
    const { data } = await (sb as any).from('policy_constants')
      .select('key, item, value_text, condition, source_title, source_date, verified_at, status')
      .eq('status', 'confirmed');
    const rows = (data ?? []) as any[];
    const cutoff = Date.now() - 180 * 86_400_000;
    const fresh = rows.filter((r) => Date.parse(r.verified_at) >= cutoff);
    const stale = rows.filter((r) => !(Date.parse(r.verified_at) >= cutoff));
    if (stale.length > 0) {
      // 크론이 10분마다 돈다 — 같은 경고는 24시간에 한 번만
      const { count: recent } = await (sb as any).from('admin_alerts').select('id', { count: 'exact', head: true })
        .eq('type', 'policy_constants_stale').gte('created_at', new Date(Date.now() - 86_400_000).toISOString());
      if (!recent) await (sb as any).from('admin_alerts').insert({
        type: 'policy_constants_stale', severity: 'warning',
        title: `제도 상수 ${stale.length}행 확인일 180일 초과 — 글 주입에서 제외됨`,
        message: stale.slice(0, 10).map((r) => `${r.key}(${String(r.verified_at).slice(0, 10)})`).join(', '),
      }).then(() => null, () => null);
    }
    return fresh.map((r) => `- ${r.item}: ${r.value_text}${r.condition ? ` (${r.condition})` : ''} — ${r.source_title}, ${String(r.verified_at).slice(0, 10)} 기준`).join('\n');
  } catch {
    return '';
  }
}

/**
 * EX-A2 ② — 감산 전용 편집 1회. 새 수치·표·비교를 더하지 못하게 지시하고, 결과는 호출부가 같은 게이트로 재판정한다.
 * ⚠️ 캐시·기록 축: caller 를 'issue-draft-edit' 로 갈라 원장에서 편집 호출만 셀 수 있게 한다.
 */
export async function editOutNumbers(content: string, tokens: string[], issue: any): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || tokens.length === 0) return null;
  try {
    const res = await anthropicFetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 12000,
        system: '당신은 편집자다. 주어진 마크다운 본문에서 지정한 수치가 들어간 문장만 삭제하거나, 그 수치를 뺀 서술로 바꾼다. 새 수치·새 표·새 비교·새 문단을 추가하지 않는다. 나머지 문장은 한 글자도 바꾸지 않는다. 결과 본문만 출력한다.',
        messages: [{ role: 'user', content: `삭제·비수치화할 수치 토큰: ${tokens.join(' | ')}\n\n본문:\n${content}` }],
      }),
    }, { caller: 'issue-draft-edit', category: llmCategoryOfContent(issue?.category), postId: null, metadata: { issue_id: issue?.id ?? null, tokens: tokens.length } });
    if (!res.ok) return null;
    const data = await res.json();
    const text = String(data.content?.[0]?.text || '').replace(/^```(?:markdown)?\s*|```\s*$/g, '').trim();
    // 감산이어야 한다 — 길이가 늘었으면 받지 않는다
    if (!text || text.length > content.length * 1.02) return null;
    return text;
  } catch {
    return null;
  }
}


export interface IssueContext { siteContext: string; sourceText: string; constantsBlock: string; bigEventContext: string }

/** 글감 1건의 입력 문맥 전부(생성 프롬프트와 게이트가 «같은 것» 을 본다). */
export async function loadIssueContext(sb: any, issue: any): Promise<IssueContext> {
  const bigEventContext = await fetchBigEventContext(sb, issue);
  let siteContext = await buildSiteContext(sb, issue.apt_site_id);
  // BN §5-3 — 단지명 병기. display 승격 금지(T-C 규율)라 현장 블록의 「표기할 이름」은 구역명이다.
  //   글감이 원장(site_name_candidates)에서 가져온 단지명을 실어 오면 병기 지시를 덧붙인다. 없으면 기존 동작.
  const cn = String(issue.raw_data?.complex_name ?? '').trim();
  if (cn && siteContext) {
    const zone = String(issue.raw_data?.zone_label ?? '').trim();
    siteContext += `\n- 단지명: 「${cn}」(시공사 제안 단지명 — 보도 확인${issue.raw_data?.complex_name_src ? `: ${issue.raw_data.complex_name_src}` : ''}). `
      + `제목과 본문 첫 언급은 「${cn}${zone ? ` — ${zone}` : ''}」로 병기하고 이후 「${cn}」로 부른다. `
      + '조합 총회 확정 여부는 단정하지 않는다(「제안 단지명」 문형)';
  }
  const sourceText = await loadSourceText(sb, issue);
  const constantsBlock = issue.category === 'apt' ? await loadPolicyConstants(sb) : '';
  return { siteContext, sourceText, constantsBlock, bigEventContext };
}

/** 허용 목록. ⛔ raw_data 의 blocked_draft·edit_pending(지난 초안)은 넣지 않는다 — 넣으면 환각 숫자가 스스로를 허가한다. */
export function buildIssueAllow(ctx: IssueContext, issue: any) {
  const nowYm = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7);
  // ABG 증분 4 §2 — 연도 결합 시기 주장은 esp·공고·상수에서만 허가(기사·실거래 기간의 연도로는 안 된다)
  const scheduleLines = ctx.siteContext.split('\n').filter((l) => /^- (예상 분양 시기|청약 접수|당첨자 발표|입주 예정):/.test(l));
  const year = yearsIn([...scheduleLines, ctx.constantsBlock]);
  const allow = buildAllow(
    [ctx.siteContext, ctx.constantsBlock, ctx.sourceText, ctx.bigEventContext, issue.title, issue.summary,
      JSON.stringify({ ...(issue.raw_data ?? {}), blocked_draft: undefined, edit_pending: undefined, source_text: undefined, number_shadow: undefined }),
      (issue.detected_keywords || []).join(' ')],
    { ym: [Number(nowYm.replace('-', ''))] },
  );
  return { ...allow, year };
}

/** 제목+본문 판정. 제목 위반은 편집으로 못 고친다(편집은 본문만) — 호출부가 곧바로 차단한다. */
export function verifyIssueDraft(title: string, content: string, allow: ReturnType<typeof buildAllow>) {
  const titleGate = verifyNumbers(title ?? '', allow);
  const bodyGate = verifyNumbers(content ?? '', allow);
  return {
    titleGate, bodyGate,
    ok: titleGate.ok && bodyGate.ok,
    checked: titleGate.checked + bodyGate.checked,
    unverified: [...titleGate.unverified.map((t) => `제목:${t}`), ...bodyGate.unverified],
  };
}
