export const PUSH_TEMPLATES = {
  APT_SUBSCRIPTION_REMIND: {
    title: '📅 청약 마감 임박!',
    body: (vars: Record<string, any>) => `${vars.apt_name} 청약 마감 ${vars.days}일 전입니다`,
    url: '/apt',
    priority: 'high' as const,
  },
  APT_WATCHLIST_TRADE: {
    title: '💰 관심단지 새 거래!',
    body: (vars: Record<string, any>) => `${vars.apt_name} ${vars.area || ''}㎡ ${vars.price || ''}억 거래`,
    url: '/apt?tab=trade',
    priority: 'medium' as const,
  },
  STOCK_WATCHLIST_ALERT: {
    title: (vars: Record<string, any>) => `📈 관심종목 ${vars.direction}!`,
    body: (vars: Record<string, any>) => `${vars.stock_name} ${vars.change_pct}% ${vars.direction} (현재 ${vars.price}원)`,
    url: (vars: Record<string, any>) => `/stock/${vars.symbol}`,
    priority: 'high' as const,
  },
  STOCK_DAILY_BRIEFING: {
    title: '🤖 오늘의 시황',
    body: (vars: Record<string, any>) => vars.title || '오늘의 시장 분석이 발행되었습니다',
    url: '/stock',
    priority: 'low' as const,
  },
  POST_COMMENT: {
    title: '💬 새 댓글',
    body: (vars: Record<string, any>) => `${vars.nickname}님이 댓글을 남겼습니다`,
    url: (vars: Record<string, any>) => `/feed/${vars.post_id}`,
    priority: 'medium' as const,
  },
  UNSOLD_CHANGE: {
    title: '🏚️ 미분양 현황 변동',
    body: (vars: Record<string, any>) => `${vars.region} 미분양 ${vars.direction} (${vars.count}세대)`,
    url: '/apt?tab=unsold',
    priority: 'low' as const,
  },
  WEEKLY_REVIEW: {
    title: '📊 주간 시장 리뷰',
    body: () => '이번 주 부동산/주식 시장 분석이 발행되었습니다',
    url: '/blog',
    priority: 'low' as const,
  },
  GRADE_UP: {
    title: '🎉 등급 승급!',
    body: (vars: Record<string, any>) => `${vars.grade_title} 등급으로 승급했습니다`,
    url: '/profile',
    priority: 'medium' as const,
  },
} as const;

export type PushTemplateKey = keyof typeof PUSH_TEMPLATES;
