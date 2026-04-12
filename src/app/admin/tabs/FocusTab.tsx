'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

// ── 유틸 ──
const f=(n:number)=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e4?(n/1e3).toFixed(0)+'K':n>=1e3?(n/1e3).toFixed(1)+'K':String(n);
const pct=(a:number,b:number)=>b>0?Math.round(a/b*100):0;
const ago=(d:string)=>{if(!d)return'—';const s=Math.floor((Date.now()-new Date(d).getTime())/1000);return s<60?'방금':s<3600?Math.floor(s/60)+'분':s<86400?Math.floor(s/3600)+'시':Math.floor(s/86400)+'일';};

// ── 벤치마크 ──
type G='good'|'warn'|'critical';
const BM:Record<string,{l:string;g:string;c:(v:number)=>G}>={
  ctr:{l:'CTA CTR',g:'>2%',c:v=>v>2?'good':v>0.5?'warn':'critical'},
  signup:{l:'가입전환',g:'>1%',c:v=>v>1?'good':v>0.3?'warn':'critical'},
  cron:{l:'크론',g:'>95%',c:v=>v>95?'good':v>80?'warn':'critical'},
  db:{l:'DB',g:'<50%',c:v=>v<50?'good':v<80?'warn':'critical'},
  gate:{l:'게이트',g:'>3%',c:v=>v>3?'good':v>1?'warn':'critical'},
  profile:{l:'프로필',g:'>30%',c:v=>v>30?'good':v>10?'warn':'critical'},
  notif:{l:'알림',g:'>30%',c:v=>v>30?'good':v>15?'warn':'critical'},
  ret:{l:'재방문',g:'>30%',c:v=>v>30?'good':v>10?'warn':'critical'},
};
const gc=(g:G)=>g==='good'?'#10B981':g==='warn'?'#F59E0B':'#EF4444';
const gi=(g:G)=>g==='good'?'🟢':g==='warn'?'🟡':'🔴';

