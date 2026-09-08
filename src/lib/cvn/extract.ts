/**
 * CV-N AI 추출 — 브랜드관 카드와 뉴스 분류 (2026-09-08).
 *
 * ⛔ 손파서를 두지 않는다. CV-1 이 정한 상속 원칙 그대로다 — 정규식으로 한 시공사를 맞추면
 *    다음 시공사에서 깨지고, 소스가 20개면 «썩는 지점이 20개» 다.
 * ⛔ 호갱노노·아실·네이버부동산을 크롤하지 않는다. 공식 브랜드관과 뉴스 API 뿐이다.
 *
 * 환각을 막는 것은 CV-1 과 같은 넷이다: 엄격 스키마 · 숫자 단위 결합 · source_url 보존 ·
 * 자동 적용은 티어가 허락한 것만(그리고 T-C 는 언제나 보류).
 *
 * ⚠️ 어떤 입력에도 «던지지 않는다». 브랜드 하나의 실패가 그날 회전을 죽이면
 *    나머지 브랜드의 신규 예정명이 통째로 사라진다.
 */

import { badJson, noResult, ok, type Outcome } from '@/lib/net/outcome';
// ⚠️ 관문을 거친다 — 원장 기록·쿼터가 여기 한 곳에 있다. 직접 fetchJson 을 부르면
//    이 호출은 다시 «관측 밖» 이 된다(2026-09-08 실측: 55곳 중 51곳이 그랬다).
import { anthropicJson } from '@/lib/llm/gateway';
import { htmlToText } from '@/lib/presale/extract';
import type { EventType } from './decide';

const MODEL = 'claude-opus-5';
/** CV-1 과 같은 상한. 목록 한 장이 통째로 들어가면서 콜당 비용이 예측 가능한 선이다. */
const MAX_INPUT_CHARS = 40_000;
/** 뉴스는 제목+요약이라 훨씬 짧다. 한 번에 여러 건을 묶어 콜 수를 줄인다. */
const MAX_NEWS_CHARS = 24_000;

/* ────────────────────────────────────────────── N-1 브랜드관 카드 */

export interface RegistryCard {
  /** 단지명 = 예정명. 「아크로 라로체」 */
  brandName: string;
  /** 사업명 = 구역명. 「시민공원주변재정비촉진3구역 재개발」 */
  projectName: string | null;
  address: string | null;
  units: number | null;
}

const REGISTRY_SYSTEM = `당신은 한국 건설사 «공식 브랜드관» 페이지에서 단지 카드를 뽑는 추출기입니다.

각 단지마다 다음을 뽑습니다.
- brand_name: 단지명(브랜드 포함한 정식 명칭). 예 「아크로 라로체」
- project_name: 그 단지의 «사업명·구역명». 예 「시민공원주변재정비촉진3구역 재개발」
  페이지가 사업명을 말하지 않으면 null 로 둡니다. 지어내지 마십시오.
- address: 주소 문자열. 없으면 null
- units: 세대수. «세대·가구» 와 결합된 숫자만. 결합되지 않은 숫자는 null

규칙
- 페이지에 없는 값을 만들지 않습니다. 모르면 null 입니다.
- 「예정」·「가칭」 표기가 붙은 이름은 brand_name 으로 쓰되 그 표기는 이름에서 뺍니다.
- 홍보 문구·수상 이력·평면 설명은 무시합니다.

출력은 JSON 배열 하나뿐입니다. 설명을 붙이지 마십시오.
[{"brand_name":"...","project_name":"...","address":"...","units":123}]`;

function toUnits(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[^\d]/g, '')) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 50_000) return null;
  return Math.round(n);
}

function toText(v: unknown, max = 120): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > max) return null;
  return s;
}

/** ⚠️ 모델이 뭘 뱉든 «여기를 통과하는 필드만» 남는다. */
export function validateRegistryCards(arr: unknown): RegistryCard[] {
  if (!Array.isArray(arr)) return [];
  const out: RegistryCard[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const brandName = toText(r.brand_name, 60);
    if (!brandName || brandName.length < 3) continue;
    out.push({
      brandName,
      projectName: toText(r.project_name, 80),
      address: toText(r.address, 160),
      units: toUnits(r.units),
    });
  }
  return out;
}

export async function extractRegistryCards(
  brand: string,
  registryUrl: string,
  html: string,
): Promise<Outcome<RegistryCard[]>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return badJson<RegistryCard[]>(0, 'ANTHROPIC 자격 없음');

  const text = htmlToText(html);
  if (text.length < 100) return noResult<RegistryCard[]>(200, `본문 텍스트 ${text.length}자`);
  const body = text.slice(0, MAX_INPUT_CHARS);

  const call = await anthropicJson<any>(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: REGISTRY_SYSTEM,
        messages: [{ role: 'user', content: `브랜드: ${brand}\n브랜드관 URL: ${registryUrl}\n\n페이지 본문:\n${body}` }],
      }),
    },
    {
      caller: 'cvn-brand-registry',
      category: 'realestate',
      metadata: { brand, input_chars: body.length, truncated: text.length > MAX_INPUT_CHARS },
    },
    { timeoutMs: 90_000, retries: 1 },
  );


  if (call.kind !== 'ok' || !call.value) return { ...call, value: null } as Outcome<RegistryCard[]>;
  const raw = call.value?.content?.find((b: any) => b?.type === 'text')?.text;
  if (typeof raw !== 'string' || !raw) return noResult<RegistryCard[]>(call.status, 'text 블록 없음');
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return badJson<RegistryCard[]>(call.status, `배열 없음: ${raw.slice(0, 80)}`);
  try {
    return ok(validateRegistryCards(JSON.parse(m[0])), call.status);
  } catch (e) {
    return badJson<RegistryCard[]>(call.status, `JSON 파싱 실패: ${String(e).slice(0, 80)}`);
  }
}

