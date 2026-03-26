
/** 사이트 기본 URL — 환경변수 우선, 폴백 production URL */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

// Demo data uses simplified shapes for SSR fallbacks — typed loosely
export const DEMO_POSTS: any[] = [
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


// DB grade_definitions 테이블 기준
export const GRADE_MAP: Record<number, { title: string; emoji: string; color: string }> = {
  1:  { title: '새싹',       emoji: '🌱', color: '#2EE8A5' },
  2:  { title: '정보통',     emoji: '📡', color: '#6CB4FF' },
  3:  { title: '동네어른',   emoji: '🏘️', color: '#B794FF' },
  4:  { title: '소문난집',   emoji: '🏠', color: '#FFD43B' },
  5:  { title: '인플루언서', emoji: '⚡', color: '#FF6B6B' },
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


export const CATEGORY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  apt: { label: '청약', color: '#2EE8A5', bg: 'rgba(52,211,153,0.12)' },
  stock: { label: '주식', color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
  local: { label: '우리동네', color: '#FFD43B', bg: 'rgba(251,191,36,0.12)' },
  free: { label: '자유', color: '#B794FF', bg: 'rgba(167,139,250,0.12)' },
  all: { label: '전체', color: '#94A8C4', bg: 'transparent' },
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


export const GRADE_COLORS: Record<number, string> = {
  1:'var(--accent-green)',2:'var(--accent-blue)',3:'var(--accent-purple)',4:'var(--accent-yellow)',5:'var(--accent-red)',
  6:'#FB7185',7:'#22D3EE',8:'var(--accent-yellow)',9:'var(--accent-purple)',10:'#C084FC',
};
export const GRADE_TITLES: Record<number, string> = {
  1:'새싹',2:'정보통',3:'동네어른',4:'소문난집',5:'인플루언서',
  6:'빅마우스',7:'찐고수',8:'전설',9:'신의경지',10:'카더라신',
};
