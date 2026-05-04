'use client';
import { useCallback, useEffect, useState } from 'react';

const REMIND_TITLE = '카더라 마케팅 동의 재확인';
const REMIND_BODY =
  '안녕하세요. 카더라 마케팅 정보 수신 동의가 곧 만료됩니다 (개인정보보호법 2년). 계속 받아보시려면 마이페이지 > 알림 설정에서 재동의 부탁드립니다.';

export default function ConsentExpiryAlerts() {
  const [expiring, setExpiring] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/marketing/kakao/funnel', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`http ${r.status}`);
        const j = await r.json();
        setExpiring(typeof j?.expiring_soon === 'number' ? j.expiring_soon : 0);
      })
      .catch(() => setExpiring(null));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (expiring == null || expiring <= 0) return null;

  const onSend = async () => {
    if (busy) return;
    if (!confirm(`${expiring}명에게 재확인 메시지를 발송할까요?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/marketing/kakao/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: REMIND_TITLE,
          body: REMIND_BODY,
          message_type: 'info',
          target: 'expiring_soon',
          segment_name: 'consent_expiry_remind',
        }),
      });
      if (!r.ok) throw new Error(`http ${r.status}`);
      const j = await r.json();
      setMsg(`발송 완료 — 배달 ${j?.delivered ?? 0}명`);
      load();
    } catch (e) {
      setMsg('실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      style={{
        padding: 12,
        borderRadius: 'var(--radius-md, 10px)',
        background: 'rgba(245,158,11,0.10)',
        border: '1px solid rgba(245,158,11,0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>
        ⚠ {expiring.toLocaleString()}명이 14일 안에 마케팅 동의 2년 만료
      </span>
      <button
        onClick={onSend}
        disabled={busy}
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: '6px 12px',
          borderRadius: 6,
          cursor: busy ? 'wait' : 'pointer',
          background: '#f59e0b',
          color: '#1a1a1a',
          border: '1px solid #f59e0b',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? '발송 중…' : '재확인 메시지 발송'}
      </button>
      {msg && <span style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>{msg}</span>}
    </section>
  );
}
