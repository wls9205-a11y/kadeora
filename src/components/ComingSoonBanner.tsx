'use client'
interface Props{feature:string;description?:string;eta?:string}
export default function ComingSoonBanner({feature,description,eta}:Props){
  return(
    <div style={{background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:'12px',padding:'16px 20px',marginBottom:'20px',display:'flex',alignItems:'flex-start',gap:'12px'}} role="status">
      <span style={{fontSize:'22px',flexShrink:0}}>🔧</span>
      <div>
        <div style={{fontSize:'14px',fontWeight:700,color:'var(--warning)',marginBottom:'4px'}}>{feature} — 준비 중</div>
        <div style={{fontSize:'13px',color:'var(--text-secondary)',lineHeight:1.5}}>{description??'현재 이 기능은 준비 중입니다. 빠른 시일 내에 오픈 예정입니다.'}</div>
        {eta&&<div style={{fontSize:'12px',color:'var(--text-tertiary)',marginTop:'6px'}}>예상 오픈: {eta}</div>}
      </div>
    </div>
  )
}
export function StockDataNotice({updatedAt}:{updatedAt?:string}){
  const d=updatedAt?new Date(updatedAt).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'}):'수동 업데이트'
  return(
    <div style={{background:'rgba(96,165,250,0.06)',border:'1px solid rgba(96,165,250,0.2)',borderRadius:'10px',padding:'10px 16px',marginBottom:'16px',fontSize:'12px',color:'var(--text-secondary)',display:'flex',alignItems:'center',gap:'8px'}}>
      <span>ℹ️</span>
      <span>현재 표시되는 주식 데이터는 <strong style={{color:'var(--text-primary)'}}>수동 업데이트 데이터</strong>입니다. 기준일: {d}</span>
    </div>
  )
}