/**
 * 인허가 매칭 — 라우트가 쓰는 «순수» 변환 넷.
 *
 * ⚠️ 왜 라우트 밖에 있나. Next 의 라우트 모듈은 GET/POST·설정 상수 «말고는» export 할 수
 *    없다 — 헬퍼를 export 한 채로 두면 생성된 라우트 타입이 `npx tsc --noEmit` 을 빨갛게
 *    만든다(M4NV 공통 게이트). 본문·시그니처는 라우트에 있던 것 그대로다.
 * ⛔ 판정 규칙은 여전히 `@/lib/permits/match` 하나가 들고 있다 — 여기는 «입력 만들기» 뿐이다.
 */
import { extractDong, type SiteFact } from '@/lib/permits/match';

export interface SiteRow {
  id: string; name: string | null; display_name: string | null; name_variants: unknown;
  address: string | null; region: string | null; sigungu: string | null; dong: string | null;
  total_units: number | null; complex_units: number | null;
}

/**
 * 사이트 한 행 → 판정기 입력.
 * ⚠️ 주소가 비어 있는 행이 절반이다(활성 6,261 중 address 3,579). 그 행들은
 *    region·sigungu·dong 으로 «주소를 합성» 해 준다 — 합성해도 지번은 생기지 않으므로
 *    지번축이 오작동하지 않고, 법정동축만 살아난다.
 * ⚠️ 세대수는 complex_units(단지 전체)가 먼저다. total_units 에는 «공급분» 이 섞여 있고,
 *    인허가의 totHhldCnt 는 단지 전체다. 뒤집으면 같은 현장이 세대수 불일치로 갈린다.
 */
export function toSiteFact(r: SiteRow): SiteFact {
  const names = [r.name, r.display_name, ...(Array.isArray(r.name_variants) ? r.name_variants : [])]
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  return {
    id: r.id,
    address: r.address ?? ([r.region, r.sigungu, r.dong].filter(Boolean).join(' ') || null),
    names,
    units: r.complex_units ?? r.total_units ?? null,
  };
}

/**
 * score → `match_confidence`.
 * ⚠️ 어휘는 «컬럼이» 정한다. `apt_permits_match_confidence_chk` 가 허용하는 것은
 *    rumor·estimated·confirmed·verified·conflicting 뿐이다. 여기서 'low' 같은 새 낱말을
 *    만들면 CHECK 가 거부하고, 그 거부가 조용하면 아무 일도 안 일어난 것처럼 보인다.
 */
export function confidenceOf(score: number): 'verified' | 'confirmed' | 'estimated' {
  if (score >= 0.95) return 'verified';
  if (score >= 0.85) return 'confirmed';
  return 'estimated';
}

/**
 * 판정기 어휘 → 컬럼 어휘. **두 어휘가 다르다.**
 * 판정기는 `unmatched` 를 쓰고, 컬럼은 `pending|matched|review|rejected|no_target` 만 받는다.
 *
 * ⚠️ 2026-09-02 1회전에서 이것이 실제로 터졌다. `unmatched` 1,190건의 UPDATE 가 CHECK 에
 *    걸려 전부 거부됐는데 **에러를 안 보고 있어서** 「후보 없음 1,190」이라고 응답까지 하고
 *    행은 `pending` 그대로였다. 그 결과 매시 훅이 같은 1,155건을 영원히 다시 판정한다.
 *    침묵 성공은 이 리포가 반복해서 잡아 온 결함형이다(R1 「0카드를 성공으로 적지 않는다」).
 */
export function toColumnStatus(s: 'matched' | 'review' | 'unmatched'): string {
  return s === 'unmatched' ? 'no_target' : s;
}

/** 법정동 이름 → 그 동의 사이트들. 후보를 여기서 좁힌다 — 전수 비교는 오매칭의 온상이다. */
export function indexByDong(rows: SiteRow[]): Map<string, SiteFact[]> {
  const idx = new Map<string, SiteFact[]>();
  for (const r of rows) {
    const f = toSiteFact(r);
    const dong = r.dong || extractDong(f.address);
    if (!dong) continue;
    const arr = idx.get(dong) ?? [];
    arr.push(f);
    idx.set(dong, arr);
  }
  return idx;
}
