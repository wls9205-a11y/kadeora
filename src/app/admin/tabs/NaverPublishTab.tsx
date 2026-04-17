'use client';
import { useState, useEffect, useCallback } from 'react';

interface OAuthStatus {
  provider: string;
  configured: boolean;
  hasRefreshToken: boolean;
  refreshCount: number;
  daysUntilRefreshExpiry: number | null;
  lastRefreshedAt: string | null;
  lastError: string | null;
  metadata: Record<string, any>;
}

interface QueueItem {
  id: number;
  blog_slug: string;
  original_title: string;
  naver_title: string;
  cafe_status: string;
  cafe_article_id: string | null;
  cafe_retry_count: number;
  cafe_error: string | null;
  cafe_published_at: string | null;
  created_at: string;
}

interface ConfigItem {
  value: any;
  description: string;
  updated_at: string;
}

export default function NaverPublishTab() {
  const [providers, setProviders] = useState<OAuthStatus[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [config, setConfig] = useState<Record<string, ConfigItem>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const [form, setForm] = useState({
    provider: 'naver_cafe',
    access_token: '',
    refresh_token: '',
    client_id: '',
    client_secret: '',
    cafeId: '',
    menuId: '',
    expires_in: 3600,
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [oauthRes, queueRes, cfgRes] = await Promise.all([
        fetch('/api/admin/naver-oauth').then(r => r.json()),
        fetch('/api/admin/naver-syndication').then(r => r.json()),
        fetch('/api/admin/config?namespace=naver_cafe').then(r => r.json()).catch(() => ({})),
      ]);
      setProviders(oauthRes.providers || []);
      setQueue(queueRes.items || []);
      setConfig(cfgRes.config || {});
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleSaveOAuth() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/admin/naver-oauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: form.provider,
        access_token: form.access_token,
        refresh_token: form.refresh_token || null,
        client_id: form.client_id || null,
        client_secret: form.client_secret || null,
        metadata: { cafeId: form.cafeId, menuId: form.menuId },
        expires_in: form.expires_in,
      }),
    });
    const data = await r.json();
    setMsg(r.ok ? '✅ 저장 완료' : `❌ ${data.error}`);
    setBusy(false);
    fetchAll();
  }

  async function handleTestPost() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/admin/naver-oauth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'naver_cafe', action: 'test_post' }),
    });
    const data = await r.json();
    setMsg(data.ok
      ? `✅ 테스트 발행 성공! articleId: ${data.articleId} — 카페 가서 한글 확인하세요`
      : `❌ 실패: ${data.error || JSON.stringify(data).slice(0, 200)}`);
    setBusy(false);
    fetchAll();
  }

  async function handleRefresh() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/admin/naver-oauth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'naver_cafe', action: 'refresh' }),
    });
    const data = await r.json();
    setMsg(data.ok ? `✅ 갱신 ${data.refreshed ? '됨' : '안됨 (아직 유효)'}` : `❌ ${data.error || 'failed'}`);
    setBusy(false);
    fetchAll();
  }

  async function handleTriggerCron() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/admin/trigger-cron?path=/api/cron/naver-cafe-publish').then(r => r.json());
    setMsg(`발행 결과: ${JSON.stringify(r).slice(0, 300)}`);
    setBusy(false);
    fetchAll();
  }

  async function handleConfigChange(key: string, value: any) {
    setBusy(true);
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ namespace: 'naver_cafe', key, value }),
    });
    setBusy(false);
    fetchAll();
  }

  async function handleQueueAction(id: number, action: 'retry' | 'skip') {
    await fetch('/api/admin/naver-syndication', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    fetchAll();
  }

  const cafeStatus = providers.find(p => p.provider === 'naver_cafe');
  const pendingCount = queue.filter(q => q.cafe_status === 'pending').length;
  const publishedCount = queue.filter(q => q.cafe_status === 'published').length;
  const failedCount = queue.filter(q => q.cafe_status === 'failed').length;

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>로딩…</div>;

  return (
    <div style={{ padding: '12px 0' }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#E2E8F0', marginBottom: 16 }}>
        🟢 네이버 자동 발행
      </h2>

      {msg && (
        <div style={{ background: msg.startsWith('✅') ? 'rgba(16,185,129,0.1)' : msg.startsWith('❌') ? 'rgba(239,68,68,0.1)' : 'rgba(59,123,246,0.1)',
          border: `1px solid ${msg.startsWith('✅') ? '#10B981' : msg.startsWith('❌') ? '#EF4444' : '#3B7BF6'}`,
          borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#E2E8F0', marginBottom: 12 }}>
          {msg}
        </div>
      )}

      {/* OAuth 상태 카드 */}
      <div className="adm-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong style={{ color: '#E2E8F0', fontSize: 14 }}>OAuth 상태 (naver_cafe)</strong>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
            background: cafeStatus?.configured ? '#10B981' : '#EF4444', color: '#fff', fontWeight: 700 }}>
            {cafeStatus?.configured ? '활성' : '미등록'}
          </span>
        </div>
        {cafeStatus?.configured && (
          <div style={{ fontSize: 11, color: '#94A3B8', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div>refresh_token 만료까지: <strong style={{ color: cafeStatus.daysUntilRefreshExpiry && cafeStatus.daysUntilRefreshExpiry < 30 ? '#F59E0B' : '#10B981' }}>{cafeStatus.daysUntilRefreshExpiry ?? '?'}일</strong></div>
            <div>Refresh 횟수: <strong style={{ color: '#E2E8F0' }}>{cafeStatus.refreshCount}</strong></div>
            <div>마지막 갱신: {cafeStatus.lastRefreshedAt ? new Date(cafeStatus.lastRefreshedAt).toLocaleString('ko-KR') : '없음'}</div>
            <div>cafeId: {cafeStatus.metadata.cafeId} / menuId: {cafeStatus.metadata.menuId}</div>
            {cafeStatus.lastError && <div style={{ gridColumn: '1 / -1', color: '#EF4444' }}>최근 에러: {cafeStatus.lastError}</div>}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <button className="adm-btn" disabled={busy || !cafeStatus?.configured} onClick={handleRefresh}>강제 Refresh</button>
          <button className="adm-btn" disabled={busy || !cafeStatus?.configured} onClick={handleTestPost}>🧪 테스트 발행</button>
          <button className="adm-btn" disabled={busy || !cafeStatus?.configured || pendingCount === 0} onClick={handleTriggerCron}>지금 1건 즉시 발행</button>
        </div>
      </div>

      {/* OAuth 등록 폼 */}
      <details style={{ background: 'rgba(12,21,40,0.6)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <summary style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0', cursor: 'pointer' }}>
          OAuth 등록/갱신 (네이버 개발자센터에서 발급)
        </summary>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            ['access_token', '', 'Bearer ya29...'],
            ['refresh_token', '', '2b2b2...'],
            ['client_id', '', 'ABcdefGhij...'],
            ['client_secret', 'password', '****'],
            ['cafeId', '', '클럽ID (숫자)'],
            ['menuId', '', '게시판 menuId (숫자)'],
          ].map(([key, type, ph]) => (
            <input key={key} type={type || 'text'} placeholder={`${key} — ${ph}`}
              value={(form as any)[key]}
              onChange={e => setForm({ ...form, [key]: e.target.value })}
              style={{ padding: 8, background: '#0a0e27', color: '#E2E8F0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' }} />
          ))}
          <input type="number" placeholder="expires_in (초, 기본 3600)"
            value={form.expires_in}
            onChange={e => setForm({ ...form, expires_in: Number(e.target.value) || 3600 })}
            style={{ padding: 8, background: '#0a0e27', color: '#E2E8F0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, fontSize: 12, gridColumn: '1 / -1' }} />
          <button className="adm-btn" disabled={busy || !form.access_token} onClick={handleSaveOAuth} style={{ gridColumn: '1 / -1', padding: 10 }}>
            저장
          </button>
        </div>
      </details>

      {/* 한도/배치 설정 (DB에서 직접 관리) */}
      <div className="adm-card" style={{ marginBottom: 16 }}>
        <strong style={{ color: '#E2E8F0', fontSize: 13 }}>설정 (app_config: naver_cafe)</strong>
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {Object.entries(config).map(([key, item]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
              <span style={{ fontSize: 11, color: '#94A3B8', flex: 1 }}>{key}</span>
              {typeof item.value === 'boolean' ? (
                <button className="adm-btn" onClick={() => handleConfigChange(key, !item.value)}
                  style={{ background: item.value ? '#10B981' : '#64748B', color: '#fff' }}>
                  {item.value ? 'ON' : 'OFF'}
                </button>
              ) : (
                <input type="number" value={item.value as number}
                  onChange={e => handleConfigChange(key, Number(e.target.value))}
                  style={{ width: 80, padding: 4, background: '#0a0e27', color: '#E2E8F0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, fontSize: 11, textAlign: 'right' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 발행 큐 */}
      <div className="adm-card">
        <strong style={{ color: '#E2E8F0', fontSize: 13 }}>
          발행 큐 — 대기 {pendingCount} · 완료 {publishedCount} · 실패 {failedCount}
        </strong>
        <div style={{ marginTop: 8, maxHeight: 400, overflowY: 'auto' }}>
          {queue.slice(0, 50).map(q => (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
              <span style={{ minWidth: 60, padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, color: '#fff', background: q.cafe_status === 'published' ? '#10B981' : q.cafe_status === 'failed' ? '#EF4444' : '#F59E0B', textAlign: 'center' }}>
                {q.cafe_status}
              </span>
              <span style={{ flex: 1, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.naver_title || q.original_title}</span>
              {q.cafe_retry_count > 0 && <span style={{ color: '#F59E0B' }}>×{q.cafe_retry_count}</span>}
              {q.cafe_status === 'failed' && (
                <button className="adm-btn" onClick={() => handleQueueAction(q.id, 'retry')} style={{ fontSize: 10 }}>재시도</button>
              )}
              {q.cafe_status === 'pending' && (
                <button className="adm-btn" onClick={() => handleQueueAction(q.id, 'skip')} style={{ fontSize: 10 }}>건너뛰기</button>
              )}
              {q.cafe_article_id && (
                <a href={`https://cafe.naver.com/${cafeStatus?.metadata.cafeId}/${q.cafe_article_id}`} target="_blank" rel="noopener" style={{ color: '#3B7BF6', fontSize: 10 }}>보기↗</a>
              )}
            </div>
          ))}
          {queue.length === 0 && <div style={{ color: '#64748B', textAlign: 'center', padding: 20, fontSize: 12 }}>큐가 비어있습니다</div>}
        </div>
      </div>
    </div>
  );
}