// ── 컴포넌트 ──
const S='rgba(12,21,40,0.6)';const BD='1px solid rgba(255,255,255,0.04)';
const Ring=({v,sz=52,c}:{v:number;sz?:number;c:string})=>{const r=(sz-6)/2,ci=2*Math.PI*r;return<svg width={sz} height={sz}><circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4"/><circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={c} strokeWidth="4" strokeDasharray={ci} strokeDashoffset={ci-(Math.min(v,100)/100)*ci} strokeLinecap="round" transform={`rotate(-90 ${sz/2} ${sz/2})`} style={{transition:'all .8s'}}/></svg>;};
const Bar=({v,mx=100,c}:{v:number;mx?:number;c:string})=><div style={{height:4,borderRadius:2,background:'rgba(255,255,255,0.03)',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.max(Math.min(v/mx*100,100),1)}%`,background:c,borderRadius:2,transition:'width .5s'}}/></div>;
const Sec=({t,ch,open=true}:{t:string;ch:React.ReactNode;open?:boolean})=>{const[o,setO]=useState(open);return<div style={{marginBottom:8}}><button onClick={()=>setO(!o)} style={{display:'flex',alignItems:'center',gap:4,width:'100%',background:'none',border:'none',padding:'5px 0',cursor:'pointer',fontSize:11,fontWeight:700,color:'#94A3B8'}}><span style={{fontSize:11,transition:'transform .15s',transform:o?'rotate(90deg)':'rotate(0)'}}>▶</span>{t}</button>{o&&ch}</div>;};
const Card=({ch,p='8px 10px',st}:{ch:React.ReactNode;p?:string;st?:React.CSSProperties})=><div style={{background:S,border:BD,borderRadius: 'var(--radius-md)',padding:p,...st}}>{ch}</div>;

export default function FocusTab({onNavigate}:{onNavigate:(t:any)=>void}) {
  const[d,setD]=useState<any>(null);
  const[ops,setOps]=useState<any>(null);
  const[df,setDf]=useState<any>(null);
  const[ld,setLd]=useState(true);
  const[gr,setGr]=useState(false);
  const[gRes,setGRes]=useState<{ok:number;fail:number}|null>(null);
  const ref=useRef<any>(null);

  const load=useCallback(()=>{
    Promise.all([
      fetch('/api/admin/v2?tab=focus').then(r=>r.json()),
      fetch('/api/admin/v2?tab=ops').then(r=>r.json()),
      fetch('/api/admin/v2?tab=data').then(r=>r.json()),
    ]).then(([a,b,c])=>{setD(a);setOps(b);setDf(c);setLd(false);}).catch(()=>setLd(false));
  },[]);
  useEffect(()=>{load();ref.current=setInterval(load,30000);return()=>clearInterval(ref.current);},[load]);

  if(ld)return<div style={{textAlign:'center',padding:80,color:'rgba(255,255,255,0.4)',fontSize:12}}>로딩...</div>;
  if(!d)return<div style={{textAlign:'center',padding:80,fontSize:12}}>⚠️ 실패</div>;

  const{healthScore:hs=0,kpi:k={} as any,growth:g={} as any,extended:x={} as any,failedCrons:fc={},recentActivity:ra=[],dailyTrend:dt=[],ctaBreakdown:cb={},signupSources:ss={},retention:ret=null as any,featureHealth:fh={} as any,trafficDetail:td={} as any}=d;

  // 벤치마크
  const cr=pct(k.cronSuccess,k.cronSuccess+k.cronFail);
  const ctrV=(g.ctaViews7d||0)>0?(g.ctaClicks7d||0)/g.ctaViews7d*100:0;
  const sRate=(x.pv7d||0)>0?(k.newUsers||0)/(x.pv7d||1)*100:0;
  const dbP=pct(k.dbMb||0,8400);
  const gateC=(x.gateViews||0)>0?(x.gateClicks||0)/x.gateViews*100:0;
  const bm=[
    {k:'ctr',v:ctrV},{k:'signup',v:sRate},{k:'cron',v:cr},{k:'db',v:dbP},
    {k:'gate',v:gateC},{k:'profile',v:g.profileRate||0},{k:'notif',v:g.notifReadRate||0},{k:'ret',v:k.returnRate||0},
  ].map(b=>({...b,g:BM[b.k].c(b.v)}));
  const crits=bm.filter(b=>b.g==='critical');
  const hsc=hs>=71?'#10B981':hs>=41?'#F59E0B':'#EF4444';
  const hourly=td?.hourlyPv||[];
  const cg=ops?.cronGroups||{};

  // 데이터 신선도
  const fresh=df?.freshness||{};
  const staleList=Object.entries(fresh).filter(([,v]:any)=>Date.now()-new Date(v.at).getTime()>21600000).map(([n]:any)=>n);

  const godMode=async()=>{
    if(gr)return;if(!confirm('전체 크론 실행?'))return;
    setGr(true);setGRes(null);
    try{const r=await fetch('/api/admin/god-mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'full'})});
      const j=await r.json();const ok=(j.results||[]).filter((x:any)=>x.status>=200&&x.status<400).length;
      setGRes({ok,fail:(j.results||[]).length-ok});load();
    }catch{setGRes({ok:0,fail:1});}finally{setGr(false);}
  };

  return (
    <div>
      {/* ═══ 1. 헤더: 헬스+KPI+최신화 ═══ */}
      <Card ch={<div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{position:'relative',flexShrink:0}}>
          <Ring v={hs} c={hsc}/>
          <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontSize:16,fontWeight:900,color:hsc}}>{hs}</span>
          </div>
        </div>
        <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap: 4}}>
          {[{l:'PV',v:f(k.pvToday||0),c:'#3B7BF6'},{l:'가입',v:`+${k.newUsersToday||0}`,c:'#10B981'},{l:'유저',v:f((k.users||0)+(x.seeds||0)),c:'#CBD5E1'}].map(s=>
            <div key={s.l} style={{textAlign:'center'}}><div style={{fontSize:14,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.35)'}}>{s.l}</div></div>
          )}
        </div>
        <button onClick={godMode} disabled={gr} style={{padding:'7px 10px',borderRadius: 'var(--radius-md)',border:'none',cursor:'pointer',fontSize:13,fontWeight:700,background:gr?'rgba(255,255,255,0.04)':'linear-gradient(135deg,#3B7BF6,#10B981)',color:'#fff',display:'flex',flexDirection:'column',alignItems:'center',gap:1,flexShrink:0}}>
          <span style={{fontSize:14}}>{gr?'⏳':'🚀'}</span>{gr?'...':'최신화'}
        </button>
      </div>} p="10px 12px"/>
      {gRes&&<div style={{padding:'3px 8px',borderRadius: 'var(--radius-sm)',margin:'4px 0',fontSize:13,fontWeight:600,background:gRes.fail>0?'rgba(239,68,68,0.08)':'rgba(16,185,129,0.08)',color:gRes.fail>0?'#EF4444':'#10B981',textAlign:'center'}}>✓{gRes.ok}{gRes.fail>0&&` ✗${gRes.fail}`}</div>}
      <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',textAlign:'right',marginBottom:2}}>30초마다 자동 갱신 · {new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</div>

      {/* ═══ 2. 경고 ═══ */}
      {(crits.length>0||staleList.length>0||Object.keys(fc||{}).length>0)&&<div style={{padding:'6px 10px',borderRadius: 'var(--radius-md)',margin:'4px 0',background:'rgba(239,68,68,0.05)',border:'1px solid rgba(239,68,68,0.12)'}}>
        {crits.map(b=><div key={b.k} style={{fontSize:13,color:'rgba(255,255,255,0.45)',marginBottom:2}}>🔴 {BM[b.k].l} {b.v.toFixed(1)}% (기준 {BM[b.k].g})</div>)}
        {staleList.length>0&&<div style={{fontSize:13,color:'rgba(255,255,255,0.45)'}}>🟠 {staleList.length}개 크론 6h+ 미실행</div>}
        {Object.keys(fc||{}).length>0&&<div style={{fontSize:13,color:'rgba(255,255,255,0.45)'}}>🔴 실패 크론 {Object.keys(fc).length}개</div>}
      </div>}

      {/* ═══ 3. 벤치마크 4x2 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap: 4,margin:'6px 0'}}>
        {bm.map(b=>(
          <div key={b.k} style={{background:S,border:BD,borderRadius: 'var(--radius-sm)',padding:'6px 6px',textAlign:'center'}}>
            <div style={{fontSize:11,fontWeight:800,color:gc(b.g),lineHeight:1}}>{b.v.toFixed(b.v<10?1:0)}%</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>{BM[b.k].l}</div>
          </div>
        ))}
      </div>

      {/* ═══ 4. 퍼널 + CTA 나란히 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:8}}>
        <Card ch={<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><span style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.4)'}}>🎯 퍼널 7일</span><span style={{fontSize:12,fontWeight:700,color:(x.pv7d||0)>0&&(k.newUsers||0)/(x.pv7d||1)*100>1?'#10B981':'#EF4444'}}>{(x.pv7d||0)>0?((k.newUsers||0)/(x.pv7d||1)*100).toFixed(2):'0'}%</span></div>
          {[{l:'PV',v:x.pv7d||0,c:'#3B7BF6'},{l:'게이트',v:x.gateViews||0,c:'#F59E0B'},{l:'클릭',v:x.gateClicks||0,c:'#EF4444'},{l:'시도',v:x.signupAttempts7d||0,c:'#EC4899'},{l:'가입',v:k.newUsers||0,c:'#10B981'}].map((s,i,a)=>{
            const mx=Math.max(...a.map(x=>x.v),1);
            return<div key={s.l} style={{marginBottom:6}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:2}}>
                <span style={{color:'rgba(255,255,255,0.45)'}}>{s.l}</span>
                <span style={{fontWeight:700,color:s.c}}>{f(s.v)}</span>
              </div>
              <Bar v={s.v} mx={mx} c={s.c}/>
            </div>;
          })}
        </>} p="6px 8px"/>
        <Card ch={<>
          <div style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:8}}>🎪 CTA 성과</div>
          {Object.entries(cb||{}).sort((a:any,b:any)=>(b[1].views||0)-(a[1].views||0)).slice(0,6).map(([n,e]:[string,any])=>{
            const v=e.views||0,cl=e.clicks||0,ctr=v>0?cl/v*100:0;
            return<div key={n} style={{display:'flex',padding:'4px 0',fontSize:12,alignItems:'center',gap: 4}}>
              <span style={{fontSize:10}}>{gi(BM.ctr.c(ctr))}</span>
              <span style={{flex:1,color:'rgba(255,255,255,0.5)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n}</span>
              <span style={{fontWeight:700,color:gc(BM.ctr.c(ctr)),fontSize:13}}>{ctr.toFixed(1)}%</span>
            </div>;
          })}
          {Object.keys(cb||{}).length===0&&<div style={{fontSize:12,color:'rgba(255,255,255,0.35)',textAlign:'center',padding:6}}>수집중</div>}
        </>} p="6px 8px"/>
      </div>

      {/* ═══ 5. 트래픽 + 유입 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:4,marginBottom:8}}>
        <Card ch={<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><span style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.4)'}}>⏰ {f(td?.todayTotal||k.pvToday||0)}PV·{td?.uniqueVisitors||'—'}UV</span>{hourly.length>0&&<span style={{fontSize:11,color:'#10B981'}}>피크 {hourly.reduce((m:any,h:any)=>(h.count||0)>(m.count||0)?h:m,{hour:0,count:0}).hour}시</span>}</div>
          {hourly.length>0&&<div style={{display:'flex',alignItems:'flex-end',gap:1,height:28}}>
            {hourly.map((v:any,i:number)=>{const mx=Math.max(...hourly.map((h:any)=>h.count||0),1);const now=new Date().getHours();
              return<div key={i} style={{flex:1,height:Math.max(((v.count||0)/mx)*22,1),borderRadius:1,background:v.hour===now?'#10B981':(v.count||0)>20?'rgba(59,123,246,0.4)':'rgba(59,123,246,0.1)'}}/>;
            })}
          </div>}
        </>} p="6px 8px"/>
        <Card ch={<>
          <div style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:6}}>📡 유입</div>
          {(td?.referrerBreakdown||[]).slice(0,4).map((r:any,i:number)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',color:'rgba(255,255,255,0.45)'}}>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{r.source}</span>
              <span style={{fontWeight:600,flexShrink:0}}>{r.count}<span style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginLeft:2}}>{(td?.referrerBreakdown||[]).reduce((s:number,x:any)=>s+(x.count||0),0)>0?Math.round(r.count/(td.referrerBreakdown.reduce((s:number,x:any)=>s+(x.count||0),0))*100):0}%</span></span>
            </div>
          ))}
        </>} p="6px 8px"/>
      </div>

      {/* ═══ 6. KPI 4x2 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap: 4,marginBottom:8}}>
        {[
          {v:f(k.blogs||0),l:'블로그',c:'#8B5CF6'},
          {v:f(k.stocks||0),l:'주식',c:'#3B7BF6'},
          {v:f(k.apts||0),l:'분양',c:'#10B981'},
          {v:`${((k.dbMb||0)/1024).toFixed(1)}G`,l:'DB/8.4G',c:gc(BM.db.c(dbP))},
          {v:f(k.emailSubs||0),l:'이메일',c:'#EC4899'},
          {v:f(x.shares7d||0),l:'공유7d',c:'#A855F7'},
          {v:f(x.sharesToday||0),l:'공유오늘',c:'#D946EF'},
          {v:f(k.interests||0),l:'관심단지',c:'#06B6D4'},
        ].map(s=>(
          <div key={s.l} style={{background:S,border:BD,borderRadius: 'var(--radius-sm)',padding:'6px 6px',textAlign:'center'}}>
            <div style={{fontSize:12,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ═══ 6.1 공유 분석 ═══ */}
      {(x.sharesByPlatform || x.sharesByContentType) && (() => {
        const bp = x.sharesByPlatform || {};
        const bc = x.sharesByContentType || {};
        const pEntries = (Object.entries(bp) as [string, number][]).sort((a,b)=>b[1]-a[1]);
        const cEntries = (Object.entries(bc) as [string, number][]).sort((a,b)=>b[1]-a[1]);
        const pTotal = pEntries.reduce((s,e)=>s+e[1],0);
        const cTotal = cEntries.reduce((s,e)=>s+e[1],0);
        const pLabel: Record<string,string> = { kakao:'카카오', kakao_top:'카카오(상단)', copy:'링크복사', 'naver-blog':'N블로그', 'naver-cafe':'N카페', 'daum-cafe':'다음카페', band:'밴드', twitter:'X', facebook:'FB', native:'네이티브' };
        const cLabel: Record<string,string> = { post:'커뮤니티', blog:'블로그', stock:'주식', 'stock-page':'주식페이지', 'stock-sector':'섹터', 'stock-market':'마켓', calc:'계산기', apt:'분양', 'apt-region':'지역', 'apt-complex':'단지', section:'섹션', page:'페이지', daily:'데일리', discuss:'토론', 'blog-series':'시리즈', unknown:'미분류' };
        if (!pTotal && !cTotal) return null;
        return <div className="adm-card" style={{padding:'8px 12px',marginBottom:8}}>
          <div style={{fontSize:11,fontWeight:700,color:'#A855F7',marginBottom:6}}>📊 공유 분석 (7일)</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginBottom:4}}>플랫폼별</div>
              {pEntries.slice(0,6).map(([p,c])=>(
                <div key={p} style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:2}}>
                  <span style={{color:'rgba(255,255,255,0.7)'}}>{pLabel[p]||p}</span>
                  <span style={{fontWeight:700,color:'#A855F7'}}>{c}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginBottom:4}}>콘텐츠별</div>
              {cEntries.slice(0,6).map(([ct,c])=>(
                <div key={ct} style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:2}}>
                  <span style={{color:'rgba(255,255,255,0.7)'}}>{cLabel[ct]||ct}</span>
                  <span style={{fontWeight:700,color:'#D946EF'}}>{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>;
      })()}

      {/* ═══ 6.5 데이터 수집률 ═══ */}
      {x.dataCollection && (() => {
        const dc = x.dataCollection;
        const t = dc.total || 1;
        const items = [
          { l: '📍 지역', v: dc.city, p: Math.round(dc.city/t*100) },
          { l: '🎂 나이', v: dc.age, p: Math.round(dc.age/t*100) },
          { l: '📧 마케팅', v: dc.marketing, p: Math.round(dc.marketing/t*100) },
          { l: '📱 푸시', v: k.pushSubs||0, p: Math.round((k.pushSubs||0)/t*100) },
        ];
        return <div className="adm-card" style={{padding:'8px 12px',marginBottom:8}}>
          <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6}}>📊 데이터 수집률 ({t}명)</div>
          {items.map(s=><div key={s.l} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 0'}}>
            <span style={{fontSize:11,minWidth:54,color:'rgba(255,255,255,0.5)'}}>{s.l}</span>
            <div style={{flex:1,height:6,background:'rgba(255,255,255,0.06)',borderRadius:3,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${s.p}%`,background:s.p>50?'#10B981':s.p>20?'#F59E0B':'#EF4444',borderRadius:3}}/>
            </div>
            <span style={{fontSize:11,minWidth:50,textAlign:'right',color:s.p>50?'#10B981':s.p>20?'#F59E0B':'#EF4444',fontWeight:600}}>{s.v}/{t} ({s.p}%)</span>
          </div>)}
        </div>;
      })()}

      {/* ═══ 7. 크론 + 데이터 신선도 ═══ */}
      <Sec t="🔧 크론 · 데이터" ch={
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
          <Card ch={<>
            {Object.entries(cg).map(([key,g]:[string,any])=>{
              const t=g.ok+g.fail;const p=t>0?Math.round(g.ok/t*100):100;
              const ic:Record<string,string>={data:'📡',process:'⚙️',ai:'🤖',content:'✍️',system:'🛠️',alert:'🔔'};
              return<div key={key} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 0'}}>
                <span style={{fontSize:12}}>{ic[key]||'📦'}</span>
                <span style={{fontSize:12,color:'rgba(255,255,255,0.45)',minWidth:32}}>{key}</span>
                <div style={{flex:1}}><Bar v={p} c={p>=90?'#10B981':p>=70?'#F59E0B':'#EF4444'}/></div>
                <span style={{fontSize:13,fontWeight:600,color:p>=90?'#10B981':'#F59E0B',minWidth:24,textAlign:'right'}}>{p}%</span>
              </div>;
            })}
            {Object.entries(ops?.failedCrons||{}).slice(0,3).map(([n,info]:[string,any])=>(
              <div key={n} style={{fontSize:12,color:'#EF4444',marginTop:1}}>✗ {n} ({info.count}회)</div>
            ))}
          </>} p="6px 8px"/>
          <Card ch={<>
            <div style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.35)',marginBottom:6}}>데이터 신선도</div>
            {Object.entries(fresh).slice(0,8).map(([name,info]:any)=>{
              const ageMs=Date.now()-new Date(info.at).getTime();
              const c=ageMs<3600000?'#10B981':ageMs<21600000?'#F59E0B':'#EF4444';
              return<div key={name} style={{display:'flex',alignItems:'center',gap: 4,padding:'4px 0',fontSize:12}}>
                <span style={{width:4,height:4,borderRadius:'50%',background:c,flexShrink:0}}/>
                <span style={{flex:1,color:'rgba(255,255,255,0.45)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>
                <span style={{color:'rgba(255,255,255,0.4)',fontSize:11}}>{ago(info.at)}</span>
              </div>;
            })}
            {Object.keys(fresh).length>8&&<div style={{fontSize:11,color:'rgba(255,255,255,0.35)',textAlign:'center',marginTop:2}}>+{Object.keys(fresh).length-8}개</div>}
          </>} p="6px 8px"/>
        </div>
      }/>

      {/* ═══ 8. 기능 + 가입경로 + 리텐션 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4,marginBottom:8}}>
        <Card ch={<>
          <div style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.35)',marginBottom:2}}>💪 기능</div>
          {[{l:'아파트BM',v:fh.aptBookmarks||0},{l:'블로그BM',v:fh.blogBookmarks||0},{l:'관심종목',v:fh.stockWatchlist||0},{l:'출석',v:fh.attendance||0}].map(feat=>(
            <div key={feat.l} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',color:feat.v>0?'rgba(255,255,255,0.5)':'rgba(255,255,255,0.15)'}}>
              <span>{feat.v>0?'✓':'✗'}{feat.l}</span><span style={{fontWeight:600}}>{feat.v}</span>
            </div>
          ))}
        </>} p="5px 6px"/>
        <Card ch={<>
          <div style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.35)',marginBottom:2}}>🎯 가입경로</div>
          {Object.entries(ss).sort((a:any,b:any)=>b[1]-a[1]).slice(0,4).map(([src,cnt]:[string,any])=>(
            <div key={src} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',color:'rgba(255,255,255,0.5)'}}>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{src}</span><span style={{fontWeight:600}}>{cnt}</span>
            </div>
          ))}
        </>} p="5px 6px"/>
        <Card ch={<>
          <div style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.35)',marginBottom:2}}>🔄 리텐션</div>
          {ret?<>
            <div style={{fontSize:16,fontWeight:800,color:gc(BM.ret.c(ret.d7Rate||0)),lineHeight:1,textAlign:'center',marginTop:4}}>{ret.d7Rate||0}%</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',textAlign:'center',marginTop:2}}>D7 · {ret.size}→{ret.d7}명</div>
          </>:<div style={{fontSize:12,color:'rgba(255,255,255,0.35)',textAlign:'center',padding:8}}>—</div>}
        </>} p="5px 6px"/>
      </div>

      {/* ═══ 9. 추이 ═══ */}
      {dt.length>0&&<Sec t="📈 14일 추이" open={false} ch={
        <Card ch={<>
          <div style={{display:'flex',alignItems:'flex-end',gap: 4,height:40}}>
            {dt.map((d:any,i:number)=>{const mx=Math.max(...dt.map((x:any)=>x.pv||0),1);
              return<div key={i} style={{flex:1}}><div style={{height:`${((d.pv||0)/mx)*32}px`,background:'#3B7BF6',borderRadius:1,minHeight:1,opacity:0.3}}/><div style={{height:`${((d.uv||0)/mx)*32}px`,background:'#3B7BF6',borderRadius:1,minHeight:1,marginTop:1}}/></div>;
            })}
          </div>
          <div style={{display:'flex',marginTop:2}}>{dt.map((d:any,i:number)=><div key={i} style={{flex:1,fontSize:10,color:'rgba(255,255,255,0.35)',textAlign:'center'}}>{i%4===0?d.date?.slice(5):''}</div>)}</div>
          <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:3,fontSize:11,color:'rgba(255,255,255,0.35)'}}><span>▓ PV</span><span>█ UV</span></div>
        </>} p="6px 10px"/>
      }/>}

      {/* ═══ 10. 최근 활동 + 실시간 ═══ */}
      <Sec t="🕐 활동 · 방문자" open={false} ch={
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
          <Card ch={<>
            {ra.slice(0,6).map((a:any,i:number)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap: 4,padding:'4px 0',fontSize:12,color:'rgba(255,255,255,0.45)'}}>
                <span style={{fontSize:11}}>{a.type==='cron'?(a.status==='success'?'✅':'❌'):'👤'}</span>
                <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.type==='cron'?a.name:`${a.name} 가입`}</span>
                <span style={{fontSize:11,color:'rgba(255,255,255,0.35)'}}>{ago(a.at)}</span>
              </div>
            ))}
          </>} p="4px 6px"/>
          <Card ch={<>
            {(td?.recentVisitors||[]).slice(0,6).map((v:any,i:number)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap: 4,padding:'4px 0',fontSize:12,color:'rgba(255,255,255,0.4)'}}>
                <span style={{fontSize:11}}>{v.device}</span>
                <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{decodeURIComponent(v.path)}</span>
                <span style={{fontSize:10,color:'rgba(255,255,255,0.06)'}}>{v.ref}</span>
              </div>
            ))}
          </>} p="4px 6px"/>
        </div>
      }/>

      {/* ═══ 11. 주식/부동산 데이터 커버리지 ═══ */}
      {df&&<Sec t="🗄️ 데이터 커버리지" open={false} ch={
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
          <Card ch={<>
            <div style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.35)',marginBottom:2}}>📈 주식</div>
            {df.stock&&[{l:'종목',v:df.stock.total},{l:'시세有',v:df.stock.active},{l:'섹터',v:df.stock.withSector},{l:'설명',v:df.stock.withDesc}].map(s=>(
              <div key={s.l} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',color:'rgba(255,255,255,0.45)'}}>
                <span>{s.l}</span><span style={{fontWeight:600}}>{f(s.v)}/{f(df.stock.total)}</span>
              </div>
            ))}
          </>} p="5px 6px"/>
          <Card ch={<>
            <div style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.35)',marginBottom:2}}>🏢 부동산</div>
            {df.realestate&&[{l:'사이트',v:df.realestate.sites},{l:'이미지有',v:df.realestate.withImages},{l:'매매',v:df.realestate.transactions},{l:'단지백과',v:df.realestate.complexProfiles}].map(s=>(
              <div key={s.l} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'4px 0',color:'rgba(255,255,255,0.45)'}}>
                <span>{s.l}</span><span style={{fontWeight:600}}>{f(s.v)}</span>
              </div>
            ))}
          </>} p="5px 6px"/>
        </div>
      }/>}

      {/* ═══ SEO ═══ */}
      <Sec t="🔍 SEO · 리라이팅" open={false} ch={
        <Card ch={<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap: 4}}>
          {[
            {l:'Google',v:x.googleReady||0,c:'#4285F4'},{l:'Naver',v:x.naverReady||0,c:'#03C75A'},
            {l:'리라이팅',v:`${pct(k.rewritten||0,k.blogs||1)}%`,c:'#8B5CF6'},{l:'인덱싱',v:x.indexedOk||0,c:'#F59E0B'},
          ].map(s=>(
            <div key={s.l} style={{textAlign:'center'}}>
              <div style={{fontSize:12,fontWeight:800,color:s.c as string,lineHeight:1}}>{typeof s.v==='number'?f(s.v):s.v}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:1}}>{s.l}</div>
            </div>
          ))}
        </div>} p="8px 10px"/>
      }/>

      {/* ═══ 네이버 발행 ═══ */}
      <Sec t="🟢 네이버 발행" open={false} ch={<NaverSyndication/>}/>

      {/* ═══ 이메일 발송 ═══ */}
      <Sec t={`📧 이메일 발송 (${f(k.emailSubs||0)}명)`} open={false} ch={<EmailSender/>}/>
    </div>
  );
}

