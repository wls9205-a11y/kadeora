/**
 * 통합 행동 분석 유틸
 * 
 * 모든 유저 행동을 user_events 테이블에 기록
 * - 비로그인: visitor_id (localStorage UUID)
 * - 로그인: visitor_id + user_id
 * - 세션: 30분 무활동 시 새 세션
 * 
 * 이벤트 대분류:
 *   page_view    — 페이지 진입
 *   page_leave   — 페이지 이탈 (체류시간 포함)
 *   scroll       — 스크롤 깊이 (25%, 50%, 75%, 100%)
 *   click        — 버튼/링크/탭 클릭
 *   cta          — CTA 노출/클릭
 *   search       — 검색 실행
 *   feature      — 기능 사용 (계산기, 북마크, 관심등록 등)
 *   share        — 공유
 *   download     — 데이터 다운로드
 *   error        — 에러 발생
 *   signup       — 가입 관련 퍼널
 */

// ═══ 식별자 관리 ═══

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('kd_visitor_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('kd_visitor_id', id);
  }
  return id;
}

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30분
  const now = Date.now();
  const lastActivity = parseInt(sessionStorage.getItem('kd_last_activity') || '0');
  let sid = sessionStorage.getItem('kd_session_id');

  if (!sid || (now - lastActivity) > SESSION_TIMEOUT) {
    sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    sessionStorage.setItem('kd_session_id', sid);
  }
  sessionStorage.setItem('kd_last_activity', String(now));
  return sid;
}

function getDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function getPageCategory(path: string): string {
  if (path.startsWith('/apt')) return 'apt';
  if (path.startsWith('/stock')) return 'stock';
  if (path.startsWith('/blog')) return 'blog';
  if (path.startsWith('/feed')) return 'feed';
  if (path.startsWith('/calc')) return 'calc';
  if (path.startsWith('/daily')) return 'daily';
  if (path.startsWith('/discuss')) return 'discuss';
  if (path.startsWith('/search')) return 'search';
  if (path === '/') return 'home';
  return 'other';
}

// ═══ 이벤트 전송 ═══

interface TrackEvent {
  event_type: string;
  event_name: string;
  page_path?: string;
  page_category?: string;
  referrer?: string;
  properties?: Record<string, any>;
  duration_ms?: number;
}

const EVENT_QUEUE: TrackEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function enqueue(event: TrackEvent) {
  EVENT_QUEUE.push(event);
  // 3개 모이거나 2초 후 일괄 전송
  if (EVENT_QUEUE.length >= 3) {
    flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flush, 2000);
  }
}

function flush() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (EVENT_QUEUE.length === 0) return;

  const events = EVENT_QUEUE.splice(0, EVENT_QUEUE.length);
  const payload = JSON.stringify({
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    device_type: getDeviceType(),
    screen_width: typeof window !== 'undefined' ? window.innerWidth : null,
    events,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/events', new Blob([payload], { type: 'application/json' }));
  } else {
    fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }
}

// 페이지 이탈 시 남은 이벤트 전송
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

// ═══ 공개 API ═══

/** 범용 이벤트 추적 */
export function track(eventType: string, eventName: string, properties?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  enqueue({
    event_type: eventType,
    event_name: eventName,
    page_path: window.location.pathname,
    page_category: getPageCategory(window.location.pathname),
    properties,
  });
}

/** 페이지 진입 */
export function trackPageView(path?: string) {
  const p = path || (typeof window !== 'undefined' ? window.location.pathname : '');
  enqueue({
    event_type: 'page_view',
    event_name: 'enter',
    page_path: p,
    page_category: getPageCategory(p),
    referrer: typeof document !== 'undefined' ? document.referrer : undefined,
  });
}

/** 페이지 이탈 (체류 시간 포함) */
export function trackPageLeave(durationMs: number) {
  if (typeof window === 'undefined') return;
  enqueue({
    event_type: 'page_view',
    event_name: 'leave',
    page_path: window.location.pathname,
    page_category: getPageCategory(window.location.pathname),
    duration_ms: durationMs,
  });
}

/** 스크롤 깊이 (25/50/75/100) */
export function trackScroll(depth: number) {
  if (typeof window === 'undefined') return;
  enqueue({
    event_type: 'scroll',
    event_name: `depth_${depth}`,
    page_path: window.location.pathname,
    page_category: getPageCategory(window.location.pathname),
    properties: { depth },
  });
}

/** 클릭 추적 */
export function trackClick(target: string, properties?: Record<string, any>) {
  track('click', target, properties);
}

/** CTA 추적 (기존 trackConversion 대체 가능) */
export function trackCTA(action: 'view' | 'click' | 'dismiss', ctaName: string, properties?: Record<string, any>) {
  track('cta', `${action}_${ctaName}`, { cta_name: ctaName, action, ...properties });
  // 기존 호환: 가입 귀속용
  if (action === 'click' && typeof window !== 'undefined') {
    try { localStorage.setItem('kd_last_cta', ctaName); } catch {}
  }
  // conversion_events에도 동시 전송 — 어드민 GrowthTab/FocusTab 통합
  // s196: click 은 navigation 직후 발사되는 경우가 많아 sendBeacon 이 race 로
  //  drop 되는 케이스 발견 (apt_alert_cta 315 views / 0 clicks 등). click 은
  //  fetch + keepalive 로 flush 보장 (브라우저가 navigation 동안에도 완료),
  //  view 는 sendBeacon 우선 (가벼운 fire-and-forget).
  if ((action === 'view' || action === 'click') && typeof window !== 'undefined') {
    const eventType = action === 'view' ? 'cta_view' : 'cta_click';
    const body = JSON.stringify({
      event_type: eventType,
      cta_name: ctaName,
      category: properties?.category || null,
      page_path: properties?.page_path || window.location.pathname,
      visitor_id: getVisitorId(),
      device_type: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      referrer_source: document.referrer ? (() => { try { return new URL(document.referrer).hostname; } catch { return null; } })() : null,
    });
    try {
      if (action === 'click') {
        // keepalive 가 navigation 중에도 request 를 살린다.
        fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
      } else if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
      }
    } catch {}
  }
}

/** 기능 사용 추적 */
export function trackFeature(featureName: string, properties?: Record<string, any>) {
  track('feature', featureName, properties);
}

/** 다운로드 추적 */
export function trackDownload(fileName: string, format?: string) {
  track('download', fileName, { format });
}

/** 에러 추적 */
export function trackError(errorType: string, message?: string) {
  track('error', errorType, { message });
}

/** 탭 전환 추적 */
export function trackTab(tabName: string, section?: string) {
  track('click', 'tab_switch', { tab: tabName, section });
}

/** 검색 추적 (확장) */
export function trackSearch(query: string, resultsCount: number, category?: string) {
  track('search', 'execute', { query, results_count: resultsCount, category });
}
