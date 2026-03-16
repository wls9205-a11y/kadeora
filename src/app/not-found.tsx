export default function NotFound() {
  return (
    <div style={{ textAlign:'center', padding:'60px 20px', minHeight:'50vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize: 48 }}>🤔</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: '16px 0 8px' }}>
        페이지를 찾을 수 없어요
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        삭제됐거나 주소가 잘못됐을 수 있어요
      </p>
      <a href="/feed" style={{
        display: 'inline-block', background: 'var(--brand)', color: 'var(--text-inverse)',
        padding: '10px 24px', borderRadius: 20, textDecoration: 'none', fontWeight: 700
      }}>홈으로 돌아가기</a>
    </div>
  );
}
