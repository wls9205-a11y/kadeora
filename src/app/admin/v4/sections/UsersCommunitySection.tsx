'use client';
import React from 'react';
import AdminKPI from '../components/AdminKPI';

interface Props {
  data: {
    total?: number;
    new_7d?: number;
    active_7d?: number;
    push_subs?: number;
    push_users?: number;
    share_7d?: { kakao?: number; naver?: number; daum?: number; total?: number };
    posts_today?: number;
    comments_today?: number;
    posts_7d?: number;
    comments_7d?: number;
  };
}

export default function UsersCommunitySection({ data }: Props) {
  const pushPct = (data.push_users && data.push_subs != null)
    ? Math.round((data.push_subs / Math.max(1, data.push_users)) * 1000) / 10
    : 0;
  const pushHealth = pushPct >= 10 ? 'ok' : pushPct >= 5 ? 'warn' : 'critical';

  const share = data.share_7d ?? {};
  const subTitleStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary, #888)',
    textTransform: 'uppercase', marginTop: 14, marginBottom: 6, letterSpacing: 0.4,
  };

  return (
    <section style={{
      padding: 16, borderRadius: 'var(--radius-lg, 14px)',
      background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
    }}>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #fff)', marginTop: 0, marginBottom: 10 }}>
        👥 Users & Community
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <AdminKPI label="누적 회원" value={(data.total ?? 0).toLocaleString()} />
        <AdminKPI label="신규 7d" value={data.new_7d ?? 0} />
        <AdminKPI label="active 7d" value={data.active_7d ?? 0} />
        <AdminKPI
          label="push 구독률"
          value={`${pushPct}%`}
          delta={`${data.push_subs ?? 0}/${data.push_users ?? 0}`}
          deltaColor="tertiary"
          health={pushHealth}
        />
      </div>

      <div style={subTitleStyle}>활동 (today / 7d)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <AdminKPI label="posts today" value={data.posts_today ?? 0} delta={`7d ${data.posts_7d ?? 0}`} />
        <AdminKPI label="comments today" value={data.comments_today ?? 0} delta={`7d ${data.comments_7d ?? 0}`} />
      </div>

      <div style={subTitleStyle}>공유 7d</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(70px, 1fr))', gap: 6, fontSize: 11 }}>
        {[
          { k: 'total', label: 'total',  v: share.total ?? 0 },
          { k: 'kakao', label: 'kakao',  v: share.kakao ?? 0 },
          { k: 'naver', label: 'naver',  v: share.naver ?? 0 },
          { k: 'daum',  label: 'daum',   v: share.daum  ?? 0 },
        ].map(it => (
          <div key={it.k} style={{
            padding: '8px 10px', borderRadius: 6,
            background: 'var(--bg-surface, #1a1b22)', border: '1px solid var(--border, #2a2b35)',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <span style={{ color: 'var(--text-tertiary, #888)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>{it.label}</span>
            <strong style={{ fontSize: 14, color: 'var(--text-primary, #fff)' }}>{it.v}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
