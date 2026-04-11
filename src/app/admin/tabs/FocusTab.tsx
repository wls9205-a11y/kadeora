'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

const f=(n:number)=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e4?(n/1e3).toFixed(0)+'K':n>=1e3?(n/1e3).toFixed(1)+'K':String(n);
const pct=(a:number,b:number)=>b>0?Math.round(a/b*100):0;
const ago=(d:string)=>{if(!d)return'—';const s=Math.floor((Date.now()-new Date(d).getTime())/1000);return s<60?'방금':s<3600?Math.floor(s/60)+'분':s<86400?Math.floor(s/3600)+'시':Math.floor(s/86400)+'일';};
type G='good'|'warn'|'critical';
const BM:Record<string,{l:string;g:string;c:(v:number)=>G}>={
  ctr:{l:'CTA 클릭률',g:'>2%',c:v=>v>2?'good':v>0.5?'warn':'critical'},
  signup:{l:'가입전환',g:'>1%',c:v=>v>1?'good':v>0.3?'warn':'critical'},
  cron:{l:'크론성공',g:'>95%',c:v=>v>95?'good':v>80?'warn':'critical'},
  db:{l:'DB사용',g:'<50%',c:v=>v<50?'good':v<80?'warn':'critical'},
  gate:{l:'게이트CTR',g:'>3%',c:v=>v>3?'good':v>1?'warn':'critical'},
  profile:{l:'프로필',g:'>30%',c:v=>v>30?'good':v>10?'warn':'critical'},
  notif:{l:'알림열람',g:'>30%',c:v=>v>30?'good':v>15?'warn':'critical'},
  ret:{l:'재방문',g:'>30%',c:v=>v>30?'good':v>10?'warn':'critical'},
};
const gc=(g:G)=>g==='good'?'#10B981':g==='warn'?'#F59E0B':'#EF4444';
const gi=(g:G)=>g==='good'?'🟢':g==='warn'?'🟡':'🔴';

