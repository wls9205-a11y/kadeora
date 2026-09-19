// BN-B 4차 판독 ⑥' — 「사업 단계」 섹션을 확정 문형으로 코드가 채운다.
//
// 3회차 판독(112539·112540) 결함이 한 층으로 수렴했다: 「세입자도 조합원」 단정, 「시공사 선정 완료」와 「조합 미구성」 자기모순.
// 원인은 현장 블록에 lifecycle_stage 가 없어 모델이 단계를 추측한 것. 단계 서술은 생성에 맡기지 않는다.
// ⚠️ 숫자·연도를 넣지 않는다(수치 게이트·연도 규칙 밖으로 두기 위함). 시기는 「모집공고 후 확정」 문형만.

/** 정비사업 절차 순서. 표시명은 도시정비법 용어. */
const REDEV_STEPS = [
  { key: 'site_planning', name: '정비구역 지정·추진위원회 구성' },
  { key: 'union_established', name: '조합설립인가' },
  { key: 'constructor_selected', name: '시공자 선정' },
  { key: 'plan_approved', name: '사업시행계획인가' },
  { key: 'mgmt_approved', name: '관리처분계획인가' },
  { key: 'relocation', name: '이주·철거' },
  { key: 'construction', name: '착공' },
  { key: 'sale', name: '일반분양(입주자모집공고)' },
  { key: 'move_in', name: '준공·입주' },
] as const;

const IDX: Record<string, number> = Object.fromEntries(REDEV_STEPS.map((s, i) => [s.key, i]));

/** 조합원 자격 — 이 문형만 쓴다(세입자·거주자 조합원 단정 금지). */
export const MEMBER_PHRASE = '재개발 조합원은 정비구역 안의 토지 또는 건축물 소유자(토지등소유자)이며, 구체적인 자격과 분양 신청 요건은 조합 정관과 관리처분계획에서 정해집니다.';

/** 받침 여부로 이/가. 마지막 글자가 한글이 아니면 가. */
export function josaIGa(word: string): string {
  const ch = String(word ?? '').trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (Number.isNaN(code) || code < 0 || code > 11171) return '가';
  return code % 28 === 0 ? '가' : '이';
}

export interface StageInput { stage: string | null | undefined; builder?: string | null; isRedev: boolean }

/** 현재 단계 표시명(정비사업만). 모르면 null. */
export function stageName(stage: string | null | undefined): string | null {
  const i = stage ? IDX[stage] : undefined;
  return i === undefined ? null : REDEV_STEPS[i].name;
}

/**
 * 「사업 단계」 본문(마크다운). 정비사업이 아니거나 단계를 모르면 null — 그때는 섹션을 건드리지 않는다.
 * 시공사가 있으면 단계가 조합설립인가여도 «선정됐다(보도 기준)» 를 함께 쓴다 — 부산 등은 조합설립 뒤 시공자를 먼저 뽑는다.
 */
export function stageSection({ stage, builder, isRedev }: StageInput): string | null {
  if (!isRedev) return null;
  const i = stage ? IDX[stage] : undefined;
  if (i === undefined) return null;
  const cur = REDEV_STEPS[i];
  const b = String(builder ?? '').trim();
  const lines: string[] = [];
  lines.push(`현재 이 구역은 **${cur.name}** 단계입니다.`);
  if (b && i < IDX.constructor_selected) lines.push(`시공자로는 ${b}${josaIGa(b)} 선정되었습니다(보도 기준). 조합설립인가를 받은 뒤 사업시행계획인가에 앞서 시공자를 뽑은 사례입니다.`);
  else if (b && i >= IDX.constructor_selected) lines.push(`시공자는 ${b}입니다(보도 기준).`);
  // 다음 단계 — 시공자가 이미 있으면 시공자 선정 단계를 건너뛴다
  let next = i + 1;
  if (b && REDEV_STEPS[next]?.key === 'constructor_selected') next += 1;
  const rest = REDEV_STEPS.slice(next).map((s) => s.name);
  if (rest.length > 0) lines.push(`남은 절차는 ${rest.join(' → ')} 순서로 진행됩니다.`);
  lines.push('각 단계의 시기는 인가·총회 결과에 따라 정해지며, 분양 일정은 입주자모집공고 후 확정됩니다.');
  lines.push(MEMBER_PHRASE);
  return lines.join(' ');
}

