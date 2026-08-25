// ONESHOT §C-1 / §C0-5 — 단계별 리드폼 문구.
//
// ⚠️ **폼만 켜고 문구를 안 고치면 전환이 안 난다.**
// 공고 전 정비사업 현장에 `분양 정보 안내 신청` 을 붙이면 어색하다 —
// 분양가도 일정도 없는데 무엇을 안내받나. 실제로 전환이 난 현장
// (`울산 남구 달동 재개발`, 조합설립)은 **정보가 없어서 물어보려고** 신청한 것이다.
//
// ⚠️ 문구가 LeadForm · SiteActionBar · SiteDetailRail 세 곳에 흩어져 있었다.
//    한 곳에서만 고치면 화면마다 다른 말을 한다 — 여기 한 벌로 모은다.

import { PIPELINE_STAGES } from '@/lib/apt/lifecycle-label';

export type LeadCopyKind = 'pre_notice' | 'offering' | 'existing' | 'home';

export interface LeadCopy {
  /** 상단 라벨 밴드 */
  band: string;
  /** 폼 제목 · 하단 액션바 · 레일 버튼이 함께 쓴다 */
  cta: string;
  /** 폼 본문 한 줄 */
  lede: string;
  /** leads.inquiry_type — 미처리 경보가 '분양상담' 으로 대상을 좁힌다 */
  inquiryType: string;
}

/**
 * 공고 전 정비사업 단계. 여기에 `분양` 이라는 말을 쓰지 않는다.
 * `contract_signing` 은 이미 분양이 끝난 계약 단계라 여기 넣지 않는다.
 */
const PRE_NOTICE = new Set<string>([...PIPELINE_STAGES, 'site_planning', 'pre_announcement']);

/** 준공된 기축. 그 지역 분양 정보를 안내한다 — 이 단지를 파는 게 아니다. */
const EXISTING = new Set(['post_move_in', 'active_trade', 'landmark_active']);

export function leadCopyKind(stage: string | null | undefined): LeadCopyKind {
  const s = stage ?? '';
  if (PRE_NOTICE.has(s)) return 'pre_notice';
  if (EXISTING.has(s)) return 'existing';
  return 'offering';
}

const COPY: Record<LeadCopyKind, Omit<LeadCopy, 'cta'> & { cta: (name: string) => string }> = {
  pre_notice: {
    band: '진행 상황 알림 · 무료',
    cta: () => '이 구역 진행 상황 알림 받기',
    lede: '단계가 바뀌거나 시공사·세대수가 확정되면 알려드립니다. 분양가와 일정은 모집공고가 나와야 확정됩니다.',
    // 아직 분양이 아니다. 미처리 경보의 '분양상담' 집계와 섞이면 응대 우선순위가 흐려진다.
    inquiryType: '진행상황알림',
  },
  offering: {
    band: '분양 정보 안내 · 무료',
    cta: () => '분양 정보 안내 신청',
    lede: '담당자가 직접 연락드려 잔여 세대·일정을 안내합니다.',
    inquiryType: '분양상담',
  },
  existing: {
    band: '지역 분양 정보 · 무료',
    cta: () => '이 지역 분양 정보 안내 신청',
    lede: '이 단지는 입주가 끝난 단지입니다. 같은 지역에서 새로 나오는 분양 정보를 안내해 드립니다.',
    inquiryType: '분양상담',
  },
  /**
   * H1-3 홈 리드폼. **현장이 특정되지 않은 유일한 자리**다.
   * 다른 셋은 「이 현장」을 전제로 말하지만 여기서는 그럴 수 없다 —
   * 「이 구역」·「이 단지」 같은 지시어를 쓰면 홈에서 가리키는 대상이 없다.
   */
  home: {
    band: '분양 정보 안내 · 무료',
    cta: () => '관심 현장 분양 정보 받기',
    lede: '모집공고·분양가·잔여세대가 확정되면 담당자가 먼저 알려드립니다.',
    inquiryType: '분양상담',
  },
};

export function leadCopy(stage: string | null | undefined, siteName = ''): LeadCopy {
  const kind = leadCopyKind(stage);
  const c = COPY[kind];
  return { band: c.band, cta: c.cta(siteName), lede: c.lede, inquiryType: c.inquiryType };
}

/** 홈 전용 한 벌. 단계가 없으므로 stage 로 고르지 않는다. */
export function leadCopyForHome(): LeadCopy {
  const c = COPY.home;
  return { band: c.band, cta: c.cta(''), lede: c.lede, inquiryType: c.inquiryType };
}
