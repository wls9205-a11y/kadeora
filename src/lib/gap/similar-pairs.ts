/**
 * 갭워치 — 「같은 법정동 유사쌍」 세는 자리.
 *
 * ⚠️ 왜 라우트 밖에 있나. Next 의 라우트 모듈은 GET/POST·설정 상수 «말고는» export 할 수
 *    없다 — 헬퍼를 export 한 채로 두면 생성된 라우트 타입이 `npx tsc --noEmit` 을 빨갛게
 *    만든다(M4NV 공통 게이트). 본문은 라우트에 있던 것 그대로다: 로직·시그니처 무변경.
 */
const bare = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, '');

/**
 * 같은 법정동 안의 «유사쌍» 수. 중복 페이지 후보다.
 * ⚠️ 부분 문자열 포함으로만 본다. 느슨한 유사도(편집거리)를 쓰면
 *    「1차 ↔ 2차」처럼 «다른 단지» 가 대량으로 걸린다 — 지표가 울면 아무도 안 본다.
 * ⚠️ 법정동이 같은 것만 센다. 지역 울타리는 CV-B ② 와 같은 원칙이다.
 */
export function countSimilarPairs(
  rows: Array<{ id: string; name: string; region: string | null; sigungu: string | null; dong: string | null }>,
): { pairs: number; samples: string[] } {
  const groups = new Map<string, Array<{ id: string; name: string; b: string }>>();
  for (const r of rows) {
    if (!r.dong) continue;
    const b = bare(r.name);
    if (b.length < 4) continue;
    const k = `${r.region ?? ''}|${r.sigungu ?? ''}|${r.dong}`;
    const arr = groups.get(k) ?? [];
    arr.push({ id: r.id, name: r.name, b });
    groups.set(k, arr);
  }
  let pairs = 0;
  const samples: string[] = [];
  for (const arr of groups.values()) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], c = arr[j];
        if (a.b.includes(c.b) || c.b.includes(a.b)) {
          pairs++;
          if (samples.length < 10) samples.push(`${a.name} <-> ${c.name}`);
        }
      }
    }
  }
  return { pairs, samples };
}
