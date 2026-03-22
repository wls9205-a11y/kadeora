export const AVATAR_COLORS = ['#60A5FA','#FBBF24','#34D399','#A78BFA','#FB7185','#22D3EE','#FB923C','#2DD4BF'];
export function getAvatarColor(str: string): string {
  const hash = (str || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
