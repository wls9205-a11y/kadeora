'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { C, Spinner, StatBox, fmt } from '../admin-shared';

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
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 8px' }}>🔍 SEO · 콘텐츠 점수</h1>
      <p style={{ fontSize: 12, color: C.textDim, margin: '0 0 24px' }}>5,420개 현장 페이지의 데이터 풍부도 현황</p>

      {/* ── IndexNow + 포털 인덱싱 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 20 }} className="mc-g2">
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>🔔 IndexNow 전송 현황</span>
            <span style={{ fontSize: 11, color: C.textDim }}>블로그 {fmt(ixn.total)}편</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            <StatBox icon="✅" label="전송완료" value={ixn.done} color={C.green} />
            <StatBox icon="⏳" label="대기" value={ixn.pending} color={C.yellow} />
            <StatBox icon="📊" label="진행률" value={`${ixn.pct}%`} color={ixn.pct > 80 ? C.green : ixn.pct > 30 ? C.yellow : C.red} accent />
          </div>
          <div style={{ height: 10, borderRadius: 5, background: C.border, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', borderRadius: 5, background: `linear-gradient(90deg, ${C.green}, ${C.cyan})`, width: `${ixn.pct}%`, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.textDim }}>
            <span>매 6시간 500편씩 전송 (indexnow-mass 크론)</span>
            <span>예상 완료: ~{Math.ceil(ixn.pending / 2000)}일</span>
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>🌐 포털 인덱싱</div>
          {[
            { name: 'Google', status: '미노출', color: C.red, action: 'Search Console 사이트맵', href: 'https://search.google.com/search-console' },
            { name: 'Naver', status: '대기', color: C.yellow, action: '서치어드바이저 RSS', href: 'https://searchadvisor.naver.com' },
            { name: 'Bing', status: '대기', color: C.yellow, action: '웹마스터 사이트맵', href: 'https://www.bing.com/webmasters' },
            { name: 'Daum', status: '미등록', color: C.red, action: '검색등록', href: 'https://register.search.daum.net' },
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

      {/* ── Hero Stats ── */}
      <div className="mc-g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatBox icon="📄" label="전체 페이지" value={seo?.totalSites || 0} color={C.brand} accent />
        <StatBox icon="🗺️" label="사이트맵" value={seo?.totalSitemap || 0} sub={`${seo?.sitemapPct || 0}% 커버리지`} color={C.green} accent />
        <StatBox icon="✍️" label="블로그 리라이트" value={`${seo?.blogRewrittenPct || 0}%`} sub={`${fmt(kpi.blogs)}건 중`} color={C.purple} accent />
        <StatBox icon="🏆" label="최대 점수" value="97" sub="/ 103점 만점" color={C.yellow} accent />
      </div>

      {/* ── Type Score Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {Object.entries(seo?.siteTypeBreakdown || {}).sort((a: any, b: any) => b[1].count - a[1].count).map(([type, info]: [string, any]) => (
          <div key={type} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: typeColors[type] || C.text }}>{typeLabels[type] || type}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{fmt(info.count)}</span>
            </div>
            <div style={{ marginBottom: 8 }}>
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
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
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
