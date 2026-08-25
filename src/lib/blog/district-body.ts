// 구·군별 정비사업 글 본문 생성 (§4-1).
//
// ── 왜 route 가 아니라 여기인가 ──
// Next.js route 파일은 임의 export 를 거부한다(타입 검증에서 걸린다).
// 본문 생성이 route 안에 있으면 **길이를 테스트로 잠글 수 없다.**
// too_thin 14건이 배포 후에야 드러난 게 정확히 그 이유다 — 여기로 빼서
// 실제 digest 픽스처로 하한을 검증한다.

import { rotateAnchor } from '@/lib/blog/anchor';
import { lifecycleLabel } from '@/lib/apt/lifecycle-label';
import { josa } from '@/lib/ko/josa';

export interface DigestItem {
  slug: string;
  name: string;
  raw_name: string | null;
  stage: string | null;
  builder: string | null;
  supply_units: number | null;
  complex_units: number | null;
  dong: string | null;
  has_image: boolean;
  confidence: string | null;
  variants: string[] | null;
  /** 재개발 · 재건축 · 가로주택정비 · 정비사업 · 기타. ⚠️ 컬럼이 아니라 이름에서 판정한 값이다. */
  project_type?: string | null;
  /** blog_site_links 기준 인바운드. 대상 선정에 쓴다. */
  inbound?: number | null;
}

export interface Digest {
  region: string;
  sigungu: string;
  total: number;
  rich: number;
  publishable: boolean;
  items: DigestItem[];
  redev_count?: number;
  rebuild_count?: number;
  other_count?: number;
  split_rebuild?: boolean;
  dominant_type?: string | null;
}

export const isRebuildItem = (it: DigestItem) => (it.project_type ?? '').trim() === '재건축';

/**
 * 이름 끝의 사업유형 접미어를 뗀다.
 *
 * ⚠️ `소규모` 를 같이 떼야 한다. 원 이름이 `신서면아파트 소규모재건축` 이라
 *    `재건축` 만 떼면 `신서면아파트 소규모` 라는 꼬리가 제목에 남는다(실측 3개 구).
 * ⚠️ 이름 자체가 접미어뿐이면 원본을 돌려준다 — 빈 문자열을 만들지 않는다.
 */
export function stripTypeSuffix(name: string): string {
  const out = name.replace(/\s*(소규모)?\s*(재건축|재개발|가로주택정비)\s*$/, '').trim();
  return out.length > 0 ? out : name.trim();
}

/**
 * 제목 대표 구역 선정.
 *
 * ⚠️ 두 가지를 막는다 (둘 다 실측으로 나왔다).
 *  ① 브랜드명 단독 행 — `아크로 라로체` 가 「부산진구 재개발 총정리」 대표로 올라왔다.
 *     구역명이 아니라 분양 브랜드라 정비사업 목록의 대표로 부적절하다.
 *     → raw_name 에 사업유형이 들어간 것만 대표로 쓴다.
 *  ② 같은 구역이 두 번 — `범천1-1 재개발` 과 `부산 범천1-1구역 재개발` 이 나란히 올라왔다.
 *     DB 담당이 병합했지만, 정규화 후 DISTINCT 를 걸어 재발을 막는다.
 *
 * ⚠️ 후보가 하나도 없으면 필터를 풀고 원래 순서로 채운다. 제목은 반드시 만들어져야 한다.
 */
const TYPE_IN_NAME = /(재개발|재건축|정비)/;

