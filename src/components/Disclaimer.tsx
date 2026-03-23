/**
 * 면책고지 통합 컴포넌트
 * 이전: 10곳에서 각각 다른 텍스트로 하드코딩
 * 이후: <Disclaimer type="stock" /> 한 줄로 통일
 */

const TEXTS: Record<string, { disclaimer: string; source?: string }> = {
  stock: {
    disclaimer: '본 서비스의 주식 정보는 투자 참고용이며 투자 권유가 아닙니다. 투자 손실에 대한 책임은 투자자 본인에게 있습니다.',
    source: '주식: 금융위원회 공공데이터 API',
  },
  apt: {
    disclaimer: '본 정보는 참고용이며 투자 권유가 아닙니다. 투자에 따른 손익은 투자자 본인에게 귀속됩니다.',
    source: '청약: 공공데이터포털(data.go.kr) · 실거래: 국토교통부 실거래가 공개시스템',
  },
  unsold: {
    disclaimer: '본 정보는 참고용이며 투자 권유가 아닙니다. 투자에 따른 손익은 투자자 본인에게 귀속됩니다.',
    source: '국토교통부 미분양주택현황 통계 · 매월 말 발표 기준',
  },
  redev: {
    disclaimer: '본 정보는 참고용이며 투자 권유가 아닙니다. 실제 진행 상황은 해당 조합 또는 지자체에 직접 확인하세요.',
    source: '서울시·경기도·부산시 공공데이터 · 매주 월요일 갱신',
  },
  trade: {
    disclaimer: '본 정보는 참고용이며 투자 권유가 아닙니다.',
    source: '국토교통부 실거래가 공개시스템 기준',
  },
  feed: {
    disclaimer: '이 게시글은 개인의 의견이며 투자 권유가 아닙니다. 모든 투자 판단과 손익은 투자자 본인에게 귀속됩니다.',
  },
  general: {
    disclaimer: '본 서비스의 정보는 투자 권유가 아니며, 투자 손실에 대한 책임은 투자자 본인에게 있습니다.',
    source: '청약: 공공데이터포털 · 미분양: 국토교통부 · 실거래: 국토교통부 · 주식: 금융위원회 · 재개발: 서울시·경기도·부산시',
  },
};

interface Props {
  type?: keyof typeof TEXTS;
  /** compact: 인라인용 (하단 safe-area 없이) */
  compact?: boolean;
}

export default function Disclaimer({ type = 'general', compact = false }: Props) {
  const t = TEXTS[type] ?? TEXTS.general;
  return (
    <p style={{
      fontSize: 'var(--fs-xs)',
      color: 'var(--text-tertiary)',
      textAlign: 'center',
      padding: compact ? '8px 12px' : '6px 16px',
      paddingBottom: compact ? undefined : 'calc(env(safe-area-inset-bottom) + 56px)',
      borderTop: compact ? undefined : '1px solid var(--border)',
      margin: compact ? '12px 0 0' : 0,
      lineHeight: 1.6,
    }}>
      ⚠️ {t.disclaimer}
      {t.source && !compact && <><br />📊 {t.source}</>}
    </p>
  );
}
