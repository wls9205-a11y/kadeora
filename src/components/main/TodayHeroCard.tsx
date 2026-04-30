// s220 메인 v5: TodayHeroCard — TODAY 헤로 (BIG_EVENT/EXPIRING/NEWS adaptive) (server)
import Link from 'next/link';
import type { MainBigEvent } from './types';

interface Props {
  event: MainBigEvent | null;
}

const BADGES: Record<MainBigEvent['type'], { label: string; bg: string; color: string }> = {
  BIG_EVENT: { label: '🔥 BIG EVENT', bg: 'rgba(220,38,38,0.15)', color: '#dc2626' },
  EXPIRING: { label: '⏰ 마감 임박', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  NEWS: { label: '📰 오늘의 소식', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
};

export default function TodayHeroCard({ event }: Props) {
  if (!event) {
    return (
      <section
        style={{
          marginBottom: 20,
          padding: 18,
          borderRadius: 16,
          border: '0.5px solid var(--border)',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.08))',
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', letterSpacing: '0.5px', marginBottom: 8 }}>
          📍 TODAY
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, lineHeight: 1.25, letterSpacing: '-0.4px' }}>
          지금 한눈에 보기
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '6px 0 0', lineHeight: 1.4 }}>
          전국 청약·시세·재개발 정보를 매일 갱신합니다.
        </p>
      </section>
    );
  }

  const badge = BADGES[event.type] ?? BADGES.NEWS;
  return (
    <section
      style={{
        marginBottom: 20,
        borderRadius: 16,
        border: '0.5px solid var(--border)',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          height: 160,
          background: event.image_url
            ? '#0a0a0a'
            : 'linear-gradient(135deg, #4f46e5, #9333ea, #ec4899)',
          position: 'relative',
        }}
      >
        {event.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.image_url}
            alt={event.title}
            width={480}
            height={160}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        <span
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            padding: '5px 10px',
            borderRadius: 'var(--radius-sm)',
            background: badge.bg,
            color: badge.color,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.3px',
            border: `0.5px solid ${badge.color}`,
            backdropFilter: 'blur(8px)',
          }}
        >
          {badge.label}
        </span>
      </div>

      <div style={{ padding: 16 }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.3,
            letterSpacing: '-0.4px',
            wordBreak: 'keep-all',
          }}
        >
          {event.title}
        </h2>
        {event.subtitle && (
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-tertiary)',
              margin: '6px 0 0',
              lineHeight: 1.45,
              wordBreak: 'keep-all',
            }}
          >
            {event.subtitle}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Link
            href={event.cta_href}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 40,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--brand)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              letterSpacing: '-0.2px',
            }}
          >
            {event.cta_label}
          </Link>
          <Link
            href={`/login?next=/track/big-event/${event.id}&cta=today_alert_cta`}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 40,
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              border: '0.5px solid var(--border)',
            }}
          >
            🔔 알림 켜기
          </Link>
        </div>
      </div>
    </section>
  );
}
