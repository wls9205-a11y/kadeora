import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL as SITE, CONTACT_EMAIL, CONTACT_PHONE, BIZ_NAME, BIZ_OWNER, BIZ_NUMBER } from '@/lib/constants';
import { PRO_PRICING, PRO_FEATURES } from '@/lib/plan-limits';
import ShareButtons from '@/components/ShareButtons';

export const metadata: Metadata = {
  title: '카더라 상점 — 프로 멤버십 · 확성기 · 아이템',
  description: `카더라 프로 멤버십 월 ${PRO_PRICING.monthly.label} — 관심 종목 무제한, AI 분석 주 5건, 급등락 알림, 청약 D-7 알림, 단지 비교, CSV 다운로드. 확성기로 내 글을 전체 유저에게 노출.`,
  alternates: { canonical: `${SITE}/shop` },
  robots: { index: true, follow: true },
  openGraph: {
    title: '카더라 상점 | 프로 멤버십 · 확성기',
    description: '주식+부동산 올인원 프리미엄. 관심 종목 무제한 · AI 분석 · 급등락 알림.',
    url: `${SITE}/shop`, siteName: '카더라', locale: 'ko_KR', type: 'website',
    images: [
      { url: `${SITE}/api/og?title=${encodeURIComponent('프로 멤버십')}&design=2&category=general`, width: 1200, height: 630, alt: '카더라 프로 멤버십' },
      { url: `${SITE}/api/og-square?title=${encodeURIComponent('프로 멤버십')}&category=general`, width: 630, height: 630 },
    ],
  },
  twitter: { card: 'summary_large_image' as const, title: '카더라 프로 멤버십', description: '주식+부동산 올인원 프리미엄' },
  other: { 'naver:author': '카더라', 'og:updated_time': '2026-04-12T00:00:00Z' },
};

const COMPARE = [
  { name: '관심 종목', free: '5개', pro: '무제한' },
  { name: '관심 단지', free: '3개', pro: '무제한' },
  { name: '가격 알림', free: '3개', pro: '20개' },
  { name: '급등락 ±5% 알림', free: '❌', pro: '✅ 실시간' },
  { name: '청약 D-7 사전 알림', free: '❌', pro: '✅' },
  { name: '전세가율 변동 알림', free: '❌', pro: '✅' },
  { name: 'AI 종목 분석', free: '❌', pro: '주 5건' },
  { name: '데일리 리포트', free: '주 1회', pro: '매일 아침' },
  { name: '단지 비교 도구', free: '❌', pro: '✅' },
  { name: '거래 데이터 CSV', free: '❌', pro: '월 10회' },
  { name: '광고', free: '있음', pro: '영구 제거' },
  { name: '프로 배지', free: '❌', pro: '⭐' },
  { name: '프로 전용 토론방', free: '❌', pro: '✅' },
  { name: '1:1 카카오 지원', free: '❌', pro: '✅' },
];

const MEGAPHONES = [
  { id: 'megaphone', name: '확성기 라이트', desc: '공지배너 노출 2회', price: 4900, icon: '📢' },
  { id: 'megaphone_standard', name: '확성기 스탠다드', desc: '공지배너 노출 5회', price: 9900, icon: '📣' },
  { id: 'megaphone_urgent', name: '확성기 프리미엄', desc: '공지배너 노출 10회', price: 19900, icon: '🔊' },
  { id: 'megaphone_premium', name: '확성기 무제한', desc: '3일간 무제한 노출', price: 29900, icon: '🎺' },
];

const UTILITIES = [
  { id: 'nickname_change', name: '닉네임 변경권', desc: '닉네임 1회 변경', price: 9900, icon: '✏️' },
];

const FAQ = [
  { q: '무료 체험 중 해지하면 결제되나요?', a: '아니요. 14일 이내 해지 시 결제 0원입니다. 기존 데이터도 삭제되지 않습니다.' },
  { q: '해지하면 관심 종목이 사라지나요?', a: '아니요. 5개까지는 무료로 유지됩니다. 6번째부터 비활성 처리되며 삭제되지 않습니다.' },
  { q: '결제는 어떻게 하나요?', a: '토스페이먼츠를 통해 카드·간편결제로 안전하게 결제됩니다.' },
  { q: '환불 정책은 어떻게 되나요?', a: '구독 시작 후 7일 이내 미사용 시 전액 환불 가능합니다.' },
  { q: '확성기는 프로 전용인가요?', a: '아니요. 확성기는 모든 유저가 구매 가능한 1회성 아이템입니다.' },
];

function Check() { return <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: '50%', background: 'rgba(52,211,153,0.15)', color: '#34D399', fontSize: 12, lineHeight: '18px', textAlign: 'center', fontWeight: 700 }}>✓</span>; }
function Cross() { return <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: '50%', background: 'rgba(248,113,113,0.1)', color: '#F87171', fontSize: 10, lineHeight: '18px', textAlign: 'center' }}>✕</span>; }
function fmt(n: number) { return n.toLocaleString(); }

