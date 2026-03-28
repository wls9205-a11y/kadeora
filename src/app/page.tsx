import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL as SITE } from '@/lib/constants';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '카더라 — 대한민국 소리소문 정보 커뮤니티',
  description: '주식 시세, 아파트 청약, 미분양, 재개발, 실거래가 정보와 커뮤니티를 한 곳에서. 코스피 코스닥 실시간 시세, 전국 청약 일정, 부동산 분석을 매일 업데이트합니다.',
  alternates: { canonical: SITE },
  openGraph: {
    title: '카더라 — 아는 사람만 아는 그 정보',
    description: '주식 시세, 아파트 청약, 미분양·재개발·실거래가, 커뮤니티 토론을 하나의 앱에서.',
    url: SITE,
    siteName: '카더라',
    images: [{ url: `${SITE}/images/brand/kadeora-wide.png`, width: 1200, height: 630, alt: '카더라 - 대한민국 소리소문 정보 커뮤니티' }],
    locale: 'ko_KR',
    type: 'website',
  },
};

const SECTIONS = [
  {
    href: '/stock',
    emoji: '📊',
    title: '실시간 주식 시세',
    desc: '코스피·코스닥·나스닥·S&P500 종목 시세, 테마별 동향, AI 분석을 한눈에',
    tags: ['코스피', '코스닥', '나스닥', '환율'],
    img: '/images/previews/stock-preview.png',
    imgAlt: '카더라 실시간 주식 시세 — 코스피 코스닥 나스닥 종목 현재가 등락률',
  },
  {
    href: '/apt',
    emoji: '🏢',
    title: '아파트 청약·부동산',
    desc: '전국 청약 일정, 미분양 현황, 재개발 진행 상황, 실거래가 조회까지',
    tags: ['청약일정', '미분양', '재개발', '실거래가'],
    img: '/images/previews/apt-preview.png',
    imgAlt: '카더라 아파트 청약 — 전국 청약 일정 미분양 재개발 실거래가',
  },
  {
    href: '/blog',
    emoji: '📰',
    title: '투자 정보 블로그',
    desc: '매일 업데이트되는 시황 분석, 청약 가이드, 재테크 정보 19,000편+',
    tags: ['시황분석', '청약가이드', '재테크'],
    img: '/images/previews/blog-preview.png',
    imgAlt: '카더라 투자 블로그 — 시황 분석 청약 가이드 재테크 정보',
  },
  {
    href: '/feed',
    emoji: '💬',
    title: '커뮤니티 피드',
    desc: '주식, 부동산, 우리동네 소식을 자유롭게 나누는 소통 공간',
    tags: ['자유토론', '우리동네', '정보공유'],
    img: '/images/previews/feed-preview.png',
    imgAlt: '카더라 커뮤니티 — 주식 부동산 자유토론 게시글 피드',
  },
  {
    href: '/discuss',
    emoji: '🗣️',
    title: '실시간 토론방',
    desc: '주식방, 부동산방, 자유방에서 실시간 채팅과 투표에 참여하세요',
    tags: ['실시간채팅', '투표', '종목토론'],
    img: '/images/previews/discuss-preview.png',
    imgAlt: '카더라 실시간 토론방 — 주식방 부동산방 채팅 투표',
  },
  {
    href: '/hot',
    emoji: '🔥',
    title: '이번 주 HOT',
    desc: '이번 주 가장 많은 관심을 받은 인기 게시글 모아보기',
    tags: ['인기글', '주간랭킹', '트렌드'],
    img: '/images/previews/main-preview.png',
    imgAlt: '카더라 — 주식 청약 부동산 커뮤니티 올인원 앱',
  },
];

