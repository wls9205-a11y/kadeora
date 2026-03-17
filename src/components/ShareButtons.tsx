'use client'
import{useState,useRef,useEffect}from'react'
interface ShareButtonsProps{title:string;url?:string;postId:number|string}
export default function ShareButtons({title,url,postId}:ShareButtonsProps){
  const[copied,setCopied]=useState(false)
  const[open,setOpen]=useState(false)
  const ref=useRef<HTMLDivElement>(null)
  const shareUrl=url??(typeof window!=='undefined'?`${window.location.origin}/feed/${postId}`:`https://kadeora.vercel.app/feed/${postId}`)
  const handleCopy=async()=>{try{await navigator.clipboard.writeText(shareUrl)}catch{const el=document.createElement('textarea');el.value=shareUrl;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el)};setCopied(true);setTimeout(()=>setCopied(false),2000)}
  const handleTwitter=()=>window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title+' | 카더라')}&url=${encodeURIComponent(shareUrl)}`,'_blank','width=550,height=420')
  const handleKakao=(e?:React.MouseEvent)=>{
    e?.stopPropagation?.()
    if(typeof window==='undefined'||typeof window.Kakao==='undefined'){handleCopy();return}
    if(!window.Kakao.isInitialized()){window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY||'')}
    if(window.Kakao.isInitialized()){
      window.Kakao.Share.sendDefault({
        objectType:'feed',
        content:{title:title,description:title,imageUrl:'https://kadeora.app/og-image.png',link:{mobileWebUrl:shareUrl,webUrl:shareUrl}},
        buttons:[{title:'카더라에서 보기',link:{mobileWebUrl:shareUrl,webUrl:shareUrl}}],
      })
      setOpen(false)
      return
    }
    handleCopy()
  }
  useEffect(()=>{
    if(!open)return
    const handler=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)}
    document.addEventListener('mousedown',handler)
    return()=>document.removeEventListener('mousedown',handler)
  },[open])
  const btn:React.CSSProperties={display:'flex',alignItems:'center',gap:'6px',padding:'7px 16px',borderRadius:'8px',border:'1px solid var(--border)',background:'var(--bg-surface)',color:'var(--text-secondary)',fontSize:'13px',fontWeight:500,cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap',width:'100%',justifyContent:'center'}
  return(
    <div ref={ref} style={{position:'relative',display:'flex',justifyContent:'center'}}>
      <button onClick={()=>setOpen(v=>!v)} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:4,padding:'6px 10px',borderRadius:20,background:'var(--bg-hover)',border:'1px solid var(--border)',color:'var(--text-secondary)',fontSize:13,cursor:'pointer',width:'100%'}} aria-label="공유하기">
        🔗 <span>공유</span>
      </button>
      {open&&(
        <div style={{position:'absolute',bottom:'100%',left:'50%',transform:'translateX(-50%)',marginBottom:8,background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:12,padding:8,display:'flex',flexDirection:'column',gap:6,minWidth:140,boxShadow:'0 -4px 16px rgba(0,0,0,0.1)',zIndex:10}}>
          <button onClick={(e)=>handleKakao(e)} style={{...btn,background:'#FEE500',color:'#191919',borderColor:'#FEE500'}} aria-label="카카오톡으로 공유">카카오톡</button>
          <button onClick={()=>{handleTwitter();setOpen(false)}} style={btn} aria-label="트위터로 공유">X(트위터)</button>
          <button onClick={()=>{handleCopy();setOpen(false)}} style={{...btn,...(copied?{background:'var(--success-bg)',color:'var(--success)',borderColor:'var(--success)'}:{})}} aria-label="링크 복사">{copied?'✓ 복사됨':'링크 복사'}</button>
        </div>
      )}
    </div>
  )
}