export default function ShopPage() {
  return (
    <article style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 80px' }}>

      {/* 브레드크럼 */}
      <nav aria-label="breadcrumb" style={{ display: 'flex', gap: 'var(--sp-xs)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>상점</span>
      </nav>

      {/* ═══════ 섹션 1: 프로 멤버십 ═══════ */}
      <section style={{ marginBottom: 32 }}>
        {/* 히어로 */}
        <div style={{
          padding: '32px 20px', textAlign: 'center',
          background: 'linear-gradient(135deg, #0D1F42 0%, #081228 100%)',
          borderRadius: 'var(--radius-lg)', position: 'relative', overflow: 'hidden', marginBottom: 20,
        }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'repeating-linear-gradient(0deg,#4A9EFF 0,#4A9EFF 1px,transparent 1px,transparent 20px),repeating-linear-gradient(90deg,#4A9EFF 0,#4A9EFF 1px,transparent 1px,transparent 20px)' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>⭐</div>
            <h1 style={{ fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 900, color: '#E8F2FF', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
              프로 멤버십
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
              투자에 쓰는 시간을 절반으로<br/>주식 + 부동산 올인원 프리미엄
            </p>
            <div style={{ marginBottom: 16 }}><ShareButtons title="카더라 프로 멤버십 — 주식+부동산 올인원" contentType="page" contentRef="shop" /></div>

            {/* 가격 카드 2개 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10, marginBottom: 16 }}>
              {/* 월간 */}
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)', padding: '14px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>월간</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#E8F2FF', letterSpacing: '-0.5px' }}>₩{fmt(PRO_PRICING.monthly.price)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>/월 · {PRO_PRICING.monthly.perDay}</div>
              </div>
              {/* 연간 */}
              <div style={{ background: 'rgba(59,123,246,0.08)', border: '1px solid rgba(59,123,246,0.3)', borderRadius: 'var(--radius-md)', padding: '14px 12px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: -8, right: 8, background: 'var(--brand)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 'var(--radius-md)' }}>추천</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>연간</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#E8F2FF', letterSpacing: '-0.5px' }}>₩{fmt(PRO_PRICING.yearly.price)}</div>
                <div style={{ fontSize: 10, color: 'var(--brand)', marginTop: 2 }}>{PRO_PRICING.yearly.perMonth} · {PRO_PRICING.yearly.discount}</div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
              {PRO_PRICING.trial.label}로 먼저 체험해보세요
            </div>
          </div>
        </div>

        {/* 프로 기능 그리드 */}
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>프로가 되면</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, marginBottom: 20 }}>
          {PRO_FEATURES.map(f => (
            <div key={f.title} style={{
              padding: '12px 10px', background: f.highlight ? 'rgba(59,123,246,0.04)' : 'var(--bg-surface)',
              border: `1px solid ${f.highlight ? 'rgba(59,123,246,0.15)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{f.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{f.title}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* 무료 vs 프로 비교 */}
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>무료 vs 프로</h2>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px', padding: '10px 12px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>기능</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textAlign: 'center' }}>무료</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', textAlign: 'center' }}>프로</span>
          </div>
          {COMPARE.map((r, i) => (
            <div key={r.name} style={{
              display: 'grid', gridTemplateColumns: '1fr 70px 70px',
              padding: '8px 12px', borderBottom: i < COMPARE.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
              <span style={{ fontSize: 11, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                {r.free === '❌' ? <Cross /> : r.free === '✅' ? <Check /> : r.free}
              </span>
              <span style={{ fontSize: 11, textAlign: 'center', color: 'var(--brand)', fontWeight: 600 }}>
                {r.pro === '✅' ? <Check /> : r.pro.startsWith('✅') ? <><Check /> <span style={{ fontSize: 10 }}>{r.pro.replace('✅ ', '')}</span></> : r.pro === '❌' ? <Cross /> : r.pro}
              </span>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>자주 묻는 질문</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {FAQ.map(f => (
            <details key={f.q} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <summary style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {f.q} <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8 }}>+</span>
              </summary>
              <div style={{ padding: '0 12px 10px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* ═══════ 섹션 2: 확성기 ═══════ */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>📢 확성기</h2>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 12px' }}>내 글을 공지배너에 올려 전체 유저에게 노출</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {MEGAPHONES.map(m => (
            <Link key={m.id} href={`/shop/megaphone?product=${m.id}`} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', textDecoration: 'none', color: 'inherit',
            }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{m.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{m.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{m.desc}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)', flexShrink: 0 }}>₩{fmt(m.price)}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════ 섹션 3: 유틸리티 ═══════ */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>🛠 유틸리티</h2>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 12px' }}>1회성 아이템</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {UTILITIES.map(u => (
            <div key={u.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{u.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{u.desc}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', flexShrink: 0 }}>₩{fmt(u.price)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 포인트 안내 */}
      <div style={{ padding: '12px 14px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-card)', textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          💡 포인트 적립: 출석(10P) · 글쓰기(10P) · 댓글(5P) · 공유(5P)
        </div>
      </div>

      {/* 정책 링크 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '16px 0 8px', borderTop: '1px solid var(--border)', marginTop: 12 }}>
        <Link href="/terms" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>이용약관</Link>
        <Link href="/refund" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>환불정책</Link>
        <Link href="/privacy" style={{ fontSize: 11, color: 'var(--text-tertiary)', textDecoration: 'none' }}>개인정보처리방침</Link>
      </div>
      <div style={{ textAlign: 'center', padding: '4px 0 16px' }}>
        <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.6 }}>
          상호: {BIZ_NAME} | 대표: {BIZ_OWNER} | 이메일: {CONTACT_EMAIL}<br/>
          전화: {CONTACT_PHONE} | 결제대행: 토스페이먼츠(주)
        </p>
      </div>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Product',
        name: '카더라 프로 멤버십',
        description: '주식+부동산 올인원 프리미엄 — 관심 종목 무제한, AI 분석, 급등락 알림, 단지 비교',
        offers: [
          { '@type': 'Offer', name: '프로 월간', price: '24900', priceCurrency: 'KRW', availability: 'https://schema.org/InStock', url: `${SITE}/shop` },
          { '@type': 'Offer', name: '프로 연간', price: '249000', priceCurrency: 'KRW', availability: 'https://schema.org/InStock', url: `${SITE}/shop` },
        ],
        brand: { '@type': 'Organization', name: '카더라' },
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: FAQ.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }) }} />
    </article>
  );
}
