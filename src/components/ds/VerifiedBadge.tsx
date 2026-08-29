// DS-2 표준 ⑥ — 검증 뱃지.
//
// 설계서 §DS-2: 「PV 트랙 D6 과 연동, 정확성을 «눈에 보이는 가치» 로」.
// 카더라가 파는 것이 정확성이라면, 그 정확성은 화면에서 «읽혀야» 값이 된다.
//
// ⚠️ 어휘는 지어내지 않는다 — DB 제약이 원본이다(tone.ts 주석 참조).
//    rumor · estimated · confirmed · verified · (null)
// ⛔ `conflicting` 은 확신도가 아니라 «검수 큐» 이름이다. 뱃지로 만들지 않는다.
// ⛔ null 을 확정처럼 칠하지 않는다 — ad-safety.isConfirmed(null) 이 false 인 것과 같은 이유다.

import { Badge } from '@/components/ds/Badge';
import { confidenceMeta } from '@/components/ds/tone';

export interface VerifiedBadgeProps {
  /** apt_sites.confidence · apt_permits.match_confidence 값을 «그대로» 넘긴다. */
  confidence: string | null | undefined;
  /**
   * 등급이 없을 때 아예 렌더하지 않을지.
   * 목록 행처럼 자리가 귀한 곳에서는 「미확인」 뱃지가 소음이 된다.
   * ⚠️ 상세·광고 랜딩에서는 «숨기지 말 것» — 모르는 것을 안 보이게 하면
   *    읽는 사람은 확정으로 읽는다(마스터 §2 표시·광고 규칙과 같은 결).
   */
  hideWhenUnknown?: boolean;
  size?: 'sm' | 'md';
}

export default function VerifiedBadge({ confidence, hideWhenUnknown = false, size = 'sm' }: VerifiedBadgeProps) {
  const known = !!confidence && ['rumor', 'estimated', 'confirmed', 'verified'].includes(confidence);
  if (!known && hideWhenUnknown) return null;

  const meta = confidenceMeta(confidence);
  return (
    <Badge tone={meta.tone} size={size} title={meta.hint}>
      {/* 색만으로 의미를 전달하지 않는다 — 라벨 텍스트가 항상 함께 간다. */}
      {meta.label}
    </Badge>
  );
}
