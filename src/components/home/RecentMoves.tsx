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

import Link from 'next/link';
import { lifecycleLabel } from '@/lib/apt/lifecycle-label';

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

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {items.map((m) => {
        const isStage = m.move_kind === 'stage';
        const isSubscription = (m.line_rank ?? 1) === 0;
        return (
          <li key={m.slug} style={{ borderBottom: '1px solid var(--border)' }}>
            <Link
              href={`/apt/${encodeURIComponent(m.slug)}`}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '10px 3px',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              {/* ⚠️ thumb_url 은 /api/og-apt 로 시작하는 생성 이미지다.
                  next/image 로 감싸지 않는다 — 최적화 대상이 아니고 이미 규격이 고정이다. */}
              {m.thumb_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.thumb_url}
                  alt=""
                  width={56}
                  height={56}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: 56,
                    height: 56,
                    flexShrink: 0,
                    borderRadius: 'var(--radius-sm, 8px)',
                    objectFit: 'cover',
                    background: 'var(--bg-elevated)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    flexShrink: 0,
                    borderRadius: 'var(--radius-sm, 8px)',
                    background: 'var(--bg-elevated)',
                  }}
                />
              )}

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.name}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-pill, 999px)',
                      whiteSpace: 'nowrap',
                      // 청약 라인은 리드가 나오는 쪽이라 눈에 먼저 들어와야 한다.
                      background: isStage && isSubscription ? 'var(--kd-accent-bg)' : 'var(--bg-hover)',
                      color: isStage && isSubscription ? 'var(--kd-accent)' : 'var(--text-secondary)',
                    }}
                  >
                    {moveLabel(m)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-tertiary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {metaLine(m)}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