/* ────────────────────────────────────────────── N-2 뉴스 분류 */

export interface NewsCard {
  proposedName: string;
  projectName: string | null;
  builder: string | null;
  units: number | null;
  eventType: EventType;
  region: string | null;
  url: string;
}

const NEWS_SYSTEM = `당신은 한국 재개발·재건축 뉴스에서 «단지 이름 사건» 을 뽑는 분류기입니다.

각 기사마다 판단합니다.
- event_type: 다음 중 하나
  * "bid"          시공사 선정 «입찰·제안» 단계. 아직 이긴 곳이 정해지지 않았다
  * "win"          시공사 «선정 완료·수주»
  * "name_confirm" 단지명(예정명) 확정 발표
  * "rename"       기존 예정명을 «다른 이름으로» 바꿈
  * "cancel"       시공 계약 «해지·취소»
- proposed_name: 기사에 나온 단지 예정명. 없으면 null
- project_name: 사업명·구역명. 예 「문현3 재개발」. 없으면 null
- builder: 시공사. 여럿이면 쉼표로
- units: 세대수. «세대·가구» 와 결합된 숫자만. 아니면 null
- region: 시군구

규칙
- 기사에 없는 값을 만들지 않습니다. 모르면 null 입니다.
- «제안명» 과 «확정명» 을 구별하십시오. 입찰 단계에서 나온 이름은 반드시 bid 입니다.
- 단지 이름 사건이 아니면 그 기사는 배열에서 «뺍니다».

출력은 JSON 배열 하나뿐입니다. 입력의 idx 를 그대로 실어 주십시오.
[{"idx":0,"event_type":"win","proposed_name":"...","project_name":"...","builder":"...","units":null,"region":"..."}]`;

const EVENTS = new Set<EventType>(['bid', 'win', 'name_confirm', 'rename', 'cancel']);

export function validateNewsCards(arr: unknown, urls: string[]): NewsCard[] {
  if (!Array.isArray(arr)) return [];
  const out: NewsCard[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const idx = typeof r.idx === 'number' ? r.idx : Number(r.idx);
    const url = Number.isInteger(idx) ? urls[idx] : undefined;
    if (!url) continue;
    const ev = String(r.event_type ?? '') as EventType;
    if (!EVENTS.has(ev)) continue;
    const proposedName = toText(r.proposed_name, 60);
    if (!proposedName || proposedName.length < 3) continue;
    out.push({
      proposedName,
      projectName: toText(r.project_name, 80),
      builder: toText(r.builder, 120),
      units: toUnits(r.units),
      eventType: ev,
      region: toText(r.region, 40),
      url,
    });
  }
  return out;
}

export interface NewsInput {
  title: string;
  description: string;
  url: string;
}

/**
 * 기사 여러 건을 «한 콜» 로 분류한다.
 * ⚠️ 콜을 건당으로 쪼개면 일 상한(cvn.daily_ai_budget)이 순식간에 마른다.
 */
export async function classifyNewsBatch(items: NewsInput[]): Promise<Outcome<NewsCard[]>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return badJson<NewsCard[]>(0, 'ANTHROPIC 자격 없음');
  if (!items.length) return ok([], 200);

  const urls = items.map((i) => i.url);
  let body = '';
  items.forEach((it, i) => {
    const line = `[${i}] 제목: ${it.title}\n요약: ${it.description}\n\n`;
    if (body.length + line.length <= MAX_NEWS_CHARS) body += line;
  });

  const call = await anthropicJson<any>(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: NEWS_SYSTEM,
        messages: [{ role: 'user', content: body }],
      }),
    },
    {
      caller: 'cvn-name-watch',
      category: 'realestate',
      metadata: { items: items.length, input_chars: body.length, truncated: body.length >= MAX_NEWS_CHARS },
    },
    { timeoutMs: 90_000, retries: 1 },
  );


  if (call.kind !== 'ok' || !call.value) return { ...call, value: null } as Outcome<NewsCard[]>;
  const raw = call.value?.content?.find((b: any) => b?.type === 'text')?.text;
  if (typeof raw !== 'string' || !raw) return noResult<NewsCard[]>(call.status, 'text 블록 없음');
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return badJson<NewsCard[]>(call.status, `배열 없음: ${raw.slice(0, 80)}`);
  try {
    return ok(validateNewsCards(JSON.parse(m[0]), urls), call.status);
  } catch (e) {
    return badJson<NewsCard[]>(call.status, `JSON 파싱 실패: ${String(e).slice(0, 80)}`);
  }
}
