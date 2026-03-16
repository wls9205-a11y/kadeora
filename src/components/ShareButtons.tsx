'use client'
import{useState}from'react'
interface ShareButtonsProps{title:string;url?:string;postId:number|string}
export default function ShareButtons({title,url,postId}:ShareButtonsProps){
  const[copied,setCopied]=useState(false)
  const shareUrl=url??(typeof window!=='undefined'?`${window.location.origin}/feed/${postId}`:`https://kadeora.vercel.app/feed/${postId}`)
  const handleCopy=async()=>{try{await navigator.clipboard.writeText(shareUrl)}catch{const el=document.createElement('textarea');el.value=shareUrl;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el)};setCopied(true);setTimeout(()=>setCopied(false),2000)}
  const handleKakao=()=>window.open(`https://story.kakao.com/share?url=${encodeURIComponent(shareUrl)}`,'_blank','width=500,height=400')
  const handleTwitter=()=>window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title+' | 카더라')}&url=${encodeURIComponent(shareUrl)}`,'_blank','width=550,height=420')
  const btn:React.CSSProperties={display:'flex',alignItems:'center',gap:'6px',padding:'7px 14px',borderRadius:'8px',border:'1px solid var(--border)',background:'var(--bg-surface)',color:'var(--text-secondary)',fontSize:'13px',fontWeight:500,cursor:'pointer',transition:'all 0.15s'}
  return(
    <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',marginTop:'16px',paddingTop:'16px',borderTop:'1px solid var(--border)'}}>
      <span style={{fontSize:'12px',color:'var(--text-tertiary)',marginRight:'4px'}}>공유하기</span>
      <button onClick={handleKakao} style={{...btn,background:'#FEE500',color:'#191919',borderColor:'#FEE500'}} aria-label="카카오톡으로 공유">카카오톡</button>
      <button onClick={handleTwitter} style={btn} aria-label="트위터로 공유">X(트위터)</button>
      <button onClick={handleCopy} style={{...btn,...(copied?{background:'var(--success-bg)',color:'var(--success)',borderColor:'var(--success)'}:{})}} aria-label="링크 복사">{copied?'✓ 복사됨':'링크 복사'}</button>
    </div>
  )
}