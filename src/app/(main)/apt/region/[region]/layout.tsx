/* 지역 허브의 «존재 검사» 자리.
 *
 * ⚠️ 왜 page 가 아니라 layout 인가. 이 세그먼트에는 loading.tsx 가 있다 — 그러면 셸이 먼저
 *    흘러가고, 그 뒤에 page 안에서 notFound() 를 불러도 응답 상태를 바꾸지 못해 «200 + 없음 화면»
 *    이 된다(2026-09-03 실측: /apt/region/없는지역 → 200). 없는 지역의 무한 변형 URL 이 전부
 *    200 색인 후보가 되던 자리다.
 *    layout 은 스트리밍 경계 «위» 라 여기서 걸면 진짜 404 가 나간다 — 스켈레톤은 그대로 두고
 *    상태코드만 바로잡는 방식이다(NV 표적 허브라 로딩 UX 를 버리지 않는다).
 * ⛔ page 의 같은 검사(L262)는 남겨 둔다. 두 겹이어서 손해 볼 것이 없고, layout 을 지우는
 *    사람이 page 도 함께 보게 만든다.
 */
import { notFound } from 'next/navigation';
import { REGIONS } from '@/lib/regions';

export default async function RegionHubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!(REGIONS as readonly string[]).includes(decodeURIComponent(region))) notFound();
  return <>{children}</>;
}
