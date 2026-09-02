/**
 * CV-1 — 분양 목록 «AI 추출» (2026-09-02). 손파서를 두지 않는 대신 여기가 유일한 경로다.
 *
 * ── 왜 AI 인가 (R1) ─────────────────────────────────────────────────────────
 * 같은 태영 페이지 «한 장 안에서» 세대수 표기가 셋이다(실측):
 *     「세대 : 994세대(공동주택 930세대, 오피스텔 64실, 총 5개동)」
 *     「세대수 : 1,135세대」
 *     「세대수 : 아파트 762세대, 오피스텔 69실」
 * 정규식으로 셋을 맞춰도 다음 시공사에서 깨진다. 소스가 20개면 «썩는 지점이 20개» 다.
 *
 * ── 환각을 무엇으로 막는가 ──────────────────────────────────────────────────
 *   ① 엄격 스키마 검증 — 모델이 뭘 뱉든 통과하는 필드만 남는다
 *   ② `parseUnits` — 「세대·가구」와 «결합되지 않은» 숫자는 통째로 버린다(PV-5 규약)
 *   ③ source_url 보존 — 사람이 언제든 원본으로 돌아갈 수 있다
 *   ④ 신규 시드는 어차피 검수 큐를 거친다
 *
 * ⚠️ 어떤 입력에도 «던지지 않는다». 소스 하나의 실패가 크론 전체를 죽이면
 *    그날 다른 19개 소스의 신규 현장이 통째로 사라진다.
 */
import { badJson, callFailed, fetchJson, noResult, ok, type Outcome } from '@/lib/net/outcome';
import { logAnthropicUsage } from '@/lib/llm/usage-tracker';
import { canonicalBuilder, parseUnits } from '@/lib/verify/builders';
import { parseAddress } from '@/lib/builder-sites/parse';
import type { PresaleSource } from '@/lib/builder-sites/presale-registry';
import type { CandidateFact } from './candidate';

/**
 * ⚠️ 추출 정확도가 이 트랙의 «단일 경로» 다 — 여기서 놓친 현장은 아래 어느 단계도
 *    복구해 주지 않는다. 그래서 싼 모델로 내리지 않았다.
 *
 * ⛔ 다만 «감으로 유지하지도 않는다»(Node 판정 ②). 셋을 건다:
 *    ① 콜당 입력 상한 — 태그를 걷어낸 본문 텍스트로 추리고 MAX_INPUT_CHARS 로 자른다
 *    ② 실사용량 실측 — 콜마다 `llm_usage_logs` 에 토큰을 남긴다. 첫 주 비용은
 *       추정이 아니라 이 표에서 나온다
 *    ③ 섀도 평가 — `modelOverride` 로 «같은 입력» 을 다른 모델에 태워 판정 일치율을
 *       잰다(CV-B). 일치율이 기준을 넘으면 그때 «데이터로» 내린다
 */
const MODEL = 'claude-opus-5';
/** 섀도 평가용 허용 목록. ⛔ 임의 문자열을 모델 이름으로 흘려보내지 않는다. */
const ALLOWED_MODELS = new Set([MODEL, 'claude-sonnet-5', 'claude-haiku-4-5-20251001']);
/**
 * 콜당 입력 상한(문자).
 * ⚠️ 실측 근거: 태영 목록 3장이 태그 포함 17.5~22KB 이고, htmlToText 를 거치면
 *    그 1/5 수준이다. 40,000자는 «그보다 훨씬 큰 목록도 통째로» 들어가면서
 *    한 소스가 폭주해도 콜 하나의 비용이 예측 가능한 선이다.
 */
const MAX_INPUT_CHARS = 40_000;
const UA = 'Mozilla/5.0 (compatible; kadeora-bot)';

/** AI 가 뱉는 카드 한 장. ⚠️ 여기 없는 필드는 «검증에서 버린다». */
interface RawCard {
  name?: unknown;
  address?: unknown;
  units_raw?: unknown;
  status?: unknown;
  detail_url?: unknown;
}

/**
 * HTML 을 받는다. ⛔ 200 응답을 곧바로 성공으로 적지 않는다 —
 *    본문이 비면 `no_result` 다(실측: /web/complex/living 이 0바이트를 준다).
 */
