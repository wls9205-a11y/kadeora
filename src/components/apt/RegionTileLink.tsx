'use client';
/**
 * H5-2 — 타일 하나. 클릭 시 «쿠키를 쓴다».
 *
 * ⚠️ 서버 컴포넌트에서 쿠키를 쓸 수 없어서 이 한 조각만 클라이언트다.
 *    타일 그리드 전체를 클라이언트로 만들지 않는다 — 목록은 크롤러가 읽어야 한다.
 *
 * ⚠️ 쿠키를 «먼저» 쓰고 이동한다. 이동 뒤에 쓰면 첫 페인트가 이미 지나가서
 *    새로고침 전까지 반영되지 않는다.
 */

import Link from 'next/link';
import { writeRegionCookie } from '@/lib/region/cookie';

export default function RegionTileLink({
  href,
  region,
  label,
  count,
  active,
}: {
  href: string;
  region: string;
  label: string;
  count: number;
  active?: boolean;
}) {
  const empty = count === 0;
  return (
    <Link
      href={href}
      scroll={false}
      onClick={() => writeRegionCookie(region)}
      aria-current={active ? 'true' : undefined}
      data-active={active ? 'true' : undefined}
      data-empty={empty ? 'true' : undefined}
      className="region-tile"
    >
      <span className="region-tile__name">{label}</span>
      <span className="region-tile__count">{count.toLocaleString()}</span>
    </Link>
  );
}
