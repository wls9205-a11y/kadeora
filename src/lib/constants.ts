import type { PostWithProfile, TrendingKeyword, StockQuote, DiscussionRoom, ShopProduct, AptSubscription } from '@/types/database';

/** 사이트 기본 URL — 환경변수 우선, 폴백 production URL */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

export const DEMO_POSTS: PostWithProfile[] = [
  {
    id: 1, author_id: 'demo-1', category: 'apt', title: '강동구 둔촌주공 재건축 근황 알아봤습니다',
    content: '현장 직접 방문해서 공사 진행 상황 체크해왔어요. 외벽 마감 거의 다 됐고 조경도 들어가고 있네요. 입주 일정은 계획대로 진행 중이라고 합니다. 분양가 대비 현재 프리미엄 붙어있는 상황이고...',
    images: null, view_count: 4821, likes_count: 183, comments_count: 47, is_deleted: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    profiles: { id: 'demo-1', nickname: '아파트왕', avatar_url: null, grade: '골드' }
  },
  {
    id: 2, author_id: 'demo-2', category: 'stock', title: '삼성전자 5만원대 진입 여부 분석 (기술적 분석)',
    content: 'RSI 지표 기준으로 지금 과매도 구간에 진입했습니다. 볼린저 밴드 하단 터치 후 반등 가능성 있고, 거래량도 바닥권에서 조금씩 늘고 있어요. 기관 매수세도 확인되는데...',
    images: null, view_count: 6234, likes_count: 267, comments_count: 89, is_deleted: false,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    profiles: { id: 'demo-2', nickname: '주식고수', avatar_url: null, grade: '플래티넘' }
  },
  {
    id: 3, author_id: 'demo-3', category: 'free', title: '토스뱅크 파킹통장 금리 인상 됐네요',
    content: '오늘 앱 확인하니까 연 3.5% → 4.0%로 올랐습니다. 1억 한도고 한국은행 기준금리 인상 반영한 것 같아요. 다른 인터넷뱅크들도 따라올 것 같은데 카카오뱅크는 아직이네요.',
    images: null, view_count: 2891, likes_count: 94, comments_count: 31, is_deleted: false,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    profiles: { id: 'demo-3', nickname: '금융인싸', avatar_url: null, grade: '실버' }
  },
  {
    id: 4, author_id: 'demo-4', category: 'stock', title: '코스피 3000 돌파 가능성 있나요? 개인적 분석',
    content: '외국인 순매수 5거래일 연속 이어지고 있고 환율도 1350원대 안정됐습니다. 이렇게 되면 코스피 2900까지는 단기 목표로 볼 수 있을 것 같고...',
    images: null, view_count: 8102, likes_count: 341, comments_count: 124, is_deleted: false,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    profiles: { id: 'demo-4', nickname: '마켓워처', avatar_url: null, grade: '골드' }
  },
  {
    id: 5, author_id: 'demo-5', category: 'apt', title: '서울 청약 가점 40점대면 어떤 아파트 狙아야 하나요',
    content: '무주택 7년, 부양가족 3명, 청약통장 10년 조건입니다. 가점 계산하니 47점 나왔는데 강남 3구는 당연히 힘들고 노원, 도봉, 중랑 정도면 가능성 있을까요?',
    images: null, view_count: 3456, likes_count: 121, comments_count: 67, is_deleted: false,
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    profiles: { id: 'demo-5', nickname: '내집마련', avatar_url: null, grade: '브론즈' }
  },
  {
    id: 6, author_id: 'demo-6', category: 'free', title: 'ETF 초보인데 KODEX200 vs TIGER200 차이점 뭔가요',
    content: '둘 다 코스피200 추종하는 ETF인데 뭐가 다른지 모르겠어요. 수수료도 비슷하고... 실제로 운용성과나 괴리율 같은 부분에서 차이가 있나요?',
    images: null, view_count: 1832, likes_count: 78, comments_count: 43, is_deleted: false,
    created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    profiles: { id: 'demo-6', nickname: 'ETF새내기', avatar_url: null, grade: '브론즈' }
  },
  {
    id: 7, author_id: 'demo-7', category: 'stock', title: 'HBM 관련주 정리해봤습니다 (SK하이닉스, 마이크론 등)',
    content: 'AI 반도체 수요로 HBM 공급이 극도로 타이트합니다. SK하이닉스 HBM3E 올해 TSMC 공급 물량 거의 다 팔렸다고 하고, 엔비디아 H200 수요도 예상 초과...',
    images: null, view_count: 5678, likes_count: 234, comments_count: 88, is_deleted: false,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    profiles: { id: 'demo-7', nickname: '반도체덕후', avatar_url: null, grade: '플래티넘' }
  },
  {
    id: 8, author_id: 'demo-8', category: 'apt', title: '경기도 청약 당첨 후기 (수원 팔달구 공공분양)',
    content: '드디어 5번째 청약에서 당첨됐습니다!! 공공분양이라 분양가가 주변 시세 대비 30% 저렴하게 나왔어요. 계약금이나 중도금 준비 과정 궁금하신 분들 있으면 댓글 달아주세요.',
    images: null, view_count: 7823, likes_count: 389, comments_count: 156, is_deleted: false,
    created_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    profiles: { id: 'demo-8', nickname: '당첨자', avatar_url: null, grade: '골드' }
  },
];

