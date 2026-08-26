'use client';

// S4 P0 — 분양 정보 안내 신청 폼. (S4-2: 필드 4개 · 입력 예시 · 시인성 / S7-3: 문구 분리)
// 서버(Apps Script 웹앱: 시트 기록 + 메일 알림 + Supabase 백업)는 이미 검증 완료 상태다.
//
// Content-Type 은 반드시 text/plain;charset=utf-8 이어야 한다.
// application/json 을 쓰면 브라우저가 OPTIONS preflight 를 먼저 보내는데 Apps Script 는
// OPTIONS 에 응답할 수 없어 CORS 로 전부 차단된다. text/plain 은 preflight 면제 대상이고
// 서버는 e.postData.contents 를 그대로 파싱하므로 문제없다.
// 로컬에서는 통과하고 배포 후에만 실패하는 유형이라 이 헤더는 바꾸지 말 것.
//
// mode:'no-cors' 도 쓰지 않는다 — 응답 본문을 못 읽게 되어 성공/실패 판별과 재시도가 무의미해진다.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent, FormEvent } from 'react';
import SectionHeader from '@/components/apt/SectionHeader';
import { SITE_URL } from '@/lib/constants';
import { leadCopy, leadCopyForHome } from '@/lib/apt/lead-copy';
import { leadKind } from '@/lib/apt/lead-eligibility';
import { trackLeadSubmit, trackLeadView } from '@/lib/apt/lead-track';

const ENDPOINT = process.env.NEXT_PUBLIC_LEAD_ENDPOINT || '';
const DRAFT_PREFIX = 'kd_lead_draft:';
const PENDING_PREFIX = 'kd_lead_pending:';
// 최초 1회 즉시 전송 후, 실패하면 이 간격만큼 쉬고 재시도 (총 3회 재시도)
const RETRY_DELAYS = [300, 900, 2700];

/**
 * 하단 전체 폼의 앵커 id — 하단 액션바·레일 진입 카드가 이 id 로 스크롤한다.
 * ⚠️ 값을 바꾸지 말 것.
 */
export const LEAD_FORM_ID = 'lead-form';

/** 희망 타입 기본값. select 는 항상 이 값으로 시작한다 (추가 조작 없이 제출 가능). */
const TYPE_UNDECIDED = '미정';

/**
 * v6-5: 분양 라인 문의 유형. 미처리 24시간 경보가 이 값으로 대상을 좁힌다.
 * 2단계에서 기축(landmark_active) 폼이 '지역DB' 를 쓰게 되므로 상수로 둔다.
 */
const INQUIRY_TYPE_SALES = '분양상담';


/**
 * 모집공고에 평형 목록이 없는 현장(36.7%)에서 쓰는 표준 목록.
 * 국민주택 규모 경계(85㎡)를 사이에 두고 실제 공급이 몰리는 구간이다.
 *
 * ⚠️ 단위(㎡)를 문자열에 포함한다. 페이지가 내려주는 typeOptions 도 이미
 *    `${n}㎡` 형태라(apt/[id] 539행) 렌더 시 단위를 덧붙이면 '59㎡㎡' 가 된다.
 *    옵션 값이 곧 시트·DB 에 남는 값이므로 사람이 읽는 문자열 그대로 쓴다.
 */
const STANDARD_TYPES = ['59㎡', '74㎡', '84㎡', '101㎡', '114㎡ 이상'];

/**
 * M5 §A-1 — 기축(resale) 폼의 희망 타입.
 * 준공된 단지에 평형을 묻는 건 의미가 없다. 무엇을 하려는지가 응대에 필요한 정보다.
 * ⚠️ leads.desired_type 에 그대로 들어간다. CHECK 제약이 없어 값 추가에 스키마 변경이 필요 없다.
 */
const RESALE_TYPES = ['매수', '매도', '전월세'];

