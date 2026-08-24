// V16 E — DART 공시 본문 수신.
//
// 왜 필요한가: `list.json` 이 주는 report_nm 은 `단일판매ㆍ공급계약체결` 같은 **고정 서식명**뿐이다.
// 실측 dart_filings 44,441건 중 report_nm 에 구역·정비사업·재개발·재건축이 들어간 건 **0건**이다.
// 구역명·계약금액은 전부 공시 **본문**에 있다.
//
// opendart 의 `document.xml` 은 ZIP 을 준다. 저장소에 zip 라이브러리가 없어
// node:zlib 의 inflateRaw 로 직접 푼다 — 의존성을 하나 늘리는 것보다 40줄을 소유하는 쪽을 골랐다.
// ZIP local file header 만 훑으면 되고, DART 가 쓰는 건 stored(0)/deflate(8) 둘뿐이다.
// (edge case 를 만나면 fflate 로 갈아타는 건 이 파일 안에서 끝나는 교체다.)
//
// ⚠️ 호출량은 하루 1~2건이다 (건설사 공급계약 90일 100건). 비용은 문제되지 않는다.
//    그래도 타임아웃과 크기 상한을 둔다 — 크론 전체를 이 왕복이 잡아먹으면 안 된다.

import { inflateRawSync } from 'node:zlib';

const DOC_URL = 'https://opendart.fss.or.kr/api/document.xml';

/** 크론 maxDuration 안에서 나머지 작업 시간을 남긴다. */
const FETCH_TIMEOUT_MS = 12_000;
/** 공시 본문 ZIP 상한. 이보다 크면 우리가 볼 문서가 아니다. */
const MAX_ZIP_BYTES = 12 * 1024 * 1024;
/** 풀어낸 텍스트 상한. 구역명은 앞부분에 있고, 뒤는 첨부·서식이다. */
const MAX_TEXT_CHARS = 400_000;

/** ZIP local file header 시그니처 */
const LOCAL_SIG = 0x04034b50;

/**
 * ZIP 버퍼에서 파일 엔트리들을 푼다.
 * central directory 를 읽지 않고 local header 를 앞에서부터 훑는다 —
 * DART 응답은 엔트리가 한두 개뿐이라 이걸로 충분하다.
 */
function unzipEntries(buf: Buffer): Buffer[] {
  const out: Buffer[] = [];
  let off = 0;

  while (off + 30 <= buf.length) {
    if (buf.readUInt32LE(off) !== LOCAL_SIG) break;

    const flags = buf.readUInt16LE(off + 6);
    const method = buf.readUInt16LE(off + 8);
    let compressed = buf.readUInt32LE(off + 18);
    const nameLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const dataStart = off + 30 + nameLen + extraLen;

    // bit 3 = 크기를 data descriptor 로 미룬 경우. 스트리밍 생성기가 쓰는 방식인데
    // 그때는 local header 의 크기가 0 이라 다음 시그니처까지를 데이터로 본다.
    if ((flags & 0x08) !== 0 && compressed === 0) {
      let next = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), dataStart);
      if (next < 0) next = buf.length;
      compressed = Math.max(0, next - dataStart - 16); // data descriptor 12~16바이트
    }

    const dataEnd = Math.min(dataStart + compressed, buf.length);
    if (dataEnd <= dataStart) break;

    const chunk = buf.subarray(dataStart, dataEnd);
    try {
      if (method === 0) out.push(chunk);
      else if (method === 8) out.push(inflateRawSync(chunk));
      // 그 외 압축 방식은 DART 가 쓰지 않는다. 조용히 건너뛴다.
    } catch {
      // 한 엔트리가 깨져도 나머지는 살린다.
    }

    off = dataEnd;
  }

  return out;
}

/**
 * XML 선언의 encoding 을 보고 디코딩한다.
 * DART 문서는 EUC-KR 이 섞여 있어 UTF-8 로만 읽으면 구역명이 깨진다.
 */
