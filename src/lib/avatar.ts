export const AVATAR_COLORS = ['#3B82F6','#F59E0B','#10B981','#8B5CF6','#EC4899','#06B6D4','#F97316','#14B8A6'];
export function getAvatarColor(str: string): string {
  const hash = (str || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