type LeadFormProps = {
  /**
   * apt_sites.slug — leads ↔ apt_sites 조인 키.
   * ⚠️ H1-3: 홈(variant='home')에는 현장이 없어 optional 이다. `leads.site_slug` 는 nullable 이라
   *    빈 값으로 들어가도 된다(DB 담당 확인). 상세·블로그에서는 그대로 필수처럼 쓴다.
   */
  siteSlug?: string;
  siteName?: string; // apt_sites.name
  /**
   * 현장별 공급 평형. 페이지가 house_type_info 에서 파생해 내려준다 (현장마다 다름).
   * v6-1: 다시 쓴다. 비어 있으면 STANDARD_TYPES 로 떨어진다 —
   * 최근 1년 376건 중 238건(63.3%)만 평형 목록이 있고 138건(36.7%)은 없다.
   * select 자체는 어느 현장에서나 항상 렌더한다. 옵션 내용만 갈린다.
   */
  typeOptions?: string[];
  /**
   * v6-4: 어느 지역 현장인지. 시트를 훑을 때 이름만으로는 구분이 안 된다
   * (현장이 수백 개다). apt_sites.region/sigungu 채움률 98.2%.
   * ⚠️ 값이 없으면 빈 문자열로 보내고 폼을 막지 않는다 — 지역이 없다고 리드를 잃으면 안 된다.
   */
  region?: string | null;
  sigungu?: string | null;
  /**
   * 놓이는 자리에 따라 설명 한 줄만 바뀐다. 제목·버튼·동의 문구는 동일하다.
   * 'home' 만 예외로 제목·본문 한 벌을 따로 쓴다 — 가리킬 현장이 없기 때문이다.
   * ⚠️ 검증·전송 경로·재시도는 셋이 완전히 같다. 홈 분기만 얹는다.
   */
  variant?: 'detail' | 'blog' | 'home';
  /** ONESHOT §C-1: 단계별 문구. 공고 전에 '분양 정보 안내' 는 어색하다. */
  lifecycleStage?: string | null;
  /**
   * C-4: 홈 폼의 「관심 지역」 선택지. `variant='home'` 에서만 쓰이고 **필수 입력**이 된다.
   *
   * ⚠️ 여기서 ['부산','울산','경남'] 을 새로 쓰지 않는다 — 원본은
   *    `lib/apt/pipeline.ts` 의 BUGYEONG_REGIONS 다. 그런데 그 파일은 `next/cache` 를
   *    import 해서 클라이언트 번들에 들어갈 수 없다. 그래서 서버 컴포넌트(홈)가
   *    읽어 prop 으로 내려 준다. 목록이 두 곳에 생기지 않게 하는 유일한 방법이다.
   */
  regionChoices?: readonly string[];
};

