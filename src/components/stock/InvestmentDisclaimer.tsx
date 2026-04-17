'use client';

/**
 * 투자 면책고지 강화 컴포넌트
 * 
 * 자본시장법 기반 표준 면책 문구.
 * 기존 Disclaimer.tsx와 별개로, AI 생성 콘텐츠에 특화.
 * 
 * 사용처:
 * - 수급 시그널 페이지
 * - AI 분석 블로그 포스트
 * - 종목 Q&A 응답
 * - 실적 분석 페이지
 * - 매크로 영향 분석
 */

interface Props {
  variant?: 'full' | 'compact' | 'inline';
  showAiNote?: boolean;
}

export default function InvestmentDisclaimer({ variant = 'full', showAiNote = true }: Props) {
  if (variant === 'inline') {
    return (
      <span style={{
        fontSize: '11px',
        color: 'var(--text-tertiary)',
        fontStyle: 'italic',
      }}>
        본 정보는 투자 권유가 아닙니다.
      </span>
    );
  }

  return (
    <div style={{
      marginTop: variant === 'compact' ? '16px' : '32px',
      padding: variant === 'compact' ? '12px 14px' : '16px 20px',
      borderRadius: 'var(--radius-md, 8px)',
      background: 'var(--bg-tertiary, #f8f9fa)',
      border: '1px solid var(--border)',
      fontSize: variant === 'compact' ? '11px' : '12px',
      color: 'var(--text-tertiary)',
      lineHeight: 1.7,
    }}>
      <p style={{ margin: '0 0 6px', fontWeight: 600 }}>
        ⚠️ 투자 유의사항
      </p>
      <p style={{ margin: 0 }}>
        본 콘텐츠는 정보 제공 목적으로 작성되었으며, 특정 금융상품의 매수·매도를 권유하지 않습니다.
        투자 판단의 최종 책임은 투자자 본인에게 있으며, 카더라는 투자 결과에 대해 어떠한 책임도 지지 않습니다.
        과거 수익률이 미래 수익률을 보장하지 않습니다.
      </p>
      {showAiNote && (
        <p style={{ margin: '6px 0 0', fontSize: '11px' }}>
          🤖 본 콘텐츠는 AI 기반 자동 분석을 포함하고 있으며, 오류가 있을 수 있습니다.
          중요한 투자 결정 전 원본 공시·데이터를 직접 확인하시기 바랍니다.
        </p>
      )}
      <p style={{ margin: '6px 0 0', fontSize: '11px' }}>
        📊 데이터 출처: DART 전자공시시스템 · KRX 정보데이터시스템 · SEC EDGAR · 금융위원회 · Yahoo Finance
      </p>
    </div>
  );
}
