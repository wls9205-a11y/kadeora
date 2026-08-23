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
 * 공시 본문 텍스트. 실패하면 null — 호출부는 그때 검수 큐로 보낸다.
 * 본문을 못 받았다고 자동 반영으로 넘어가면 안 된다.
 */
export async function fetchFilingBody(rceptNo: string, apiKey: string): Promise<string | null> {
  if (!rceptNo || !apiKey) return null;
  try {
    const res = await fetch(`${DOC_URL}?crtfc_key=${apiKey}&rcept_no=${encodeURIComponent(rceptNo)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[dart/body] ${rceptNo} http ${res.status}`);
      return null;
    }

    // 키 오류·문서 없음은 ZIP 이 아니라 JSON/XML 로 온다.
    const ctype = res.headers.get('content-type') ?? '';
    const raw = Buffer.from(await res.arrayBuffer());
    if (raw.length === 0 || raw.length > MAX_ZIP_BYTES) {
      console.warn(`[dart/body] ${rceptNo} 크기 이상 ${raw.length}`);
      return null;
    }
    if (raw.readUInt32LE(0) !== LOCAL_SIG) {
      console.warn(`[dart/body] ${rceptNo} ZIP 아님 (${ctype}) ${raw.subarray(0, 120).toString('utf8')}`);
      return null;
    }

    const entries = unzipEntries(raw);
    if (entries.length === 0) return null;

    const text = entries.map((e) => stripTags(decode(e))).join(' ').slice(0, MAX_TEXT_CHARS);
    return text.length > 0 ? text : null;
  } catch (e: any) {
    console.warn(`[dart/body] ${rceptNo} 실패:`, e?.message ?? String(e));
    return null;
  }
}
