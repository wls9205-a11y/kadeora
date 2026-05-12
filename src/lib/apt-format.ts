// lib/apt-format.ts
export function formatKoreanPrice(amount: number | null | undefined): string {
  if (amount == null || amount === 0) return '—';
  const eok = Math.floor(amount / 10000);
  const man = amount % 10000;
  if (eok > 0 && man >= 1000) return `${eok}.${Math.floor(man / 1000)}억`;
  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString('ko')}만`;
  if (eok > 0) return `${eok}억`;
  return `${amount.toLocaleString('ko')}만`;
}

export function formatPyeongPrice(pyeongPrice: number | null | undefined): string {
  if (pyeongPrice == null) return '—';
  return `${pyeongPrice.toLocaleString('ko')}만/평`;
}

export function formatArea(sqm: number | string | null | undefined): string {
  if (sqm == null) return '—';
  const num = typeof sqm === 'string' ? parseFloat(sqm) : sqm;
  if (isNaN(num)) return '—';
  const pyeong = Math.round(num / 3.305785);
  return `${num.toFixed(1)}㎡ (${pyeong}평)`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function formatYearMonth(ym: string | null | undefined): string {
  if (!ym) return '—';
  const cleaned = ym.replace(/[^\d]/g, '');
  if (cleaned.length === 6) {
    return `${cleaned.slice(0, 4)}년 ${parseInt(cleaned.slice(4, 6), 10)}월`;
  }
  return ym;
}

export function calcDday(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function ddayBucket(dday: number | null): 'imminent' | 'soon' | 'upcoming' | 'past' | null {
  if (dday == null) return null;
  if (dday < 0) return 'past';
  if (dday <= 1) return 'imminent';
  if (dday <= 7) return 'soon';
  return 'upcoming';
}

export function formatMargin(margin: number | null | undefined): string {
  if (margin == null) return '—';
  const sign = margin > 0 ? '+' : '';
  return `${sign}${margin.toFixed(1)}%`;
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  if (hour < 24) return `${hour}시간 전`;
  if (day < 30) return `${day}일 전`;
  return formatDate(iso);
}
