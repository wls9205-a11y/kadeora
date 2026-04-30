// 아파트 현장명 → URL slug 변환 (한글 유지)
// sync-apt-sites 크론과 동일한 로직 유지
export function generateAptSlug(name: string): string {
  if (!name || !name.trim()) return '';
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w가-힣\-]/g, '')
    .toLowerCase();
}

// slug인지 숫자 ID인지 판별
export function isNumericId(id: string): boolean {
  return /^\d+$/.test(id);
}

// s218 Track A: UUID 형식 판별 (apt_sites.id 직접 lookup 분기용)
// Supabase apt_sites 의 id 가 uuid 형. /apt/<uuid> 직접 진입 시 slug 로 잘못 lookup → 404 발생.
export function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
