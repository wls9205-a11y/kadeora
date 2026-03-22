export const AVATAR_COLORS = ['#2563EB','#FF8C42','#4CAF50','#2196F3','#9C27B0','#E91E63','#FF9800','#00BCD4'];
export function getAvatarColor(str: string): string {
  const hash = (str || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