type LeadPayload = {
  name: string;
  phone: string;
  birthDate: string; // 미입력 시 빈 문자열 — null 처리는 서버가 한다
  desiredType: string; // 미선택 시 빈 문자열
  consent: boolean;
  marketingOk: boolean;
  dwellMs: number;
  siteSlug: string;
  siteName: string;
  /**
   * v6-4: 시트·DB 에 같이 남길 지역 정보.
   *
   * ⚠️ Apps Script 가 site_slug 로 Supabase 를 다시 조회하게 만들지 않는다.
   *    리드 도달이 이 경로 최대 리스크인데 왕복을 하나 더 얹으면 조회 실패가 곧 리드 유실이다.
   *    페이지가 이미 값을 갖고 있으니 같이 보낸다.
   */
  region: string;
  sigungu: string;
  /**
   * fn_insert_lead 의 p_interest_region 에 그대로 넣을 값 — `"부산 사상구"` 형태.
   * 시트 열(시·도 / 시군구)은 따로 쓰고 이건 DB 용이다.
   * Apps Script 가 문자열을 조립하지 않게 여기서 미리 만든다 —
   * 조립 규칙이 두 곳에 생기면 한쪽만 고치게 된다. 둘 중 하나가 비면 있는 쪽만 들어간다.
   */
  interestRegion: string;
  /** 시트에서 바로 열 수 있는 현장 링크. */
  siteUrl: string;
  /**
   * v6-5: 문의 유형. 지금은 '분양상담' 고정이다.
   * 미처리 24시간 경보가 이 값으로 대상을 좁히므로 비면 분리가 깨진다.
   * 2단계에서 기축(landmark_active) 폼이 '지역DB' 를 쓴다.
   */
  inquiryType: string;
  entryPath: string;
  sourceDomain: string;
  /**
   * H1-3: 홈 유입 구분.
   *
   * ⚠️ `leads` 에 **`source` 컬럼은 없다.** 실제 컬럼은 `channel` 이고
   *    `fn_insert_lead(p_channel …)` 로 들어간다(기본값 'organic').
   *
   * ⚠️ 이 값이 실제로 저장되려면 **Apps Script 가 payload.channel 을
   *    p_channel 로 넘겨야 한다.** 지금까지 channel 은 서버가 utm·유입 도메인에서
   *    스스로 판정해 왔고(실측값 'organic' 4건 · 'utm:kakao' 1건), 프런트가 보낸 적이 없다.
   *    Apps Script 가 무시하면 이 필드는 그냥 버려진다 — 코드는 실패하지 않는다.
   *
   * ⚠️ 그래서 홈 구분은 이 값에만 기대지 않는다. `entryPath` 가 이미 저장되는 값이고
   *    홈에서는 항상 `'/'` 다. channel 이 안 붙어도 `entry_path='/'` 로 셀 수 있다.
   */
  channel?: string;
  company: string;
  query: Record<string, string>;
  /**
   * s-v2 B-7: 접수 건 식별 키. 지금은 1차 전송에만 실린다.
   *
   * 2차(추가 정보) 전송은 제거했다 — `fn_insert_lead` 가
   * `on conflict (dedupe_key) do update set inquiry_count = inquiry_count + 1` 이라
   * 같은 이름·전화로 한 번 더 POST 하면 선택 입력을 성실히 채운 리드가 전부
   * '재문의(repeat)' 로 기록되고 status 도 new 로 리셋된다.
   * 시트 중복 행과 메일은 지우면 되지만 재문의 카운터는 복구가 안 된다.
   *
   * 되살릴 때 순서:
   *   1) fn_update_lead_followup(leadRef, birth_date, desired_type) 신설
   *      — inquiry_count·status 미변경, anon EXECUTE 만
   *   2) Apps Script 에 followUp 분기 — leadRef 로 행 찾아 열만 UPDATE,
   *      메일 미발송, fn_insert_lead 호출 안 함
   *      (재배포는 반드시 '배포 관리 → 수정 → 새 버전'. '새 배포' 는 /exec 주소가 바뀐다)
   *   3) 성공 화면 버튼 재활성화
   * 그 준비로 이 키는 남겨둔다.
   */
  leadRef: string;
};

type FieldErrors = { name?: string; phone?: string; birthDate?: string; consent?: string; homeRegion?: string };

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const onlyDigits = (v: string) => v.replace(/[^0-9]/g, '');

function formatPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

// 서버는 필터에 걸린 요청도 HTTP 200 + ok:true 로 답하고 skipped 사유만 덧붙인다
// (실측: {"ok":true,"skipped":"too_fast"}, {"ok":true,"skipped":"honeypot"}).
// ok:true 만 보고 성공 처리하면 걸러진 신청이 접수된 것처럼 안내된다 — skipped 를 반드시 본다.
//   recorded    실제로 기록됨
//   silent-drop 허니팟. 봇에게는 성공 화면을 보여주는 게 의도된 동작이다
//   rejected    서버가 거절. 같은 payload 로 재시도해도 결과가 같으므로 재시도하지 않는다
//   failed      네트워크/응답 실패. 재시도 대상
type PostOutcome = 'recorded' | 'silent-drop' | 'rejected' | 'failed';

async function postLead(payload: LeadPayload): Promise<PostOutcome> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return 'failed';
  const json = (await res.json().catch(() => null)) as { ok?: boolean; skipped?: string } | null;
  if (json?.ok !== true) return 'failed';
  if (!json.skipped) return 'recorded';
  return json.skipped === 'honeypot' ? 'silent-drop' : 'rejected';
}

/** localStorage 는 사파리 프라이빗 등에서 접근 자체가 throw 한다 — 전부 감싼다. */
function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 저장 불가 환경 — 임시 보관만 포기하고 폼 자체는 정상 동작 */
  }
}
function lsRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

// font-size 를 지정하지 않는다 — bbce67a4 의 전역 하한
// `input, textarea, select { font-size: max(16px, var(--fs-sm)) }` 을 그대로 상속받아야
// iOS 포커스 시 자동 확대가 막힌다 (개별 override 금지).
const fieldStyle: CSSProperties = {
  width: '100%',
  height: 'var(--btn-h)',
  padding: '0 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-base)',
  color: 'var(--text-primary)',
  outline: 'none',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 'var(--fs-xs)',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 6,
};

