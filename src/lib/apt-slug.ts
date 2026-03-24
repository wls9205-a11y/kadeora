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