// ── 컴팩트 컴포넌트 ──
const Ring=({v,mx=100,sz=64,c}:{v:number;mx?:number;sz?:number;c:string})=>{
  const r=(sz-6)/2,ci=2*Math.PI*r,off=ci-(Math.min(v,mx)/mx)*ci;
  return<svg width={sz} height={sz}><circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="5"/><circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke={c} strokeWidth="5" strokeDasharray={ci} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(-90 ${sz/2} ${sz/2})`} style={{transition:'all 1s'}}/></svg>;
};
const Bar=({v,mx=100,c,h=5}:{v:number;mx?:number;c:string;h?:number})=><div style={{height:h,borderRadius:h/2,background:'rgba(255,255,255,0.04)',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.max(Math.min(v/mx*100,100),1)}%`,background:c,borderRadius:h/2,transition:'width 0.6s'}}/></div>;
const Sec=({title,children,defaultOpen=true}:{title:string;children:React.ReactNode;defaultOpen?:boolean})=>{
  const[open,setOpen]=useState(defaultOpen);
  return<div style={{marginBottom:6}}><button onClick={()=>setOpen(!open)} style={{display:'flex',alignItems:'center',gap:4,width:'100%',background:'none',border:'none',padding:'6px 0',cursor:'pointer',fontSize:12,fontWeight:700,color:'#CBD5E1'}}><span style={{fontSize:8,transition:'transform .2s',transform:open?'rotate(90deg)':'rotate(0)'}}>▶</span>{title}</button>{open&&children}</div>;
};
const Kpi=({v,l,c='#E2E8F0',sub}:{v:string|number;l:string;c?:string;sub?:string})=>(
  <div style={{background:'rgba(12,21,40,0.6)',border:'1px solid rgba(255,255,255,0.04)',borderRadius:10,padding:'8px 6px',textAlign:'center'}}>
    <div style={{fontSize:15,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
    <div style={{fontSize:8,color:'rgba(255,255,255,0.2)',marginTop:3}}>{l}</div>
    {sub&&<div style={{fontSize:7,color:'rgba(255,255,255,0.1)',marginTop:1}}>{sub}</div>}
  </div>
);
const C='rgba(12,21,40,0.6)';const B='1px solid rgba(255,255,255,0.04)';const R=10;

export default function FocusTab({onNavigate}:{onNavigate:(t:any)=>void}) {
  const[d,setD]=useState<any>(null);
  const[ops,setOps]=useState<any>(null);
  const[ld,setLd]=useState(true);
  const[gr,setGr]=useState(false);
  const[gRes,setGRes]=useState<{ok:number;fail:number}|null>(null);
  const ref=useRef<any>(null);

  const load=useCallback(()=>{
    Promise.all([
      fetch('/api/admin/v2?tab=focus').then(r=>r.json()),
      fetch('/api/admin/v2?tab=ops').then(r=>r.json()),
    ]).then(([f,o])=>{setD(f);setOps(o);setLd(false);}).catch(()=>setLd(false));
  },[]);
  useEffect(()=>{load();ref.current=setInterval(load,30000);return()=>clearInterval(ref.current);},[load]);

  if(ld)return<div style={{textAlign:'center',padding:80,color:'rgba(255,255,255,0.3)',fontSize:13}}>불러오는 중...</div>;
  if(!d)return<div style={{textAlign:'center',padding:80}}>⚠️ 로드 실패</div>;

  const{healthScore:hs=0,kpi:k={} as any,growth:g={} as any,extended:x={} as any,failedCrons:fc={},recentActivity:ra=[],dailyTrend:dt=[],ctaBreakdown:cb={},signupSources:ss={},retention:ret=null as any,featureHealth:fh={} as any,trafficDetail:td={} as any}=d;

  // 벤치마크 계산
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
  const warns=bm.filter(b=>b.g==='warn');
  const fcn=Object.keys(fc||{}).length;
  const hsc=hs>=71?'#10B981':hs>=41?'#F59E0B':'#EF4444';
  const hourly=td?.hourlyPv||[];

  const godMode=async()=>{
    if(gr)return;if(!confirm('전체 크론 실행?'))return;
    setGr(true);setGRes(null);
    try{const r=await fetch('/api/admin/god-mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'full'})});
      const d=await r.json();const ok=(d.results||[]).filter((x:any)=>x.status>=200&&x.status<400).length;
      setGRes({ok,fail:(d.results||[]).length-ok});load();
    }catch{setGRes({ok:0,fail:1});}finally{setGr(false);}
  };

  // 크론 그룹 (ops에서)
  const cg=ops?.cronGroups||{};
  const cronTotal=(ops?.totalOk||0)+(ops?.totalFail||0);

  return (
    <div>
      {/* ═══ 헤더: 헬스 + KPI + 최신화 ═══ */}
      <div style={{background:C,border:B,borderRadius:R,padding:'12px 14px',marginBottom:6,display:'flex',alignItems:'center',gap:12}}>
        <div style={{position:'relative',flexShrink:0}}>
          <Ring v={hs} c={hsc} sz={56}/>
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontSize:18,fontWeight:900,color:hsc,lineHeight:1}}>{hs}</div>
          </div>
        </div>
        <div style={{flex:1,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:2}}>
          {[
            {l:'PV 오늘',v:f(k.pvToday||0),c:'#3B7BF6'},
            {l:'가입 오늘',v:`+${k.newUsersToday||0}`,c:'#10B981'},
            {l:'실유저',v:f(k.users||0),c:'#E2E8F0'},
          ].map(s=><div key={s.l} style={{textAlign:'center'}}><div style={{fontSize:14,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div><div style={{fontSize:7,color:'rgba(255,255,255,0.2)',marginTop:1}}>{s.l}</div></div>)}
        </div>
        <button onClick={godMode} disabled={gr} style={{
          padding:'8px 12px',borderRadius:8,border:'none',cursor:'pointer',fontSize:10,fontWeight:700,
          background:gr?'rgba(255,255,255,0.05)':'linear-gradient(135deg,#3B7BF6,#10B981)',color:'#fff',
          display:'flex',flexDirection:'column',alignItems:'center',gap:1,flexShrink:0,
        }}><span style={{fontSize:16}}>{gr?'⏳':'🚀'}</span>{gr?'...':'최신화'}</button>
      </div>
      {gRes&&<div style={{padding:'4px 10px',borderRadius:6,marginBottom:4,fontSize:10,fontWeight:600,background:gRes.fail>0?'rgba(239,68,68,0.1)':'rgba(16,185,129,0.1)',color:gRes.fail>0?'#EF4444':'#10B981',textAlign:'center'}}>✓{gRes.ok} {gRes.fail>0&&`✗${gRes.fail}`}</div>}

      {/* ═══ 경고 배너 ═══ */}
      {(crits.length>0||fcn>0)&&<div style={{padding:'8px 12px',borderRadius:8,marginBottom:6,background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.15)'}}>
        {crits.map(b=><div key={b.k} style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginBottom:2}}>🔴 <strong>{BM[b.k].l}</strong> {b.v.toFixed(1)}% — 기준 {BM[b.k].g}</div>)}
        {fcn>0&&<div style={{fontSize:10,color:'rgba(255,255,255,0.5)'}}>🔴 <strong>실패크론</strong> {fcn}개</div>}
      </div>}
      {warns.length>0&&crits.length===0&&<div style={{padding:'6px 12px',borderRadius:8,marginBottom:6,background:'rgba(245,158,11,0.05)',border:'1px solid rgba(245,158,11,0.1)',fontSize:10,color:'#F59E0B'}}>⚡ {warns.map(w=>BM[w.k].l).join(' · ')} 주의</div>}

      {/* ═══ 벤치마크 그리드 ═══ */}
      <Sec title="📋 운영 기준표">
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
          {bm.map(b=>(
            <div key={b.k} style={{background:C,border:B,borderRadius:8,padding:'6px 4px',textAlign:'center'}}>
              <div style={{fontSize:12,fontWeight:800,color:gc(b.g),lineHeight:1}}>{b.v.toFixed(1)}%</div>
              <div style={{fontSize:7,color:'rgba(255,255,255,0.2)',marginTop:2}}>{BM[b.k].l}</div>
              <div style={{fontSize:7,marginTop:1}}>{gi(b.g)}</div>
            </div>
          ))}
        </div>
      </Sec>

      {/* ═══ 전환 퍼널 ═══ */}
      <Sec title="🎯 전환 퍼널 (7일)">
        <div style={{background:C,border:B,borderRadius:R,padding:'10px 12px'}}>
          {[
            {l:'PV',v:x.pv7d||0,c:'#3B7BF6'},{l:'UV',v:td?.uniqueVisitors||0,c:'#8B5CF6'},
            {l:'게이트노출',v:x.gateViews||0,c:'#F59E0B'},{l:'게이트클릭',v:x.gateClicks||0,c:'#EF4444'},
            {l:'가입시도',v:x.signupAttempts7d||0,c:'#EC4899'},{l:'가입성공',v:k.newUsers||0,c:'#10B981'},
          ].map((s,i,arr)=>{
            const prev=i>0?arr[i-1].v:s.v;const drop=prev>0&&i>0?Math.round((1-s.v/prev)*100):0;
            const mx=Math.max(...arr.map(a=>a.v),1);
            return<div key={s.l} style={{marginBottom:4}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:1}}>
                <span style={{color:'rgba(255,255,255,0.4)'}}>{s.l}</span>
                <span style={{fontWeight:700,color:s.c}}>{f(s.v)}{i>0&&drop>0&&<span style={{fontSize:8,color:'rgba(255,255,255,0.15)',marginLeft:3}}>-{drop}%</span>}</span>
              </div>
              <Bar v={s.v} mx={mx} c={s.c} h={4}/>
            </div>;
          })}
        </div>
      </Sec>

      {/* ═══ CTA 성과 ═══ */}
      <Sec title="🎪 CTA 성과 (7일)">
        <div style={{background:C,border:B,borderRadius:R,padding:'6px 10px'}}>
          {Object.entries(cb||{}).sort((a:any,b:any)=>(b[1].views||0)-(a[1].views||0)).slice(0,8).map(([n,e]:[string,any])=>{
            const v=e.views||0,cl=e.clicks||0,ctr=v>0?cl/v*100:0;const grade=BM.ctr.c(ctr);
            return<div key={n} style={{display:'flex',padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.02)',fontSize:10,alignItems:'center',gap:3}}>
              <span style={{fontSize:7}}>{gi(grade)}</span>
              <span style={{flex:1,color:'rgba(255,255,255,0.5)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n}</span>
              <span style={{width:28,textAlign:'right',color:'rgba(255,255,255,0.2)',fontSize:9}}>{f(v)}</span>
              <span style={{width:22,textAlign:'right',color:'rgba(255,255,255,0.2)',fontSize:9}}>{cl}</span>
              <span style={{width:38,textAlign:'right',fontWeight:700,color:gc(grade),fontSize:10}}>{ctr.toFixed(1)}%</span>
            </div>;
          })}
          {Object.keys(cb||{}).length===0&&<div style={{textAlign:'center',padding:8,fontSize:10,color:'rgba(255,255,255,0.15)'}}>수집 중</div>}
        </div>
      </Sec>

      {/* ═══ 트래픽 + 유입 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:6,marginBottom:6}}>
        {/* 시간대 차트 */}
        <div style={{background:C,border:B,borderRadius:R,padding:'8px 10px'}}>
          <div style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.3)',marginBottom:4}}>⏰ 시간대 (오늘)</div>
          {hourly.length>0&&<>
            <div style={{display:'flex',alignItems:'flex-end',gap:1,height:35}}>
              {hourly.map((v:any,i:number)=>{const mx=Math.max(...hourly.map((h:any)=>h.count||0),1);const now=new Date().getHours();
                return<div key={i} style={{flex:1,height:Math.max(((v.count||0)/mx)*28,1),borderRadius:1,background:v.hour===now?'#10B981':(v.count||0)>20?'rgba(59,123,246,0.4)':'rgba(59,123,246,0.1)'}}/>;
              })}
            </div>
            <div style={{fontSize:8,color:'rgba(255,255,255,0.15)',marginTop:3,textAlign:'center'}}>PV {f(td?.todayTotal||k.pvToday||0)} · UV {td?.uniqueVisitors||'—'}</div>
          </>}
        </div>
        {/* 유입 경로 */}
        <div style={{background:C,border:B,borderRadius:R,padding:'8px 10px'}}>
          <div style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.3)',marginBottom:4}}>📡 유입</div>
          {(td?.referrerBreakdown||[]).slice(0,4).map((r:any,i:number)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:9,padding:'1px 0',color:'rgba(255,255,255,0.35)'}}>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{r.source}</span>
              <span style={{fontWeight:600,flexShrink:0,marginLeft:4}}>{r.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ KPI 그리드 ═══ */}
      <Sec title="📊 핵심 지표">
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
          <Kpi v={f(k.blogs||0)} l="블로그" c="#8B5CF6" sub={`핫${f(x.hotBlogs||0)}`}/>
          <Kpi v={f(k.stocks||0)} l="주식" c="#3B7BF6"/>
          <Kpi v={f(k.apts||0)} l="분양" c="#10B981" sub={`미분양${f(k.unsold||0)}`}/>
          <Kpi v={`${cr}%`} l="크론" c={gc(BM.cron.c(cr))} sub={`${k.cronSuccess||0}/${cronTotal||0}`}/>
          <Kpi v={f(k.emailSubs||0)} l="이메일" c="#EC4899"/>
          <Kpi v={f(k.pushSubs||0)} l="푸시" c="#F59E0B"/>
          <Kpi v={f(x.shares7d||0)} l="공유/7d" c="#A855F7" sub={`오늘${x.sharesToday||0}`}/>
          <Kpi v={`${((k.dbMb||0)/1024).toFixed(1)}G`} l="DB" c={gc(BM.db.c(dbP))} sub="/8.4G"/>
        </div>
      </Sec>

      {/* ═══ 크론 그룹 ═══ */}
      <Sec title="🔧 크론 현황 (24h)" defaultOpen={false}>
        <div style={{background:C,border:B,borderRadius:R,padding:'8px 10px'}}>
          {Object.entries(cg).map(([key,g]:[string,any])=>{
            const t=g.ok+g.fail;const p=t>0?Math.round(g.ok/t*100):100;
            const icons:Record<string,string>={data:'📡',process:'⚙️',ai:'🤖',content:'✍️',system:'🛠️',alert:'🔔'};
            return<div key={key} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 0'}}>
              <span style={{fontSize:10}}>{icons[key]||'📦'}</span>
              <span style={{fontSize:10,color:'rgba(255,255,255,0.4)',minWidth:40}}>{key}</span>
              <div style={{flex:1}}><Bar v={p} c={p>=90?'#10B981':p>=70?'#F59E0B':'#EF4444'}/></div>
              <span style={{fontSize:10,fontWeight:600,color:p>=90?'#10B981':'#F59E0B',minWidth:28,textAlign:'right'}}>{p}%</span>
            </div>;
          })}
          {/* 실패 크론 */}
          {Object.keys(ops?.failedCrons||{}).length>0&&<div style={{marginTop:6,paddingTop:6,borderTop:'1px solid rgba(255,255,255,0.04)'}}>
            {Object.entries(ops.failedCrons).slice(0,3).map(([n,info]:[string,any])=>(
              <div key={n} style={{fontSize:9,color:'#EF4444',marginBottom:2}}>✗ {n} ({info.count}회)</div>
            ))}
          </div>}
          {/* 최근 크론 */}
          {(ops?.recentCrons||[]).slice(0,5).map((c:any,i:number)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'2px 0',fontSize:9,color:'rgba(255,255,255,0.3)'}}>
              <span style={{width:5,height:5,borderRadius:'50%',background:c.status==='success'?'#10B981':'#EF4444',flexShrink:0}}/>
              <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
              {c.records>0&&<span>{c.records}건</span>}
              <span style={{fontSize:8}}>{ago(c.at)}</span>
            </div>
          ))}
        </div>
      </Sec>

      {/* ═══ 기능 사용 + 가입 경로 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:6}}>
        <div style={{background:C,border:B,borderRadius:R,padding:'8px 10px'}}>
          <div style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.3)',marginBottom:4}}>💪 기능 사용</div>
          {[{l:'아파트BM',v:fh.aptBookmarks||0},{l:'블로그BM',v:fh.blogBookmarks||0},{l:'관심종목',v:fh.stockWatchlist||0},{l:'알림',v:fh.priceAlerts||0},{l:'출석',v:fh.attendance||0},{l:'미션',v:fh.missionCompleted||0}].map(feat=>(
            <div key={feat.l} style={{display:'flex',justifyContent:'space-between',padding:'2px 0',fontSize:9}}>
              <span style={{color:feat.v>0?'rgba(255,255,255,0.4)':'rgba(255,255,255,0.1)'}}>{feat.v>0?'✓':'✗'} {feat.l}</span>
              <span style={{fontWeight:600,color:feat.v>0?'#E2E8F0':'rgba(255,255,255,0.08)'}}>{feat.v}</span>
            </div>
          ))}
        </div>
        <div style={{background:C,border:B,borderRadius:R,padding:'8px 10px'}}>
          <div style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.3)',marginBottom:4}}>🎯 가입 경로</div>
          {Object.entries(ss).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5).map(([src,cnt]:[string,any])=>(
            <div key={src} style={{display:'flex',justifyContent:'space-between',padding:'2px 0',fontSize:9}}>
              <span style={{color:'rgba(255,255,255,0.4)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{src}</span>
              <span style={{fontWeight:600,color:'#E2E8F0',flexShrink:0}}>{cnt}</span>
            </div>
          ))}
          {Object.keys(ss).length===0&&<div style={{fontSize:9,color:'rgba(255,255,255,0.1)',textAlign:'center',padding:8}}>—</div>}
        </div>
      </div>

      {/* ═══ 14일 트렌드 ═══ */}
      {dt.length>0&&<Sec title="📈 14일 추이" defaultOpen={false}>
        <div style={{background:C,border:B,borderRadius:R,padding:'8px 12px'}}>
          <div style={{display:'flex',alignItems:'flex-end',gap:2,height:45}}>
            {dt.map((d:any,i:number)=>{const mx=Math.max(...dt.map((x:any)=>x.pv||0),1);
              return<div key={i} style={{flex:1,display:'flex',flexDirection:'column',gap:1}}>
                <div style={{height:`${((d.pv||0)/mx)*35}px`,background:'#3B7BF6',borderRadius:1,minHeight:1,opacity:0.3}}/>
                <div style={{height:`${((d.uv||0)/mx)*35}px`,background:'#3B7BF6',borderRadius:1,minHeight:1}}/>
              </div>;
            })}
          </div>
          <div style={{display:'flex',marginTop:3}}>{dt.map((d:any,i:number)=><div key={i} style={{flex:1,fontSize:6,color:'rgba(255,255,255,0.1)',textAlign:'center'}}>{i%4===0?d.date?.slice(5):''}</div>)}</div>
        </div>
      </Sec>}

      {/* ═══ 리텐션 ═══ */}
      {ret&&<div style={{background:C,border:B,borderRadius:R,padding:'8px 12px',marginBottom:6,display:'flex',alignItems:'center',gap:10}}>
        <div style={{fontSize:18,fontWeight:800,color:gc(BM.ret.c(ret.d7Rate||0))}}>{ret.d7Rate||0}%</div>
        <div><div style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.4)'}}>D7 리텐션</div><div style={{fontSize:8,color:'rgba(255,255,255,0.15)'}}>코호트 {ret.cohortWeek?.slice(5)} · {ret.size}명→{ret.d7}명</div></div>
      </div>}

      {/* ═══ 최근 활동 ═══ */}
      <Sec title="🕐 최근 활동" defaultOpen={false}>
        <div style={{background:C,border:B,borderRadius:R,padding:'4px 10px'}}>
          {ra.slice(0,8).map((a:any,i:number)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 0',borderBottom:'1px solid rgba(255,255,255,0.02)',fontSize:10}}>
              <span style={{fontSize:8}}>{a.type==='cron'?(a.status==='success'?'✅':'❌'):'👤'}</span>
              <span style={{flex:1,color:'rgba(255,255,255,0.4)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.type==='cron'?a.name:`${a.name} 가입`}</span>
              <span style={{fontSize:8,color:'rgba(255,255,255,0.1)',flexShrink:0}}>{ago(a.at)}</span>
            </div>
          ))}
        </div>
      </Sec>

      {/* ═══ 실시간 방문자 ═══ */}
      {(td?.recentVisitors||[]).length>0&&<Sec title="👁 실시간 방문자" defaultOpen={false}>
        <div style={{background:C,border:B,borderRadius:R,padding:'4px 10px',maxHeight:160,overflowY:'auto'}}>
          {td.recentVisitors.slice(0,10).map((v:any,i:number)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'2px 0',borderBottom:'1px solid rgba(255,255,255,0.02)',fontSize:9}}>
              <span>{v.device}</span>
              <span style={{flex:1,color:'rgba(255,255,255,0.3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{decodeURIComponent(v.path)}</span>
              <span style={{color:'rgba(255,255,255,0.1)',fontSize:7}}>{v.ref}</span>
              <span style={{color:'rgba(255,255,255,0.08)',fontSize:7}}>{ago(v.at)}</span>
            </div>
          ))}
        </div>
      </Sec>}

      {/* ═══ 바로가기 ═══ */}
      <div style={{display:'flex',gap:4,marginTop:8}}>
        {[{t:'users' as const,l:'👤 유저'},{t:'data' as const,l:'🗄️ 데이터'},{t:'ops' as const,l:'🔧 운영'},{t:'issues' as const,l:'🔍 이슈'}].map(b=>(
          <button key={b.t} onClick={()=>onNavigate(b.t)} style={{flex:1,padding:'8px 4px',borderRadius:8,background:'rgba(59,123,246,0.06)',border:'1px solid rgba(59,123,246,0.12)',color:'#3B7BF6',cursor:'pointer',fontSize:10,fontWeight:600}}>
            {b.l}
          </button>
        ))}
      </div>
    </div>
  );
}
