// ONESHOT §B-5 — SEO 메타에 쓰는 표시 이름과 지역 접두사.
//
// 두 가지 문제를 한 곳에서 닫는다.
//
// ① **이름만으로는 검색에 안 걸린다.** `흑석9구역 재개발` 은 사람들이
//    `서울 흑석9구역` 으로 찾는다. `display_name` 이 지역을 붙인 표시용 이름이다.
//    ⚠️ `name` 과 `slug` 는 절대 바꾸지 않는다 — `name` 은 공공API 매칭 키이고
//       `slug` 는 색인이 걸려 있으며 301 맵의 기준이다. 표시 계층에서만 갈아끼운다.
//
// ② **지역이 두 번 찍힌다.** `울산 남구 울산 남구 달동 재개발` — 실측 344건.
//    설명 템플릿이 `{region} {sigungu} {name}` 인데 이름이 이미 지역으로 시작한다.
//    ⚠️ `display_name` 을 쓴다고 저절로 풀리지 않는다. 달동 재개발은
//       `display_name = name` 이라 값이 같다. 접두사 쪽을 고쳐야 한다.

/** 표시용 이름. 없으면 `name` 을 그대로 쓴다 — 지어내지 않는다. */
export function displayNameOf(displayName: string | null | undefined, name: string): string {
  const d = (displayName ?? '').trim();
  return d || name;
}

/**
 * 이름 앞에 붙일 지역 접두사. 이미 이름에 들어 있으면 붙이지 않는다.
 *   `울산 남구 달동 재개발` + (울산, 남구) → ''        (이미 시·도로 시작)
 *   `남구 달동 재개발`      + (울산, 남구) → '울산'     (시군구로 시작)
 *   `흑석9구역 재개발`      + (서울, 동작구) → '서울 동작구'
 */
export function regionPrefix(disp: string, region?: string | null, sigungu?: string | null): string {
  const d = (disp ?? '').trim();
  const r = (region ?? '').trim();
  const g = (sigungu ?? '').trim();
  if (r && d.startsWith(r)) return '';
  if (g && d.startsWith(g)) return r;
  return [r, g].filter(Boolean).join(' ');
}

/** 지역 접두사를 붙인 이름. 중복 없이 한 벌. */
export function regionedName(disp: string, region?: string | null, sigungu?: string | null): string {
  const p = regionPrefix(disp, region, sigungu);
  return p ? `${p} ${disp}` : disp;
}

/**
 * 타이틀 꼬리의 ` — 지역`. 앞머리에 이미 그 지역이 있으면 붙이지 않는다.
 * `울산 남구 달동 재개발 분양정보 … — 울산` 처럼 양끝에 지역이 찍히는 걸 막는다.
 */
export function regionSuffix(title: string, region?: string | null): string {
  const r = (region ?? '').trim();
  if (!r) return '';
  return (title ?? '').includes(r) ? '' : ` — ${r}`;
}

/**
 * 저장된 설명 앞머리의 지역 중복만 걷어낸다.
 *   `울산 남구 울산 남구 달동 재개발. …` → `울산 남구 달동 재개발. …`
 * ⚠️ 뒤에 남은 본문은 손대지 않는다. 저장된 설명 5,521건을 통째로 갈아엎지 않는다.
 */
export function stripDupRegionPrefix(desc: string, region?: string | null, sigungu?: string | null): string {
  const d = (desc ?? '').trim();
  const r = (region ?? '').trim();
  if (!r) return d;
  const g = (sigungu ?? '').trim();
  for (const p of [g ? `${r} ${g} ` : '', `${r} `]) {
    if (p && d.startsWith(p)) {
      const rest = d.slice(p.length);
      // **같은 시·도가 다시 나올 때만** 접두사가 중복된 것이다.
      // 시군구로 시작한다고 떼면 `서울 동작구 흑석9구역` 같은 정상 문구가 깎인다.
      if (rest.startsWith(`${r} `)) return rest;
    }
  }
  return d;
}

/**
 * 저장된 제목의 **앞머리 이름만** 표시 이름으로 갈아끼운다.
 *   `흑석9구역 재개발 분양정보 — 분양가·청약일정·입주시기 2026`
 *   → `서울 동작구 흑석9구역 재개발 분양정보 — 분양가·청약일정·입주시기 2026`
 * 저장값을 통째로 버리면 뒤 꼬리(`— 분양가·청약일정·입주시기 2026`)를 잃는다.
 * 앞머리가 `name` 으로 시작하지 않으면(직접 손본 제목) 손대지 않는다.
 */
export function swapLeadingName(title: string, name: string, disp: string): string {
  const t = (title ?? '').trim();
  if (!t || disp === name || !name || !t.startsWith(name)) return t;
  return disp + t.slice(name.length);
}
