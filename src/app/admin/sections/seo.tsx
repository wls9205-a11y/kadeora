'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { C, Spinner, StatBox, fmt } from '../admin-shared';
import { CALC_REGISTRY, CATEGORIES } from '@/lib/calc/registry';

export default function SEOSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scoreDetail, setScoreDetail] = useState<any>(null);

  useEffect(() => {
    fetch('/api/admin/dashboard?section=overview').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  // content_score 상세 분포 로드
  useEffect(() => {
    if (!data) return;
    fetch('/api/admin/dashboard?section=seo-detail')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setScoreDetail(d))
      .catch(() => {});
  }, [data]);

  if (loading) return <Spinner />;
  if (!data) return <div style={{ color: C.red }}>로드 실패</div>;

  const { seo, kpi, premiumKpi } = data;
  const typeColors: Record<string, string> = { subscription: C.green, trade: C.yellow, redevelopment: C.purple, unsold: C.red, landmark: C.cyan };
  const typeLabels: Record<string, string> = { subscription: '청약', trade: '실거래', redevelopment: '재개발', unsold: '미분양', landmark: '대장' };
  const maxScore = 103;
  const ixn = premiumKpi?.indexNow || { total: 0, done: 0, pending: 0, pct: 0 };

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: C.text, margin: '0 0 8px' }}>🔍 SEO · 콘텐츠 점수</h1>
      <p style={{ fontSize: 12, color: C.textDim, margin: '0 0 24px' }}>분양 5,420 페이지 + 계산기 {CALC_REGISTRY.length}종 + 블로그 {fmt(kpi?.blogs || 0)}편</p>

      {/* ── IndexNow + 포털 인덱싱 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--sp-md)', marginBottom: 'var(--sp-xl)' }} className="mc-g2">
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-lg)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-md)' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>🔔 IndexNow 전송 현황</span>
            <span style={{ fontSize: 11, color: C.textDim }}>블로그 {fmt(ixn.total)}편</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
            <StatBox icon="✅" label="전송완료" value={ixn.done} color={C.green} />
            <StatBox icon="⏳" label="대기" value={ixn.pending} color={C.yellow} />
            <StatBox icon="📊" label="진행률" value={`${ixn.pct}%`} color={ixn.pct > 80 ? C.green : ixn.pct > 30 ? C.yellow : C.red} accent />
          </div>
          <div style={{ height: 10, borderRadius: 5, background: C.border, overflow: 'hidden', marginBottom: 'var(--sp-sm)' }}>
            <div style={{ height: '100%', borderRadius: 5, background: `linear-gradient(90deg, ${C.green}, ${C.cyan})`, width: `${ixn.pct}%`, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textDim }}>
            <span>매 6시간 500편씩 전송 (indexnow-mass 크론)</span>
            <span>예상 완료: ~{Math.ceil(ixn.pending / 2000)}일</span>
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-lg)', padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 'var(--sp-md)' }}>🌐 포털 인덱싱</div>
          {[
            { name: 'Google', status: '인증완료', color: C.green, action: 'Search Console', href: 'https://search.google.com/search-console' },
            { name: 'Naver', status: '인증완료', color: C.green, action: '서치어드바이저', href: 'https://searchadvisor.naver.com' },
            { name: 'Bing', status: '인증완료', color: C.green, action: '웹마스터', href: 'https://www.bing.com/webmasters' },
            { name: 'Daum', status: '등록 필요', color: C.yellow, action: '검색등록 →', href: 'https://register.search.daum.net' },
            { name: 'ZUM', status: '등록 필요', color: C.yellow, action: '검색등록 →', href: 'https://zum.com' },
          ].map(p => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}08` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{p.name}</span>
                <span style={{ fontSize: 10, color: p.color, fontWeight: 600 }}>{p.status}</span>
              </div>
              <a href={p.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: C.brand, textDecoration: 'none', fontWeight: 600, padding: '2px 6px', background: C.brandBg, borderRadius: 4 }}>
                {p.action} →
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* ── 브랜드 키워드 검색 노출 체크리스트 ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-lg)', padding: '16px 18px', marginBottom: 'var(--sp-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-md)' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>🎯 브랜드 키워드 노출 전략</span>
          <span style={{ fontSize: 10, color: C.textDim }}>목표: &quot;카더라&quot; 검색 시 1위</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)' }} className="mc-g1">
          {/* 기술적 SEO */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.brand, marginBottom: 8 }}>✅ 기술적 SEO (코드)</div>
            {[
              { label: 'title에 "카더라" 포함', done: true },
              { label: 'Organization JSON-LD (독립)', done: true },
              { label: 'WebSite JSON-LD + SearchAction', done: true },
              { label: 'alternateName 확장 (부동산/주식/앱)', done: true },
              { label: '/about 브랜드 앵커 페이지', done: true },
              { label: '블로그 title "카더라 부동산/주식" 분기', done: true },
              { label: 'SiteNavigationElement', done: true },
              { label: 'og:site_name = 카더라', done: true },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 10 }}>
                <span style={{ color: r.done ? C.green : C.red }}>{r.done ? '●' : '○'}</span>
                <span style={{ color: r.done ? C.textSec : C.text }}>{r.label}</span>
              </div>
            ))}
          </div>
          {/* 외부 채널 */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, marginBottom: 8 }}>📡 외부 채널 (수동)</div>
            {[
              { label: '네이버 블로그 개설·운영', done: false, href: 'https://section.blog.naver.com' },
              { label: '네이버 카페 개설·운영', done: false, href: 'https://section.cafe.naver.com' },
              { label: '네이버 스마트플레이스 등록', done: false, href: 'https://new.smartplace.naver.com' },
              { label: '구글 비즈니스 프로필 등록', done: false, href: 'https://business.google.com' },
              { label: '카카오톡 채널 개설', done: false, href: 'https://business.kakao.com' },
              { label: '나무위키 문서 생성', done: false, href: 'https://namu.wiki' },
              { label: '프레스 릴리즈 배포', done: false, href: 'https://www.newswire.co.kr' },
              { label: '네이버 브랜드검색광고', done: false, href: 'https://searchad.naver.com' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', fontSize: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: r.done ? C.green : C.red }}>{r.done ? '●' : '○'}</span>
                  <span style={{ color: r.done ? C.textSec : C.text }}>{r.label}</span>
                </div>
                <a href={r.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: C.brand, textDecoration: 'none', fontWeight: 600 }}>→</a>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12, padding: '8px 10px', background: `${C.brand}10`, borderRadius: 6, fontSize: 10, color: C.textSec, lineHeight: 1.6 }}>
          💡 <strong style={{ color: C.text }}>핵심:</strong> &quot;카더라&quot;는 일반명사(소문)로 나무위키/위키백과가 장악 중. &quot;카더라 부동산&quot; &quot;카더라 주식&quot; 조합 키워드부터 1위 확보 → 6개월 후 단독 키워드 도전.
        </div>
      </div>
      {(() => {
        const total = CALC_REGISTRY.length;
        const withEmoji = CALC_REGISTRY.filter(c => c.emoji).length;
        const withSeo = CALC_REGISTRY.filter(c => c.seoContent && c.seoContent.length > 100).length;
        const withFaq3 = CALC_REGISTRY.filter(c => c.faqs.length >= 3).length;
        const withFaq5 = CALC_REGISTRY.filter(c => c.faqs.length >= 5).length;
        const catMap: Record<string, number> = {};
        CALC_REGISTRY.forEach(c => { catMap[c.categoryLabel] = (catMap[c.categoryLabel] || 0) + 1; });
        const pct = (n: number) => Math.round((n / total) * 100);
        return (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-lg)', padding: '16px 18px', marginBottom: 'var(--sp-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-md)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>🧮 계산기 포털 노출 현황 ({total}종)</span>
              <span style={{ fontSize: 10, color: C.textDim }}>{CATEGORIES.length}카테고리 · JSON-LD 4종</span>
            </div>
            <div className="mc-g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-md)' }}>
              <StatBox icon="🏷️" label="이모지" value={`${pct(withEmoji)}%`} sub={`${withEmoji}/${total}`} color={withEmoji === total ? C.green : C.yellow} accent />
              <StatBox icon="📝" label="seoContent" value={`${pct(withSeo)}%`} sub={`${withSeo}/${total}`} color={withSeo === total ? C.green : C.yellow} accent />
              <StatBox icon="❓" label="FAQ 5개+" value={`${pct(withFaq5)}%`} sub={`${withFaq5}/${total} (3+: ${withFaq3})`} color={withFaq5 > total * 0.8 ? C.green : C.yellow} accent />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)' }}>
              {[
                { label: 'JSON-LD WebApplication', val: `${total}/${total}`, ok: true },
                { label: 'JSON-LD FAQPage', val: `${total}/${total}`, ok: true },
                { label: 'JSON-LD HowTo (3단계)', val: `${total}/${total}`, ok: true },
                { label: 'JSON-LD BreadcrumbList', val: `${total}/${total}`, ok: true },
                { label: 'AggregateRating', val: '제거 (실리뷰 필요)', ok: true },
                { label: 'OG 이미지 이모지 (1200×630+630×630)', val: `${withEmoji}/${total}`, ok: withEmoji === total },
                { label: 'Meta desc "무료·회원가입 불필요"', val: `${total}/${total}`, ok: true },
                { label: 'naver:written_time + daum:site_name', val: `${total}/${total}`, ok: true },
                { label: '회원가입 CTA (결과+하단)', val: '전체 적용', ok: true },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
                  <span style={{ color: C.textSec }}>{r.label}</span>
                  <span style={{ fontWeight: 600, color: r.ok ? C.green : C.red }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Hero Stats ── */}
      <div className="mc-g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-md)', marginBottom: 'var(--sp-xl)' }}>
        <StatBox icon="📄" label="전체 페이지" value={seo?.totalSites || 0} color={C.brand} accent />
        <StatBox icon="🗺️" label="사이트맵" value={seo?.totalSitemap || 0} sub={`${seo?.sitemapPct || 0}% 커버리지`} color={C.green} accent />
        <StatBox icon="✍️" label="블로그 리라이트" value={`${seo?.blogRewrittenPct || 0}%`} sub={`${fmt(kpi.blogs)}건 중`} color={C.purple} accent />
        <StatBox icon="🏆" label="최대 점수" value="97" sub="/ 103점 만점" color={C.yellow} accent />
      </div>

      {/* ── Type Score Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--sp-md)', marginBottom: 'var(--sp-xl)' }}>
        {Object.entries(seo?.siteTypeBreakdown || {}).sort((a: any, b: any) => b[1].count - a[1].count).map(([type, info]: [string, any]) => (
          <div key={type} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-lg)', padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: typeColors[type] || C.text }}>{typeLabels[type] || type}</span>
              <span style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: C.text }}>{fmt(info.count)}</span>
            </div>
            <div style={{ marginBottom: 'var(--sp-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: C.textDim }}>평균 점수</span>
                <span style={{ color: typeColors[type], fontWeight: 700 }}>{info.avgScore} / {maxScore}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: C.border, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: typeColors[type] || C.brand, width: `${(info.avgScore / maxScore) * 100}%`, transition: 'width .6s' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: C.textDim }}>사이트맵</span>
              <span style={{ color: C.green, fontWeight: 600 }}>{info.sitemapCount}건 ({info.count > 0 ? Math.round(info.sitemapCount / info.count * 100) : 0}%)</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Score Formula Reference ── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-lg)', padding: 18 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 14px' }}>📐 점수 산정 공식 (최대 103점)</h3>
        <div className="mc-g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { title: '기본 정보 (30)', items: ['이름 3자+ (+10)', '지역+시군구 (+10)', '세대수 (+10)'] },
            { title: '데이터 소스 (36)', items: ['가격 정보 (+5)', '청약 연결 (+10)', '재개발 연결 (+15)', '실거래 존재 (+10/+5/+3)', '미분양 연결 (+8)'] },
            { title: '콘텐츠 (28)', items: ['설명 100자+ (+10)', '설명 200자+ (+3)', 'FAQ 3개+ (+10)', 'FAQ 5개+ (+3)', 'key_features (+2)'] },
            { title: '위치 (13)', items: ['좌표 (+5)', '지하철역 (+5)', '상세 주소 (+3)'] },
            { title: '미디어 (5)', items: ['이미지 1장+ (+5)'] },
            { title: '부가 정보 (11)', items: ['시공사 (+3)', '준공년도 (+3)', '시행사 (+2)', '입주예정 (+3)'] },
          ].map(g => (
            <div key={g.title}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, marginBottom: 6 }}>{g.title}</div>
              {g.items.map(item => (
                <div key={item} style={{ fontSize: 11, color: C.textSec, padding: '2px 0' }}>{item}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// 👤 USERS
// ══════════════════════════════════════