const TOOLS = [
  { href: '/apt/map', label: '부동산 지도뷰', emoji: '🗺️' },
  { href: '/apt/diagnose', label: '청약 진단', emoji: '🏥' },
  { href: '/stock/compare', label: '종목 비교', emoji: '⚖️' },
  { href: '/search', label: '통합 검색', emoji: '🔍' },
  { href: '/guide', label: '가이드북', emoji: '📖' },
  { href: '/grades', label: '등급 안내', emoji: '🏅' },
];

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.getAll().some(c =>
    c.name.startsWith('sb-') && c.name.includes('-auth-token')
  );
  if (hasSession) redirect('/feed');

  let stats = { blogs: 19393, stocks: 728, apts: 5522, posts: 4083, profiles: 121, redev: 202 };
  let indices: any[] = [];
  let openApts: any[] = [];
  let latestBlog: any = null;
  let todayActivity = { posts: 0, comments: 0 };
  let hotPost: any = null;
  try {
    const sb = getSupabaseAdmin();
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10) + 'T00:00:00';
    const [blogR, stockR, aptR, postR, profileR, redevR, indicesR, openAptsR, latestBlogR, todayPostsR, todayCommentsR, hotPostR] = await Promise.all([
      sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true),
      sb.from('stock_quotes').select('symbol', { count: 'exact', head: true }),
      sb.from('apt_subscriptions').select('id', { count: 'exact', head: true }),
      sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('redevelopment_projects').select('id', { count: 'exact', head: true }).eq('is_active', true),
      sb.from('stock_quotes').select('symbol,name,price,change_pct').or('name.ilike.%KOSPI%,name.ilike.%KOSDAQ%').limit(2),
      sb.from('apt_subscriptions').select('id,house_nm,region_nm,rcept_endde').lte('rcept_bgnde', new Date().toISOString().slice(0, 10)).gte('rcept_endde', new Date().toISOString().slice(0, 10)).order('rcept_endde', { ascending: true }).limit(2),
      sb.from('blog_posts').select('title,slug,category').eq('is_published', true).order('published_at', { ascending: false }).limit(1).maybeSingle(),
      sb.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', today),
      sb.from('comments').select('id', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', today),
      sb.from('posts').select('id,title,slug,likes_count').eq('is_deleted', false).order('likes_count', { ascending: false }).limit(1).maybeSingle(),
    ]);
    stats = {
      blogs: blogR.count ?? stats.blogs,
      stocks: stockR.count ?? stats.stocks,
      apts: aptR.count ?? stats.apts,
      posts: postR.count ?? stats.posts,
      profiles: profileR.count ?? stats.profiles,
      redev: redevR.count ?? stats.redev,
    };
    indices = indicesR?.data || [];
    openApts = openAptsR?.data || [];
    latestBlog = latestBlogR?.data || null;
    todayActivity = { posts: todayPostsR.count ?? 0, comments: todayCommentsR.count ?? 0 };
    hotPost = hotPostR?.data || null;
  } catch {}

  const fmtNum = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}만` : n >= 1000 ? `${(n / 1000).toFixed(1)}천` : String(n);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: '카더라',
        url: SITE,
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/search?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: SECTIONS.map((s, i) => ({
          '@type': 'SiteNavigationElement',
          position: i + 1,
          name: s.title,
          url: `${SITE}${s.href}`,
          description: s.desc,
        })),
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ImageGallery',
        name: '카더라 서비스 미리보기',
        description: '카더라의 주요 서비스 화면 — 주식 시세, 아파트 청약, 블로그, 커뮤니티, 토론방',
        image: SECTIONS.map(s => ({
          '@type': 'ImageObject',
          url: `${SITE}${s.img}`,
          name: s.title,
          description: s.imgAlt,
          width: 800,
          height: 500,
        })),
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: '카더라는 무료인가요?', acceptedAnswer: { '@type': 'Answer', text: '네, 카더라의 모든 기본 기능은 완전 무료입니다. 주식 시세 조회, 아파트 청약 일정 확인, 커뮤니티 글 작성, 블로그 열람 등 핵심 기능을 무료로 이용할 수 있습니다.' } },
          { '@type': 'Question', name: '어떤 주식 정보를 볼 수 있나요?', acceptedAnswer: { '@type': 'Answer', text: '코스피, 코스닥, 나스닥, S&P500 등 국내외 주요 종목의 실시간 시세를 제공합니다. 테마별 동향, 섹터 히트맵, AI 종목 분석, 투자자 매매동향 등 다양한 투자 정보를 확인할 수 있습니다.' } },
          { '@type': 'Question', name: '아파트 청약 정보는 어떻게 확인하나요?', acceptedAnswer: { '@type': 'Answer', text: '카더라 부동산 페이지에서 전국 5,400건+ 부동산 현장(청약·실거래·미분양·재개발) 종합 정보, 실거래가를 확인할 수 있습니다.' } },
          { '@type': 'Question', name: '블로그에는 어떤 글이 있나요?', acceptedAnswer: { '@type': 'Answer', text: '매일 자동 업데이트되는 19,000편+ 투자 정보 블로그를 운영합니다. 코스피·코스닥 시황 분석, 청약 가이드, 미분양 리포트 등을 매일 발행합니다.' } },
          { '@type': 'Question', name: '카더라 앱은 어디서 다운로드하나요?', acceptedAnswer: { '@type': 'Answer', text: '카더라는 웹앱(PWA)으로, 별도 앱스토어 다운로드 없이 브라우저에서 바로 사용할 수 있습니다. 모바일에서 홈 화면에 추가하면 앱처럼 사용 가능합니다.' } },
          { '@type': 'Question', name: '개인정보는 안전한가요?', acceptedAnswer: { '@type': 'Answer', text: '카더라는 Supabase 서울 리전에 데이터를 저장하며, HTTPS 암호화, RLS(Row Level Security), CSRF 보호, Rate Limiting으로 보안을 강화하고 있습니다.' } },
        ],
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE },
          { '@type': 'ListItem', position: 2, name: '주식 시세', item: `${SITE}/stock` },
          { '@type': 'ListItem', position: 3, name: '부동산', item: `${SITE}/apt` },
          { '@type': 'ListItem', position: 4, name: '블로그', item: `${SITE}/blog` },
          { '@type': 'ListItem', position: 5, name: '커뮤니티', item: `${SITE}/feed` },
          { '@type': 'ListItem', position: 6, name: '토론', item: `${SITE}/discuss` },
        ],
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: '카더라',
        alternateName: ['KADEORA', '카더라 커뮤니티'],
        url: SITE,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE}/icons/icon-192.png`,
          width: 192,
          height: 192,
        },
        image: `${SITE}/images/brand/kadeora-wide.png`,
        description: '대한민국 소리소문 정보 커뮤니티 — 주식 시세, 아파트 청약, 실시간 토론',
        foundingDate: '2026',
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer service',
          email: 'kadeora.app@gmail.com',
          telephone: '+82-10-5001-1382',
          availableLanguage: 'Korean',
        },
        address: {
          '@type': 'PostalAddress',
          streetAddress: '연동로 27, 405호',
          addressLocality: '연제구',
          addressRegion: '부산광역시',
          postalCode: '47545',
          addressCountry: 'KR',
        },
      }) }} />

      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

        {/* ━━━ 헤더 ━━━ */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(11,20,38,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            maxWidth: 1200, margin: '0 auto', padding: '12px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <svg width={32} height={32} viewBox="0 0 72 72" aria-hidden="true">
                <defs><linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0F1B3E" /><stop offset="100%" stopColor="#2563EB" /></linearGradient></defs>
                <rect width={72} height={72} rx={18} fill="url(#hg)" />
                <circle cx={18} cy={36} r={7} fill="white" /><circle cx={36} cy={36} r={7} fill="white" /><circle cx={54} cy={36} r={7} fill="white" />
              </svg>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>카더라</span>
            </Link>
            <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Link href="/feed" className="home-nav-link">피드</Link>
              <Link href="/stock" className="home-nav-link">주식</Link>
              <Link href="/apt" className="home-nav-link">부동산</Link>
              <Link href="/blog" className="home-nav-link">블로그</Link>
              <Link href="/login" style={{
                marginLeft: 8, padding: '8px 18px', borderRadius: 999,
                background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 14,
                textDecoration: 'none', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>시작하기</Link>
            </nav>
          </div>
        </header>

        {/* ━━━ 히어로 ━━━ */}
        <section style={{
          maxWidth: 1200, margin: '0 auto', padding: 'clamp(48px, 10vw, 100px) 20px clamp(40px, 8vw, 80px)',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-block', padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600,
            background: 'var(--brand-bg)', color: 'var(--brand-hover)', border: '1px solid var(--brand-border)',
            marginBottom: 20,
          }}>
            대한민국 소리소문 정보 커뮤니티
          </div>
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: 900, lineHeight: 1.2, letterSpacing: '-0.03em',
            margin: '0 0 16px',
            background: 'linear-gradient(135deg, #E8EDF5 0%, #93C5FD 50%, #3B82F6 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            아는 사람만 아는{'\n'}그 정보, 카더라
          </h1>
          <p style={{
            fontSize: 'clamp(15px, 2vw, 18px)', color: 'var(--text-secondary)', lineHeight: 1.7,
            maxWidth: 540, margin: '0 auto 32px',
          }}>
            주식 시세, 아파트 청약, 미분양·재개발·실거래가,{' '}
            투자 정보와 커뮤니티를 하나의 앱에서 만나보세요.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/feed" className="kd-btn-glow" style={{
              padding: '14px 32px', borderRadius: 14, fontSize: 16,
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              🔍 둘러보기
            </Link>
            <Link href="/login" style={{
              padding: '14px 32px', borderRadius: 14, fontSize: 16, fontWeight: 700,
              background: '#FEE500', color: '#191919', textDecoration: 'none',
              border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'transform 0.12s ease, box-shadow 0.2s ease',
            }}>
              💬 카카오로 3초 가입
            </Link>
          </div>
        </section>

        {/* ━━━ 실시간 통계 ━━━ */}
        <section style={{ maxWidth: 1200, margin: '0 auto 36px', padding: '0 20px' }}>
          <div className="kd-glass" style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8,
            padding: 'clamp(14px, 2vw, 20px)',
          }}>
            {[
              { label: '블로그', value: fmtNum(stats.blogs), suffix: '편' },
              { label: '종목 시세', value: String(stats.stocks), suffix: '종목' },
              { label: '청약 정보', value: fmtNum(stats.apts), suffix: '건' },
              { label: '재개발', value: String(stats.redev), suffix: '곳' },
              { label: '커뮤니티', value: fmtNum(stats.posts), suffix: '건' },
              { label: '회원', value: String(stats.profiles), suffix: '명' },
            ].map(s => (
              <div key={s.label} className="kd-counter" style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={{ fontSize: 'clamp(18px, 2.5vw, 24px)', fontWeight: 800, color: 'var(--brand-hover)', letterSpacing: '-0.02em' }}>
                  {s.value}<span style={{ fontSize: '0.5em', fontWeight: 600, color: 'var(--text-tertiary)', marginLeft: 2 }}>{s.suffix}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* 실시간 프리뷰 */}
          {(indices.length > 0 || openApts.length > 0 || latestBlog) && (
            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, textAlign: 'center' }}>지금 카더라에서</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', justifyContent: 'center', paddingBottom: 4 }}>
                {indices.map((idx: any) => {
                  const pct = Number(idx.change_pct) || 0;
                  return (
                    <Link key={idx.symbol} href="/stock" style={{ flexShrink: 0, minWidth: 160, padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', color: 'inherit', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>{idx.name}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{Number(idx.price).toLocaleString()}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: pct > 0 ? 'var(--accent-red)' : pct < 0 ? 'var(--accent-blue)' : 'var(--text-tertiary)', marginTop: 2 }}>
                        {pct > 0 ? '▲' : pct < 0 ? '▼' : '━'}{pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                      </div>
                    </Link>
                  );
                })}
                {openApts.map((a: any) => {
                  const diff = Math.ceil((new Date(a.rcept_endde).getTime() - Date.now()) / 86400000);
                  return (
                    <Link key={a.id} href={`/apt/${a.id}`} style={{ flexShrink: 0, minWidth: 160, padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', color: 'inherit', textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)' }}>접수중</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.house_nm}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{a.region_nm} · D-{diff}</div>
                    </Link>
                  );
                })}
                {latestBlog && (
                  <Link href={`/blog/${latestBlog.slug}`} style={{ flexShrink: 0, minWidth: 160, padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', color: 'inherit', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-purple)' }}>최신 블로그</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{latestBlog.title}</div>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* 커뮤니티 라이브 활동 */}
          {(todayActivity.posts > 0 || todayActivity.comments > 0 || hotPost) && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8, marginBottom: 8 }}>
              {todayActivity.posts > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 20, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', fontSize: 12, fontWeight: 600, color: 'var(--accent-green)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', animation: 'pulse 1.5s infinite' }} />
                  오늘 {todayActivity.posts}개 글 · {todayActivity.comments}개 댓글
                </div>
              )}
              {hotPost && (
                <Link href={`/feed/${hotPost.slug || hotPost.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 20, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, fontWeight: 600, color: 'var(--accent-red)', textDecoration: 'none', maxWidth: 280, overflow: 'hidden' }}>
                  🔥 {(hotPost.title || '').slice(0, 20)}{(hotPost.title || '').length > 20 ? '…' : ''} · ♥{hotPost.likes_count}
                </Link>
              )}
            </div>
          )}
        </section>

        {/* ━━━ 주요 서비스 ━━━ */}
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 64px' }}>
          <h2 style={{
            fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, textAlign: 'center', marginBottom: 12,
            letterSpacing: '-0.02em',
          }}>
            카더라에서 할 수 있는 것들
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 15, marginBottom: 36 }}>
            금융·부동산 정보부터 커뮤니티까지, 하나의 앱으로
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
            gap: 12,
          }}>
            {SECTIONS.map((s, i) => (
              <Link key={s.href} href={s.href} className="home-card kd-section-card" style={{
                display: 'block', textDecoration: 'none',
                background: 'var(--bg-surface)', borderRadius: 12,
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', overflow: 'hidden' }}>
                  <Image
                    src={s.img}
                    alt={s.imgAlt}
                    width={800}
                    height={500}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading={i < 3 ? 'eager' : 'lazy'}
                  />
                </div>
                <div style={{ padding: 'clamp(12px, 2vw, 16px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{s.emoji}</span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{s.title}</h3>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 8px' }}>{s.desc}</p>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {s.tags.map(t => (
                      <span key={t} style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 4,
                        background: 'var(--brand-bg)', color: 'var(--info)', fontWeight: 500,
                      }}>{t}</span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ━━━ 편의 도구 ━━━ */}
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 64px' }}>
          <h2 style={{
            fontSize: 'clamp(18px, 2.5vw, 24px)', fontWeight: 800, textAlign: 'center', marginBottom: 24,
            letterSpacing: '-0.02em',
          }}>
            편의 도구
          </h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {TOOLS.map(t => (
              <Link key={t.href} href={t.href} className="home-tool" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 18px', borderRadius: 12,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600,
                textDecoration: 'none', transition: 'border-color 0.2s, color 0.2s',
              }}>
                <span>{t.emoji}</span> {t.label}
              </Link>
            ))}
          </div>
        </section>

        {/* ━━━ FAQ 섹션 (리치 결과 면적 확대) ━━━ */}
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 64px' }}>
          <h2 style={{
            fontSize: 'clamp(18px, 2.5vw, 24px)', fontWeight: 800, textAlign: 'center', marginBottom: 24,
            letterSpacing: '-0.02em',
          }}>
            자주 묻는 질문
          </h2>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { q: '카더라는 무료인가요?', a: '네, 카더라의 모든 기본 기능은 완전 무료입니다. 주식 시세 조회, 아파트 청약 일정 확인, 커뮤니티 글 작성, 블로그 열람 등 핵심 기능을 무료로 이용할 수 있습니다. 카카오 계정으로 3초 만에 가입하세요.' },
              { q: '어떤 주식 정보를 볼 수 있나요?', a: '코스피, 코스닥, 나스닥, S&P500 등 국내외 주요 종목의 실시간 시세를 제공합니다. 테마별 동향, 섹터 히트맵, AI 종목 분석, 투자자 매매동향, 뉴스 감성 분석 등 다양한 투자 정보를 한눈에 확인할 수 있습니다.' },
              { q: '아파트 청약 정보는 어떻게 확인하나요?', a: '카더라 부동산 페이지에서 전국 5,400건+ 부동산 현장(청약·실거래·미분양·재개발) 종합 정보, 실거래가를 확인할 수 있습니다. 청약 캘린더, 지도뷰, 청약 진단 도구도 제공합니다.' },
              { q: '블로그에는 어떤 글이 있나요?', a: '매일 자동 업데이트되는 19,000편+ 투자 정보 블로그를 운영하고 있습니다. 코스피·코스닥 시황 분석, 청약 가이드, 미분양 리포트, ETF 비교 등 주식과 부동산 관련 정보를 매일 발행합니다.' },
              { q: '카더라 앱은 어디서 다운로드하나요?', a: '카더라는 웹앱(PWA)으로, 별도 앱스토어 다운로드 없이 브라우저에서 바로 사용할 수 있습니다. 모바일 브라우저에서 kadeora.app에 접속한 후 "홈 화면에 추가"를 누르면 앱처럼 사용할 수 있습니다.' },
              { q: '개인정보는 안전한가요?', a: '카더라는 Supabase 서울 리전에 데이터를 저장하며, 모든 통신은 HTTPS로 암호화됩니다. Row Level Security(RLS)를 적용하여 본인의 데이터만 접근할 수 있으며, CSRF 보호와 Rate Limiting으로 보안을 강화하고 있습니다.' },
            ].map((faq, i) => (
              <details key={i} style={{
                background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)',
                overflow: 'hidden',
              }}>
                <summary style={{
                  padding: '16px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  color: 'var(--text-primary)', listStyle: 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  {faq.q}
                  <span style={{ fontSize: 18, color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 12 }}>+</span>
                </summary>
                <div style={{
                  padding: '0 20px 16px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7,
                }}>
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* ━━━ CTA 배너 ━━━ */}
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 64px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #152850 0%, #0A1225 100%)',
            borderRadius: 20, padding: 'clamp(32px, 5vw, 56px)', textAlign: 'center',
            border: '1px solid var(--border-strong)',
          }}>
            <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, marginBottom: 12 }}>
              지금 바로 시작하세요
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 24, lineHeight: 1.7 }}>
              카카오 계정으로 3초 만에 가입하고,<br />
              주식·부동산·커뮤니티 모든 기능을 무료로 이용하세요.
            </p>
            <Link href="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 36px', borderRadius: 14, fontSize: 16, fontWeight: 700,
              background: '#FEE500', color: '#191919', textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(254,229,0,0.2)',
            }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="#191919"><path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.79 1.86 5.234 4.66 6.595-.145.524-.935 3.378-.967 3.595 0 0-.02.164.087.227.107.063.232.03.232.03.306-.043 3.55-2.318 4.107-2.715.59.083 1.2.127 1.82.127h.061c5.523 0 10-3.463 10-7.691 0-4.228-4.477-7.691-10-7.691V3z" /></svg>
              카카오로 시작하기
            </Link>
          </div>
        </section>

        {/* ━━━ 푸터 ━━━ */}
        <footer style={{
          borderTop: '1px solid var(--border)', padding: '32px 20px 48px',
          maxWidth: 1200, margin: '0 auto',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 24,
            marginBottom: 32,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>서비스</div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href="/stock" className="home-flink">주식 시세</Link>
                <Link href="/apt" className="home-flink">아파트 청약</Link>
                <Link href="/blog" className="home-flink">블로그</Link>
                <Link href="/feed" className="home-flink">커뮤니티</Link>
              </nav>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>부동산</div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href="/apt" className="home-flink">청약 일정</Link>
                <Link href="/apt?tab=unsold" className="home-flink">미분양 현황</Link>
                <Link href="/apt?tab=redev" className="home-flink">재개발 정보</Link>
                <Link href="/apt?tab=trade" className="home-flink">실거래가</Link>
              </nav>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>도구</div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href="/apt/map" className="home-flink">지도뷰</Link>
                <Link href="/apt/diagnose" className="home-flink">청약 진단</Link>
                <Link href="/stock/compare" className="home-flink">종목 비교</Link>
                <Link href="/search" className="home-flink">통합 검색</Link>
              </nav>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>카더라</div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href="/guide" className="home-flink">가이드북</Link>
                <Link href="/grades" className="home-flink">등급 안내</Link>
                <Link href="/terms" className="home-flink">이용약관</Link>
                <Link href="/privacy" className="home-flink">개인정보처리방침</Link>
              </nav>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.9 }}>
            <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>사업자 정보</p>
            <p>상호명: 카더라 &nbsp;|&nbsp; 대표자: 노영진 &nbsp;|&nbsp; 사업자등록번호: 278-57-00801</p>
            <p>사업장 주소: 부산광역시 연제구 연동로 27, 405호</p>
            <p>전화: 010-5001-1382 &nbsp;|&nbsp; 이메일: kadeora.app@gmail.com</p>
            <p style={{ marginTop: 4 }}>© 2026 카더라. All rights reserved.</p>
          </div>
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .home-nav-link {
          padding: 6px 12px; border-radius: 8px; font-size: 14px; font-weight: 600;
          color: var(--text-secondary); text-decoration: none; transition: color 0.2s, background 0.2s;
        }
        .home-nav-link:hover { color: var(--text-primary); background: var(--bg-hover); }
        .home-card:hover {
          transform: translateY(-4px);
          border-color: var(--brand) !important;
          box-shadow: 0 8px 32px rgba(37,99,235,0.12);
        }
        .home-tool:hover { border-color: var(--brand) !important; color: var(--text-primary) !important; }
        .home-flink {
          font-size: 13px; color: var(--text-tertiary); text-decoration: none; transition: color 0.15s;
        }
        .home-flink:hover { color: var(--text-primary); }
        @media (max-width: 640px) {
          .home-nav-link { display: none; }
        }
      ` }} />
    </>
  );
}
