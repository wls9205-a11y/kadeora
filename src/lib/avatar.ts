export const AVATAR_COLORS = ['#6CB4FF','#FFD43B','#2EE8A5','#B794FF','#FF6B8A','#22D3EE','#FF9F43','#2DD4BF'];
export function getAvatarColor(str: string): string {
  const hash = (str || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
