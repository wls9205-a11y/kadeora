import type { Metadata } from 'next';
import { SITE_URL , CONTACT_EMAIL} from '@/lib/constants';
import GuideInstallButton from '@/components/GuideInstallButton';
import Link from 'next/link';
import ShareButtons from '@/components/ShareButtons';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '가이드북 — 카더라 100% 활용법',
  description: '카더라 앱 사용 가이드. 주식 시세, 부동산 청약, 블로그, 커뮤니티, 등급 시스템, 포인트 획득 방법을 알아보세요.',
  alternates: { canonical: SITE_URL + '/guide' },
  openGraph: {
    title: '가이드북 — 카더라 100% 활용법',
    description: '카더라 앱 사용 가이드',
    url: SITE_URL + '/guide',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: SITE_URL + '/images/brand/kadeora-hero.png', alt: '카더라 가이드' }],
  },
  twitter: { card: 'summary_large_image' },
  other: { 'naver:written_time': new Date().toISOString(), 'naver:updated_time': new Date().toISOString(), 'article:section': '가이드', 'dg:plink': SITE_URL + '/guide', 'naver:author': '카더라', 'og:updated_time': new Date().toISOString() },
};

const FEATURES = [
  { icon: '📋', title: '피드', desc: '전체/우리동네/주식/부동산/자유 탭으로 원하는 주제 글 보기. ▲ 추천 버튼으로 좋은 글 추천. 임시저장 지원.' },
  { icon: '📊', title: '주식', desc: '국내외 주요 종목 실시간 시세 (5~10분 갱신). 코스피/코스닥/뉴욕/나스닥 탭. 캔들차트, 수급, 뉴스, AI 한줄평, 종목 토론, 트리맵, 레이더차트까지.' },
  { icon: '🏢', title: '부동산', desc: '5개 탭 — 📅 청약 일정 · 🏢 분양중 · 🏚️ 미분양 · 🏗️ 재개발 · 💰 실거래. 지역 필터, 마감 임박 알림, 관심단지 등록.' },
  { icon: '🏘️', title: '단지백과', desc: '전국 아파트 단지 프로필. 시세, 전세가율, 연차별 통계, 관련 실거래 내역을 한눈에.' },
  { icon: '📝', title: '블로그', desc: '주식·청약·미분양·재테크 정보를 매일 업데이트. 카테고리 필터, 인기글 TOP5, 검색 기능.' },
  { icon: '💬', title: '라운지 토론', desc: '자유방/주식방/부동산방에서 실시간 채팅. 투표형 토론도 가능.' },
  { icon: '🔥', title: '이번 주 HOT', desc: '이번 주 가장 핫한 글 TOP 5와 지역별 인기 글을 한눈에 확인.' },
  { icon: '⚖️', title: '종목 비교', desc: '관심 종목 2~4개를 선택해서 시가총액, 등락률 등 핵심 지표를 나란히 비교.' },
  { icon: '🗺️', title: '부동산 지도', desc: '지도에서 청약·분양·미분양·재개발 현장 위치를 한눈에 확인. 핀 클릭 시 상세 정보.' },
  { icon: '🔍', title: '통합 검색', desc: '게시글·블로그·주식·청약·재개발·미분양·토론·단지백과를 한번에 검색.' },
  { icon: '📍', title: '우리동네', desc: '내 지역 설정 후 동네별 소식 확인. 시 단위 지역 필터 (서울/부산/경기 등)' },
  { icon: '🔗', title: '공유', desc: '카카오톡/X/밴드/스레드/라인/네이버/링크복사로 글 공유. 부동산 상세에서도 공유 가능.' },
  { icon: '🔔', title: '알림', desc: '댓글, 좋아요, 팔로우 알림을 실시간으로. 클릭하면 해당 게시글로 바로 이동.' },
  { icon: '⭐', title: '관심 종목·단지', desc: '주식 종목 관심등록, 부동산 관심단지 등록. 새 소식이 있으면 알림.' },
  { icon: '📈', title: '캔들차트', desc: '주식 상세에서 캔들/라인 전환, 1주~전체 기간 선택. 터치하면 시가·고가·저가·종가 확인.' },
  { icon: '🏗️', title: '재개발 현황', desc: '전국 재개발·재건축 진행 현황. 단계별(정비구역지정~준공) 필터, 세대수 표시.' },
  { icon: '💰', title: '실거래가', desc: '매매·전월세 실거래가 검색. 월별 추이, 최고가 대비 % 표시, 지역별 현황.' },
  { icon: '🎯', title: '청약 가점 진단', desc: '부동산 페이지에서 내 청약 가점을 자가 진단해보세요.' },
  { icon: '📅', title: '출석 체크', desc: '매일 출석 체크로 +10P 획득. 7일 연속 +30P, 30일 연속 +100P 보너스!' },
  { icon: '👥', title: '친구 초대', desc: '내 초대코드를 공유하세요. 프로필에서 초대 코드를 확인할 수 있습니다.' },
  
  { icon: '🚨', title: '신고', desc: '부적절한 글/댓글 신고 기능. 어드민이 확인 후 조치합니다.' },
  { icon: '⭐', title: '등급 시스템', desc: '활동 포인트로 🌱새싹 → 🚀카더라신 10단계 등급. 매일 자동 갱신.' },
  { icon: '🔤', title: '글씨 크기', desc: '오른쪽 상단 드롭다운에서 작게/보통/크게 조절. 기본값은 보통 크기.' },
  { icon: '🌗', title: '화면 테마', desc: '다크 모드 기본 적용. 더보기 메뉴에서 라이트 모드로 전환할 수 있습니다.' },
  { icon: '📊', title: '통계 자료실', desc: '주식/부동산 데이터를 CSV로 다운로드. 종목 시세, 청약, 미분양, 단지백과 데이터 제공.' },
  { icon: '👤', title: '프로필', desc: '지역 설정, 자기소개, 내 게시글/댓글/북마크 히스토리.' },
  { icon: '📱', title: '푸시 알림', desc: '홈 화면에 추가 후 알림을 허용하면 댓글/좋아요/팔로우 시 실시간 푸시 알림.' },
  { icon: '🔄', title: '당겨서 새로고침', desc: '피드/검색/알림 등에서 화면을 아래로 당기면 최신 정보로 새로고침.' },
  { icon: '✍️', title: '현장 한줄평', desc: '청약 아파트, 미분양, 재개발 상세 페이지에서 현장 한줄평을 남겨보세요.' },
  { icon: '📢', title: '확성기', desc: '확성기를 구매하면 내 글을 전체 사용자에게 공지 배너로 홍보할 수 있어요.' },
];

