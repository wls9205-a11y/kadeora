/**
 * Wes Bos: "rate-limit에 3, 10, 30 같은 숫자가 하드코딩 — 맥락이 없다"
 * 모든 매직 넘버를 이름 있는 상수로 추출
 */

// --- Rate Limiting ---
/** OTP 인증: 분당 최대 시도 횟수 */
export const MAX_OTP_ATTEMPTS_PER_MINUTE = 3;
/** OTP 인증: 시간당 최대 시도 횟수 */
export const MAX_OTP_ATTEMPTS_PER_HOUR = 10;
/** 채팅: 분당 최대 메시지 수 */
export const MAX_CHAT_MESSAGES_PER_MINUTE = 30;
/** API: 분당 최대 요청 수 */
export const MAX_API_REQUESTS_PER_MINUTE = 60;
/** 버그 제보: 분당 최대 제출 수 */
export const MAX_BUG_REPORTS_PER_MINUTE = 5;
/** 검색: 분당 최대 검색 수 */
export const MAX_SEARCH_REQUESTS_PER_MINUTE = 30;

// --- Content Limits ---
/** 게시글 제목 최대 길이 */
export const MAX_POST_TITLE_LENGTH = 100;
/** 게시글 본문 최대 길이 */
export const MAX_POST_CONTENT_LENGTH = 5000;
/** 댓글 최대 길이 */
export const MAX_COMMENT_LENGTH = 1000;
/** 게시글당 최대 이미지 수 */
export const MAX_IMAGES_PER_POST = 5;
/** 이미지 최대 크기 (bytes): 10MB */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

// --- Allowed File Types ---
/** 업로드 허용 이미지 MIME 타입 */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

// --- Spam Detection ---
/** 스팸 판정: 동일 메시지 반복 횟수 임계값 */
export const SPAM_DUPLICATE_THRESHOLD = 3;
/** 스팸 판정: 5분 내 메시지 수 임계값 */
export const SPAM_VOLUME_THRESHOLD = 10;
/** 스팸 감지 윈도우 (초) */
export const SPAM_WINDOW_SECONDS = 300;

// --- Cache TTL ---
/** 트렌딩 키워드 캐시 (초) */
export const CACHE_TTL_TRENDING = 60;
/** 피드 게시글 캐시 (초) */
export const CACHE_TTL_POSTS = 30;
/** 주식 시세 캐시 (초) */
export const CACHE_TTL_STOCK = 30;

// --- Pagination ---
/** 피드 기본 페이지 크기 */
export const DEFAULT_PAGE_SIZE = 20;
/** 피드 최대 페이지 크기 */
export const MAX_PAGE_SIZE = 50;
/** 트렌딩 키워드 표시 개수 */
export const TRENDING_KEYWORDS_LIMIT = 10;

// --- Auth ---
/** 인증 보호 대상 경로 */
export const PROTECTED_PATHS = ["/write", "/payment", "/profile"] as const;
/** 최소 가입 연령 */
export const MINIMUM_AGE_YEARS = 14;

// --- User Retention ---
/** 탈퇴 후 복구 가능 기간 (일) */
export const ACCOUNT_RECOVERY_DAYS = 30;
/** 채팅 내용 보관 기간 (일) */
export const CHAT_RETENTION_DAYS = 365;
/** 행태정보 보관 기간 (일) */
export const ANALYTICS_RETENTION_DAYS = 180;

// --- Categories ---
export const POST_CATEGORIES = [
  { value: "all", label: "전체" },
  { value: "stock", label: "주식" },
  { value: "apt", label: "청약" },
  { value: "community", label: "커뮤니티" },
  { value: "free", label: "자유" },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  stock: "#3B82F6",
  apt: "#10B981",
  community: "#8B5CF6",
  bug: "#EF4444",
  free: "#F59E0B",
};

export const CATEGORY_LABELS: Record<string, string> = {
  stock: "주식",
  apt: "청약",
  community: "커뮤니티",
  bug: "버그",
  free: "자유",
};
