/**
 * data.go.kr `serviceKey` 정규화 — PV-2.
 *
 * ── 왜 필요한가 ────────────────────────────────────────────────────────────
 * 공공데이터포털은 인증키를 «두 벌» 준다.
 *   Decoding  `abc+def/ghi==`       (원본)
 *   Encoding  `abc%2Bdef%2Fghi%3D%3D` (퍼센트 인코딩된 것)
 * URL 에 실려야 하는 것은 «Encoding 형태» 하나뿐인데, 어느 쪽을 env 에 넣었는지에 따라
 * 코드가 해야 할 일이 정반대가 된다:
 *   Decoding 을 넣었으면 → encodeURIComponent 해야 한다
 *   Encoding 을 넣었으면 → 그대로 써야 한다 (또 인코딩하면 `%` 가 `%25` 가 되어
 *                          SERVICE_KEY_IS_NOT_REGISTERED_ERROR 가 난다)
 *
 * ⚠️ 기존 크론(`crawl-apt-subscription`)은 `encodeURIComponent(APT_DATA_API_KEY)` 다.
 *    즉 그 env 에는 «Decoding» 키가 들어 있다는 뜻이다. 그런데 PV 용 키는 «Encoding» 으로
 *    받았다. 「기존과 같은 방식으로 쓰라」와 「Encoding 키를 재인코딩하지 말라」는
 *    그대로는 «양립하지 않는다» — 같은 코드에 서로 다른 형태의 키가 들어오기 때문이다.
 *
 * ── 그래서 형태를 «묻지 않는다» ─────────────────────────────────────────────
 * 「이미 인코딩됐나」를 추측으로 판정하지 않는다. 추측은 언젠가 틀리고, 틀리면
 * 401 이 아니라 «조용한 0건» 으로 나타난다. 대신 항상 «한 번 풀고 한 번 감는다»:
 *     decode → encode
 * 두 형태 모두 같은 결과로 수렴하고, 이미 정규화된 값에 다시 걸어도 그대로다(멱등).
 *
 * ⚠️ 이 함수의 반환값은 «URL 에 그대로 넣는» 값이다. 호출부에서 다시
 *    encodeURIComponent 를 «걸지 말 것». 그게 이 파일이 막으려는 사고다.
 */

/**
 * env 의 인증키를 URL 에 실을 수 있는 형태로 만든다. Decoding·Encoding 어느 쪽을
 * 넣어도 같은 값이 나온다.
 *
 * @param raw `process.env.*_API_KEY` 값
 * @returns 퍼센트 인코딩된 serviceKey. 빈 값이면 빈 문자열.
 */
export function normalizeServiceKey(raw: string | undefined | null): string {
  const key = (raw ?? '').trim();
  if (!key) return '';
  try {
    // Encoding 키면 원본으로 풀리고, Decoding 키면 대개 그대로다.
    // ⚠️ data.go.kr Decoding 키는 base64 문자집합(A-Za-z0-9+/=)이라 `%` 를 포함하지
    //    않는다. 그래서 「풀었더니 뜻이 달라지는」 경우가 생기지 않는다.
    return encodeURIComponent(decodeURIComponent(key));
  } catch {
    // `%` 가 escape 가 아닌 위치에 있으면 decode 가 던진다 — 그건 Decoding 키다.
    return encodeURIComponent(key);
  }
}

/**
 * `serviceKey` 가 붙은 URL 을 만든다. 키를 «문자열 이어붙이기로» 넣는 자리를 없애기 위해서다.
 *
 * ⚠️ URLSearchParams 를 쓰지 «않는다». 그쪽은 값을 자동으로 인코딩하므로 이미
 *    인코딩된 serviceKey 가 다시 감긴다 — 바로 이 파일이 막으려는 그 사고다.
 */
export function buildDataGoKrUrl(
  base: string,
  serviceKey: string,
  params: Record<string, string | number | undefined>,
): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${base}?serviceKey=${serviceKey}${qs ? `&${qs}` : ''}`;
}