function decode(buf: Buffer): string {
  const head = buf.subarray(0, 200).toString('latin1');
  const m = /encoding=["']([\w-]+)["']/i.exec(head);
  const enc = (m?.[1] ?? 'utf-8').toLowerCase();
  const label = enc === 'euc-kr' || enc === 'ks_c_5601-1987' || enc === 'cp949' ? 'euc-kr' : 'utf-8';
  try {
    return new TextDecoder(label as any).decode(buf);
  } catch {
    return buf.toString('utf8');
  }
}

/** 태그를 걷어내고 공백을 접는다. 구역명 매칭에 필요한 건 텍스트뿐이다. */
export function stripTags(xml: string): string {
  return xml
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 본문 수신 결과.
 *
 * ⚠️ 이전 판은 실패를 전부 `null` 로 뭉개고 원인은 console.warn 에만 남겼다.
 *    Vercel 런타임 로그는 보존 기간이 짧아(Pro 1일) 하루만 지나면 사라진다.
 *    실측: 검수 큐 3건이 전부 `body_fetch_failed` 인데 401 인지 ZIP 파싱 실패인지
 *    EUC-KR 인지 알 방법이 없었다. **원인을 값으로 돌려준다.**
 */
export type FilingBodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: string; detail?: string };

/** 큐 reason 에 그대로 실리므로 짧고 기계가 읽을 수 있게 만든다. */
function fail(reason: string, detail?: string): FilingBodyResult {
  return { ok: false, reason, detail: detail?.slice(0, 200) };
}

/**
 * opendart 상태 코드 (공식 체계) — 실측 확인:
 * 잘못된 키로 호출하면 **HTTP 200 · XML 126바이트**로 아래를 돌려준다.
 *   <result><status>010</status><message>등록되지 않은 인증키입니다.</message></result>
 *
 *   010 등록되지 않은 인증키      키 문제. 코드로 못 고친다
 *   011 사용할 수 없는 키(미신청·만료)
 *   013 조회된 데이터 없음        그 공시에 문서가 없다. **정상 상황이다**
 *   020 요청 제한 초과(일 20,000)
 *   100 필드 부적절(rcept_no 형식)
 *   800 시스템 점검
 *
 * ⚠️ 013 은 [기재정정] 공시에서 흔하다 — 원문 문서가 별도 rcept_no 를 갖는 경우가 있다.
 */

/** 다시 시도해도 결과가 같은 실패. 큐에 남겨도 사람이 할 게 없다 → 닫는다. */
export function isTerminalBodyFailure(reason: string): boolean {
  return reason === 'opendart_013' || reason === 'opendart_100' || reason === 'no_rcept_no';
}

/** 요청 한도 초과. 같은 실행에서 더 두드리면 한도만 태운다 → 이번 회차는 멈춘다. */
export function isRateLimited(reason: string): boolean {
  return reason === 'opendart_020';
}

/**
 * 공시 본문 텍스트.
 *
 * 엔드포인트는 opendart 의 `document.xml` 이다 — 뷰어 HTML(dsaf001/main.do)이 아니다.
 * 뷰어는 dcmNo·eleId 를 JS 로 채워서 정적 파싱이 불가능하고 본문 글자도 없다.
 * ⚠️ 이 URL 을 뷰어로 바꾸지 말 것.
 */
export async function fetchFilingBody(rceptNo: string, apiKey: string): Promise<FilingBodyResult> {
  if (!rceptNo) return fail('no_rcept_no');
  if (!apiKey) return fail('no_api_key');
  try {
    const res = await fetch(`${DOC_URL}?crtfc_key=${apiKey}&rcept_no=${encodeURIComponent(rceptNo)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return fail(`http_${res.status}`);

    // 키 오류·문서 없음은 ZIP 이 아니라 JSON/XML 로 온다.
    const ctype = res.headers.get('content-type') ?? '';
    const raw = Buffer.from(await res.arrayBuffer());
    if (raw.length === 0) return fail('empty_body');
    if (raw.length > MAX_ZIP_BYTES) return fail('too_large', String(raw.length));

    if (raw.length < 4 || raw.readUInt32LE(0) !== LOCAL_SIG) {
      // ⚠️ 여기가 가장 흔한 실패다. opendart 는 인증키 오류·문서 없음을 **HTTP 200 + XML**
      //    로 답한다(<status>013</status> 조회된 데이터가 없습니다 등).
      //    그 status 코드가 원인을 그대로 말해주므로 반드시 실어 올린다.
      const head = raw.subarray(0, 400).toString('utf8');
      const status = /<status>([^<]+)<\/status>/.exec(head)?.[1];
      const message = /<message>([^<]+)<\/message>/.exec(head)?.[1];
      return fail(
        status ? `opendart_${status}` : 'not_zip',
        `${ctype} ${message ?? head.replace(/\s+/g, ' ').slice(0, 160)}`,
      );
    }

    const entries = unzipEntries(raw);
    if (entries.length === 0) return fail('unzip_empty', `${raw.length}B`);

    const text = entries.map((e) => stripTags(decode(e))).join(' ').slice(0, MAX_TEXT_CHARS);
    if (text.length === 0) return fail('empty_text', `entries=${entries.length}`);
    return { ok: true, text };
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    return fail(/timeout|abort/i.test(msg) ? 'timeout' : 'exception', msg);
  }
}
