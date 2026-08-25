'use client';

// ADDENDUM §2 — DART 정비사업 검수 큐 화면.
//
// 조감도 큐(V9)와 같은 패턴: 좌 공시 / 우 매칭 후보 / 버튼 2개.
// 목표는 3초에 한 건이다. 판단에 필요한 것만 두고 나머지는 뺀다.
//
// ⚠️ 큐가 0건인 날이 정상이다(진짜 정비사업 공시는 하루 1~2건). 그래서 처리 이력
//    (승인·반려)도 탭으로 본다 — 규칙을 고칠 때 근거가 되는 건 처리된 건들이다.

import { useCallback, useEffect, useState } from 'react';

type SiteOption = { id: string; slug: string; name: string; builder: string | null; zone: string };

type QueueItem = {
  id: number;
  rcept_no: string;
  corp_name: string | null;
  report_nm: string | null;
  source_url: string | null;
  filed_at: string | null;
  zone_candidates: string[] | null;
  reason: string | null;
  proposed_stage: string | null;
  status: string;
  reviewed_by: string | null;
  note: string | null;
  resolved_at: string | null;
  created_at: string;
  site_options: SiteOption[];
  resolved_site: { slug: string; name: string; lifecycle_stage: string | null } | null;
};

const TABS = [
  { key: 'pending', label: '대기' },
  { key: 'approved', label: '승인' },
  { key: 'rejected', label: '반려' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/**
 * 경과 시간.
 * ⚠️ 기준은 created_at(수집 시각)이다. filed_at 은 DART rcept_dt 라 **날짜만** 있고
 *    항상 00:00 이라 분 단위를 못 잰다 — 그걸로 재면 늘 "몇 시간"이 나온다.
 */
function elapsed(fromIso: string, toIso?: string | null): string {
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  const min = Math.max(0, Math.round((to - from) / 60000));
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 ${min % 60}분`;
  return `${Math.floor(h / 24)}일 ${h % 24}시간`;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '—');

export default function ReviewQueueClient() {
  const [tab, setTab] = useState<TabKey>('pending');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [picked, setPicked] = useState<Record<number, string>>({});

  const load = useCallback(async (t: TabKey) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/redev-review?status=${t}&limit=30`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setItems(json.items ?? []);
      setCounts(json.counts ?? {});
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(tab); }, [tab, load]);

  async function act(item: QueueItem, action: 'approve' | 'reject') {
    const siteId = picked[item.id] ?? item.site_options[0]?.id;
    if (action === 'approve' && !siteId) {
      setErr('반영할 현장을 고르세요. 후보가 없으면 반려하거나 이름을 먼저 붙여야 합니다.');
      return;
    }
    setBusyId(item.id);
    setErr(null);
    try {
      const res = await fetch('/api/admin/redev-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, action, site_id: action === 'approve' ? siteId : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      // ⚠️ 잠긴 현장이면 단계가 안 바뀐다. "반영됨" 으로 잘못 안내하지 않는다.
      if (json.locked) setErr(`${json.slug} 는 stage_locked 라 단계를 바꾸지 않았습니다. 큐만 닫혔습니다.`);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      setCounts((c) => ({ ...c, pending: Math.max(0, (c.pending ?? 1) - 1), [action === 'approve' ? 'approved' : 'rejected']: (c[action === 'approve' ? 'approved' : 'rejected'] ?? 0) + 1 }));
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--sp-lg)' }}>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, margin: '0 0 4px' }}>정비사업 공시 검수</h1>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>
        자동 반영이 확신하지 못한 DART 공급계약 공시입니다. 승인하면 해당 현장이 <b>시공사 선정</b>으로 바뀝니다.
        <br />
        경과 시간 기준은 <b>수집 시각</b>입니다 — DART 접수일자는 날짜만 있어 분 단위를 잴 수 없습니다.
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '7px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              border: tab === t.key ? '1px solid var(--brand)' : '1px solid var(--border)',
              background: tab === t.key ? 'var(--brand)' : 'transparent',
              color: tab === t.key ? '#fff' : 'var(--text-primary)',
              fontSize: 'var(--fs-sm)', fontWeight: 700,
            }}
          >
            {t.label} {counts[t.key] ?? 0}
          </button>
        ))}
      </div>

      {err && (
        <div style={{ padding: 10, borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 'var(--fs-sm)', marginBottom: 12 }}>
          {err}
        </div>
      )}

      {loading && <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>불러오는 중…</p>}

      {!loading && items.length === 0 && (
        <div style={{ padding: 20, border: '1px dashed var(--border)', borderRadius: 'var(--radius-card)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {tab === 'pending'
            ? '대기 중인 건이 없습니다. 진짜 정비사업 공시는 하루 1~2건이라 비어 있는 게 정상입니다 — 철도·인프라 공급계약은 1차 필터가 걸러 여기까지 오지 않습니다.'
            : '해당하는 이력이 없습니다.'}
        </div>
      )}

      {items.map((item) => {
        const zones = item.zone_candidates ?? [];
        const chosen = picked[item.id] ?? item.site_options[0]?.id ?? '';
        return (
          <section key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 14, marginBottom: 12, background: 'var(--bg-surface)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="mc-g2">
              {/* 좌 — 공시 */}
              <div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, marginBottom: 4 }}>{item.corp_name ?? '—'}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>{(item.report_nm ?? '').trim() || '—'}</div>

                <div style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                  <div>
                    <b style={{ color: 'var(--text-primary)' }}>구역명 후보</b>{' '}
                    {zones.length > 0
                      ? zones.map((z) => (
                          <span key={z} style={{ display: 'inline-block', padding: '1px 7px', margin: '0 4px 4px 0', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>{z}</span>
                        ))
                      : <span style={{ color: 'var(--accent-yellow)' }}>없음 — 본문에서 구역명을 못 뽑았습니다</span>}
                  </div>
                  <div><b style={{ color: 'var(--text-primary)' }}>사유</b> {item.reason ?? '—'}</div>
                  <div><b style={{ color: 'var(--text-primary)' }}>수집</b> {fmt(item.created_at)} · <b>{elapsed(item.created_at, item.resolved_at)}</b> 경과</div>
                  <div style={{ opacity: 0.75 }}>접수일자(참고) {item.filed_at ? item.filed_at.slice(0, 10) : '—'}</div>
                  {item.resolved_at && <div><b style={{ color: 'var(--text-primary)' }}>처리</b> {fmt(item.resolved_at)}</div>}
                  {item.resolved_site && (
                    <div><b style={{ color: 'var(--text-primary)' }}>반영 현장</b> <a href={`/apt/${item.resolved_site.slug}`} target="_blank" rel="noreferrer">{item.resolved_site.name}</a> ({item.resolved_site.lifecycle_stage ?? '—'})</div>
                  )}
                  {item.source_url && (
                    <div><a href={item.source_url} target="_blank" rel="noreferrer">DART 원문 열기 ↗</a></div>
                  )}
                </div>
              </div>

              {/* 우 — 매칭 후보 + 판정 */}
              <div>
                {item.status === 'pending' ? (
                  <>
                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, marginBottom: 6 }}>매칭 후보 현장</div>
                    {item.site_options.length === 0 ? (
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>
                        이름이 정확히 일치하는 활성 현장이 없습니다.
                        <br />
                        구역명을 <code>name_variants</code> 에 먼저 넣어야 붙습니다 — 여기서는 반려만 가능합니다.
                      </div>
                    ) : (
                      <div style={{ marginBottom: 10 }}>
                        {item.site_options.map((o) => (
                          <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: chosen === o.id ? '1px solid var(--brand)' : '1px solid var(--border)', marginBottom: 6, cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name={`site-${item.id}`}
                              checked={chosen === o.id}
                              onChange={() => setPicked((p) => ({ ...p, [item.id]: o.id }))}
                            />
                            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{o.name}</span>
                            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                              {o.builder ?? '시공사 미상'} · {o.zone} 일치
                            </span>
                          </label>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        disabled={busyId === item.id || item.site_options.length === 0}
                        onClick={() => act(item, 'approve')}
                        style={{ flex: 1, minHeight: 44, borderRadius: 'var(--radius-sm)', border: 'none', background: item.site_options.length === 0 ? 'var(--bg-elevated)' : 'var(--brand)', color: item.site_options.length === 0 ? 'var(--text-tertiary)' : '#fff', fontWeight: 800, fontSize: 'var(--fs-sm)', cursor: item.site_options.length === 0 ? 'not-allowed' : 'pointer' }}
                      >
                        맞음 — 시공사 선정 반영
                      </button>
                      <button
                        disabled={busyId === item.id}
                        onClick={() => act(item, 'reject')}
                        style={{ flex: 1, minHeight: 44, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer' }}
                      >
                        틀림
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <div><b style={{ color: 'var(--text-primary)' }}>상태</b> {item.status}</div>
                    <div><b style={{ color: 'var(--text-primary)' }}>처리자</b> {item.reviewed_by ?? '—'}</div>
                    {item.note && <div><b style={{ color: 'var(--text-primary)' }}>메모</b> {item.note}</div>}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
