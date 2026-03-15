'use client'
import{useState}from'react'
import{useRouter}from'next/navigation'
export default function DeleteAccountSection(){
  const[isOpen,setIsOpen]=useState(false)
  const[txt,setTxt]=useState('')
  const[loading,setLoading]=useState(false)
  const[err,setErr]=useState('')
  const router=useRouter()
  const PHRASE='계정을 삭제합니다'
  const handleDelete=async()=>{
    if(txt!==PHRASE){setErr('확인 문구를 정확히 입력해주세요.');return}
    setLoading(true);setErr('')
    try{
      const r=await fetch('/api/account/delete',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:txt})})
      if(!r.ok){const d=await r.json();setErr(d.error??'오류가 발생했습니다.');return}
      alert('계정이 삭제되었습니다.');router.push('/')
    }catch{setErr('네트워크 오류가 발생했습니다.')}finally{setLoading(false)}
  }
  return(
    <section style={{marginTop:'40px',padding:'20px',border:'1px solid var(--kd-danger)',borderRadius:'12px',background:'var(--kd-danger-dim)'}}>
      <h3 style={{color:'var(--kd-danger)',fontSize:'15px',fontWeight:700,margin:'0 0 8px'}}>위험 구역 — 계정 삭제</h3>
      <p style={{fontSize:'13px',color:'var(--kd-text-muted)',margin:'0 0 12px',lineHeight:1.5}}>계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.</p>
      {!isOpen?(
        <button onClick={()=>setIsOpen(true)} style={{padding:'8px 16px',background:'transparent',color:'var(--kd-danger)',border:'1px solid var(--kd-danger)',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>계정 삭제하기</button>
      ):(
        <div>
          <p style={{fontSize:'13px',color:'var(--kd-text)',marginBottom:'10px'}}>계속하려면 <strong style={{color:'var(--kd-danger)'}}>"{PHRASE}"</strong>를 입력하세요.</p>
          <input type="text" value={txt} onChange={e=>setTxt(e.target.value)} placeholder={PHRASE} style={{width:'100%',padding:'10px 12px',border:`1px solid ${err?'var(--kd-danger)':'var(--kd-border)'}`,borderRadius:'8px',background:'var(--kd-surface)',color:'var(--kd-text)',fontSize:'14px',marginBottom:'8px',boxSizing:'border-box'}} />
          {err&&<p style={{fontSize:'12px',color:'var(--kd-danger)',marginBottom:'8px'}}>{err}</p>}
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={handleDelete} disabled={loading||txt!==PHRASE} style={{padding:'8px 18px',background:txt===PHRASE?'var(--kd-danger)':'rgba(239,68,68,0.3)',color:'white',border:'none',borderRadius:'8px',fontSize:'13px',cursor:txt===PHRASE?'pointer':'not-allowed',fontWeight:600}}>{loading?'삭제 중...':'영구 삭제'}</button>
            <button onClick={()=>{setIsOpen(false);setTxt('');setErr('')}} style={{padding:'8px 16px',background:'var(--kd-surface)',color:'var(--kd-text-muted)',border:'1px solid var(--kd-border)',borderRadius:'8px',fontSize:'13px',cursor:'pointer'}}>취소</button>
          </div>
        </div>
      )}
    </section>
  )
}