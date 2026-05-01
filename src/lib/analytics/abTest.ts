// s222: A/B 테스트 클라이언트 헬퍼.
// - getVariant: 사용자별 deterministic 50/50 배정 (visitor_id 해시)
// - trackAbView / trackAbClick: keepalive fetch (sendBeacon 우선, 실패 시 fetch)

const VISITOR_KEY = 'kd_visitor_id';

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `v_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch { return ''; }
}

// 32-bit FNV-1a 해시 — deterministic, fast, no crypto deps
function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * 사용자에게 variant 배정 (같은 user 는 항상 같은 variant).
 * 기본 50/50 A/B. variants 배열로 N-way 도 가능.
 */
export function getVariant(experimentName: string, variants: string[] = ['A', 'B']): string {
  const vid = getVisitorId();
  const h = hash32(`${experimentName}:${vid}`);
  return variants[h % variants.length];
}

function send(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/events/ab', new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch('/api/events/ab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch { /* silent */ }
}

export function trackAbView(experimentName: string, variant: string, metadata?: Record<string, unknown>): void {
  send({
    experiment_name: experimentName,
    variant,
    event_type: 'view',
    visitor_id: getVisitorId(),
    page_path: typeof window !== 'undefined' ? window.location.pathname : null,
    metadata: metadata ?? null,
  });
}

export function trackAbClick(experimentName: string, variant: string, metadata?: Record<string, unknown>): void {
  send({
    experiment_name: experimentName,
    variant,
    event_type: 'click',
    visitor_id: getVisitorId(),
    page_path: typeof window !== 'undefined' ? window.location.pathname : null,
    metadata: metadata ?? null,
  });
}

export function trackAbConvert(experimentName: string, variant: string, metadata?: Record<string, unknown>): void {
  send({
    experiment_name: experimentName,
    variant,
    event_type: 'convert',
    visitor_id: getVisitorId(),
    page_path: typeof window !== 'undefined' ? window.location.pathname : null,
    metadata: metadata ?? null,
  });
}
