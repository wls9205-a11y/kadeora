export default function Disclaimer() {
  return (
    <p style={{
      fontSize: 'var(--fs-xs)',
      color: 'var(--text-tertiary)',
      textAlign: 'center',
      padding: '6px 16px',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 56px)',
      borderTop: '1px solid var(--border)',
      margin: 0,
      lineHeight: 1.6,
    }}>
      본 서비스의 정보는 투자 권유가 아니며, 투자 손실에 대한 책임은 투자자 본인에게 있습니다.
      <br />
      청약: 공공데이터포털(data.go.kr) · 미분양: 국토교통부 통계누리 · 실거래: 국토교통부 실거래가 공개시스템 · 주식: 금융위원회 공공데이터 API · 재개발: 서울시·경기도·부산시 공공데이터
    </p>
  );
}