export const DEMO_TRENDING: TrendingKeyword[] = [
  { id: 1, keyword: '삼성전자', rank: 1, count: 2341, created_at: new Date().toISOString() },
  { id: 2, keyword: '청약 경쟁률', rank: 2, count: 1876, created_at: new Date().toISOString() },
  { id: 3, keyword: '코스피 3000', rank: 3, count: 1543, created_at: new Date().toISOString() },
  { id: 4, keyword: 'HBM 반도체', rank: 4, count: 1201, created_at: new Date().toISOString() },
  { id: 5, keyword: '토스뱅크', rank: 5, count: 987, created_at: new Date().toISOString() },
  { id: 6, keyword: '파킹통장', rank: 6, count: 876, created_at: new Date().toISOString() },
  { id: 7, keyword: 'SK하이닉스', rank: 7, count: 754, created_at: new Date().toISOString() },
  { id: 8, keyword: '분양가상한제', rank: 8, count: 632, created_at: new Date().toISOString() },
  { id: 9, keyword: '기준금리', rank: 9, count: 521, created_at: new Date().toISOString() },
  { id: 10, keyword: '리츠 배당', rank: 10, count: 456, created_at: new Date().toISOString() },
];

export const DEMO_STOCKS: any[] = [
  { id: 1, symbol: '005930', name: '삼성전자', price: 58400, change_amount: 800, change_rate: 1.39, volume: 12847320, market_cap: 348700000000000, updated_at: new Date().toISOString() },
  { id: 2, symbol: '000660', name: 'SK하이닉스', price: 183000, change_amount: -2500, change_rate: -1.35, volume: 4523156, market_cap: 133200000000000, updated_at: new Date().toISOString() },
  { id: 3, symbol: '035420', name: 'NAVER', price: 178500, change_amount: 3200, change_rate: 1.82, volume: 1238946, market_cap: 29300000000000, updated_at: new Date().toISOString() },
  { id: 4, symbol: '035720', name: '카카오', price: 37450, change_amount: -550, change_rate: -1.45, volume: 2891023, market_cap: 16700000000000, updated_at: new Date().toISOString() },
  { id: 5, symbol: '051910', name: 'LG화학', price: 287000, change_amount: 5500, change_rate: 1.95, volume: 389123, market_cap: 20200000000000, updated_at: new Date().toISOString() },
  { id: 6, symbol: '006400', name: '삼성SDI', price: 198500, change_amount: -1500, change_rate: -0.75, volume: 521456, market_cap: 14400000000000, updated_at: new Date().toISOString() },
  { id: 7, symbol: '207940', name: '삼성바이오로직스', price: 832000, change_amount: 12000, change_rate: 1.46, volume: 145233, market_cap: 58900000000000, updated_at: new Date().toISOString() },
  { id: 8, symbol: '068270', name: '셀트리온', price: 142500, change_amount: 2000, change_rate: 1.42, volume: 892341, market_cap: 19600000000000, updated_at: new Date().toISOString() },
  { id: 9, symbol: '005380', name: '현대차', price: 198000, change_amount: -800, change_rate: -0.40, volume: 1023456, market_cap: 42200000000000, updated_at: new Date().toISOString() },
  { id: 10, symbol: '003550', name: 'LG', price: 73200, change_amount: 600, change_rate: 0.83, volume: 678234, market_cap: 12800000000000, updated_at: new Date().toISOString() },
];

