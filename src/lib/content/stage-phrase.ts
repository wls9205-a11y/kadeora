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
export const MEMBER_PHRASE = '재개발 조합원은 정비구역 안의 토지 또는 건축물 소유자(토지등소유자)이며, 구체적인 자격과 분양 신청 요건은 조합 정관과 관리처분계획에서 정해진다.';

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
  if (b && i < IDX.constructor_selected) lines.push(`시공자로는 ${b}이(가) 선정되었습니다(보도 기준). 조합설립인가를 받은 뒤 사업시행계획인가에 앞서 시공자를 뽑은 사례입니다.`);
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
