/**
 * PV2-C — 인허가 원문에서 «사업명» 만 남기는 두 함수.
 *
 * ── 왜 라우트 밖에 있나 ────────────────────────────────────────────────────
 * 라우트 안에 두었더니 이름 결함을 «배포해야만» 볼 수 있었고, 세 번 연속으로 냈다:
 *   1차  「부산광역시 부산진구 범천동 858-6번지 일원 희망더함아파트」 — 원문 그대로
 *   2차  「창원 풍호장천지구 1BL」 → 「창원 풍 1BL」    — `지구` 의 '구' 를 시군구로 읽음
 *   3차  「진주시 판문지구 공동주택 1단지」 → 「공동주택 1단지」 — 머리에서 같은 일
 * 이름이 곧 URL 이고 페이지 생성은 되돌리기 어렵다. 그래서 판정을 lib 로 내려
 * 테스트로 잠근다 — 배포 왕복 없이 «로컬에서» 틀린다.
 *
 * ⛔ 지어내지 않는다. 원문에서 «빼기만» 한다(D2 수동 시드 금지).
 */
import { extractDong, extractZoneTokens } from '@/lib/permits/match';

/**
 * 행정 접두를 «머리에서만» 뗀다.
 *
 * ⛔ 문자열 아무 데서나 「…구」를 털지 않는다 — 사업명을 물어 뜯는다.
 *    (기존 `extractZoneCodes` 주석의 「무동지구의 '구' 까지 물어 뜯는다」와 같은 함정.)
 * ⛔ 머리에서도 `…지구`·`…구역` 은 시군구가 아니다. 「판문지구」는 사업의 이름이다.
 * ⚠️ 동+지번은 «남긴다». 그것이 그 사업을 가리키는 유일한 식별자인 원문이 많다 —
 *    「다대동 370-11번지 일원 공동주택」(3,002세대)에서 지번을 떼면 「공동주택」만 남는다.
 */
export function cleanProjectName(raw: string | null | undefined): string {
  let t = String(raw ?? '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 5; i++) {
    const before = t;
    t = t
      .replace(/^(?:부산|울산)\s*광역시\s*/, '')
      .replace(/^(?:경상남도|창원특례시)\s*/, '')
      // 「부산 연제구 …」처럼 시도 약칭 뒤에 시군구가 오는 형태
      .replace(/^(?:부산|울산|경남)\s+(?=[가-힣]{2,4}(?:시|군|구)\s)/, '')
      // ⛔ 「판문지구」·「상남산호지구」·「엄궁1구역」은 시군구가 아니다
      // ⚠️ 「남구」·「중구」는 시군구 «전체» 가 2자다. {2,4} 로 잡으면 앞 글자 수가 모자라
      //    통째로 안 떼진다(3차 예행: 「남구 신정동 …」이 그대로 남았다). {1,4} 로 받되
      //    위의 지구·구역 가드가 「판문지구」를 막는다.
      .replace(/^(?![가-힣]*(?:지구|구역)\s)[가-힣]{1,4}(?:시|군|구)\s+/, '');
    if (t === before) break;
  }
  return t.replace(/\s*신축공사\s*$/, '').replace(/\s+/g, ' ').trim();
}

/**
 * 사업명으로 쓸 수 있는가.
 *
 * ⛔ 브랜드 «단독» 은 거부한다 — 「힐스테이트」·「호반 써밋」이 원문에 그렇게 온다.
 *    그 이름의 페이지는 어느 현장도 가리키지 못한다(PL-A 판정 ① 과 같은 종).
 * 통과 조건: 구역·지구·블록 식별자가 있거나, 법정동 이름이 남아 있을 것.
 * ⚠️ 괄호가 바로 뒤에 오는 동 이름(「모라동(270-3번지 일원)」)도 «동이 있는» 것이다.
 *    extractDong 의 경계만으로는 놓치므로 여기서 괄호를 공백으로 바꿔 한 번 더 본다.
 */
export function usableAsProject(cleaned: string): boolean {
  const t = String(cleaned ?? '').trim();
  if (t.length < 5) return false;
  if (/^(아파트|공동주택)( 및|$)/.test(t)) return false;
  const hasZone = extractZoneTokens(t).length > 0 || /(구역|지구|BL|블록|블럭)/i.test(t);
  const spaced = t.replace(/[()（）\[\]]/g, ' ');
  const hasDong = Boolean(extractDong(t) || extractDong(spaced));
  return hasZone || hasDong;
}

/**
 * 같은 사업의 분할 인허가를 한 덩어리로 — 단지·블록 꼬리를 턴 이름이 키다.
 *
 * ⚠️ 시군구 «약칭» 이 이름 머리에 붙은 채로 오는 원문이 있다 —
 *    「상남산호지구 …(2단지)」와 「창원 상남산호지구 …(4단지)」가 같은 사업인데
 *    앞의 「창원」 때문에 두 덩어리가 됐다(3차 예행).
 * ⛔ 그렇다고 «머리의 두세 글자» 를 무조건 떼지 않는다 — 그러면 「연산동 주상복합」이
 *    「주상복합」이 되어 다른 사업들과 한 덩어리가 된다. 그 행의 시군구에서 온 말일 때만 뗀다.
 */
export function projectKey(name: string | null | undefined, sigungu?: string | null): string {
  const short = String(sigungu ?? '').replace(/(시|군|구)$/, '');
  let base = cleanProjectName(name);
  if (short.length >= 2 && base.startsWith(short + ' ')) base = base.slice(short.length + 1);
  return base
    .replace(/[()（）\[\]]/g, ' ')
    .replace(/\s+/g, '')
    .replace(/(\d+단지|\d+BL|\d+블록|\d+블럭|[A-Z]-?\d+블록?|[A-Z]-\d+)/g, '')
    .replace(/(공동주택|주상복합|주거복합|신축공사|아파트)$/g, '')
    .trim();
}
