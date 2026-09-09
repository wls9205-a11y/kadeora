// V13 A-1 — 공고 전 현장 목록 행.
//
// SubscriptionCard 와 같은 .kd-lrow--thumb 3열을 쓴다. 목록 두 벌을 만들지 않는다.
// 다른 점은 딱 둘이다.
//   ① 좌측 배지가 청약 상태(접수중·D-3)가 아니라 **단계명**(착공·시공사 선정)이다.
//      공고 전 현장에는 접수일이 없어 D-day 축 자체가 없다.
//   ② item.id 가 apt_sites.id(uuid) 라 AptHubItem 규격이 아니다 — 전용 컴포넌트가 필요한 이유.
//
// ⚠️ 분양가·일정을 지어내지 말 것. 공고 전이라 확정값이 없다 (표시·광고법, V13 C).
//    우측 열은 세대수만 다루고, 없으면 '미공개' 로 둔다.

import Link from 'next/link';
import { StageChip } from '@/components/apt/StageChip';
import { isRecentStageChange, pipelineHref, type AptPipelineItem } from '@/lib/apt/pipeline';
import { unitCell } from '@/lib/apt/units';
import ListThumb from '@/components/ui/ListThumb';

/** 등급 표기. confirmed 는 기본값이라 말하지 않는다 — 말하면 전 행에 붙어 정보가 0이 된다. */
const CONFIDENCE_NOTE: Record<string, string> = {
  estimated: '추정',
  rumor: '카더라',
};

/** '부산 해운대구 중동' 에서 시·도를 걷어낸 나머지. 지역 칩과 중복되는 앞 토막을 뺀다. */
function tailAddr(addr: string | null, region: string | null): string | null {
  if (!addr) return null;
  const t = region && addr.startsWith(region) ? addr.slice(region.length) : addr;
  return t.trim() || null;
}

function fmtStageDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getMonth() + 1}/${d.getDate()} 변경`;
}

export default function PipelineCard({ item, now }: { item: AptPipelineItem; now?: number }) {
  const name = item.house_nm || '(이름 없음)';
  const href = pipelineHref(item);
  const isNew = isRecentStageChange(item.stage_updated_at, now);
  const note = item.confidence ? CONFIDENCE_NOTE[item.confidence] : undefined;
  // 공고 전 현장이라 '미공개' 가 아니라 '미정' 이다 — 아직 정해지지 않았다 (V17 F-2).
  const units = unitCell({ supply: item.supply_units, complex: item.complex_units });

  const meta = [
    item.region_nm,
    item.builder || tailAddr(item.supply_addr, item.region_nm),
  ]
    .filter(Boolean)
    .join(' · ');

  const body = (
    <>
      <ListThumb src={item.thumb_url} name={name} />

      <span style={{ minWidth: 0 }}>
        <span className="kd-lrow-t">
          {/* DS2 §7② — 단계 칩을 StageChip 으로 옮긴다.
              종전엔 `is-soon` 한 벌이라 **모든 단계가 같은 파랑**이었다. 착공도 조합설립도
              분양 예고도 색이 같아서, 목록을 색으로 훑는 축 자체가 없었다.
              ⚠️ size="dense" 는 기존 치수(9.5px/800)를 «그대로» 쓴다 — 색만 바뀌고
                 행 높이·리듬은 안 바뀐다. DS 사다리(12px/500)로 올릴지는 실화면 대조 뒤
                 별도 판정이다(Badge 의 size 주석).
              ⚠️ item.status 를 그대로 넘긴다. 라벨·톤·미매핑 판정은 전부 StageChip 안에서
                 단일 원본을 거친다 — 여기서 다시 lifecycleLabel 을 부르지 않는다. */}
          <StageChip stage={item.status} size="dense" />
          {isNew && <span className="kd-lrow-badge is-hot">NEW</span>}
          {name}
        </span>
        <span className="kd-lrow-m">
          <span>{meta}</span>
          {note && <span className="kd-lrow-m-fix">{note}</span>}
          {fmtStageDate(item.stage_updated_at) && (
            <span className="kd-lrow-m-fix">{fmtStageDate(item.stage_updated_at)}</span>
          )}
        </span>
      </span>

      {/* V17: RPC 가 두 축을 따로 실어 준다. 어느 쪽 숫자인지 밝히지 않으면
          경쟁률의 분모(분양 공급)와 단지 규모(단지 전체)가 섞인다 (V15 C 와 같은 규칙). */}
      <span className="kd-lrow-r">
        {units.value === '미확인' ? (
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-tertiary)' }}>미정</span>
        ) : (
          <>
            {units.value}
            <span style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>
              {units.note ?? '세대'}
            </span>
          </>
        )}
      </span>
    </>
  );

  // slug 가 없으면 상세가 없다. 404 로 보내느니 링크를 걸지 않는다.
  if (!href) {
    return <span className="kd-lrow kd-lrow--thumb">{body}</span>;
  }

  return (
    <Link href={href} className="kd-lrow kd-lrow--thumb" style={{ textDecoration: 'none', color: 'inherit' }}>
      {body}
    </Link>
  );
}
