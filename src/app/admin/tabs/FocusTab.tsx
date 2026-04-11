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
const Sec=({t,ch,open=true}:{t:string;ch:React.ReactNode;open?:boolean})=>{const[o,setO]=useState(open);return<div style={{marginBottom:4}}><button onClick={()=>setO(!o)} style={{display:'flex',alignItems:'center',gap:4,width:'100%',background:'none',border:'none',padding:'5px 0',cursor:'pointer',fontSize:11,fontWeight:700,color:'#94A3B8'}}><span style={{fontSize:7,transition:'transform .15s',transform:o?'rotate(90deg)':'rotate(0)'}}>▶</span>{t}</button>{o&&ch}</div>;};
const Card=({ch,p='8px 10px',st}:{ch:React.ReactNode;p?:string;st?:React.CSSProperties})=><div style={{background:S,border:BD,borderRadius:8,padding:p,...st}}>{ch}</div>;

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

  if(ld)return<div style={{textAlign:'center',padding:80,color:'rgba(255,255,255,0.25)',fontSize:12}}>로딩...</div>;
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
        <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:2}}>
          {[{l:'PV',v:f(k.pvToday||0),c:'#3B7BF6'},{l:'가입',v:`+${k.newUsersToday||0}`,c:'#10B981'},{l:'유저',v:f(k.users||0),c:'#CBD5E1'}].map(s=>
            <div key={s.l} style={{textAlign:'center'}}><div style={{fontSize:14,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div><div style={{fontSize:7,color:'rgba(255,255,255,0.15)'}}>{s.l}</div></div>
          )}
        </div>
        <button onClick={godMode} disabled={gr} style={{padding:'7px 10px',borderRadius:8,border:'none',cursor:'pointer',fontSize:9,fontWeight:700,background:gr?'rgba(255,255,255,0.04)':'linear-gradient(135deg,#3B7BF6,#10B981)',color:'#fff',display:'flex',flexDirection:'column',alignItems:'center',gap:1,flexShrink:0}}>
          <span style={{fontSize:14}}>{gr?'⏳':'🚀'}</span>{gr?'...':'최신화'}
        </button>
      </div>} p="10px 12px"/>
      {gRes&&<div style={{padding:'3px 8px',borderRadius:6,margin:'4px 0',fontSize:9,fontWeight:600,background:gRes.fail>0?'rgba(239,68,68,0.08)':'rgba(16,185,129,0.08)',color:gRes.fail>0?'#EF4444':'#10B981',textAlign:'center'}}>✓{gRes.ok}{gRes.fail>0&&` ✗${gRes.fail}`}</div>}

      {/* ═══ 2. 경고 ═══ */}
      {crits.length>0&&<div style={{padding:'6px 10px',borderRadius:8,margin:'4px 0',background:'rgba(239,68,68,0.05)',border:'1px solid rgba(239,68,68,0.12)'}}>
        {crits.map(b=><div key={b.k} style={{fontSize:9,color:'rgba(255,255,255,0.45)',marginBottom:1}}>🔴 {BM[b.k].l} {b.v.toFixed(1)}% (기준 {BM[b.k].g})</div>)}
        {staleList.length>0&&<div style={{fontSize:9,color:'rgba(255,255,255,0.45)'}}>🔴 {staleList.length}개 크론 6h+ 미실행</div>}
      </div>}

      {/* ═══ 3. 벤치마크 4x2 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:3,margin:'6px 0'}}>
        {bm.map(b=>(
          <div key={b.k} style={{background:S,border:BD,borderRadius:6,padding:'5px 3px',textAlign:'center'}}>
            <div style={{fontSize:11,fontWeight:800,color:gc(b.g),lineHeight:1}}>{b.v.toFixed(b.v<10?1:0)}%</div>
            <div style={{fontSize:7,color:'rgba(255,255,255,0.15)',marginTop:2}}>{BM[b.k].l}</div>
          </div>
        ))}
      </div>

      {/* ═══ 4. 퍼널 + CTA 나란히 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:4}}>
        <Card ch={<>
          <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.25)',marginBottom:4}}>🎯 퍼널 7일</div>
          {[{l:'PV',v:x.pv7d||0,c:'#3B7BF6'},{l:'게이트',v:x.gateViews||0,c:'#F59E0B'},{l:'클릭',v:x.gateClicks||0,c:'#EF4444'},{l:'시도',v:x.signupAttempts7d||0,c:'#EC4899'},{l:'가입',v:k.newUsers||0,c:'#10B981'}].map((s,i,a)=>{
            const mx=Math.max(...a.map(x=>x.v),1);
            return<div key={s.l} style={{marginBottom:3}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,marginBottom:1}}>
                <span style={{color:'rgba(255,255,255,0.3)'}}>{s.l}</span>
                <span style={{fontWeight:700,color:s.c}}>{f(s.v)}</span>
              </div>
              <Bar v={s.v} mx={mx} c={s.c}/>
            </div>;
          })}
        </>} p="6px 8px"/>
        <Card ch={<>
          <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.25)',marginBottom:4}}>🎪 CTA 성과</div>
          {Object.entries(cb||{}).sort((a:any,b:any)=>(b[1].views||0)-(a[1].views||0)).slice(0,6).map(([n,e]:[string,any])=>{
            const v=e.views||0,cl=e.clicks||0,ctr=v>0?cl/v*100:0;
            return<div key={n} style={{display:'flex',padding:'2px 0',fontSize:8,alignItems:'center',gap:2}}>
              <span style={{fontSize:6}}>{gi(BM.ctr.c(ctr))}</span>
              <span style={{flex:1,color:'rgba(255,255,255,0.35)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n}</span>
              <span style={{fontWeight:700,color:gc(BM.ctr.c(ctr)),fontSize:9}}>{ctr.toFixed(1)}%</span>
            </div>;
          })}
          {Object.keys(cb||{}).length===0&&<div style={{fontSize:8,color:'rgba(255,255,255,0.1)',textAlign:'center',padding:6}}>수집중</div>}
        </>} p="6px 8px"/>
      </div>

      {/* ═══ 5. 트래픽 + 유입 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:4,marginBottom:4}}>
        <Card ch={<>
          <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.25)',marginBottom:3}}>⏰ 오늘 {f(td?.todayTotal||k.pvToday||0)}PV · {td?.uniqueVisitors||'—'}UV</div>
          {hourly.length>0&&<div style={{display:'flex',alignItems:'flex-end',gap:1,height:28}}>
            {hourly.map((v:any,i:number)=>{const mx=Math.max(...hourly.map((h:any)=>h.count||0),1);const now=new Date().getHours();
              return<div key={i} style={{flex:1,height:Math.max(((v.count||0)/mx)*22,1),borderRadius:1,background:v.hour===now?'#10B981':(v.count||0)>20?'rgba(59,123,246,0.4)':'rgba(59,123,246,0.1)'}}/>;
            })}
          </div>}
        </>} p="6px 8px"/>
        <Card ch={<>
          <div style={{fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.25)',marginBottom:3}}>📡 유입</div>
          {(td?.referrerBreakdown||[]).slice(0,4).map((r:any,i:number)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:8,padding:'1px 0',color:'rgba(255,255,255,0.3)'}}>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{r.source}</span>
              <span style={{fontWeight:600,flexShrink:0}}>{r.count}</span>
            </div>
          ))}
        </>} p="6px 8px"/>
      </div>

      {/* ═══ 6. KPI 4x2 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:3,marginBottom:4}}>
        {[
          {v:f(k.blogs||0),l:'블로그',c:'#8B5CF6'},
          {v:f(k.stocks||0),l:'주식',c:'#3B7BF6'},
          {v:f(k.apts||0),l:'분양',c:'#10B981'},
          {v:`${((k.dbMb||0)/1024).toFixed(1)}G`,l:'DB/8.4G',c:gc(BM.db.c(dbP))},
          {v:f(k.emailSubs||0),l:'이메일',c:'#EC4899'},
          {v:f(k.pushSubs||0),l:'푸시',c:'#F59E0B'},
          {v:f(x.shares7d||0),l:'공유7d',c:'#A855F7'},
          {v:f(k.interests||0),l:'관심단지',c:'#06B6D4'},
        ].map(s=>(
          <div key={s.l} style={{background:S,border:BD,borderRadius:6,padding:'5px 3px',textAlign:'center'}}>
            <div style={{fontSize:12,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:6,color:'rgba(255,255,255,0.12)',marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ═══ 7. 크론 + 데이터 신선도 ═══ */}
      <Sec t="🔧 크론 · 데이터" ch={
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
          <Card ch={<>
            {Object.entries(cg).map(([key,g]:[string,any])=>{
              const t=g.ok+g.fail;const p=t>0?Math.round(g.ok/t*100):100;
              const ic:Record<string,string>={data:'📡',process:'⚙️',ai:'🤖',content:'✍️',system:'🛠️',alert:'🔔'};
              return<div key={key} style={{display:'flex',alignItems:'center',gap:4,padding:'2px 0'}}>
                <span style={{fontSize:8}}>{ic[key]||'📦'}</span>
                <span style={{fontSize:8,color:'rgba(255,255,255,0.3)',minWidth:32}}>{key}</span>
                <div style={{flex:1}}><Bar v={p} c={p>=90?'#10B981':p>=70?'#F59E0B':'#EF4444'}/></div>
                <span style={{fontSize:9,fontWeight:600,color:p>=90?'#10B981':'#F59E0B',minWidth:24,textAlign:'right'}}>{p}%</span>
              </div>;
            })}
            {Object.entries(ops?.failedCrons||{}).slice(0,3).map(([n,info]:[string,any])=>(
              <div key={n} style={{fontSize:8,color:'#EF4444',marginTop:1}}>✗ {n} ({info.count}회)</div>
            ))}
          </>} p="6px 8px"/>
          <Card ch={<>
            <div style={{fontSize:8,fontWeight:600,color:'rgba(255,255,255,0.2)',marginBottom:3}}>데이터 신선도</div>
            {Object.entries(fresh).slice(0,8).map(([name,info]:any)=>{
              const ageMs=Date.now()-new Date(info.at).getTime();
              const c=ageMs<3600000?'#10B981':ageMs<21600000?'#F59E0B':'#EF4444';
              return<div key={name} style={{display:'flex',alignItems:'center',gap:3,padding:'1px 0',fontSize:8}}>
                <span style={{width:4,height:4,borderRadius:'50%',background:c,flexShrink:0}}/>
                <span style={{flex:1,color:'rgba(255,255,255,0.3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>
                <span style={{color:'rgba(255,255,255,0.12)',fontSize:7}}>{ago(info.at)}</span>
              </div>;
            })}
            {Object.keys(fresh).length>8&&<div style={{fontSize:7,color:'rgba(255,255,255,0.1)',textAlign:'center',marginTop:2}}>+{Object.keys(fresh).length-8}개</div>}
          </>} p="6px 8px"/>
        </div>
      }/>

      {/* ═══ 8. 기능 + 가입경로 + 리텐션 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4,marginBottom:4}}>
        <Card ch={<>
          <div style={{fontSize:8,fontWeight:600,color:'rgba(255,255,255,0.2)',marginBottom:2}}>💪 기능</div>
          {[{l:'아파트BM',v:fh.aptBookmarks||0},{l:'블로그BM',v:fh.blogBookmarks||0},{l:'관심종목',v:fh.stockWatchlist||0},{l:'출석',v:fh.attendance||0}].map(feat=>(
            <div key={feat.l} style={{display:'flex',justifyContent:'space-between',fontSize:8,padding:'1px 0',color:feat.v>0?'rgba(255,255,255,0.35)':'rgba(255,255,255,0.08)'}}>
              <span>{feat.v>0?'✓':'✗'}{feat.l}</span><span style={{fontWeight:600}}>{feat.v}</span>
            </div>
          ))}
        </>} p="5px 6px"/>
        <Card ch={<>
          <div style={{fontSize:8,fontWeight:600,color:'rgba(255,255,255,0.2)',marginBottom:2}}>🎯 가입경로</div>
          {Object.entries(ss).sort((a:any,b:any)=>b[1]-a[1]).slice(0,4).map(([src,cnt]:[string,any])=>(
            <div key={src} style={{display:'flex',justifyContent:'space-between',fontSize:8,padding:'1px 0',color:'rgba(255,255,255,0.35)'}}>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{src}</span><span style={{fontWeight:600}}>{cnt}</span>
            </div>
          ))}
        </>} p="5px 6px"/>
        <Card ch={<>
          <div style={{fontSize:8,fontWeight:600,color:'rgba(255,255,255,0.2)',marginBottom:2}}>🔄 리텐션</div>
          {ret?<>
            <div style={{fontSize:16,fontWeight:800,color:gc(BM.ret.c(ret.d7Rate||0)),lineHeight:1,textAlign:'center',marginTop:4}}>{ret.d7Rate||0}%</div>
            <div style={{fontSize:7,color:'rgba(255,255,255,0.12)',textAlign:'center',marginTop:2}}>D7 · {ret.size}→{ret.d7}명</div>
          </>:<div style={{fontSize:8,color:'rgba(255,255,255,0.08)',textAlign:'center',padding:8}}>—</div>}
        </>} p="5px 6px"/>
      </div>

      {/* ═══ 9. 추이 ═══ */}
      {dt.length>0&&<Sec t="📈 14일 추이" open={false} ch={
        <Card ch={<>
          <div style={{display:'flex',alignItems:'flex-end',gap:2,height:40}}>
            {dt.map((d:any,i:number)=>{const mx=Math.max(...dt.map((x:any)=>x.pv||0),1);
              return<div key={i} style={{flex:1}}><div style={{height:`${((d.pv||0)/mx)*32}px`,background:'#3B7BF6',borderRadius:1,minHeight:1,opacity:0.3}}/><div style={{height:`${((d.uv||0)/mx)*32}px`,background:'#3B7BF6',borderRadius:1,minHeight:1,marginTop:1}}/></div>;
            })}
          </div>
          <div style={{display:'flex',marginTop:2}}>{dt.map((d:any,i:number)=><div key={i} style={{flex:1,fontSize:6,color:'rgba(255,255,255,0.08)',textAlign:'center'}}>{i%4===0?d.date?.slice(5):''}</div>)}</div>
        </>} p="6px 10px"/>
      }/>}

      {/* ═══ 10. 최근 활동 + 실시간 ═══ */}
      <Sec t="🕐 활동 · 방문자" open={false} ch={
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
          <Card ch={<>
            {ra.slice(0,6).map((a:any,i:number)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:3,padding:'2px 0',fontSize:8,color:'rgba(255,255,255,0.3)'}}>
                <span style={{fontSize:7}}>{a.type==='cron'?(a.status==='success'?'✅':'❌'):'👤'}</span>
                <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.type==='cron'?a.name:`${a.name} 가입`}</span>
                <span style={{fontSize:7,color:'rgba(255,255,255,0.08)'}}>{ago(a.at)}</span>
              </div>
            ))}
          </>} p="4px 6px"/>
          <Card ch={<>
            {(td?.recentVisitors||[]).slice(0,6).map((v:any,i:number)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:3,padding:'2px 0',fontSize:8,color:'rgba(255,255,255,0.25)'}}>
                <span style={{fontSize:7}}>{v.device}</span>
                <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{decodeURIComponent(v.path)}</span>
                <span style={{fontSize:6,color:'rgba(255,255,255,0.06)'}}>{v.ref}</span>
              </div>
            ))}
          </>} p="4px 6px"/>
        </div>
      }/>

      {/* ═══ 11. 주식/부동산 데이터 커버리지 ═══ */}
      {df&&<Sec t="🗄️ 데이터 커버리지" open={false} ch={
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
          <Card ch={<>
            <div style={{fontSize:8,fontWeight:600,color:'rgba(255,255,255,0.2)',marginBottom:2}}>📈 주식</div>
            {df.stock&&[{l:'종목',v:df.stock.total},{l:'시세有',v:df.stock.active},{l:'섹터',v:df.stock.withSector},{l:'설명',v:df.stock.withDesc}].map(s=>(
              <div key={s.l} style={{display:'flex',justifyContent:'space-between',fontSize:8,padding:'1px 0',color:'rgba(255,255,255,0.3)'}}>
                <span>{s.l}</span><span style={{fontWeight:600}}>{f(s.v)}/{f(df.stock.total)}</span>
              </div>
            ))}
          </>} p="5px 6px"/>
          <Card ch={<>
            <div style={{fontSize:8,fontWeight:600,color:'rgba(255,255,255,0.2)',marginBottom:2}}>🏢 부동산</div>
            {df.realestate&&[{l:'사이트',v:df.realestate.sites},{l:'이미지有',v:df.realestate.withImages},{l:'매매',v:df.realestate.transactions},{l:'단지백과',v:df.realestate.complexProfiles}].map(s=>(
              <div key={s.l} style={{display:'flex',justifyContent:'space-between',fontSize:8,padding:'1px 0',color:'rgba(255,255,255,0.3)'}}>
                <span>{s.l}</span><span style={{fontWeight:600}}>{f(s.v)}</span>
              </div>
            ))}
          </>} p="5px 6px"/>
        </div>
      }/>}

      {/* ═══ SEO ═══ */}
      <Sec t="🔍 SEO · 리라이팅" open={false} ch={
        <Card ch={<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:3}}>
          {[
            {l:'Google',v:x.googleReady||0,c:'#4285F4'},{l:'Naver',v:x.naverReady||0,c:'#03C75A'},
            {l:'리라이팅',v:`${pct(k.rewritten||0,k.blogs||1)}%`,c:'#8B5CF6'},{l:'인덱싱',v:x.indexedOk||0,c:'#F59E0B'},
          ].map(s=>(
            <div key={s.l} style={{textAlign:'center'}}>
              <div style={{fontSize:12,fontWeight:800,color:s.c as string,lineHeight:1}}>{typeof s.v==='number'?f(s.v):s.v}</div>
              <div style={{fontSize:7,color:'rgba(255,255,255,0.12)',marginTop:1}}>{s.l}</div>
            </div>
          ))}
        </div>} p="8px 10px"/>
      }/>
    </div>
  );
}
