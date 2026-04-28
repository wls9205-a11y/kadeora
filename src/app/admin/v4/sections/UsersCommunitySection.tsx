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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #fff)', margin: 0 }}>
          👥 사용자 & 커뮤니티
        </h2>
        <a href="/admin/users" style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 700,
          padding: '6px 10px', borderRadius: 6,
          background: 'var(--bg-surface, #1a1b22)', color: 'var(--text-secondary, #ccc)',
          border: '1px solid var(--border, #2a2b35)', textDecoration: 'none',
        }}>유저 상세 보기 →</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <AdminKPI label="누적 회원" value={(data.total ?? 0).toLocaleString()} />
        <AdminKPI label="7일 신규" value={data.new_7d ?? 0} />
        <AdminKPI label="7일 활성" value={data.active_7d ?? 0} />
        <AdminKPI
          label="푸시 구독률"
          value={`${pushPct}%`}
          delta={`${data.push_subs ?? 0}/${data.push_users ?? 0}`}
          deltaColor="tertiary"
          health={pushHealth}
        />
      </div>

      <div style={subTitleStyle}>활동 (오늘 / 7일)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <AdminKPI label="오늘 게시" value={data.posts_today ?? 0} delta={`7일 ${data.posts_7d ?? 0}`} />
        <AdminKPI label="오늘 댓글" value={data.comments_today ?? 0} delta={`7일 ${data.comments_7d ?? 0}`} />
      </div>

      <div style={subTitleStyle}>7일 공유</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(70px, 1fr))', gap: 6, fontSize: 11 }}>
        {[
          { k: 'total', label: '전체',   v: share.total ?? 0 },
          { k: 'kakao', label: '카카오', v: share.kakao ?? 0 },
          { k: 'naver', label: '네이버', v: share.naver ?? 0 },
          { k: 'daum',  label: '다음',   v: share.daum  ?? 0 },
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
