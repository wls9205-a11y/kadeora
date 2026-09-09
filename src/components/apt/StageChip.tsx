// DS2 §7① — lifecycle_stage 단계 칩. 단일 컴포넌트.
//
// ⛔ 색을 여기서 정하지 않는다. 톤 이름만 고르고 값은 tokens.css → tone.ts 로 간다.
//    그래야 scripts/contrast-audit.ts 가 두 스킨(기본·toss)에서 «기계로» 잰다.
// ⛔ 라벨도 여기서 정하지 않는다. lib/apt/lifecycle-label 이 한글 라벨 단일 원본이다.
//    설계서 §1 은 칩 라벨을 따로 줬지만, 그대로 쓰면 4개 정비 단계가 「공고 전」 하나로
//    뭉쳐져 관리처분인가·조합설립 같은 실무 분기가 화면에서 사라진다.
//    → 색은 묶고 글자는 남긴다.
//
// ⚠️ 이 칩은 «상태 표시» 라 Badge 다(누를 수 없다). 필터로 쓸 자리가 생기면 Chip 으로
//    바꾸되 44px 터치 규칙이 따라온다 — 두 개를 한 컴포넌트에 겸하게 만들지 말 것.

import { Badge } from '@/components/ds/Badge';
import { stageToneOf, isUnmappedStage } from '@/components/ds/tone';
import { lifecycleLabel } from '@/lib/apt/lifecycle-label';

/** 단계를 모를 때 보여 줄 말. 「없음」이 아니라 «아직 모른다» 다. */
const UNKNOWN_LABEL = '단계 미확인';

export interface StageChipProps {
  stage: string | null | undefined;
  size?: 'sm' | 'md';
}

export function StageChip({ stage, size = 'sm' }: StageChipProps) {
  const tone = stageToneOf(stage);
  const label = lifecycleLabel(stage) ?? UNKNOWN_LABEL;

  return (
    <span
      // ⚠️ 화면은 NULL 과 미매핑을 «같은 칩» 으로 낸다(사용자에게 둘 다 정보 부재다).
      //    그러나 DOM 에는 갈라 남긴다 — 새 stage 가 들어왔다는 신호까지 지우면
      //    인리치 백로그가 돌지 않는다. 감사·수집이 이 속성을 센다.
      data-ds-stage={stage ? (isUnmappedStage(stage) ? '__unmapped' : stage) : '__null'}
    >
      <Badge
        tone={tone}
        size={size}
        // 색만으로 의미를 옮기지 않는다. 스크린리더가 읽을 보충을 같이 준다.
        title={tone === 'stageUnknown' ? '단계 정보가 아직 없습니다' : undefined}
      >
        {label}
      </Badge>
    </span>
  );
}