/**
 * 본문의 「## 사업 단계」 섹션 본문을 확정 문형으로 교체한다. 섹션이 없으면 「## 현장 개요」 섹션 뒤에 넣는다.
 * 둘 다 없으면 원문 그대로.
 */
export function injectStageSection(content: string, section: string | null): string {
  if (!section) return content;
  const body = content ?? '';
  const head = /^##\s+[^\n]*사업\s*단계[^\n]*$/m.exec(body);
  const block = `\n\n${section}\n\n`;
  if (head) {
    const start = head.index + head[0].length;
    const nextH2 = body.slice(start).search(/\n##\s/);
    const end = nextH2 === -1 ? body.length : start + nextH2;
    return body.slice(0, start) + block + body.slice(end).replace(/^\n+/, '');
  }
  const ov = /^##\s+[^\n]*현장\s*개요[^\n]*$/m.exec(body);
  if (!ov) return body;
  const after = ov.index + ov[0].length;
  const nx = body.slice(after).search(/\n##\s/);
  const at = nx === -1 ? body.length : after + nx;
  return `${body.slice(0, at).replace(/\n+$/, '')}\n\n## 사업 단계${block}${body.slice(at).replace(/^\n+/, '')}`;
}

/**
 * BN-B4 ② — 「주변 거래 데이터」 섹션도 확정 문형으로 채운다.
 * 모델이 중위가에 「약·수준·~대」를 붙이면 RULES#149 추정 규칙이 막고 감산 편집이 숫자를 지워
 * 「중위 거래액은 상당 수준」 같은 공허 문장이 남았다(112554·112555). 블록 값을 수식어 없이 그대로 싣는다.
 * 블록에 실거래 줄이 없으면 수치 없이 «집계 부족» 한 문장.
 */
export function dataSection(siteContext: string): string {
  const region = /^- 지역: ([^\n]+)/m.exec(siteContext ?? '')?.[1]?.trim() ?? '';
  const m = /^- 같은 시군구 아파트 실거래\((\d{4})-(\d{2})~(\d{4})-(\d{2}), ([\d,]+)건(\+?)\): 중위 ([^—\n]+?)\s*—/m.exec(siteContext ?? '');
  if (!m) return `${region ? `${region} ` : ''}아파트 실거래 집계가 충분하지 않아 이 글에는 거래가 수치를 싣지 않습니다. 단지별 시세는 현장 상세 페이지에서 확인할 수 있습니다.`;
  const [, y1, m1, y2, m2, cnt, plus, median] = m;
  const count = `${Number(cnt.replace(/,/g, '')).toLocaleString('ko-KR')}건${plus ? ' 이상' : ''}`;
  return `${region ? `${region} ` : ''}아파트 실거래(${y1}-${m1}~${y2}-${m2}, ${count} 집계)의 중위 거래가는 ${median.trim()}입니다. `
    + '단지를 특정하지 않은 시군구 전체 집계이므로 개별 단지의 가격과는 다를 수 있습니다.';
}

/** 「## 주변 거래 …」 섹션 본문을 교체. 섹션이 없으면 「## 사업 단계」 뒤(없으면 현장 개요 뒤)에 넣는다. */
export function injectDataSection(content: string, section: string | null): string {
  if (!section) return content;
  const body = content ?? '';
  const head = /^##\s+[^\n]*주변\s*거래[^\n]*$/m.exec(body);
  const block = `\n\n${section}\n\n`;
  if (head) {
    const start = head.index + head[0].length;
    const nx = body.slice(start).search(/\n##\s/);
    const end = nx === -1 ? body.length : start + nx;
    return body.slice(0, start) + block + body.slice(end).replace(/^\n+/, '');
  }
  const anchor = /^##\s+[^\n]*사업\s*단계[^\n]*$/m.exec(body) ?? /^##\s+[^\n]*현장\s*개요[^\n]*$/m.exec(body);
  if (!anchor) return body;
  const after = anchor.index + anchor[0].length;
  const nx = body.slice(after).search(/\n##\s/);
  const at = nx === -1 ? body.length : after + nx;
  return `${body.slice(0, at).replace(/\n+$/, '')}\n\n## 주변 거래 데이터${block}${body.slice(at).replace(/^\n+/, '')}`;
}