export default function GuidePage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"홈","item":SITE_URL},{"@type":"ListItem","position":2,"name":"가이드","item":SITE_URL + "/guide"}]}) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: [
          { "@type": "Question", name: "카더라는 무료인가요?", acceptedAnswer: { "@type": "Answer", text: "네, 카더라의 모든 기본 기능은 완전 무료입니다. 주식 시세 조회, 아파트 청약 일정, 블로그, 커뮤니티 글 작성 등 핵심 기능을 무료로 이용할 수 있습니다." } },
          { "@type": "Question", name: "카더라에서 어떤 주식 정보를 볼 수 있나요?", acceptedAnswer: { "@type": "Answer", text: "코스피, 코스닥, NYSE, NASDAQ 주요 종목의 실시간 시세, 캔들 차트, 수급 분석, 종목 뉴스, AI 한줄평, 투자자 매매동향, 트리맵, 레이더차트, 종목 비교를 제공합니다." } },
          { "@type": "Question", name: "아파트 청약 정보는 어떻게 확인하나요?", acceptedAnswer: { "@type": "Answer", text: "카더라 부동산 페이지에서 전국 청약 일정, 경쟁률, 미분양 현황, 재개발 구역, 실거래가를 확인할 수 있습니다. 관심 단지 등록 시 마감 알림도 받을 수 있습니다." } },
          { "@type": "Question", name: "카더라 앱은 어디서 설치하나요?", acceptedAnswer: { "@type": "Answer", text: "카더라는 PWA(프로그레시브 웹앱)로, 앱스토어 다운로드 없이 모바일 브라우저에서 홈 화면에 추가하면 앱처럼 사용할 수 있습니다." } },
          { "@type": "Question", name: "회원 등급은 어떻게 올라가나요?", acceptedAnswer: { "@type": "Answer", text: "활동 포인트(글 작성, 댓글, 출석 등)로 자동 등급업됩니다. 새싹부터 카더라신까지 10단계 등급이 있으며 매일 자동 갱신됩니다." } },
        ],
      }) }} />
      <div style={{ marginBottom: 'var(--sp-xl)' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>📖 카더라 가이드</h1>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--fs-base)', color: 'var(--text-secondary)' }}>카더라를 100% 활용하는 방법</p>
        <div style={{ marginTop: 8 }}><ShareButtons title="카더라 가이드 — 100% 활용법" contentType="page" contentRef="guide" /></div>
      </div>

      {/* 빠른 시작 3단계 */}
      <div style={{ marginBottom: 'var(--sp-xl)', padding: 16, background: 'linear-gradient(135deg, rgba(96,165,250,0.06), rgba(52,211,153,0.06))', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-md)' }}>🚀 빠른 시작 3단계</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>1</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>카카오 로그인</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>3초면 가입 완료, 별도 회원가입 불필요</div>
            </div>
            <Link href="/login" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius-xs)', background: 'var(--brand)', color: '#fff', textDecoration: 'none', fontWeight: 700, flexShrink: 0 }}>시작 →</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>2</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>관심 종목·지역 등록</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>주식 ⭐ 관심종목, 부동산 ❤️ 관심단지</div>
            </div>
            <Link href="/stock" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 700, border: '1px solid var(--border)', flexShrink: 0 }}>등록 →</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-md)' }}>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>3</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>첫 글 작성</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>의견을 나누고 포인트도 적립하세요</div>
            </div>
            <Link href="/write" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius-xs)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 700, border: '1px solid var(--border)', flexShrink: 0 }}>작성 →</Link>
          </div>
        </div>
      </div>

      {/* 앱 설치 — 원버튼 */}
      <div id="install" style={{ marginBottom: 'var(--sp-lg)', scrollMarginTop: 80 }}>
        <GuideInstallButton />
      </div>

      {/* 주요 기능 소개 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20, marginBottom: 'var(--sp-lg)' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>주요 기능</h2>
        {FEATURES.map((f, i) => (
          <div key={f.title} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < FEATURES.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--fs-xl)', flexShrink: 0, lineHeight: 1 }}>{f.icon}</span>
            <div>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)' }}>{f.title}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 등급 안내 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20, marginBottom: 'var(--sp-lg)' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>🏅 회원 등급 안내</h2>
        <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>활동 포인트에 따라 등급이 올라갑니다</p>
        {[
          { lv: 1, name: '새싹', pts: '0P', emoji: '🌱' },
          { lv: 2, name: '정보통', pts: '100P', emoji: '📡' },
          { lv: 3, name: '동네어른', pts: '300P', emoji: '🏘️' },
          { lv: 4, name: '소문난집', pts: '600P', emoji: '🏠' },
          { lv: 5, name: '인플루언서', pts: '1,000P', emoji: '⚡' },
          { lv: 6, name: '빅마우스', pts: '2,000P', emoji: '🔥' },
          { lv: 7, name: '찐고수', pts: '5,000P', emoji: '💎' },
          { lv: 8, name: '전설', pts: '10,000P', emoji: '🌟' },
          { lv: 9, name: '신의경지', pts: '30,000P', emoji: '👑' },
          { lv: 10, name: '카더라신', pts: '100,000P', emoji: '🚀' },
        ].map((g, i, arr) => (
          <div key={g.lv} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 'var(--fs-lg)', width: 28, textAlign: 'center' as const }}>{g.emoji}</span>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Lv.{g.lv} {g.name}</span>
            <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{g.pts}~</span>
          </div>
        ))}
      </div>

      {/* 포인트 획득 방법 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20, marginBottom: 'var(--sp-lg)' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>💰 포인트 획득 방법</h2>
        {[
          { action: '출석체크', pts: '+10P', note: '7일 연속 +30P, 30일 연속 +100P' },
          { action: '게시글 작성', pts: '+10P', note: '' },
          { action: '댓글 작성', pts: '+5P', note: '블로그 댓글 포함' },
          { action: '공유', pts: '+5P', note: '' },
          { action: '프로필 사진 등록', pts: '+30P', note: '최초 1회' },
          { action: '관심단지 등록', pts: '+50P', note: '' },
        ].map((p, i, arr) => (
          <div key={p.action} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{p.action}</span>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--brand)' }}>{p.pts}</span>
            {p.note && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{p.note}</span>}
          </div>
        ))}
      </div>

      {/* 자주 묻는 질문 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: 20, marginBottom: 'var(--sp-lg)' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>❓ 자주 묻는 질문</h2>
        {[
          { q: '카더라는 무료인가요?', a: '네, 모든 기능을 무료로 이용할 수 있습니다. 확성기 등 일부 유료 상품이 있지만, 핵심 기능은 전부 무료입니다.' },
          { q: '회원 탈퇴는 어떻게 하나요?', a: '프로필 → 계정 설정에서 탈퇴할 수 있습니다. 탈퇴 시 작성한 글과 댓글은 익명 처리됩니다.' },
          { q: '주식 시세는 실시간인가요?', a: '장중에는 5~10분 간격으로 갱신됩니다. 코스피, 코스닥, NYSE, NASDAQ 주요 종목을 지원합니다.' },
          { q: '청약 정보는 어디서 가져오나요?', a: '공공데이터포털(data.go.kr) API에서 매일 자동 수집합니다.' },
          { q: '단지백과는 뭔가요?', a: '전국 아파트 단지의 시세, 전세가율, 거래 이력을 한눈에 볼 수 있는 프로필 페이지입니다.' },
          { q: '블로그 글은 누가 쓰나요?', a: '공공 데이터를 기반으로 자동 생성됩니다. 투자 권유가 아닌 참고 자료입니다.' },
          { q: '오프라인에서도 사용할 수 있나요?', a: 'PWA 설치 후에는 이전에 본 페이지를 오프라인에서도 볼 수 있습니다. 새 데이터는 온라인 연결이 필요합니다.' },
        ].map((faq, i, arr) => (
          <div key={i} style={{ padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-xs)' }}>Q. {faq.q}</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>A. {faq.a}</div>
          </div>
        ))}
      </div>

      {/* 문의 */}
      <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-card)', padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>💌 문의·건의</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-md)', lineHeight: 1.6 }}>
          버그 신고, 기능 제안, 문의사항이 있으시면 언제든 연락해주세요.
        </div>
        <a href={`mailto:${CONTACT_EMAIL}`} style={{ display: 'inline-block', padding: 'var(--sp-md) var(--sp-2xl)', borderRadius: 'var(--radius-md)', background: 'var(--brand)', color: 'var(--text-inverse)', fontSize: 'var(--fs-sm)', fontWeight: 700, textDecoration: 'none' }}>
          📧 {CONTACT_EMAIL}
        </a>
      </div>
    </div>
  );
}
