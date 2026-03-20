export default function Disclaimer() {
  return (
    <p style={{
      fontSize: 10,
      color: 'var(--text-tertiary)',
      textAlign: 'center',
      padding: '6px 16px',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 56px)',
      borderTop: '1px solid var(--border)',
      margin: 0,
    }}>
      본 서비스의 정보는 투자 권유가 아니며, 투자 손실에 대한 책임은 투자자 본인에게 있습니다.
      <br />
      청약 데이터: 청약홈(applyhome.co.kr) 공공데이터 | 미분양: 국토교통부 | 주식 시세: 장 마감 기준
    </p>
  );
}