export async function fetchListHtml(src: PresaleSource): Promise<Outcome<string>> {
  try {
    const res = await fetch(src.listUrl, {
      method: src.method ?? 'GET',
      headers: { 'user-agent': UA, ...(src.headers ?? {}) },
      body: src.body,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    if (!res.ok) {
      return res.status < 500
        ? badJson<string>(res.status, `HTTP ${res.status}`)
        : callFailed<string>(res.status, `HTTP ${res.status}`);
    }
    if (text.trim().length < 200) {
      return noResult<string>(res.status, `본문 ${text.length}바이트 — 목록이 비었다`);
    }
    return ok(text, res.status);
  } catch (e) {
    return callFailed<string>(0, String(e).slice(0, 120));
  }
}

/**
 * 태그를 걷어내고 «본문 텍스트» 만 남긴다. 토큰을 아끼려는 것이 절반,
 * 스크립트에 박힌 문자열을 모델이 카드로 오인하지 않게 하려는 것이 절반이다.
 */
export function htmlToText(html: string): string {
  return String(html ?? '')
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(li|p|h\d|div|tr|td|span)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const SYSTEM = `당신은 한국 건설사 «분양단지 목록» 페이지에서 단지 카드를 뽑는 추출기입니다.
판정하지 마세요. 요약하지 마세요. 페이지에 «쓰여 있는 것만» 뽑습니다.

카드 하나마다 아래 5개 필드:
  name       단지명 또는 사업명. 페이지 표기 그대로. 예: "김해 외동 재건축사업"
  address    위치 원문 그대로. 예: "경상남도 김해시 외동 705번지 일원". 없으면 null
  units_raw  세대수를 «단위까지 원문 그대로». 예: "1,135세대"
  status     페이지가 말하는 상태. 예: "분양예정" "분양중" "공사중". 없으면 null
  detail_url 단지 전용 페이지 링크. 없으면 null

⚠️ units_raw 규칙 — 여기가 자주 틀립니다:
   · 「아파트 762세대, 오피스텔 69실」 → "762세대" (아파트/공동주택 세대수만)
   · 「994세대(공동주택 930세대, 오피스텔 64실)」 → "930세대" (괄호 안 공동주택이 실제 세대수)
   · 숫자만 있고 「세대」「가구」가 붙지 않았으면 null. 숫자만 넣지 마세요
   · 「69실」「5개동」「㎡」는 세대수가 아닙니다

⚠️ 확실하지 않으면 그 필드를 null 로 두세요. 카드 자체가 불확실하면 «빼세요».
⚠️ 지어내지 마세요. 페이지에 없는 단지를 만들지 마세요.

JSON 배열만 반환. 설명 금지:
[{"name":"김해 외동 재건축사업","address":"경상남도 김해시 외동 705번지 일원","units_raw":"1,135세대","status":"분양예정","detail_url":null}]
카드가 없으면 []`;

/** 검증을 통과한 카드. `parseUnits` 를 이미 거친 값이다. */
export interface ExtractedCard extends CandidateFact {
  statusRaw: string | null;
}

/** 문자열이면 다듬어 돌려주고, 아니면 null. 모델이 숫자·객체를 넣어도 안전하다. */
const str = (v: unknown, max = 300): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};

/**
 * 스키마 검증 — «모델의 출력을 믿지 않는 지점» 이다.
 * ⚠️ 순수 함수다. 테스트가 여기를 직접 때린다.
 */
export function validateCards(arr: unknown, src: PresaleSource): ExtractedCard[] {
  if (!Array.isArray(arr)) return [];
  const out: ExtractedCard[] = [];
  const seen = new Set<string>();

  for (const row of arr) {
    if (!row || typeof row !== 'object') continue;
    const r = row as RawCard;

    const name = str(r.name, 120);
    if (!name) continue;                       // 이름 없는 카드는 카드가 아니다
    const key = name.replace(/\s+/g, '').toLowerCase();
    if (seen.has(key)) continue;               // 같은 목록 안 중복은 한 장으로 접는다
    seen.add(key);

    const addrRaw = str(r.address, 200);
    const { region, sigungu } = parseAddress(addrRaw);

    // ⛔ 「세대·가구」와 결합되지 않은 수치는 버린다(PV-5 판정 1-③).
    const totalUnits = parseUnits(str(r.units_raw, 60));

    const detail = str(r.detail_url, 500);
    // ⚠️ 상세 URL 은 «절대 URL 로만» 받는다. 상대경로를 붙여 만들면 모델이 지어낸
    //    경로가 그럴듯한 링크가 되어 저장된다. 원본 목록 URL 로 접는 편이 정직하다.
    const sourceUrl = detail && /^https?:\/\//.test(detail) ? detail : src.listUrl;

    out.push({
      rawName: name,
      addrRaw,
      region,
      sigungu,
      totalUnits,
      builderRaw: canonicalBuilder(src.builder),
      expectedPeriodRaw: null,
      sourceUrl,
      kind: src.kind,
      statusRaw: str(r.status, 40),
    });
  }
  return out;
}

/**
 * 목록 텍스트 → 카드 배열. 실패는 «세 갈래로» 돌려준다(PV-5).
 * ⚠️ 자격 부재(401·403 포함)는 call_failed 가 아니다 — 재시도해도 같다.
 */
export async function extractCards(
  src: PresaleSource,
  html: string,
  opts: { modelOverride?: string | null } = {},
): Promise<Outcome<ExtractedCard[]>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return badJson<ExtractedCard[]>(0, 'ANTHROPIC 자격 없음');

  const text = htmlToText(html);
  if (text.length < 100) return noResult<ExtractedCard[]>(200, `본문 텍스트 ${text.length}자`);

  // ⚠️ 허용 목록에 없는 값은 «조용히 기본 모델로 접는다». 오타 하나로 콜이
  //    통째로 400 이 되면 그날 그 소스의 신규 현장이 사라진다.
  const model = opts.modelOverride && ALLOWED_MODELS.has(opts.modelOverride) ? opts.modelOverride : MODEL;
  const body = text.slice(0, MAX_INPUT_CHARS);

  const user = `시공사: ${src.builder} (브랜드 ${src.brand})
목록 성격: ${src.kind}
목록 URL: ${src.listUrl}

페이지 본문:
${body}`;

  const started = Date.now();
  // ⚠️ 응답 «전체» 를 받는다. text 만 뽑으면 usage 가 같이 버려지고,
  //    그러면 첫 주 비용을 «추정» 으로만 말하게 된다(Node 판정 ②).
  const call = await fetchJson<any>(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: 'user', content: user }],
      }),
    },
    { timeoutMs: 90_000, retries: 1 },
  );

  logAnthropicUsage({
    cron_name: 'builder-presale-crawl',
    model,
    usage: call.kind === 'ok' ? call.value?.usage : null,
    duration_ms: Date.now() - started,
    status: call.kind === 'ok' ? 'success' : 'error',
    error_code: call.kind === 'ok' ? null : `${call.kind}:${call.status}`,
    metadata: { source_key: src.key, kind: src.kind, input_chars: body.length, truncated: text.length > MAX_INPUT_CHARS },
  });

  if (call.kind !== 'ok' || !call.value) return { ...call, value: null } as Outcome<ExtractedCard[]>;

  const raw = call.value?.content?.find((b: any) => b?.type === 'text')?.text;
  if (typeof raw !== 'string' || !raw) {
    return noResult<ExtractedCard[]>(call.status, 'text 블록 없음');
  }

  const m = raw.match(/\[[\s\S]*\]/);
  // ⚠️ 「배열이 없다」는 호출 실패가 아니라 «읽을 수 없는 응답» 이다. 재시도해도 같다.
  if (!m) return badJson<ExtractedCard[]>(call.status, `배열 없음: ${raw.slice(0, 80)}`);

  let parsed: unknown;
  try { parsed = JSON.parse(m[0]); }
  catch (e) { return badJson<ExtractedCard[]>(call.status, `JSON 파싱 실패: ${String(e).slice(0, 60)}`); }

  const cards = validateCards(parsed, src);
  return cards.length === 0
    ? noResult<ExtractedCard[]>(call.status, '검증 통과 카드 0건')
    : ok(cards, call.status);
}
