// 판독 모드 글감 — 스위치가 켜지기 전까지 «비공개 초안» 으로만 만든다.
//
// BP(EX-A ④) 를 BN(BN-1 판정 ②, 2026-09-18) 이 복제한다. 스위치 = app_config(namespace, 'hub_publish_enabled') 가 정확히 true.
//
// stampReason — 초안에 auto_unpublished_reason 을 생성 즉시 찍는다. DB 가드(trg_guard_hallucination_republish,
//   'hold:%')가 어떤 공개 경로도 막는다. issue-draft·issue-publish 스위치만으로는 blog-auto-publish
//   (auto_publish_eligible) 경로가 새기 때문이다 — 이미지 백필 큐 편입 → 티어 채점 → eligible 로 판독 전 공개.
//   ⚠️ BP 는 false 로 둔다. 해제 절차(세션 B 판독 후 사유 비움)가 이미 운영 중이라 바꾸지 않는다.
//   해제: 스위치를 true 로 + 판독 통과 초안의 사유를 비운다(가드는 사유만 본다).

export interface ReviewHold {
  namespace: 'bp' | 'bn';
  reason: string;
  stampReason: boolean;
}

const HOLDS: Array<ReviewHold & { match: (i: { source_type?: string | null; raw_data?: any }) => boolean }> = [
  { namespace: 'bp', reason: 'hold:bp_review', stampReason: false,
    match: (i) => i.source_type === 'bp70_hub' || String(i.raw_data?.doc ?? '').startsWith('BP70') },
  { namespace: 'bn', reason: 'hold:bn_review', stampReason: true,
    match: (i) => i.source_type === 'bn_hub' },
];

export function reviewHoldOf(issue: { source_type?: string | null; raw_data?: any }): ReviewHold | null {
  const h = HOLDS.find((x) => x.match(issue));
  return h ? { namespace: h.namespace, reason: h.reason, stampReason: h.stampReason } : null;
}

/** 판독 대기 초안의 사유인가 — 같은 현장 중복 판정에서 «살아 있는» 글로 센다. */
export function isReviewHoldReason(reason: string | null | undefined): boolean {
  return !!reason && HOLDS.some((h) => reason.startsWith(h.reason));
}

/** namespace 별 스위치. 행이 없거나 true 가 아니면 판독 모드(=닫힘). */
export async function reviewSwitches(sb: any): Promise<Record<ReviewHold['namespace'], boolean>> {
  const { data } = await sb.from('app_config').select('namespace, value')
    .in('namespace', HOLDS.map((h) => h.namespace)).eq('key', 'hub_publish_enabled');
  const out = { bp: false, bn: false };
  for (const r of (data ?? []) as Array<{ namespace: 'bp' | 'bn'; value: unknown }>) out[r.namespace] = r.value === true;
  return out;
}