export const DEMO_DISCUSS: any[] = [
  { id: 1, title: '삼성전자 6만원 복귀 가능할까? 🔥', description: '현재 주가 분석 및 전망 토론', category: 'stock', participants_count: 234, messages_count: 1847, is_active: true, created_at: new Date().toISOString() },
  { id: 2, title: '2026 청약 전략 공유방', description: '청약 가점, 지역, 타이밍 등 전략 공유', category: 'apt', participants_count: 189, messages_count: 2341, is_active: true, created_at: new Date().toISOString() },
  { id: 3, title: 'HBM 반도체 슈퍼사이클 얼마나 갈까', description: 'AI 반도체 시장 전망 토론', category: 'stock', participants_count: 312, messages_count: 3102, is_active: true, created_at: new Date().toISOString() },
  { id: 4, title: '파킹통장 금리 비교 & 추천', description: '각 은행 파킹통장 실시간 금리 공유', category: 'free', participants_count: 156, messages_count: 891, is_active: true, created_at: new Date().toISOString() },
  { id: 5, title: '코스피 3000 연내 돌파 가능?', description: '매크로 환경 분석 및 지수 전망', category: 'stock', participants_count: 421, messages_count: 4567, is_active: true, created_at: new Date().toISOString() },
  { id: 6, title: '서울 외곽 vs 경기 핵심지 청약 전략', description: '무주택자 청약 지역 선택 전략', category: 'apt', participants_count: 98, messages_count: 543, is_active: true, created_at: new Date().toISOString() },
  { id: 7, title: 'ETF 포트폴리오 구성 방법', description: '패시브 투자 전략 및 ETF 선택 가이드', category: 'free', participants_count: 267, messages_count: 1234, is_active: true, created_at: new Date().toISOString() },
  { id: 8, title: 'NAVER vs 카카오 어디 담을까?', description: '국내 빅테크 2파전 비교 토론', category: 'stock', participants_count: 345, messages_count: 2891, is_active: true, created_at: new Date().toISOString() },
  { id: 9, title: '강남 아파트 언제 반등할까', description: '강남권 부동산 시장 분석', category: 'apt', participants_count: 178, messages_count: 1567, is_active: true, created_at: new Date().toISOString() },
  { id: 10, title: '금리 인하 시점과 투자 전략', description: '한은 금통위 전망 및 대응 전략', category: 'free', participants_count: 534, messages_count: 5678, is_active: true, created_at: new Date().toISOString() },
];

export const DEMO_APT: AptSubscription[] = [
  { id: 1, name: '래미안 원베일리', location: '서울 서초구', total_units: 2990, subscription_type: '민간분양', rcept_bgnde: '2026-03-20', application_end: '2026-03-22', move_in_date: '2027-12-01', min_price: 150000, max_price: 280000, status: 'upcoming', competition_rate: null, homepage_url: 'https://applyhome.co.kr', created_at: new Date().toISOString() },
  { id: 2, name: '힐스테이트 광교중앙역', location: '경기 수원시', total_units: 845, subscription_type: '민간분양', rcept_bgnde: '2026-03-15', application_end: '2026-03-17', move_in_date: '2027-06-01', min_price: 58000, max_price: 95000, status: 'open', competition_rate: 47.3, homepage_url: 'https://applyhome.co.kr', created_at: new Date().toISOString() },
  { id: 3, name: '검단 푸르지오 더 파크', location: '인천 서구', total_units: 1284, subscription_type: '공공분양', rcept_bgnde: '2026-03-10', application_end: '2026-03-12', move_in_date: '2027-03-01', min_price: 35000, max_price: 52000, status: 'closed', competition_rate: 23.1, homepage_url: 'https://applyhome.co.kr', created_at: new Date().toISOString() },
  { id: 4, name: '올림픽파크 포레온 2차', location: '서울 강동구', total_units: 4786, subscription_type: '민간분양', rcept_bgnde: '2026-04-08', application_end: '2026-04-10', move_in_date: '2028-06-01', min_price: 120000, max_price: 198000, status: 'upcoming', competition_rate: null, homepage_url: 'https://applyhome.co.kr', created_at: new Date().toISOString() },
  { id: 5, name: '평택 브레인시티 e편한세상', location: '경기 평택시', total_units: 2156, subscription_type: '공공분양', rcept_bgnde: '2026-03-25', application_end: '2026-03-27', move_in_date: '2027-09-01', min_price: 28000, max_price: 45000, status: 'upcoming', competition_rate: null, homepage_url: 'https://applyhome.co.kr', created_at: new Date().toISOString() },
  { id: 6, name: '위례 자이 더 시티', location: '경기 성남시', total_units: 698, subscription_type: '민간분양', rcept_bgnde: '2026-02-28', application_end: '2026-03-02', move_in_date: '2026-12-01', min_price: 75000, max_price: 125000, status: 'closed', competition_rate: 128.7, homepage_url: 'https://applyhome.co.kr', created_at: new Date().toISOString() },
];

