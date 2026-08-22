'use client';

// 표의 `미공개` 칸과 FAQ 마지막 항목에 붙는 인라인 텍스트 링크.
//
// `미공개`는 정직한 표기다. 있는 값을 숨겨서 만들지 않는다 —
// 값이 실제로 없는 칸에서만 이 링크가 뜬다.

import { KAKAO_TALK_URL, trackTalkClick, type TalkSlot } from '@/lib/talk-banner';
import { useTalkView } from './useTalkView';

export type TalkInlineLinkProps = {
  slot: Extract<TalkSlot, 'supply_table' | 'faq'>;
  siteSlug: string;
  /** 링크 문구. 기본값은 표 칸용. */
  label?: string;
  /** 어느 행에서 눌렀는지 — 훅이 자주 뜨는 행을 판정한다. */
  field?: string;
  /** 노출을 셀지. 표는 행마다 뜨므로 대표 1개에서만 켠다. */
  countView?: boolean;
};

export default function TalkInlineLink({
  slot,
  siteSlug,
  label = '방에서 물어보기 →',
  field,
  countView = false,
}: TalkInlineLinkProps) {
  // 훅 순서를 지키려고 항상 호출하고, ref 를 붙일지로 노출 집계를 가른다.
  const viewRef = useTalkView<HTMLAnchorElement>(slot, { site_slug: siteSlug, field });

  return (
    <a
      ref={countView ? viewRef : undefined}
      href={KAKAO_TALK_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackTalkClick(slot, { site_slug: siteSlug, field })}
      style={{
        color: 'var(--text-link)',
        textDecoration: 'underline',
        textUnderlineOffset: 2,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </a>
  );
}
