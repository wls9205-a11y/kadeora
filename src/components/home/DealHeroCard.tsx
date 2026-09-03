// H4-1 (f) — 「지금 계약 가능」 최상단 «실사» 카드.
//
// ── 언제 뜨는가 ──
// 목록에 `hero_image_url` 을 가진 건이 있을 때만, 그 한 건을 위로 올려 이미지 카드로 낸다.
// **없으면 승격하지 않는다.** 브랜드 카드·생성 카드로 자리를 채우지 않는다 —
// 부울경 실사 보유가 171/1,464(11.7%)이고 울산·경남은 0이다. 없는 걸 있는 척하면
// 「이게 실제 단지 사진이야?」가 되고, 그건 RULES#130 이 막으려던 바로 그 문제다.
//
// ⚠️ 위성(`satellite_image_url`)을 쓰지 않는다 (2026-08-25 이미지 정책).
//    준공 전 현장에 위성을 깔면 아직 없는 건물 자리의 공터·기존 주택이 보인다.
//
// ⚠️ 라이선스 게이트를 반드시 통과시킨다 (lib/apt/hero-license.ts).
//    홈은 리드폼이 없는 화면이라 `leadContext: false` 다 — review·판정 전도 쓸 수 있다.
//    그래도 `blocked` 는 어디서도 쓰지 않는다. 게이트를 건너뛰지 말 것.
//
// ── 실측 (2026-08-26) ──
// 부울경 `unsold_active` 37곳 중 `hero_image_url` 보유 «0곳». 지금은 한 번도 뜨지 않는다.
// 조감도가 붙는 순간 자동으로 살아나라고 남겨 둔 자리다. 안 뜬다고 위성으로 바꾸지 말 것.

import Link from 'next/link';
import { canUseHeroImage } from '@/lib/apt/hero-license';
import { lifecycleLabel } from '@/lib/apt/lifecycle-label';
import type { HomeRow } from '@/lib/home/sections';

/**
 * 승격할 한 건을 고른다. 없으면 null — 호출부가 목록을 그대로 낸다.
 *
 * ⚠️ 판정을 JSX 안에 묻지 않는다. 「없으면 승격하지 않는다」가 이 기능의 존재 이유라
 *    회귀가 조용히 들어오면 안 된다.
 */
export function pickDealHero(items: HomeRow[]): HomeRow | null {
  for (const r of items) {
    const url = (r.hero_image_url ?? '').trim();
    if (url.length < 10) continue;
    if (!canUseHeroImage({ tier: r.hero_license_tier, lifecycleStage: r.lifecycle_stage, leadContext: false })) continue;
    return r;
  }
  return null;
}

export default function DealHeroCard({ item }: { item: HomeRow }) {
  const stage = lifecycleLabel(item.lifecycle_stage);
  const where = [item.region, item.sigungu].filter(Boolean).join(' ');

  return (
    <Link
      href={`/apt/${encodeURIComponent(item.slug)}`}
      style={{
        display: 'block',
        marginBottom: 10,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      {/* ⚠️ next/image 를 쓰지 않는다. hero_image_url 은 공공데이터 API·시공사 사이트에서
          오는 값이라 호스트가 next.config 의 remotePatterns 에 없을 수 있고,
          그러면 «빌드가 아니라 런타임에» 500 이 난다. 홈에서 그걸 감수할 이유가 없다.
       ⚠️ aspectRatio 를 고정해 CLS 를 막는다. 실사는 치수를 모른다 —
          모르는 값을 width/height 속성으로 «적지 않는다». */}
      <span style={{ display: 'block', aspectRatio: '16 / 9', background: 'var(--bg-hover)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.hero_image_url as string}
          alt={`${item.name} 조감도`}
          loading="lazy"
          decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </span>

      <span style={{ display: 'block', padding: '9px 11px 11px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 15, fontWeight: 600, lineHeight: 1.3, letterSpacing: -0.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: 'var(--text-primary)',
            }}
          >
            {item.name}
          </span>
          {stage && (
            <span
              style={{
                flexShrink: 0, fontSize: 10, fontWeight: 500, letterSpacing: 0,
                padding: '1px 6px', borderRadius: 'var(--radius-pill)',
                background: 'var(--bg-hover)', color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              {stage}
            </span>
          )}
        </span>
        {where && (
          <span style={{ display: 'block', fontSize: 11, letterSpacing: 0, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {where}
          </span>
        )}
      </span>
    </Link>
  );
}