export const DEMO_PRODUCTS: ShopProduct[] = [
  { id: 'megaphone-1d', name: '1일 메가폰', description: '24시간 동안 내 게시글을 피드 상단에 고정해드립니다', price_krw: 500, icon: '📢', is_active: true, created_at: new Date().toISOString() },
  { id: 'megaphone-3d', name: '3일 메가폰', description: '72시간 상단 고정 + HOT 배지 부착', price_krw: 1200, icon: '🔥', is_active: true, created_at: new Date().toISOString() },
  { id: 'megaphone-7d', name: '7일 메가폰', description: '7일 상단 고정 + 추천 섹션 등록', price_krw: 2500, icon: '🚀', is_active: true, created_at: new Date().toISOString() },
  { id: 'badge-gold', name: '골드 등급 뱃지', description: '프로필에 골드 등급 뱃지를 30일간 표시합니다', price_krw: 3000, icon: '🥇', is_active: true, created_at: new Date().toISOString() },
  { id: 'anonymous-post', name: '익명 게시글', description: '닉네임 없이 익명으로 게시글을 작성할 수 있습니다 (3회)', price_krw: 800, icon: '🕵️', is_active: true, created_at: new Date().toISOString() },
  { id: 'premium-nickname', name: '프리미엄 닉네임 색상', description: '닉네임에 프리미엄 컬러 효과를 7일간 적용합니다', price_krw: 600, icon: '🎨', is_active: true, created_at: new Date().toISOString() },
  { id: 'pin-comment', name: '댓글 고정권', description: '특정 게시글에서 내 댓글을 상단에 고정합니다 (1회)', price_krw: 300, icon: '📌', is_active: true, created_at: new Date().toISOString() },
  { id: 'premium-membership', name: '30일 프리미엄 멤버십', description: '광고 없는 깔끔한 환경 + 전용 채널 접근', price_krw: 9900, icon: '💎', is_active: true, created_at: new Date().toISOString() },
];

// DB grade_definitions 테이블 기준
export const GRADE_MAP: Record<number, { title: string; emoji: string; color: string }> = {
  1:  { title: '새싹',       emoji: '🌱', color: '#34D399' },
  2:  { title: '정보통',     emoji: '📡', color: '#60A5FA' },
  3:  { title: '동네어른',   emoji: '🏘️', color: '#A78BFA' },
  4:  { title: '소문난집',   emoji: '🏠', color: '#FBBF24' },
  5:  { title: '인플루언서', emoji: '⚡', color: '#F87171' },
  6:  { title: '빅마우스',   emoji: '🔥', color: '#FB7185' },
  7:  { title: '찐고수',     emoji: '💎', color: '#22D3EE' },
  8:  { title: '전설',       emoji: '🌟', color: '#FCD34D' },
  9:  { title: '신의경지',   emoji: '👑', color: '#818CF8' },
  10: { title: '카더라신',   emoji: '🚀', color: '#C084FC' },
};

// 하위 호환
export const GRADE_EMOJI: Record<number, string> = Object.fromEntries(
  Object.entries(GRADE_MAP).map(([k, v]) => [Number(k), v.emoji])
);

export function gradeInfo(grade: number | null) { return GRADE_MAP[grade ?? 1] ?? GRADE_MAP[1]; }
export function gradeEmoji(grade: number | null): string { return gradeInfo(grade).emoji; }
export function gradeColor(grade: number | null): string { return gradeInfo(grade).color; }
export function gradeTitle(grade: number | null): string { return gradeInfo(grade).title; }

export const CATEGORY_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  stock: { label: '주식', color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
  apt: { label: '부동산', color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  local: { label: '우리동네', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  free: { label: '자유', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
};

export const CATEGORY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  apt: { label: '청약', color: '#34D399', bg: 'rgba(52,211,153,0.12)' },
  stock: { label: '주식', color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
  local: { label: '우리동네', color: '#FBBF24', bg: 'rgba(251,191,36,0.12)' },
  free: { label: '자유', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
  all: { label: '전체', color: '#9DB0C7', bg: 'transparent' },
};

export const REGIONS = [
  { value: 'all', label: '전체' },
  { value: '서울', label: '서울' },
  { value: '부산', label: '부산' },
  { value: '인천', label: '인천' },
  { value: '대구', label: '대구' },
  { value: '대전', label: '대전' },
  { value: '광주', label: '광주' },
  { value: '울산', label: '울산' },
  { value: '세종', label: '세종' },
  { value: '경기', label: '경기' },
  { value: '강원', label: '강원' },
  { value: '충북', label: '충북' },
  { value: '충남', label: '충남' },
  { value: '전북', label: '전북' },
  { value: '전남', label: '전남' },
  { value: '경북', label: '경북' },
  { value: '경남', label: '경남' },
  { value: '제주', label: '제주' },
];

export const GRADE_INFO: Record<string, { icon: string; color: string }> = {
  '씨앗': { icon: '🌱', color: '#9DB0C7' },
  '새싹': { icon: '🌿', color: '#34D399' },
  '브론즈': { icon: '🥉', color: '#FBBF24' },
  '실버': { icon: '🥈', color: '#9DB0C7' },
  '골드': { icon: '🥇', color: '#FCD34D' },
  '플래티넘': { icon: '💎', color: '#A78BFA' },
  '다이아': { icon: '🔷', color: '#22D3EE' },
};