function EmailSender() {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<any>(null);

  const send = async (target: 'test' | 'dormant' | 'all') => {
    if (sending) return;
    const msg = target === 'test' ? '테스트 발송 (norich92@gmail.com)' : target === 'dormant' ? '휴면 유저에게 발송' : '전체 유저에게 발송';
    if (!confirm(`${msg}합니다. 계속?`)) return;
    setSending(true); setResult(null);
    try {
      const r = await fetch('/api/admin/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign: 're-engagement', target }),
      });
      setResult(await r.json());
    } catch (e: any) { setResult({ error: e.message }); }
    finally { setSending(false); }
  };

  const loadLogs = async () => {
    const r = await fetch('/api/admin/send-email');
    setLogs(await r.json());
  };

  return (
    <div style={{background:'rgba(12,21,40,0.6)',border:'1px solid rgba(255,255,255,0.04)',borderRadius: 'var(--radius-md)',padding:'8px 10px'}}>
      <div style={{display:'flex',gap:4,marginBottom:6}}>
        <button onClick={()=>send('test')} disabled={sending} style={{flex:1,padding:'6px',borderRadius: 'var(--radius-sm)',border:'1px solid rgba(59,123,246,0.2)',background:'rgba(59,123,246,0.06)',color:'#3B7BF6',cursor:'pointer',fontSize:13,fontWeight:600}}>🧪 테스트</button>
        <button onClick={()=>send('dormant')} disabled={sending} style={{flex:1,padding:'6px',borderRadius: 'var(--radius-sm)',border:'1px solid rgba(245,158,11,0.2)',background:'rgba(245,158,11,0.06)',color:'#F59E0B',cursor:'pointer',fontSize:13,fontWeight:600}}>😴 휴면유저</button>
        <button onClick={()=>send('all')} disabled={sending} style={{flex:1,padding:'6px',borderRadius: 'var(--radius-sm)',border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.06)',color:'#EF4444',cursor:'pointer',fontSize:13,fontWeight:600}}>📨 전체발송</button>
      </div>
      {sending&&<div style={{fontSize:13,color:'rgba(255,255,255,0.45)',textAlign:'center',padding:4}}>발송 중...</div>}
      {result&&<div style={{fontSize:13,padding:6,borderRadius: 'var(--radius-sm)',marginBottom:8,background:result.error?'rgba(239,68,68,0.06)':'rgba(16,185,129,0.06)',color:result.error?'#EF4444':'#10B981'}}>
        {result.error||`✓ ${result.sent}건 발송 ${result.failed>0?`· ✗ ${result.failed}건 실패`:''}`}
      </div>}
      <button onClick={loadLogs} style={{width:'100%',padding:'4px',borderRadius:4,border:'1px solid rgba(255,255,255,0.04)',background:'none',color:'rgba(255,255,255,0.35)',cursor:'pointer',fontSize:12}}>발송 이력 보기</button>
      {logs?.summary&&<div style={{marginTop:4,fontSize:12,color:'rgba(255,255,255,0.35)'}}>
        {Object.entries(logs.summary).map(([c,s]:[string,any])=><div key={c}>{c}: ✓{s.sent} ✗{s.failed}</div>)}
      </div>}
    </div>
  );
}

