// 같은 이름의 단지가 여럿일 때 «어느 시군구인지» 를 태그로 고른다.
//
// ── 왜 필요한가 ──
// `apt_complex_profiles` 를 `apt_name` 만으로 고르면 오집이 난다. 실측: 단지 이름 1,833개가
// 복수 시군구에 걸쳐 있고(한 이름이 최대 81곳), 그게 거래 160,525행 = 전체의 22% 다.
// 블로그 크론은 그렇게 고른 시세를 `meta_description` 에 넣는다 — «검색 결과에» 나가는 문장이다.
// 엉뚱한 도시 단지의 시세가 그 자리에 실리면 고치기도 어렵다(색인에 남는다).
//
// ── 왜 태그로 고르는가 ──
// `blog_posts` 에 region/sigungu 컬럼이 «없다». 가진 건 `tags` 뿐이고, 거기에 지역이 들어 있다.
// 다만 자리가 일정하지 않다 — 실측:
//   ['이펜하우스3단지','서울','양천구','실거래가','부동산분석']   ← [1]=시도 [2]=시군구
//   ['레이카운티','무순위청약','줍줍','부산청약',…,'연제구','거제동',…,'부산']  ← 뒤죽박죽
//   ['서울','30억~50억','실거래가',…]                          ← [0]이 단지명이 아니다
// 그래서 «자리로 뽑지 않는다». 태그 «집합» 에 시군구가 들어 있는지로 맞춘다.
//
// ⚠️ 못 고르면 «고르지 않는다». 후보가 둘 이상인데 태그가 가리지 못하면 null 을 낸다.
//    찍어서 맞히는 것보다 그 글의 meta_description 을 갱신하지 않는 편이 낫다.

export interface ProfileLike {
  sigungu?: string | null;
  region_nm?: string | null;
}

/**
 * 후보 프로필 중 태그와 맞는 하나를 고른다. 못 고르면 null.
 *
 * 1) 후보가 하나면 그대로 쓴다 (이름이 유일한 흔한 경우).
 * 2) 태그에 시군구가 있으면 그걸로 고른다. 그렇게 걸린 게 «정확히 하나» 일 때만 쓴다.
 * 3) 시군구로 못 가리면 시도로 한 번 더 좁힌다 — 역시 하나로 좁혀질 때만.
 * 4) 그래도 여럿이면 null.
 */
export function pickProfileByTags<T extends ProfileLike>(
  candidates: T[] | null | undefined,
  tags: (string | null | undefined)[] | null | undefined,
): T | null {
  const list = (candidates ?? []).filter(Boolean);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];

  const tagSet = new Set(
    (tags ?? []).map((t) => String(t ?? '').trim()).filter(Boolean),
  );
  if (tagSet.size === 0) return null;

  const bySigungu = list.filter((p) => p.sigungu && tagSet.has(String(p.sigungu).trim()));
  if (bySigungu.length === 1) return bySigungu[0];

  // 시군구가 여럿 걸렸으면 시도로 한 번 더 좁힌다 (예: 같은 이름이 부산·서울에 각각).
  const pool = bySigungu.length > 1 ? bySigungu : list;
  const byRegion = pool.filter((p) => p.region_nm && tagSet.has(String(p.region_nm).trim()));
  if (byRegion.length === 1) return byRegion[0];

  return null;   // 못 가린다 — 찍지 않는다
}
