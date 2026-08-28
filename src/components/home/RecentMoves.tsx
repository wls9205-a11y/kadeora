// H1-2 — 홈 「최근 움직인 현장」.
//
// ⚠️ **정렬을 프런트에서 다시 하지 말 것.** RPC(get_apt_recent_moves)가 이미
//    ① move_kind='stage' ② line_rank 0(청약 라인) ③ occurred_at DESC 로 준다.
//    받은 배열 순서를 그대로 렌더한다.
//
// ⚠️ 「366곳이 움직였다」는 틀린 수였다. 단계 변경 84 · 신규 등록 345 인데
//    둘을 섞어 센 값이다. 오늘 정비사업 277건을 승격시키며 생긴 「첫 이력」이
//    대부분이라 그걸 「움직였다」로 부르면 거짓말이 된다.
//    → move_kind 를 라벨로 반드시 갈라 쓴다. 아래 moveLabel 이 그 자리다.

import { lifecycleLabel } from '@/lib/apt/lifecycle-label';
import SiteRow from '@/components/apt/SiteRow';

export interface RecentMove {
  slug: string;
  name: string;
  raw_name: string | null;
  region: string | null;
  sigungu: string | null;
  lifecycle_stage: string | null;
  previous_stage: string | null;
  /** 'stage' = 단계가 실제로 바뀜 · 'new' = 이번에 처음 들어옴 */
  move_kind: 'stage' | 'new' | string;
  /** 0 = 청약 라인 · 1 = 그 외. 정렬은 RPC 가 했고 여기서는 배지 색만 가른다. */
  line_rank?: number | null;
  total_units: number | null;
  supply_units: number | null;
  complex_units: number | null;
  builder: string | null;
  confidence: string | null;
  /** 라이선스 판정. review·판정 전은 리드폼이 뜨는 자리에서 쓰지 않는다. */
  hero_license_tier?: string | null;
  /** 조감도 → 카드(?ratio=1x1) → 위성. 히어로 체인과 같다. */
  thumb_url: string | null;
  occurred_at: string | null;
}

/**
 * 배지 문구.
 * ⚠️ 신규 등록을 「움직였다」로 쓰지 않는다 — 단계가 바뀐 적이 없는 현장이다.
 * ⚠️ 단계 한글은 lifecycle-label.ts 만 쓴다. 여기서 새 맵을 만들지 말 것 —
 *    move_in_ready 를 「입주 임박」으로 오분류한 전례가 있다(「입주 예정」으로 정정됨).
 */
function moveLabel(m: RecentMove): string {
  if (m.move_kind !== 'stage') return '신규 등록';
  const to = lifecycleLabel(m.lifecycle_stage);
  const from = lifecycleLabel(m.previous_stage);
  if (!to) return '신규 등록';
  return from ? `${from} → ${to}` : to;
}

function metaLine(m: RecentMove): string {
  const bits: string[] = [];
  const where = [m.region, m.sigungu].filter(Boolean).join(' ');
  if (where) bits.push(where);
  const units = m.total_units ?? m.complex_units ?? m.supply_units ?? 0;
  if (units > 0) {
    // ⚠️ confidence 가 confirmed 가 아니면 단정하지 않는다(표시광고법).
    bits.push(`${units.toLocaleString('ko-KR')}세대${m.confidence === 'confirmed' ? '' : ' 예정'}`);
  }
  if (m.builder && m.builder.trim()) bits.push(m.builder.trim());
  return bits.join(' · ');
}

export default function RecentMoves({ items }: { items: RecentMove[] }) {
  if (items.length === 0) return null;

  /* B7-1 — 썸네일 칸을 «걷어냈다».
     ⚠️ 이미지가 있는 현장이 6,033곳 중 hero 174 · 우리 OG 카드 1,666 뿐이라
        대부분이 생성 카드였다. 그 카드에는 «현장 이름이 이미 그려져» 있어
        옆의 이름 텍스트와 같은 말을 두 번 하고 있었다(OG 카드 이중 표기).
     ⚠️ 배지는 단계가 아니라 «이동»(「접수중 → 당첨자 발표」)이다 — 이 섹션의 의미다.
        SiteRow 의 badge 로 갈아 끼운다. 단계 배지로 덮으면 섹션이 말하려던 것을 잃는다.
     ⚠️ metaLine 은 «그대로» 쓴다. 세대수 뒤의 「예정」(confidence 미확정)과 시공사가
        거기 붙어 있고, 표시광고법 때문에 넣은 조건이다. SiteRow 기본 meta 로 바꾸면 빠진다. */
  return (
    <div className="kd-srows">
      {items.map((m) => (
        <SiteRow
          key={m.slug}
          item={{
            slug: m.slug,
            name: m.name,
            region: m.region,
            sigungu: m.sigungu,
            badge: moveLabel(m),
            badgeAccent: m.move_kind === 'stage' && (m.line_rank ?? 1) === 0,
            date: (m.occurred_at || '').slice(0, 10) || null,
            metaOverride: metaLine(m),
          }}
        />
      ))}
    </div>
  );
}