function NaverSyndication() {
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<number|null>(null);
  const [htmlView, setHtmlView] = useState<number|null>(null);
  const [htmlContent, setHtmlContent] = useState('');

  const load = async () => {
    const r = await fetch('/api/admin/naver-syndication');
    const d = await r.json();
    if (d.ok) { setItems(d.items||[]); setStats(d.stats||{}); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    await fetch('/api/cron/naver-blog-content');
    await load();
    setGenerating(false);
  };

  const markPublished = async (id:number) => {
    await fetch('/api/admin/naver-syndication', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action:'mark_blog_published'})});
    await load();
  };

  const viewHtml = async (id:number) => {
    if (htmlView===id) { setHtmlView(null); return; }
    const r = await fetch(`/api/admin/naver-syndication/${id}`);
    const d = await r.json();
    setHtmlContent(d.data?.naver_html||'');
    setHtmlView(id);
  };

  const copyHtml = async (id:number) => {
    const r = await fetch(`/api/admin/naver-syndication/${id}`);
    const d = await r.json();
    await navigator.clipboard.writeText(d.data?.naver_html||'');
    setCopied(id);
    setTimeout(()=>setCopied(null),2000);
  };

  if (loading) return <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',padding:8}}>로딩...</div>;

  return (
    <div style={{padding:'6px 10px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <div style={{display:'flex',gap:12}}>
          <span style={{fontSize:11}}>📝 대기 <b style={{color:'#F59E0B'}}>{stats.pending||0}</b></span>
          <span style={{fontSize:11}}>✅ 발행 <b style={{color:'#34D399'}}>{stats.published||0}</b></span>
          <span style={{fontSize:11}}>📊 전체 <b>{stats.total||0}</b></span>
        </div>
        <button onClick={generate} disabled={generating} style={{fontSize:14,padding:'3px 8px',borderRadius: 'var(--radius-sm)',border:'1px solid rgba(59,123,246,0.3)',background:'rgba(59,123,246,0.1)',color:'#3B7BF6',cursor:'pointer'}}>
          {generating?'생성 중...':'🔄 수동 생성'}
        </button>
      </div>
      {items.length===0 && <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',textAlign:'center',padding:12}}>아직 발행 콘텐츠 없음 · 수동 생성 또는 09:00 크론 대기</div>}
      {items.map((it:any) => (
        <div key={it.id} style={{padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:'#e0e0e0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{it.naver_title}</div>
              <div style={{fontSize:13,color:'rgba(255,255,255,0.4)',marginTop:2}}>
                {it.category} · 블로그:{it.blog_status==='published'?'✅':'⏳'} · 카페:{it.cafe_status==='published'?'✅':it.cafe_status==='failed'?'❌':'⏳'}
                {it.naver_tags?.length>0 && <span> · {it.naver_tags.slice(0,3).map((t:string)=>`#${t}`).join(' ')}</span>}
              </div>
            </div>
            <div style={{display:'flex',gap:4,marginLeft:8}}>
              <button onClick={()=>copyHtml(it.id)} style={{fontSize:13,padding:'2px 6px',borderRadius:4,border:'1px solid rgba(3,199,90,0.3)',background:'rgba(3,199,90,0.1)',color:'#03C75A',cursor:'pointer'}}>
                {copied===it.id?'✅ 복사됨':'📋 복사'}
              </button>
              <button onClick={()=>viewHtml(it.id)} style={{fontSize:13,padding:'2px 6px',borderRadius:4,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.05)',color:'rgba(255,255,255,0.5)',cursor:'pointer'}}>
                {htmlView===it.id?'닫기':'👁 보기'}
              </button>
              {it.blog_status==='pending' && <button onClick={()=>markPublished(it.id)} style={{fontSize:13,padding:'2px 6px',borderRadius:4,border:'1px solid rgba(52,211,153,0.3)',background:'rgba(52,211,153,0.1)',color:'#34D399',cursor:'pointer'}}>✓ 발행완료</button>}
            </div>
          </div>
          {htmlView===it.id && <div style={{marginTop:6,padding:8,borderRadius: 'var(--radius-sm)',background:'rgba(0,0,0,0.3)',maxHeight:200,overflow:'auto',fontSize:14,color:'rgba(255,255,255,0.5)',whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{htmlContent}</div>}
        </div>
      ))}
    </div>
  );
}