function repKey(name: string, region: string): string {
  return name
    .replace(new RegExp(`^${region}\\s+`), '')
    .replace(/구역/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function pickRepresentatives(
  items: DigestItem[],
  region: string,
  count: number,
  strip = false,
): string[] {
  const take = (pool: DigestItem[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const it of pool) {
      const raw = (it.raw_name || it.name || '').trim();
      if (!raw) continue;
      const k = repKey(raw, region);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(strip ? stripTypeSuffix(raw) : raw);
      if (out.length >= count) break;
    }
    return out;
  };

  const named = take(items.filter((it) => TYPE_IN_NAME.test(it.raw_name || it.name || '')));
  return named.length > 0 ? named : take(items);
}

/**
 * 앵커 텍스트. **같은 글 안에서 같은 문구를 반복하지 않는다.**
 * ⚠️ 3자 하한만으로는 부족하다. variants 에 `부산`·`푸르지오` 같은 광범위 토큰이 섞여 있어
 *    그대로 쓰면 브랜드·지역 일반 검색어에 엉뚱한 현장이 매달린다 (lib/blog/anchor.ts).
 */
function anchor(item: DigestItem, i: number): string {
  // ⚠️ variants 에 **시공사명으로 만든 변형**이 섞여 있다(실측 `동구 대우건설`).
  //    배제 규칙은 앵커 가드 안에 있다 — builder 를 넘기기만 하면 된다.
  return rotateAnchor(item.name, item.variants, i, item.builder);
}

// ⚠️ 여기서 시공사명을 **정규화하지 않는다.** DB 에 `trg_normalize_builder`
//    BEFORE INSERT/UPDATE 트리거가 걸려 있다((주)·㈜·주식회사 제거 · 포스코건설→포스코이앤씨
//    · 지에스건설→GS건설 · 디엘이앤씨→DL이앤씨 · 숫자만이면 NULL).
//    실측 2026-08-25: 활성 3,027건 중 접두어 0 · 옛 사명 0 · 숫자만 0.
//    한때 `(주)DL이앤씨` 와 `DL이앤씨` 가 목록에 둘 다 나와 여기서 접두어를 떼고 있었는데,
//    이제 원본이 깨끗하다. 같은 규칙을 두 곳에 두면 한쪽만 고치게 된다.

/**
 * 세대수 서술.
 * ⚠️ confidence 가 confirmed 가 아니면 단정하지 않는다.
 *    complex_units(단지 전체)를 우선 쓰고, 없으면 supply_units 를 **이름 붙여** 쓴다 —
 *    라벨 없는 '176세대' 는 총세대수로 오독된다.
 */
function unitsPhrase(item: DigestItem): string | null {
  const confirmed = item.confidence === 'confirmed';
  const soft = confirmed ? '' : ' 예정';
  if (item.complex_units && item.complex_units > 0) {
    return `총 ${item.complex_units.toLocaleString('ko-KR')}세대${soft}`;
  }
  if (item.supply_units && item.supply_units > 0) {
    return `일반분양 ${item.supply_units.toLocaleString('ko-KR')}세대${soft}`;
  }
  return null;
}

/** 시공사 서술. 확정이 아니면 「알려짐」을 붙인다. */
function builderPhrase(item: DigestItem): string | null {
  if (!item.builder || !item.builder.trim()) return null;
  return item.confidence === 'confirmed' ? item.builder : `${item.builder}(알려짐)`;
}

/**
 * 단계 한 줄 설명.
 * ⚠️ 그 구에 **실제로 있는 단계만** 낸다. 전 구에 같은 문단을 깔면 15편이 서로
 *    중복 콘텐츠가 된다. 구마다 단계 구성이 달라 이 방식이면 자연히 갈린다.
 */
const STAGE_NOTE: Record<string, string> = {
  construction: '철거·착공에 들어간 구역입니다. 일반분양 시기가 가장 가깝습니다.',
  mgmt_approved: '관리처분인가를 받은 구역입니다. 조합원 분담금과 일반분양 물량이 확정되는 단계입니다.',
  plan_approved: '사업시행인가 단계입니다. 세대수·용적률 등 사업 규모가 정해집니다.',
  constructor_selected: '시공사를 선정한 구역입니다. 브랜드와 공사비가 정해지는 시점입니다.',
  union_established: '조합설립인가를 받은 구역입니다. 사업시행인가까지는 통상 수년이 걸립니다.',
  site_planning: '정비구역 지정·계획 단계입니다. 일정 변동 폭이 가장 큽니다.',
  pre_announcement: '모집공고를 앞둔 구역입니다.',
};

const EARLY_STAGES = new Set(['site_planning', 'pre_announcement']);
const LATE_STAGES = new Set(['mgmt_approved', 'construction']);

/**
 * 사업유형 절차 문단.
 *
 * ── ⚠️ 왜 대부분이 계산값인가 ──
 * 절차 설명을 통문장으로 깔면 15개 구가 **글자 그대로 같은 문단**을 갖는다.
 * 이 크론이 막으려는 구간 중복(제목 기준 0.667)을 본문에서 되살리는 짓이다.
 * 그래서 고정 문장은 절차 순서 한 줄로 줄이고, 나머지는 그 구의 실측값으로 채운다 —
 * 단계 분포·가장 앞선 구역·세대수·동 분포·소규모 비중은 구마다 다르다.
 *
 * ⚠️ 준공연도로 연한을 계산하지 않는다. apt_sites.built_year 가 재건축 현장 전체에서
 *    **0건**이다(실측). 연한 숫자를 구별로 쓰면 지어내는 것이 된다.
 */
function processSection(kind: '재건축' | '재개발', d: Digest, items: DigestItem[]): string[] {
  if (items.length < 3) return [];
  const lines: string[] = [];
  const n = items.length;

  lines.push('');
  lines.push(`## ${kind} 절차와 ${d.sigungu}의 현재 위치`);
  lines.push('');

  if (kind === '재건축') {
    lines.push(
      '재건축은 준공 후 연한이 지난 단지가 안전진단을 받는 데서 시작합니다. ' +
        '연한은 시·도 조례로 정하며 대부분 30년입니다. ' +
        '이후 정비구역 지정 → 조합설립인가 → 사업시행인가 → 관리처분인가 → 이주·철거 → 착공·분양 순으로 진행됩니다.',
    );
  } else {
    lines.push(
      '재개발은 노후·불량 건축물이 밀집한 구역을 기반시설과 함께 정비하는 사업입니다. ' +
        '단지 하나를 다시 짓는 재건축과 달리 도로·공원 등을 같이 손보는 점이 다릅니다. ' +
        '정비구역 지정 → 조합설립인가 → 사업시행인가 → 관리처분인가 → 이주·철거 → 착공·분양 순으로 진행됩니다.',
    );
  }

  // ── 여기부터 전부 그 구의 실측값 ──
  const byStage = new Map<string, number>();
  for (const it of items) {
    const label = lifecycleLabel(it.stage) ?? '진행 중';
    byStage.set(label, (byStage.get(label) ?? 0) + 1);
  }
  const dist = [...byStage.entries()].map(([k, v]) => `${k} ${v}곳`).join(' · ');
  const head = items[0]; // items 는 단계순 정렬이라 첫 항목이 가장 앞선 구역이다
  lines.push('');
  lines.push(
    `${d.sigungu}의 ${kind} ${n}곳은 ${dist}으로 나뉩니다. ` +
      (head
        ? `가장 앞선 곳은 ${lifecycleLabel(head.stage) ?? '진행 중'} 단계의 ${head.raw_name || head.name}입니다.`
        : ''),
  );

  // ⚠️ 곳수만 세지 말고 **이름을 낸다.** 이 글의 목적은 현장 페이지로 링크를 흘려보내는 것이고,
  //    읽는 사람이 가장 먼저 찾는 건 「분양이 언제 가까운 곳인가」다.
  const names = (its: DigestItem[], k: number) =>
    its.slice(0, k).map((it) => it.raw_name || it.name).join(' · ');
  const late = items.filter((it) => it.stage && LATE_STAGES.has(it.stage));
  const early = items.filter((it) => it.stage && EARLY_STAGES.has(it.stage));
  const gate: string[] = [];
  if (late.length > 0) {
    gate.push(
      `일반분양이 가까운 곳은 관리처분인가를 넘긴 ${late.length}곳(${names(late, 3)}` +
        `${late.length > 3 ? ' 등' : ''})으로, 분담금과 일반분양 물량이 정해진 상태입니다`,
    );
  }
  if (early.length > 0) {
    gate.push(
      `반대로 조합설립 전인 ${early.length}곳(${names(early, 3)}${early.length > 3 ? ' 등' : ''})은 ` +
        `일정 변동 폭이 가장 큽니다`,
    );
  }
  if (gate.length > 0) lines.push(`${gate.join('. ')}.`);

  const units = items.map((it) => it.complex_units ?? it.supply_units ?? 0).filter((x) => x > 0);
  if (units.length > 0) {
    const sum = units.reduce((a, b) => a + b, 0);
    lines.push(
      `세대수가 확인된 ${units.length}곳을 합치면 약 ${sum.toLocaleString('ko-KR')}세대이고, ` +
        `나머지 ${n - units.length}곳은 사업 규모가 아직 확정되지 않았습니다.`,
    );
  }

  // 규모 순위. 읽는 사람이 실제로 찾는 정보이고, 구마다 값도 순서도 다르다.
  // 구역이 많은 구는 상위 5곳까지 — 순위가 길어질수록 정보량도 는다.
  const sized = items
    .map((it) => ({ it, u: it.complex_units ?? it.supply_units ?? 0 }))
    .filter((x) => x.u > 0)
    .sort((a, b) => b.u - a.u)
    .slice(0, n >= 8 ? 5 : 3);
  if (sized.length >= 2) {
    lines.push(
      `규모가 큰 순으로는 ${sized
        .map((x) => `${x.it.raw_name || x.it.name} ${x.u.toLocaleString('ko-KR')}세대`)
        .join(' · ')} 입니다.`,
    );
  }

  // 시공사 구성. ⚠️ builder 가 빈 문자열('')로 오는 경우가 있다(실측). trim 으로 거른다.
  // ⚠️ 문장을 항상 `등이` 로 끝낸다. 이름을 그대로 이어붙이면 받침에 따라 조사가 갈려
  //    `한국토지주택공사이 참여하고` 같은 문장이 나간다(실측).
  const builders = [
    ...new Set(
      items
        .map((it) => (it.builder ?? '').trim())
        .filter((b) => b.length > 0)
        // 한 칸에 두 곳이 들어간 경우만 나눈다(`SK, 현대건설`). 표기 정리는 DB 몫이다.
        .flatMap((b) => b.split(/[,&]/).map((s) => s.trim()))
        .filter((b) => b.length > 1),
    ),
  ];
  if (builders.length >= 2) {
    const shown = builders.slice(0, 5);
    const more = builders.length > shown.length;
    // ⚠️ 이름 뒤 조사는 받침으로 갈린다 — 그대로 이어붙이면 `한국토지주택공사이 참여하고` 가 나간다(실측).
    const tail = more ? '등이' : josa(shown[shown.length - 1], '이/가');
    lines.push(`시공사로는 ${shown.join(' · ')}${more ? ' ' : ''}${tail} 참여하고 있습니다.`);
  }

  // ⚠️ **커버리지가 절반 미만이면 이 문장을 쓰지 않는다.**
  //    14곳 중 1곳만 dong 값이 있는데 「행정동으로는 초량동 1곳에 몰려 있습니다」라고 쓰면
  //    나머지 13곳이 다른 동인 것처럼 읽힌다 — 사실과 다른 인상이다(실측).
  //    부분 데이터로 전체를 서술하는 문장은 전부 이 함정을 갖는다.
  const byDong = new Map<string, number>();
  for (const it of items) {
    const dg = (it.dong ?? '').trim();
    if (dg) byDong.set(dg, (byDong.get(dg) ?? 0) + 1);
  }
  const dongKnown = [...byDong.values()].reduce((a, b) => a + b, 0);
  if (dongKnown >= 3 && dongKnown * 2 >= n) {
    const top = [...byDong.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    lines.push(`행정동으로는 ${top.map(([k, v]) => `${k} ${v}곳`).join(' · ')}입니다.`);
  }

  // 소규모·가로주택은 절차가 실제로 다르다. 비중이 구마다 달라 문장도 갈린다.
  if (kind === '재건축') {
    const small = items.filter((it) => /소규모/.test(it.raw_name || it.name || '')).length;
    if (small > 0) {
      lines.push(
        `이 가운데 ${small}곳은 소규모재건축입니다. 면적·세대수 요건을 갖추면 정비구역 지정 없이 ` +
          `조합설립부터 시작할 수 있어 일반 재건축보다 절차가 짧습니다.`,
      );
    }
  } else {
    const street = items.filter((it) => (it.project_type ?? '') === '가로주택정비').length;
    if (street > 0) {
      lines.push(
        `이 가운데 ${street}곳은 가로주택정비사업입니다. 기존 도로를 유지한 채 소규모로 진행해 ` +
          `정비구역 지정 절차가 없고, 그만큼 사업 기간이 짧은 편입니다.`,
      );
    }
  }

  return lines;
}

/**
 * 재건축 분리편을 뗄지 정한다.
 *
 * ── ⚠️ 분리는 **양쪽이 다 글이 될 때만** 한다 ──
 * 첫 실행 실측에서 too_thin 14건이 났고, 원인은 분리 자체였다.
 *   부산진구/rebuild 8곳 1,277자 · 동래구/rebuild 11곳 1,470자
 *   연제구/rebuild 10곳 1,284자 · 해운대구/main 6곳 1,051자
 * 특히 해운대구는 25곳 중 19곳이 재건축이라 본편에 6곳만 남는다.
 * 나누기 전 통합편은 문턱을 넘던 글이므로, **한쪽이라도 얇으면 나누지 않는 게 맞다.**
 *
 * ⚠️ 재건축 곳수만 보는 하한으로는 이 경우를 못 거른다 — 해운대구는 19곳이라
 *    어떤 하한을 걸어도 통과하는데 정작 얇아지는 건 본편이다. 그래서 두 겹이다:
 *      ① 싼 선판정 — 재건축이 MIN_SPLIT_ITEMS 미만이면 애초에 나누지 않는다
 *      ② 실제 판정 — 양쪽 본문을 만들어 보고 하나라도 얇으면 통합편으로 되돌린다
 *
 * ⚠️ ②에서 재는 본문은 실제로 발행할 것과 **같은 함수·같은 인자**여야 한다.
 *    다른 걸 재면 게이트가 거짓말을 한다.
 */
export const MIN_SPLIT_ITEMS = 8;

export interface SplitDecision {
  split: boolean;
  mainItems: DigestItem[];
  rebuildItems: DigestItem[];
  /** 분리를 포기했을 때만 채워진다. 카운터가 아니라 사람이 읽을 사유다. */
  revertedMessage?: string;
}

export function decideSplit(
  d: Digest,
  all: DigestItem[],
  ym: string,
  movedAll: Set<string>,
  minContentLength: number,
): SplitDecision {
  const rebuildAll = all.filter(isRebuildItem);
  const mainAll = all.filter((it) => !isRebuildItem(it));

  if (d.split_rebuild !== true || rebuildAll.length < MIN_SPLIT_ITEMS) {
    return { split: false, mainItems: all, rebuildItems: [] };
  }

  const measure = (its: DigestItem[]) =>
    buildBody(
      { ...d, total: its.length },
      its,
      new Set<string>(its.map((i) => i.slug).filter((s) => movedAll.has(s))),
      ym,
    ).length;
  const mainLen = measure(mainAll);
  const reLen = measure(rebuildAll);

  if (mainLen < minContentLength || reLen < minContentLength) {
    return {
      split: false,
      mainItems: all,
      rebuildItems: [],
      revertedMessage:
        `${d.sigungu}: 분리 취소 — main ${mainAll.length}곳 ${mainLen}자 · ` +
        `rebuild ${rebuildAll.length}곳 ${reLen}자 (하한 ${minContentLength})`,
    };
  }
  return { split: true, mainItems: mainAll, rebuildItems: rebuildAll };
}

export function buildBody(d: Digest, items: DigestItem[], movedSlugs: Set<string>, ym: string): string {
  const lines: string[] = [];

  lines.push(
    `${d.region} ${d.sigungu}에서 진행 중인 재개발·재건축 구역을 ${ym} 기준으로 정리했습니다. ` +
      `모집공고 전 단계까지 포함해 ${items.length}곳입니다.`,
  );

  /* ── 구 단위 요약 — 전부 계산된 사실이다. 구마다 값이 달라 중복이 되지 않는다 ── */
  const byStage = new Map<string, number>();
  for (const it of items) {
    const label = lifecycleLabel(it.stage) ?? '진행 중';
    byStage.set(label, (byStage.get(label) ?? 0) + 1);
  }
  const dist = [...byStage.entries()].map(([k, v]) => `${k} ${v}곳`).join(' · ');
  if (dist) {
    lines.push('');
    lines.push(`단계별로는 ${dist} 입니다.`);
  }

  const unitList = items.map((it) => it.complex_units ?? it.supply_units ?? 0).filter((n) => n > 0);
  if (unitList.length >= 2) {
    const sum = unitList.reduce((a, b) => a + b, 0);
    const peak = Math.max(...unitList);
    const max = items.filter((it) => (it.complex_units ?? it.supply_units ?? 0) === peak)[0];
    lines.push(
      `세대수가 확인된 ${unitList.length}곳을 합치면 약 ${sum.toLocaleString('ko-KR')}세대 규모이고, ` +
        `가장 큰 곳은 ${max?.raw_name || max?.name}입니다.`,
    );
  }

  const withBuilder = items.filter((it) => it.builder && it.builder.trim()).length;
  if (withBuilder > 0) {
    lines.push(
      `시공사가 정해진 구역은 ${withBuilder}곳입니다. ` +
        `나머지는 아직 선정 전이거나 공개되지 않았습니다.`,
    );
  }

  /* ── 사업유형 절차 문단 ──
   * 그 글에 실제로 들어있는 유형만 낸다. 분리편이면 재건축 하나, 통합편이면 둘 다 나온다. */
  const rebuilds = items.filter(isRebuildItem);
  const redevs = items.filter((it) => !isRebuildItem(it));
  lines.push(...processSection('재건축', d, rebuilds));
  lines.push(...processSection('재개발', d, redevs));

  if (movedSlugs.size > 0) {
    lines.push('');
    lines.push(`## 이번 달 단계가 바뀐 구역`);
    lines.push('');
    const moved = items.filter((it) => movedSlugs.has(it.slug));
    moved.forEach((it, i) => {
      const stage = lifecycleLabel(it.stage) ?? '진행 중';
      lines.push(`- [${anchor(it, i)}](/apt/${it.slug}) — ${stage}`);
    });
  }

  // 단계별로 묶는다. items 는 이미 단계순이라 순서를 유지하며 헤딩만 끼운다.
  lines.push('');
  lines.push(`## 구역별 진행 현황`);

  let lastStage: string | null = null;
  items.forEach((it, i) => {
    const stage = lifecycleLabel(it.stage) ?? '진행 중';
    if (stage !== lastStage) {
      lines.push('');
      lines.push(`### ${stage}`);
      lines.push('');
      const note = it.stage ? STAGE_NOTE[it.stage] : null;
      if (note) { lines.push(note); lines.push(''); }
      lastStage = stage;
    }
    const bits = [builderPhrase(it), unitsPhrase(it), it.dong].filter(Boolean);
    lines.push(`- [${anchor(it, i)}](/apt/${it.slug})${bits.length > 0 ? ` — ${bits.join(' · ')}` : ''}`);
  });

  if (d.total > items.length) {
    lines.push('');
    lines.push(
      `그 밖에 ${d.total - items.length}곳이 더 있습니다. ` +
        `[${d.region} 정비사업 전체 보기](/apt/redev/${encodeURIComponent(d.region)})`,
    );
  }

  lines.push('');
  lines.push(
    `단계와 세대수는 고시·공시 원문과 조합 공개 자료를 기준으로 하며, 확정되지 않은 항목은 「예정」·「알려짐」으로 표시했습니다. ` +
      `구역별 상세는 각 링크에서 확인하실 수 있습니다.`,
  );

  return lines.join('\n');
}
