'use client';

// S4 P0 — 관심 현장 알림 신청 폼.
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
import type { CSSProperties, FormEvent } from 'react';

const ENDPOINT = process.env.NEXT_PUBLIC_LEAD_ENDPOINT || '';
const DRAFT_PREFIX = 'kd_lead_draft:';
const PENDING_PREFIX = 'kd_lead_pending:';
// 최초 1회 즉시 전송 후, 실패하면 이 간격만큼 쉬고 재시도 (총 3회 재시도)
const RETRY_DELAYS = [300, 900, 2700];

type LeadFormProps = {
  siteSlug: string; // apt_sites.slug — leads ↔ apt_sites 조인 키
  siteName: string; // apt_sites.name
};

type LeadPayload = {
  name: string;
  phone: string;
  consent: boolean;
  marketingOk: boolean;
  dwellMs: number;
  siteSlug: string;
  siteName: string;
  entryPath: string;
  sourceDomain: string;
  company: string;
  query: Record<string, string>;
};

type FieldErrors = { name?: string; phone?: string; consent?: string };

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

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

const inputStyle: CSSProperties = {
  width: '100%',
  height: 'var(--btn-h)',
  padding: '0 12px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border)',
  background: 'var(--bg-base)',
  color: 'var(--text-primary)',
  fontSize: 'var(--fs-sm)',
  outline: 'none',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 'var(--fs-xs)',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 6,
};

// 13px + --error. 스펙의 --text-danger 는 globals.css 에 없는 이름이라 그대로 쓰면
// 값이 없어 조용히 상속색으로 렌더된다 (Rule #94). 실재 토큰은 --error (#DC2626).
const errorStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--error)',
  lineHeight: 1.5,
  margin: '4px 0 0',
};

const badgeBase: CSSProperties = {
  flexShrink: 0,
  padding: '1px 6px',
  borderRadius: 'var(--radius-pill)',
  fontSize: 11,
  fontWeight: 700,
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

export default function LeadForm({ siteSlug, siteName }: LeadFormProps) {
  const mountedAt = useRef(Date.now());
  const draftKey = `${DRAFT_PREFIX}${siteSlug}`;
  const pendingKey = `${PENDING_PREFIX}${siteSlug}`;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [marketingOk, setMarketingOk] = useState(false);
  const [company, setCompany] = useState(''); // 허니팟
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 복원이 끝나기 전에 저장 effect 가 돌면 빈 값으로 초안을 덮어쓴다.
  const restored = useRef(false);

  // 임시 보관 복원
  useEffect(() => {
    const raw = lsGet(draftKey);
    if (raw) {
      try {
        const d = JSON.parse(raw) as Partial<LeadPayload>;
        if (typeof d.name === 'string') setName(d.name);
        if (typeof d.phone === 'string') setPhone(d.phone);
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
    lsSet(draftKey, JSON.stringify({ name, phone, consent, marketingOk }));
  }, [draftKey, name, phone, consent, marketingOk]);

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

  const validate = useCallback((): FieldErrors => {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = '이름을 입력해 주세요.';
    if ((phone.match(/\d/g) || []).length < 9) next.phone = '연락처를 정확히 입력해 주세요.';
    if (!consent) next.consent = '개인정보 수집·이용에 동의해 주세요.';
    return next;
  }, [name, phone, consent]);

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

    const payload: LeadPayload = {
      name,
      phone, // 원본 그대로. 정규화는 서버가 한다
      consent,
      marketingOk,
      dwellMs: Date.now() - mountedAt.current, // 3초 미만 판정은 서버가 한다 — 여기서 막지 않는다
      siteSlug,
      siteName,
      entryPath: window.location.pathname,
      sourceDomain: window.location.hostname,
      company,
      // 특정 키만 고르지 않는다 — 네이버 광고 파라미터·utm 해석은 서버 몫이고,
      // 새 파라미터가 생겨도 이 코드는 그대로 둘 수 있다.
      query: Object.fromEntries(new URLSearchParams(window.location.search)),
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

  if (done) {
    return (
      <section
        className="apt-card"
        style={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '20px 14px' }}
      >
        <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.7, margin: 0 }}>
          신청이 접수되었습니다. 확인 후 순차적으로 안내드리겠습니다.
        </p>
      </section>
    );
  }

  return (
    <section
      className="apt-card"
      style={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--border)', padding: '16px 14px' }}
    >
      <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
        관심 현장 알림 신청
      </h2>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 14px' }}>
        {siteName}의 분양가·일정 변동을 가장 먼저 알려드립니다.
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
            autoComplete="name"
            style={inputStyle}
          />
          {errors.name && <p style={errorStyle}>{errors.name}</p>}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label htmlFor="kd-lead-phone" style={labelStyle}>연락처</label>
          <input
            id="kd-lead-phone"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={e => {
              setPhone(e.target.value);
              if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined }));
            }}
            autoComplete="tel"
            style={inputStyle}
          />
          {errors.phone && <p style={errorStyle}>{errors.phone}</p>}
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

        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6, margin: '10px 0 0' }}>
          작성 내용은 전송 성공 전까지 기기에 임시 보관됩니다
        </p>
      </form>
    </section>
  );
}