// 스펙의 --text-danger 는 globals.css 에 없는 이름이라 그대로 쓰면 값이 없어
// 상속색으로 렌더된다 (Rule #94). 실재 토큰은 --error (#DC2626).
const errorStyle: CSSProperties = {
  fontSize: 'var(--fs-sm)',
  color: 'var(--error)',
  lineHeight: 1.5,
  margin: '4px 0 0',
};

// 스펙의 --text-muted 도 미정의. 저장소의 보조 텍스트 토큰은 --text-tertiary.
const hintStyle: CSSProperties = {
  fontSize: 'var(--fs-xs)',
  color: 'var(--text-tertiary)',
  lineHeight: 1.5,
  margin: '4px 0 0',
};

const badgeBase: CSSProperties = {
  flexShrink: 0,
  padding: '1px 6px',
  borderRadius: 'var(--radius-pill)',
  fontSize: 'var(--fs-xs)',
  fontWeight: 500,
  lineHeight: 1.6,
};

// 허니팟 — display:none 은 일부 봇이 건너뛰므로 화면 밖으로 밀어내는 방식을 쓴다.
const honeypotStyle: CSSProperties = {
  position: 'absolute',
  left: -9999,
  top: 0,
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: 'none',
};

export default function LeadForm({
  siteSlug = '',
  siteName = '',
  typeOptions,
  region,
  sigungu,
  variant = 'detail',
  lifecycleStage,
  regionChoices,
}: LeadFormProps) {
  const isHome = variant === 'home';
  // 홈인데 선택지가 안 내려왔으면 셀렉트를 필수로 걸 수 없다. 폼을 막는 대신
  // 지역 칸만 빠지고 나머지는 그대로 돈다 — 리드를 놓치는 쪽이 더 비싸다.
  const homeRegions = isHome ? (regionChoices ?? []) : [];
  const needsRegion = homeRegions.length > 0;
  // ONESHOT §C-1: 단계별 문구 한 벌. 세 화면(폼·액션바·레일)이 같은 말을 해야 한다.
  // H1-3: 홈은 단계가 없다 — stage 로 고르지 않고 홈 한 벌을 그대로 쓴다.
  const copy = isHome ? leadCopyForHome() : leadCopy(lifecycleStage, siteName);
  const mountedAt = useRef(Date.now());

  // §5-3: 본문 폼이 **실제로 화면에 들어온 순간**만 노출로 센다.
  // ⚠️ 마운트 시점에 세지 않는다 — 폼은 페이지 하단에 있어 대부분의 방문자는 보지 못한다.
  //    마운트로 세면 분모가 부풀어 전환율이 실제보다 낮게 나온다.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const el = document.getElementById(LEAD_FORM_ID);
    if (!el) return;
    let fired = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || fired) continue;
          fired = true;
          trackLeadView('body', { site_slug: siteSlug, lifecycle_stage: lifecycleStage });
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [siteSlug, lifecycleStage]);
  // ⚠️ 홈은 siteSlug 가 없다. 빈 문자열을 그대로 쓰면 키가 `kd_lead_draft:` 가 되어
  //    나중에 다른 무슬러그 변형이 생기면 초안이 섞인다. 자리 이름으로 namespace 를 준다.
  const storageKey = siteSlug || (isHome ? 'home' : 'unknown');
  const draftKey = `${DRAFT_PREFIX}${storageKey}`;
  const pendingKey = `${PENDING_PREFIX}${storageKey}`;

  /**
   * v6-2: 희망 타입 옵션. '현장마다 폼이 다르다' 의 구조적 원인이 여기였다.
   *   공고 있음(63.3%) → 그 현장 실제 평형 + 미정
   *   공고 없음(36.7%) → 표준 목록 + 미정
   * select 는 어느 현장에서나 항상 렌더한다 — 화면은 같은 4칸이고 옵션만 갈린다.
   * 그건 '양식이 다른 것' 이 아니라 정상이다.
   */
  // M5 §A — 기축이면 평형이 아니라 매수/매도/전월세를 묻는다.
  const isResale = leadKind(lifecycleStage) === 'resale';
  const hasSiteTypes = !isResale && Array.isArray(typeOptions) && typeOptions.length > 0;
  const typeChoices = (() => {
    const base = isResale ? RESALE_TYPES : hasSiteTypes ? typeOptions! : STANDARD_TYPES;
    // 중복·빈 값 제거 후 '미정' 을 맨 앞에 고정한다 (기본값이라 첫 자리가 맞다).
    const uniq = Array.from(new Set(base.map(t => String(t).trim()).filter(t => t && t !== TYPE_UNDECIDED)));
    return [TYPE_UNDECIDED, ...uniq];
  })();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  // 기본값이 '미정' 이라 사용자가 손대지 않아도 제출된다 (추가 조작 0).
  const [desiredType, setDesiredType] = useState(TYPE_UNDECIDED);
  // C-4: 홈 폼의 관심 지역. 상세·블로그는 region prop 이 있어 쓰지 않는다.
  const [homeRegion, setHomeRegion] = useState('');
  const [consent, setConsent] = useState(false);
  const [marketingOk, setMarketingOk] = useState(false);
  const [company, setCompany] = useState(''); // 허니팟
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 접수 건 식별 키. 폼 인스턴스당 1개. (2차 전송 복구 시 그대로 쓴다)
  const leadRefRef = useRef<string>('');
  if (!leadRefRef.current) {
    leadRefRef.current =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `lr_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }

  // 복원이 끝나기 전에 저장 effect 가 돌면 빈 값으로 초안을 덮어쓴다.
  const restored = useRef(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  // 서식을 다시 입히면 캐럿이 끝으로 튄다 — 재렌더 후 복원할 "앞쪽 숫자 개수"를 담아둔다.
  const caretDigitsRef = useRef<number | null>(null);

  // 임시 보관 복원
  useEffect(() => {
    const raw = lsGet(draftKey);
    if (raw) {
      try {
        const d = JSON.parse(raw) as Partial<LeadPayload>;
        if (typeof d.name === 'string') setName(d.name);
        if (typeof d.phone === 'string') setPhone(d.phone);
        if (typeof d.birthDate === 'string') setBirthDate(d.birthDate);
        // 빈 문자열 초안(구버전)으로 기본값을 덮어쓰지 않는다.
        if (typeof d.desiredType === 'string' && d.desiredType) setDesiredType(d.desiredType);
        // C-4: 초안의 지역이 지금 내려온 선택지에 없으면 버린다 — 셀렉트에 없는 값이
        //      state 에 남으면 화면은 빈칸인데 검증은 통과하는 상태가 된다.
        {
          const draftRegion = (d as { homeRegion?: unknown }).homeRegion;
          if (typeof draftRegion === 'string' && homeRegions.includes(draftRegion)) {
            setHomeRegion(draftRegion);
          }
        }
        if (typeof d.consent === 'boolean') setConsent(d.consent);
        if (typeof d.marketingOk === 'boolean') setMarketingOk(d.marketingOk);
      } catch {
        lsRemove(draftKey);
      }
    }
    restored.current = true;
  }, [draftKey]);

  // 입력값이 바뀔 때마다 임시 보관. 삭제는 전송 성공 응답을 받은 뒤에만 한다.
  useEffect(() => {
    if (!restored.current) return;
    lsSet(draftKey, JSON.stringify({ name, phone, birthDate, desiredType, homeRegion, consent, marketingOk }));
  }, [draftKey, name, phone, birthDate, desiredType, homeRegion, consent, marketingOk]);

  // 서식 적용 후 캐럿을 원래 자리로 되돌린다 (앞쪽 숫자 개수를 기준으로 위치를 다시 찾는다).
  useEffect(() => {
    const want = caretDigitsRef.current;
    const el = phoneRef.current;
    caretDigitsRef.current = null;
    if (want === null || !el) return;
    let pos = 0;
    let seen = 0;
    while (pos < el.value.length && seen < want) {
      if (/[0-9]/.test(el.value[pos])) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
  }, [phone]);

  // 미전송분 재시도 — 조용히 1회. 실패해도 UI 에 아무것도 표시하지 않는다.
  useEffect(() => {
    let cancelled = false;
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PENDING_PREFIX)) keys.push(k);
      }
    } catch {
      return;
    }
    if (keys.length === 0) return;

    (async () => {
      for (const k of keys) {
        if (cancelled) return;
        const raw = lsGet(k);
        if (!raw) continue;
        let payload: LeadPayload;
        try {
          payload = JSON.parse(raw) as LeadPayload;
        } catch {
          lsRemove(k); // 깨진 값은 영구히 남지 않게 정리
          continue;
        }
        try {
          // 'failed' 가 아니면 서버가 판정을 내린 것이므로 키를 정리한다.
          // 거절된 payload 를 남겨두면 매 마운트마다 재전송되는 영구 잔존 키가 된다.
          if ((await postLead(payload)) !== 'failed') lsRemove(k);
        } catch {
          /* 조용히 무시 — 다음 마운트에서 다시 시도한다 */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 하이픈을 실시간으로 붙이되, 하이픈만 지워지는 상황을 따로 잡는다.
   * `010-1234-5678` 에서 하이픈 위 백스페이스는 숫자를 그대로 둔 채 길이만 줄이므로
   * 그냥 다시 서식을 입히면 하이픈이 되살아나 "지워지지 않는" 것처럼 보인다.
   * 이 경우 캐럿 앞 숫자 하나를 대신 지운다.
   */
  function handlePhoneChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    const prevDigits = onlyDigits(phone);
    let digits = onlyDigits(raw);
    let before = onlyDigits(raw.slice(0, caret)).length;

    if (raw.length < phone.length && digits.length === prevDigits.length && before > 0) {
      digits = digits.slice(0, before - 1) + digits.slice(before);
      before -= 1;
    }

    caretDigitsRef.current = before;
    setPhone(formatPhone(digits));
    if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined }));
  }

  // v6-1: 이름·연락처·생년월일·동의를 본다.
  //   생년월일은 청약 자격·가점 확인에 바로 쓰이므로 필수다.
  //   희망 타입은 기본값이 '미정' 이라 검사 대상이 아니다.
  const validate = useCallback((): FieldErrors => {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = '이름을 입력해 주세요';
    if (onlyDigits(phone).length < 11) next.phone = '연락처 11자리를 모두 입력해 주세요';
    if (onlyDigits(birthDate).length !== 6) next.birthDate = '생년월일 6자리를 입력해 주세요';
    // C-4: 홈은 가리킬 현장이 없다. 지역까지 비면 담당자가 전화를 걸 근거가 없어진다.
    if (needsRegion && !homeRegion.trim()) next.homeRegion = '관심 지역을 선택해 주세요';
    if (!consent) next.consent = '개인정보 수집 동의가 필요합니다';
    return next;
  }, [name, phone, birthDate, consent, needsRegion, homeRegion]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;

    const v = validate();
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }

    setSendError(null);
    setSending(true);

    // 홈은 사용자가 고른 값이 곧 관심 지역이다. 상세·블로그는 현장의 region 을 그대로 쓴다.
    const regionText = (isHome ? homeRegion : (region ?? '')).trim();
    const sigunguText = (isHome ? '' : (sigungu ?? '')).trim();

    const payload: LeadPayload = {
      name,
      phone, // 원본 그대로. 정규화는 서버가 한다
      birthDate,
      desiredType,
      consent,
      marketingOk,
      dwellMs: Date.now() - mountedAt.current, // 3초 미만 판정은 서버가 한다 — 여기서 막지 않는다
      siteSlug,
      siteName,
      // 빈 값이어도 그대로 보낸다. 폼을 막지 않는다.
      region: regionText,
      sigungu: sigunguText,
      interestRegion: [regionText, sigunguText].filter(Boolean).join(' '),
      // 시트에서 바로 열 수 있게 절대 URL 로. 판정은 constants 한 곳(SITE_URL)만 쓴다.
      siteUrl: siteSlug ? `${SITE_URL.replace(/\/$/, '')}/apt/${encodeURIComponent(siteSlug)}` : '',
      // ONESHOT §C-1: 공고 전은 '진행상황알림' 이다. 미처리 경보가 '분양상담' 으로
      //   대상을 좁히므로 섞이면 응대 우선순위가 흐려진다.
      inquiryType: copy.inquiryType,
      entryPath: window.location.pathname,
      sourceDomain: window.location.hostname,
      // ⚠️ 홈에서만 싣는다. 상세·블로그는 지금까지처럼 서버가 판정하게 둔다 —
      //    기존 경로의 channel 판정을 덮어쓰면 utm 유입 분류가 깨진다.
      ...(isHome ? { channel: 'home' } : {}),
      company,
      // 특정 키만 고르지 않는다 — 네이버 광고 파라미터·utm 해석은 서버 몫이고,
      // 새 파라미터가 생겨도 이 코드는 그대로 둘 수 있다.
      query: Object.fromEntries(new URLSearchParams(window.location.search)),
      leadRef: leadRefRef.current,
    };

    let outcome: PostOutcome = 'failed';
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) await sleep(RETRY_DELAYS[attempt - 1]);
      try {
        outcome = await postLead(payload);
      } catch {
        outcome = 'failed';
      }
      if (outcome !== 'failed') break; // 서버가 판정을 내렸으면 재시도는 의미가 없다
    }

    setSending(false);

    if (outcome === 'recorded' || outcome === 'silent-drop') {
      lsRemove(draftKey);
      lsRemove(pendingKey);
      // §5-3: 실제로 기록된 건만 전환으로 센다.
      // ⚠️ silent-drop 은 허니팟(봇)이다 — 성공 화면은 보여주되 전환에는 넣지 않는다.
      if (outcome === 'recorded') {
        trackLeadSubmit('body', { site_slug: siteSlug, lifecycle_stage: lifecycleStage });
      }
      setDone(true);
      return;
    }

    // 접수된 것처럼 안내하지 않는다.
    // rejected 는 재전송해도 같은 결과라 보관하지 않고, failed 만 다음 방문에 조용히 재전송한다.
    if (outcome === 'failed') lsSet(pendingKey, JSON.stringify(payload));
    setSendError('전송에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }

  // 엔드포인트가 없으면 폼만 덩그러니 보이고 제출이 실패하는 상태가 되므로 아예 렌더하지 않는다.
  if (!ENDPOINT) return null;

  // 강조는 2px 테두리 하나로만 준다. 배경은 다른 카드와 같은 --bg-surface 를 유지한다.
  // (그라디언트·그림자·애니메이션 없음. 빨강 계열도 쓰지 않는다 — 경고로 읽힌다.)
  const shell: CSSProperties = {
    background: 'var(--bg-surface)',
    border: '2px solid var(--kd-accent-border)',
    borderRadius: 'var(--radius-card)',
    overflow: 'hidden',
    margin: '2rem 0',
  };

  // s-v2: 성공 화면의 '추가 정보 보내기'(2차 POST)는 제거했다.
  //   fn_insert_lead 가 dedupe_key 충돌 시 inquiry_count 를 올리고 status 를 new 로 되돌린다.
  //   같은 이름·전화로 한 번 더 보내면 선택 입력을 성실히 채운 리드가 전부 '재문의' 로 기록되고,
  //   재문의 카운터는 관심도 신호라 오염되면 복구가 안 된다.
  //   생년월일·희망타입은 상담 통화에서 받는다. 복구 순서는 LeadPayload.leadRef 주석 참조.
  if (done) {
    return (
      <section id={LEAD_FORM_ID} style={shell}>
        <p
          style={{
            fontSize: 'var(--fs-sm)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.7,
            margin: 0,
            padding: '20px 14px',
          }}
        >
          신청이 접수되었습니다. 확인 후 순차적으로 안내드리겠습니다.
        </p>
      </section>
    );
  }

  return (
    <section id={LEAD_FORM_ID} style={shell}>
      <style>{`
        .kd-lead-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
        @media (max-width: 480px) { .kd-lead-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>

      {/* 상단 라벨 밴드 */}
      <div
        style={{
          background: 'var(--kd-accent-bg)',
          color: 'var(--kd-accent)',
          fontSize: 'var(--fs-sm)',
          fontWeight: 500,
          padding: '7px 14px',
          borderBottom: '1px solid var(--kd-accent-border)',
        }}
      >
        {copy.band}
      </div>

      <div style={{ padding: '14px' }}>
        <SectionHeader eyebrow="CONTACT" title={copy.cta} />
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 14px' }}>
          {variant === 'blog' && siteName
            ? `이 글에서 다룬 ${siteName}의 분양 정보를 담당자가 안내해 드립니다.`
            : copy.lede}
        </p>

        <form onSubmit={handleSubmit} noValidate style={{ position: 'relative' }}>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="kd-lead-name" style={labelStyle}>이름</label>
            <input
              id="kd-lead-name"
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
              }}
              placeholder="홍길동"
              autoComplete="name"
              style={fieldStyle}
            />
            {errors.name && <p style={errorStyle}>{errors.name}</p>}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="kd-lead-phone" style={labelStyle}>연락처</label>
            <input
              id="kd-lead-phone"
              ref={phoneRef}
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="010-1234-5678"
              autoComplete="tel"
              style={fieldStyle}
            />
            {errors.phone && <p style={errorStyle}>{errors.phone}</p>}
          </div>

          {/* C-4 관심 지역 — 홈에서만, 그리고 필수다.
              ⚠️ 상세·블로그에는 렌더하지 않는다. 그쪽은 현장이 곧 지역이라
                 사용자에게 다시 묻는 칸이 되고, 폼만 길어진다. */}
          {needsRegion && (
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="kd-lead-region" style={labelStyle}>관심 지역</label>
              <select
                id="kd-lead-region"
                value={homeRegion}
                onChange={e => {
                  setHomeRegion(e.target.value);
                  if (errors.homeRegion) setErrors(prev => ({ ...prev, homeRegion: undefined }));
                }}
                style={fieldStyle}
              >
                <option value="">선택해 주세요</option>
                {homeRegions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {errors.homeRegion
                ? <p style={errorStyle}>{errors.homeRegion}</p>
                : <p style={hintStyle}>담당자가 해당 지역 현장으로 안내해 드립니다</p>}
            </div>
          )}

          {/* v6-1: 생년월일·희망타입 복원. state·payload·DB 컬럼·시트 전송은 계속 살아 있었고
               입력칸만 s-v2 B-7 에서 빠져 있었다. 화면은 어느 현장에서나 같은 4칸이다. */}
          <div className="kd-lead-grid" style={{ marginBottom: 12 }}>
            <div>
              <label htmlFor="kd-lead-birth" style={labelStyle}>생년월일</label>
              <input
                id="kd-lead-birth"
                type="text"
                inputMode="numeric"
                value={birthDate}
                onChange={e => {
                  setBirthDate(onlyDigits(e.target.value).slice(0, 6));
                  if (errors.birthDate) setErrors(prev => ({ ...prev, birthDate: undefined }));
                }}
                placeholder="920502"
                maxLength={6}
                autoComplete="bday"
                style={fieldStyle}
              />
              {errors.birthDate && <p style={errorStyle}>{errors.birthDate}</p>}
            </div>

            <div>
              <label htmlFor="kd-lead-type" style={labelStyle}>희망 타입</label>
              <select
                id="kd-lead-type"
                value={desiredType}
                onChange={e => setDesiredType(e.target.value)}
                style={fieldStyle}
              >
                {typeChoices.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {hasSiteTypes && <p style={hintStyle}>이 현장 공급 평형</p>}
            </div>
          </div>

          {/* 허니팟 — 사람에게는 보이지 않는다 */}
          <input
            type="text"
            name="company"
            value={company}
            onChange={e => setCompany(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={honeypotStyle}
          />

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={consent}
                onChange={e => {
                  setConsent(e.target.checked);
                  if (errors.consent) setErrors(prev => ({ ...prev, consent: undefined }));
                }}
                style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, accentColor: 'var(--brand)' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <span style={{ ...badgeBase, background: 'var(--error-bg)', color: 'var(--error)' }}>필수</span>
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ color: 'var(--text-link)', textDecoration: 'underline' }}
                >
                  개인정보 수집·이용 동의
                </a>
              </span>
            </label>
            {errors.consent && <p style={errorStyle}>{errors.consent}</p>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={marketingOk}
                onChange={e => setMarketingOk(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, accentColor: 'var(--brand)' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <span style={{ ...badgeBase, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>선택</span>
                분양 정보 문자 수신 동의
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={sending}
            className="kd-btn kd-btn-primary"
            style={{
              width: '100%',
              height: 'var(--btn-h)',
              fontSize: 'var(--fs-sm)',
              borderRadius: 'var(--radius-sm)',
              opacity: sending ? 0.6 : 1,
              cursor: sending ? 'default' : 'pointer',
            }}
          >
            {sending ? '전송 중…' : '신청하기'}
          </button>

          {sendError && <p style={{ ...errorStyle, marginTop: 8 }}>{sendError}</p>}

        </form>
      </div>
    </section>
  );
}
