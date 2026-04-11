'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

const f=(n:number)=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e4?(n/1e3).toFixed(0)+'K':n>=1e3?(n/1e3).toFixed(1)+'K':String(n);
const pct=(a:number,b:number)=>b>0?Math.round(a/b*100):0;
const ago=(d:string)=>{const s=Math.floor((Date.now()-new Date(d).getTime())/1000);return s<60?'방금':s<3600?Math.floor(s/60)+'분':s<86400?Math.floor(s/3600)+'시':Math.floor(s/86400)+'일';};

const Ring=({value,max=100,size=44,stroke=4,color,children}:{value:number;max?:number;size?:number;stroke?:number;color:string;children?:React.ReactNode})=>{
  const r=(size-stroke)/2,circ=2*Math.PI*r,off=circ-(Math.min(value,max)/max)*circ;
  return <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}/>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{transition:'stroke-dashoffset 1s'}}/>
    <g style={{transform:'rotate(90deg)',transformOrigin:'center'}}>{children}</g>
  </svg>;
};
const Spark=({data,h=32,color='#3B7BF6'}:{data:number[];h?:number;color?:string})=>{
  const mx=Math.max(...data,1),w=560;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-(v/mx)*h}`).join(' ');
  return <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{display:'block'}}>
    <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#sg)"/><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx={w} cy={h-(data[data.length-1]/mx)*h} r="2.5" fill={color}/>
  </svg>;
};
const Dot=({ok,size=6}:{ok:boolean;size?:number})=><span style={{width:size,height:size,borderRadius:'50%',background:ok?'#10B981':'#EF4444',display:'inline-block',flexShrink:0,boxShadow:ok?'0 0 6px rgba(16,185,129,0.4)':'0 0 6px rgba(239,68,68,0.4)'}}/>;
const HBar=({value,max=100,color,h=5}:{value:number;max?:number;color:string;h?:number})=><div style={{height:h,borderRadius:h/2,background:'rgba(255,255,255,0.06)',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.max(Math.min(value/max*100,100),2)}%`,background:color,borderRadius:h/2,transition:'width 0.8s'}}/></div>;

// 섹션 타이틀
const SH=({icon,title,right}:{icon:string;title:string;right?:React.ReactNode})=>(
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <span style={{fontSize:13}}>{icon}</span>
      <span style={{fontSize:13,fontWeight:800,color:'#F1F5F9'}}>{title}</span>
    </div>
    {right}
  </div>
);

const GodBtn=()=>{
  const [r,setR]=useState(false);const [res,setRes]=useState<{ok:number;fail:number}|null>(null);
  const run=async()=>{if(r)return;if(!confirm('113개 크론 전체 실행. 계속?'))return;setR(true);setRes(null);
    try{const d=await(await fetch('/api/admin/god-mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'full'})})).json();
      const ok=(d.results||[]).filter((x:any)=>x.status>=200&&x.status<400).length;const fail=(d.results||[]).length-ok;setRes({ok,fail});
    }catch{setRes({ok:0,fail:1});}setR(false);};
  return <button onClick={run} disabled={r} style={{width:'100%',padding:'14px 0',borderRadius:12,border:'none',background:r?'rgba(12,21,40,0.65)':'linear-gradient(135deg,#2563EB,#7C3AED)',color:'#fff',fontSize:15,fontWeight:800,cursor:r?'not-allowed':'pointer',marginBottom:6,position:'relative',overflow:'hidden'}}>
    {r?<span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><span style={{width:16,height:16,border:'2px solid rgba(255,255,255,0.2)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .5s linear infinite',display:'inline-block'}}/>실행 중...</span>
    :res?`✅ ${res.ok}성공 ${res.fail>0?`· ❌ ${res.fail}실패`:''}`:'🚀 전체 최신화 (113개 크론)'}
  </button>;
};

export default function FocusTab({onNavigate}:{onNavigate:(t:any)=>void}) {
  const [d,setD]=useState<any>(null);
  const [ld,setLd]=useState(true);
  const [pulse,setPulse]=useState(true);
  const ref=useRef<any>(null);
  const load=useCallback(()=>{fetch('/api/admin/v2?tab=focus').then(r=>r.json()).then(v=>{setD(v);setLd(false);}).catch(()=>setLd(false));},[]);
  useEffect(()=>{load();ref.current=setInterval(load,30000);return()=>clearInterval(ref.current);},[load]);
  useEffect(()=>{const i=setInterval(()=>setPulse(p=>!p),1500);return()=>clearInterval(i);},[]);

  if(ld)return<div style={{textAlign:'center',padding:80,color:'rgba(255,255,255,0.3)',fontSize:13}}>불러오는 중...</div>;
  if(!d)return<div style={{textAlign:'center',padding:80,fontSize:13}}>⚠️ 로드 실패</div>;

  const{healthScore:hs=0,kpi:k={} as any,growth:g={} as any,extended:x={} as any,failedCrons:fc={},recentActivity:ra=[],dailyTrend:dt=[],categoryStats:cs=[],trafficDetail:td={} as any,ctaBreakdown:cb={} as any,signupSources:ss={} as any,retention:ret=null as any,featureHealth:fh={} as any,behavior:bv=null as any}=d;
  const fcn=Object.keys(fc||{}).length;
  const cr=pct(k.cronSuccess,k.cronSuccess+k.cronFail);
  const ctr=(g.ctaViews7d||0)>0?((g.ctaClicks7d||0)/(g.ctaViews7d||1)*100).toFixed(1):'0';
  const nr=pct(g.notifRead7d||0,g.notifTotal7d||1);
  const dbPct=pct(k.dbMb||0,8400);
  const rwPct=k.rewriteRate||0;
  const rwRemain=(k.blogs||0)-(k.rewritten||0);
  const rwDaily=x.newBlogs24||0;
  const rwEta=rwDaily>0?Math.ceil(rwRemain/(rwDaily>10?rwDaily:154)):0;

  const shareTotal = x.shares7d || 0;
  const sharePlatforms = x.sharesByPlatform || {};
  const topSharePlatform = Object.entries(sharePlatforms).sort((a: any, b: any) => b[1] - a[1])[0];

  const warns:string[]=[];
  if((g.profileRate??0)===0&&k.users>0)warns.push('프로필 0%');
  if(parseFloat(ctr)<1&&(g.ctaViews7d??0)>10)warns.push(`CTR ${ctr}%`);
  if(fcn>0)warns.push(`크론실패 ${fcn}`);
  if(ret&&ret.d7Rate===0&&ret.size>5)warns.push('D7 리텐션 0%');
  if((k.pushSubs??0)<=3)warns.push(`푸시 ${k.pushSubs??0}명`);
  if(shareTotal<=1)warns.push('공유 죽음');
  if((k.signupAttempts??0)>10&&(k.signupSuccess??0)===0)warns.push('가입성공 0건');
  if((k.neverActive??0)>10)warns.push(`미활성 ${k.neverActive}명`);
  const deadFeatures = ['aptBookmarks','blogBookmarks','stockWatchlist','priceAlerts'].filter(f=>(fh[f]??0)===0).length;
  if(deadFeatures>=3)warns.push(`죽은기능 ${deadFeatures}개`);

  const CS={card:{background:'rgba(12,21,40,0.65)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:12,padding:'12px 14px',backdropFilter:'blur(8px)'} as const};

  const hourly=td?.hourlyPv||[];
  const hmx=hourly.length>0?Math.max(...hourly.map((h:any)=>h.count||0),1):1;
  const topPages=td?.topPages||[];
  const refSources=td?.referrerBreakdown||[];
  const refTotal=refSources.reduce((a:number,r:any)=>a+(r.count||0),0)||1;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:6}}>

      {/* ═══ 📊 가입 퍼널 — 최상단 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:2}}>
        <div style={{background:'linear-gradient(135deg,rgba(251,191,36,0.12),rgba(12,21,40,0.8))',border:'1px solid rgba(251,191,36,0.2)',borderRadius:14,padding:'12px 10px',textAlign:'center'}}>
          <div style={{fontSize:11,fontWeight:700,color:'rgba(251,191,36,0.8)'}}>가입 시도</div>
          <div style={{fontSize:28,fontWeight:900,color:'#FBBF24',lineHeight:1,marginTop:4}}>{k.signupAttempts??0}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:4}}>{k.signupAttempts7d||0} / 7일</div>
        </div>
        <div style={{background:'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(12,21,40,0.8))',border:'1px solid rgba(16,185,129,0.2)',borderRadius:14,padding:'12px 10px',textAlign:'center'}}>
          <div style={{fontSize:11,fontWeight:700,color:'rgba(16,185,129,0.8)'}}>가입 성공</div>
          <div style={{fontSize:28,fontWeight:900,color:'#10B981',lineHeight:1,marginTop:4}}>{k.signupSuccess??0}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:4}}>{k.signupAttempts > 0 ? ((k.signupSuccess/k.signupAttempts)*100).toFixed(0) : '\u2014'}% 전환</div>
        </div>
        <div style={{background:'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(12,21,40,0.8))',border:'1px solid rgba(239,68,68,0.2)',borderRadius:14,padding:'12px 10px',textAlign:'center'}}>
          <div style={{fontSize:11,fontWeight:700,color:'rgba(239,68,68,0.8)'}}>가입 실패</div>
          <div style={{fontSize:28,fontWeight:900,color:'#EF4444',lineHeight:1,marginTop:4}}>{(k.signupAttempts??0)-(k.signupSuccess??0)}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:4}}>에러 체크</div>
        </div>
      </div>

      {/* ═══ 🚀 전체 최신화 ═══ */}
      <GodBtn/>

      {/* ═══ 🔥 오늘 핵심 KPI 히어로 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        <div style={{background:'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(12,21,40,0.8))',border:'1px solid rgba(16,185,129,0.2)',borderRadius:14,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:11,fontWeight:700,color:'rgba(16,185,129,0.8)',letterSpacing:0.5,marginBottom:6}}>오늘 가입자</div>
          <div style={{fontSize:32,fontWeight:900,color:'#10B981',lineHeight:1}}>{k.newUsersToday??0}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:4}}>+{k.newUsers||0} / 7일</div>
        </div>
        <div style={{background:'linear-gradient(135deg,rgba(6,182,212,0.12),rgba(12,21,40,0.8))',border:'1px solid rgba(6,182,212,0.2)',borderRadius:14,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:11,fontWeight:700,color:'rgba(6,182,212,0.8)',letterSpacing:0.5,marginBottom:6}}>오늘 방문자</div>
          <div style={{fontSize:32,fontWeight:900,color:'#06B6D4',lineHeight:1}}>{td?.uniqueVisitors||0}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:4}}>PV {k.pvToday||0}</div>
        </div>
        <div style={{background:'linear-gradient(135deg,rgba(168,85,247,0.12),rgba(12,21,40,0.8))',border:'1px solid rgba(168,85,247,0.2)',borderRadius:14,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:11,fontWeight:700,color:'rgba(168,85,247,0.8)',letterSpacing:0.5,marginBottom:6}}>오늘 공유</div>
          <div style={{fontSize:32,fontWeight:900,color:'#A855F7',lineHeight:1}}>{k.sharesToday??0}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:4}}>{k.shares7d||0} / 7일</div>
        </div>
        <div style={{background:'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(12,21,40,0.8))',border:'1px solid rgba(239,68,68,0.2)',borderRadius:14,padding:'14px 16px',textAlign:'center'}}>
          <div style={{fontSize:11,fontWeight:700,color:'rgba(239,68,68,0.8)',letterSpacing:0.5,marginBottom:6}}>게이트 전환</div>
          <div style={{fontSize:32,fontWeight:900,color:'#EF4444',lineHeight:1}}>{k.gateClicks??0}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:4}}>{k.gateViews??0}뷰 · {k.gateViews > 0 ? ((k.gateClicks/k.gateViews)*100).toFixed(1) : 0}%</div>
        </div>
      </div>

      {/* ═══ 위험 신호 ═══ */}
      {warns.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {warns.map((w,i)=><span key={i} style={{fontSize:12,fontWeight:700,color:'#EF4444',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.15)',padding:'4px 10px',borderRadius:20}}>⚠ {w}</span>)}
      </div>}

      {/* ═══ 실시간 트래픽 ═══ */}
      <div style={{...CS.card,background:'linear-gradient(135deg,rgba(6,182,212,0.06),rgba(12,21,40,0.65))'}}>
        <SH icon="⚡" title="실시간 트래픽" right={
          <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.15)',borderRadius:20,padding:'3px 10px'}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#10B981',opacity:pulse?1:0.3,transition:'opacity 0.3s'}}/>
            <span style={{fontSize:11,fontWeight:700,color:'#10B981'}}>{td?.recentVisitors?.length||'—'}</span>
            <span style={{fontSize:9,color:'rgba(16,185,129,0.5)'}}>online</span>
          </div>
        }/>
        {/* 2×2 그리드 — 모바일 가독성 */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
          {[
            {l:'접속 (1h)',v:td?.recentVisitors?.length||0,c:'#10B981'},
            {l:'UV (오늘)',v:td?.uniqueVisitors||0,c:'#06B6D4'},
            {l:'PV (오늘)',v:k.pvToday||0,c:'#3B7BF6'},
            {l:'PV (7일)',v:f(x.pv7d||0),c:'#8B5CF6'},
          ].map(kk=>(
            <div key={kk.l} style={{textAlign:'center',padding:'6px 0',background:'rgba(255,255,255,0.02)',borderRadius:8}}>
              <div style={{fontSize:26,fontWeight:900,color:kk.c,lineHeight:1}}>{kk.v}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:4}}>{kk.l}</div>
            </div>
          ))}
        </div>
        {hourly.length>0&&<>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.25)',marginBottom:4}}>시간대별 PV (24h)</div>
          <div style={{display:'flex',gap:1,height:28,alignItems:'flex-end'}}>
            {hourly.map((v:any,i:number)=>{const now=new Date().getHours();return <div key={i} style={{flex:1,height:Math.max(((v.count||0)/hmx)*24,2),borderRadius:2,background:v.hour===now?'#10B981':(v.count||0)>40?'rgba(59,123,246,0.5)':'rgba(59,123,246,0.15)'}}/>;
            })}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:3}}>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.25)'}}>0시</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.25)'}}>12시</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.25)'}}>23시</span>
          </div>
        </>}
        {/* 최근 접속자 실시간 피드 */}
        {(td?.recentVisitors||[]).length>0&&<>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.25)',marginTop:8,marginBottom:4}}>최근 접속 (실시간)</div>
          {td.recentVisitors.slice(0,8).map((v:any,i:number)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 0',fontSize:11,borderBottom:i<7?'1px solid rgba(255,255,255,0.03)':'none'}}>
              <span style={{fontSize:12,flexShrink:0}}>{v.device}</span>
              <span style={{flex:1,color:'rgba(255,255,255,0.4)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,minWidth:0}}>{(() => { try { return decodeURIComponent(v.path||'').replace(/\(main\)\//g,'') } catch { return v.path } })().slice(0,25)}</span>
              <span style={{fontSize:9,padding:'1px 6px',borderRadius:8,background:v.ref.includes('Google')?'rgba(66,133,244,0.15)':v.ref.includes('Naver')?'rgba(0,199,60,0.15)':v.ref.includes('Kakao')?'rgba(254,229,0,0.15)':v.ref.includes('Daum')?'rgba(245,158,11,0.15)':v.ref==='Direct'?'rgba(59,123,246,0.1)':'rgba(255,255,255,0.04)',color:v.ref.includes('Google')?'#4285F4':v.ref.includes('Naver')?'#00C73C':v.ref.includes('Kakao')?'#FEE500':v.ref.includes('Daum')?'#F59E0B':v.ref==='Direct'?'#3B7BF6':'rgba(255,255,255,0.3)',flexShrink:0}}>{v.ref}</span>
              <span style={{fontSize:9,color:'rgba(255,255,255,0.15)',flexShrink:0,width:24,textAlign:'right' as const}}>{ago(v.at)}</span>
            </div>
          ))}
        </>}
      </div>

      {/* ═══ 인기 페이지 + 유입 경로 ═══ */}
      {(topPages.length>0||refSources.length>0)&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,overflow:'hidden'}}>
        <div style={{...CS.card,minWidth:0,overflow:'hidden'}}>
          <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:6}}>🔥 인기 페이지</div>
          {topPages.slice(0,5).map((p:any,i:number)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 0',fontSize:10}}>
              <span style={{width:16,height:16,borderRadius:4,background:i<3?['#3B7BF6','#06B6D4','#8B5CF6'][i]:'rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:800,color:i<3?'#fff':'rgba(255,255,255,0.25)',flexShrink:0}}>{i+1}</span>
              <span style={{flex:1,color:'rgba(255,255,255,0.45)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,minWidth:0}}>{(() => { try { return decodeURIComponent(p.path).replace(/\(.main\)\//g,'') } catch { return p.path } })().slice(0,20)}</span>
              <span style={{fontWeight:700,color:'rgba(255,255,255,0.55)',fontSize:11}}>{p.count}</span>
            </div>
          ))}
        </div>
        <div style={{...CS.card,minWidth:0,overflow:'hidden'}}>
          <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:6}}>🌐 유입 경로</div>
          {refSources.slice(0,8).map((r:any)=>{const w=pct(r.count||0,refTotal);const clr:any={'Direct':'#3B7BF6','Google':'#4285F4','Naver 검색':'#00C73C','Naver 블로그':'#03C75A','Naver 카페':'#1EC800','Naver 뉴스':'#00B843','Naver':'#00C73C','Daum 검색':'#F59E0B','Daum 카페':'#E68A00','Daum':'#F59E0B','Kakao':'#FEE500','Kakao 채널':'#FFD700','Bing':'#00809D','Zum':'#FF6B00','DCinside':'#1E90FF','Clien':'#4A90D9','FMKorea':'#2DB400','Blind':'#00D1B2','Instagram':'#E1306C','Facebook':'#1877F2','X(Twitter)':'#1DA1F2','YouTube':'#FF0000','Band':'#06C755','Tistory':'#FF5A00','ChatGPT':'#10A37F','Perplexity':'#20B2AA'}; return <div key={r.source} style={{marginBottom:4}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}>
              <span style={{color:'rgba(255,255,255,0.45)'}}>{r.source}</span>
              <span style={{fontWeight:600,color:'rgba(255,255,255,0.55)'}}>{r.count} <span style={{fontSize:9,color:'rgba(255,255,255,0.2)'}}>({w}%)</span></span>
            </div>
            <HBar value={w} color={clr[r.source]||'rgba(255,255,255,0.2)'} h={4}/>
          </div>;})}
        </div>
      </div>}

      {/* ═══ KPI — 2×2 그리드 (모바일 최적화) ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        {[
          {l:'유저',v:`${k.users}/${k.users+(x.seeds||0)}`,c:'#3B7BF6',sub:`시드${x.seeds||0} · +${k.newUsers}/7d`,ring:pct(g.onboardRate||0,100)},
          {l:'블로그',v:f(k.blogs),c:'#8B5CF6',sub:`${f(x.hotBlogs||0)}핫`,ring:Math.min(pct(x.hotBlogs||0,k.blogs||1)*10,100)},
          {l:'크론',v:`${cr}%`,c:cr>=95?'#10B981':'#EF4444',sub:`${k.cronFail}실패`,ring:cr},
          {l:'DB',v:`${((k.dbMb||0)/1024).toFixed(1)}G`,c:dbPct<50?'#10B981':'#F59E0B',sub:'/8.4G',ring:dbPct},
        ].map(kk=>(
          <div key={kk.l} style={{...CS.card,display:'flex',alignItems:'center',gap:12,padding:'8px 10px'}}>
            <Ring value={kk.ring} size={38} stroke={4} color={kk.c}>
              <text x="19" y="17" textAnchor="middle" dominantBaseline="central" fill={kk.c} fontSize="11" fontWeight="800">{kk.v}</text>
            </Ring>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.5)'}}>{kk.l}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.25)'}}>{kk.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ 유저·블로그 세부 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:4}}>
        {[
          {l:'전체',v:(k.users||0)+(x.seeds||0),c:'#6B7280'},
          {l:'신규(7d)',v:k.newUsers||0,c:'#10B981'},
          {l:'활성',v:k.activeUsers||0,c:'#3B7BF6'},
          {l:'복귀율',v:`${k.returnRate||0}%`,c:'#8B5CF6'},
          {l:'오늘글',v:g.postsToday||0,c:'#06B6D4'},
        ].map(kk=>(
          <div key={kk.l} style={{textAlign:'center',background:'rgba(12,21,40,0.65)',border:'1px solid rgba(255,255,255,0.04)',borderRadius:8,padding:'6px 0'}}>
            <div style={{fontSize:14,fontWeight:800,color:kk.c,lineHeight:1}}>{kk.v}</div>
            <div style={{fontSize:8,color:'rgba(255,255,255,0.2)',marginTop:3}}>{kk.l}</div>
          </div>
        ))}
      </div>

      {/* ═══ 데이터 KPI ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
        {[{l:'청약',v:f(k.apts),c:'#10B981',i:'🏠'},{l:'종목',v:f(k.stocks),c:'#F59E0B',i:'📈'},{l:'단지',v:f(x.aptSites||0),c:'#14B8A6',i:'🏢'},{l:'미분양',v:f(k.unsold),c:'#F97316',i:'🏚️'},{l:'재개발',v:f(k.redev||0),c:'#EC4899',i:'🔨'},{l:'관심',v:f(k.interests||0),c:'#6366F1',i:'❤️'}].map(kk=>(
          <div key={kk.l} style={{...CS.card,display:'flex',alignItems:'center',gap:10,padding:'8px 10px'}}>
            <span style={{fontSize:18,opacity:0.6}}>{kk.i}</span>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:kk.c,lineHeight:1}}>{kk.v}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginTop:2}}>{kk.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ 14일 PV 스파크라인 ═══ */}
      {dt?.length>0&&<div style={{...CS.card,overflow:'hidden'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <span style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)'}}>📈 14일 PV</span>
          <span style={{fontSize:12,fontWeight:700,color:'#06B6D4'}}>{k.pvToday}<span style={{fontSize:10,color:'rgba(255,255,255,0.25)'}}> /오늘</span></span>
        </div>
        <Spark data={dt.slice(-14).map((v:any)=>v.pv||0)} h={40}/>
      </div>}

      {/* ═══ 리라이팅 현황 ═══ */}
      <div style={{...CS.card,background:'linear-gradient(135deg,rgba(139,92,246,0.06),rgba(12,21,40,0.65))',borderLeft:'3px solid #8B5CF6'}}>
        <SH icon="✍️" title="SEO 리라이팅" right={<span style={{fontSize:11,fontWeight:700,color:'#8B5CF6'}}>{rwPct}%</span>}/>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:10}}>
          <Ring value={rwPct} size={52} stroke={5} color="#8B5CF6">
            <text x="26" y="23" textAnchor="middle" dominantBaseline="central" fill="#8B5CF6" fontSize="14" fontWeight="900">{rwPct}%</text>
            <text x="26" y="36" textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.2)" fontSize="8">완료</text>
          </Ring>
          <div style={{flex:1}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:6}}>
              {[{l:'완료',v:f(k.rewritten||0),c:'#10B981'},{l:'잔여',v:f((k.blogs||0)-(k.rewritten||0)),c:'#F59E0B'},{l:'오늘',v:x.newBlogs24||0,c:'#06B6D4'}].map(kk=>(
                <div key={kk.l} style={{textAlign:'center'}}>
                  <div style={{fontSize:15,fontWeight:800,color:kk.c,lineHeight:1}}>{kk.v}</div>
                  <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',marginTop:2}}>{kk.l}</div>
                </div>
              ))}
            </div>
            {/* 리라이팅 세부 */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginTop:6}}>
              {[{l:'일처리',v:`${rwDaily>0?rwDaily:'~154'}/일`,c:'#06B6D4'},{l:'ETA',v:rwEta>0?`${rwEta}일`:'—',c:rwEta<14?'#10B981':'#F59E0B'},{l:'발행총',v:f(k.blogs||0),c:'#8B5CF6'}].map(kk=>(
                <div key={kk.l} style={{textAlign:'center',background:'rgba(255,255,255,0.02)',borderRadius:6,padding:'4px 0'}}>
                  <div style={{fontSize:12,fontWeight:700,color:kk.c,lineHeight:1}}>{kk.v}</div>
                  <div style={{fontSize:8,color:'rgba(255,255,255,0.2)',marginTop:2}}>{kk.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* 카테고리 효율 */}
        {(cs||[]).length>0&&<>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:4}}>콘텐츠 효율 (views/post)</div>
          {cs.slice(0,4).map((c:any)=>(
            <div key={c.category} style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
              <span style={{width:44,fontSize:10,color:'rgba(255,255,255,0.35)'}}>{c.category}</span>
              <div style={{flex:1}}><HBar value={c.efficiency||0} max={200} color={(c.efficiency||0)>50?'#10B981':(c.efficiency||0)>15?'#F59E0B':'#EF4444'}/></div>
              <span style={{width:24,fontSize:11,fontWeight:700,textAlign:'right' as const,color:(c.efficiency||0)>50?'#10B981':'rgba(255,255,255,0.35)'}}>{c.efficiency||0}</span>
            </div>
          ))}
        </>}
      </div>

      {/* ═══ 포털별 SEO 준비도 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        {/* Google */}
        <div style={{...CS.card,borderLeft:'3px solid #4285F4',background:'linear-gradient(135deg,rgba(66,133,244,0.04),rgba(12,21,40,0.65))'}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
            <svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 01-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/></svg>
            <span style={{fontSize:11,fontWeight:800,color:'#E2E8F0'}}>Google</span>
            <div style={{flex:1}}/>
            <Ring value={pct(x.googleReady||0,k.blogs||1)} size={30} stroke={3} color="#4285F4">
              <text x="15" y="15" textAnchor="middle" dominantBaseline="central" fill="#4285F4" fontSize="9" fontWeight="800">{pct(x.googleReady||0,k.blogs||1)}%</text>
            </Ring>
          </div>
          {[
            {l:'Sitemap',v:pct(x.indexedOk||0,k.blogs||1)},
            {l:'내부링크',v:pct(x.linksOk||0,k.blogs||1)},
            {l:'제목최적화',v:pct(x.titleGood||0,k.blogs||1)},
            {l:'메타설명',v:pct(x.metaGood||0,k.blogs||1)},
            {l:'이미지Alt',v:pct(x.imageAltOk||0,k.blogs||1)},
            {l:'JSON-LD',v:100},
            {l:'콘텐츠길이',v:pct(x.contentLongOk||0,k.blogs||1)},
            {l:'리라이트',v:rwPct},
          ].map(r=>(
            <div key={r.l} style={{display:'flex',alignItems:'center',gap:4,marginBottom:3}}>
              <span style={{width:10,height:10,borderRadius:'50%',background:r.v>=80?'rgba(16,185,129,0.15)':r.v>=30?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,flexShrink:0,color:r.v>=80?'#10B981':r.v>=30?'#F59E0B':'#EF4444'}}>{r.v>=80?'✓':r.v>=30?'△':'✗'}</span>
              <span style={{flex:1,fontSize:10,color:'rgba(255,255,255,0.4)'}}>{r.l}</span>
              <span style={{fontSize:11,fontWeight:700,color:r.v>=80?'#10B981':r.v>=30?'#F59E0B':'#EF4444'}}>{r.v}%</span>
            </div>
          ))}
          <div style={{fontSize:10,fontWeight:700,color:'#4285F4',textAlign:'center',marginTop:4}}>{f(x.googleReady||0)}/{f(k.blogs||0)}편</div>
        </div>
        {/* Naver */}
        <div style={{...CS.card,borderLeft:'3px solid #00C73C',background:'linear-gradient(135deg,rgba(0,199,60,0.04),rgba(12,21,40,0.65))'}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
            <div style={{width:14,height:14,borderRadius:3,background:'#00C73C',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,color:'#fff'}}>N</div>
            <span style={{fontSize:11,fontWeight:800,color:'#E2E8F0'}}>Naver</span>
            <div style={{flex:1}}/>
            <Ring value={pct(x.naverReady||0,k.blogs||1)} size={30} stroke={3} color="#00C73C">
              <text x="15" y="15" textAnchor="middle" dominantBaseline="central" fill="#00C73C" fontSize="9" fontWeight="800">{pct(x.naverReady||0,k.blogs||1)}%</text>
            </Ring>
          </div>
          {[
            {l:'OG이미지',v:100},
            {l:'요약문',v:pct(x.excerptOk||0,k.blogs||1)},
            {l:'제목최적화',v:pct(x.titleGood||0,k.blogs||1)},
            {l:'메타설명',v:pct(x.metaGood||0,k.blogs||1)},
            {l:'naver:desc',v:100},
            {l:'해시태그',v:pct(x.tagsOk||0,k.blogs||1)},
            {l:'키워드',v:pct(x.keywordsOk||0,k.blogs||1)},
            {l:'시리즈연결',v:pct(x.seriesOk||0,k.blogs||1)},
          ].map(r=>(
            <div key={r.l} style={{display:'flex',alignItems:'center',gap:4,marginBottom:3}}>
              <span style={{width:10,height:10,borderRadius:'50%',background:r.v>=80?'rgba(16,185,129,0.15)':r.v>=30?'rgba(245,158,11,0.15)':'rgba(239,68,68,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,flexShrink:0,color:r.v>=80?'#10B981':r.v>=30?'#F59E0B':'#EF4444'}}>{r.v>=80?'✓':r.v>=30?'△':'✗'}</span>
              <span style={{flex:1,fontSize:10,color:'rgba(255,255,255,0.4)'}}>{r.l}</span>
              <span style={{fontSize:11,fontWeight:700,color:r.v>=80?'#10B981':r.v>=30?'#F59E0B':'#EF4444'}}>{r.v}%</span>
            </div>
          ))}
          <div style={{fontSize:10,fontWeight:700,color:'#00C73C',textAlign:'center',marginTop:4}}>{f(x.naverReady||0)}/{f(k.blogs||0)}편</div>
        </div>
      </div>

      {/* ═══ SEO 등급 분포 + 콘텐츠 =══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
        {[
          {l:'A등급',v:f(x.tierA||0),c:'#10B981',sub:`${pct(x.tierA||0,k.blogs||1)}%`},
          {l:'B등급',v:f(x.tierB||0),c:'#F59E0B',sub:`${pct(x.tierB||0,k.blogs||1)}%`},
          {l:'C등급',v:f(x.tierC||0),c:'#EF4444',sub:`${pct(x.tierC||0,k.blogs||1)}%`},
        ].map(kk=>(
          <div key={kk.l} style={{textAlign:'center',background:'rgba(12,21,40,0.65)',border:'1px solid rgba(255,255,255,0.04)',borderRadius:8,padding:'6px 0'}}>
            <div style={{fontSize:14,fontWeight:800,color:kk.c,lineHeight:1}}>{kk.v}</div>
            <div style={{fontSize:8,color:'rgba(255,255,255,0.2)',marginTop:2}}>{kk.l} ({kk.sub})</div>
          </div>
        ))}
      </div>

      {/* ═══ 2열: 유저 + CTA ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        <div style={CS.card}>
          <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:6}}>👤 유저</div>
          {[{l:'온보딩',v:g.onboardRate??0,bar:true,c:(g.onboardRate??0)>70?'#10B981':'#F59E0B'},{l:'프로필',v:g.profileRate??0,bar:true,c:(g.profileRate??0)>20?'#10B981':'#EF4444'},{l:'게시글',v:f(x.totalPosts||0),c:'rgba(255,255,255,0.5)'},{l:'댓글',v:f(x.totalComments||0),c:'rgba(255,255,255,0.5)'},{l:'연령대',v:`${pct(x.ageCount||0,k.users||1)}%`,c:'rgba(255,255,255,0.5)'},{l:'자기소개',v:`${pct(x.bioCount||0,k.users||1)}%`,c:'rgba(255,255,255,0.5)'}].map(r=>(
            <div key={r.l} style={{marginBottom:4}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}>
                <span style={{color:'rgba(255,255,255,0.35)'}}>{r.l}</span>
                <span style={{fontWeight:700,color:r.c}}>{r.bar?r.v+'%':r.v}</span>
              </div>
              {r.bar&&<HBar value={r.v} color={r.c}/>}
            </div>
          ))}
        </div>
        <div style={CS.card}>
          <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:6}}>📊 CTA 퍼널</div>
          <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:6}}>
            {[{v:g.ctaViews7d||0,l:'노출',c:'#3B7BF6',w:100},{v:g.ctaClicks7d||0,l:'클릭',c:'#F59E0B',w:Math.max((g.ctaClicks7d||0)/Math.max(g.ctaViews7d||1,1)*100,10)},{v:k.newUsers||0,l:'가입',c:'#10B981',w:Math.max((k.newUsers||0)/Math.max(g.ctaViews7d||1,1)*100,15)}].map(xx=>(
              <div key={xx.l} style={{display:'flex',alignItems:'center',gap:4}}>
                <span style={{fontSize:9,color:'rgba(255,255,255,0.25)',width:22}}>{xx.l}</span>
                <div style={{flex:1,height:12,background:'rgba(255,255,255,0.04)',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${xx.w}%`,background:`linear-gradient(90deg,${xx.c},${xx.c}88)`,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:4}}>
                    <span style={{fontSize:9,fontWeight:700,color:'#fff'}}>{xx.v}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{textAlign:'center',fontSize:13,fontWeight:800,color:parseFloat(ctr)>2?'#10B981':'#EF4444'}}>CTR {ctr}%</div>
        </div>
      </div>

      {/* ═══ 가입 경로 분석 ═══ */}
      {x.signupBySource && Object.keys(x.signupBySource).length > 0 && (
        <div style={{...CS.card}}>
          <SH icon="🔍" title="가입 경로 (7일)" />
          {Object.entries(x.signupBySource as Record<string, {attempts:number;success:number}>)
            .sort((a: any, b: any) => b[1].attempts - a[1].attempts)
            .map(([src, v]: any) => (
            <div key={src} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
              <span style={{fontSize:11,color:'rgba(255,255,255,0.6)',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>
                {src === 'apt_alert_cta' ? '🔔 청약알림CTA' : src === 'content_gate' ? '🔒 게이트' : src === 'direct' ? '🔗 직접' : src === 'nav' ? '🧭 네비' : src === 'stock_alert_cta' ? '📊 종목알림CTA' : `📌 ${src}`}
              </span>
              <span style={{fontSize:13,fontWeight:700,color:'#FBBF24'}}>{v.attempts}</span>
              <span style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>시도</span>
              <span style={{fontSize:13,fontWeight:700,color:'#10B981'}}>{v.success}</span>
              <span style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>성공</span>
              <span style={{fontSize:11,fontWeight:600,color:v.attempts > 0 && v.success/v.attempts > 0.5 ? '#10B981' : '#EF4444'}}>{v.attempts > 0 ? ((v.success/v.attempts)*100).toFixed(0) : 0}%</span>
            </div>
          ))}
        </div>
      )}

      {/* ═══ CTA별 성과 + 가입귀속 + 리텐션 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        {/* CTA별 성과 */}
        <div style={CS.card}>
          <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:6}}>🎯 CTA별 성과 (7일)</div>
          {Object.entries(cb||{}).sort((a:any,b:any)=>(b[1].views||0)-(a[1].views||0)).slice(0,6).map(([name,stat]:any)=>{
            const v=stat.views||0;const c=stat.clicks||0;const r=v>0?((c/v)*100).toFixed(1):'0';
            return <div key={name} style={{marginBottom:4}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'rgba(255,255,255,0.4)'}}>
                <span>{name.replace(/_/g,' ')}</span>
                <span>{v}뷰 {c}클릭 <span style={{color:parseFloat(r)>1?'#10B981':'#EF4444'}}>{r}%</span></span>
              </div>
              <div style={{height:4,background:'rgba(255,255,255,0.04)',borderRadius:2,overflow:'hidden',marginTop:2}}>
                <div style={{height:'100%',width:`${Math.min((v/(Object.values(cb||{}).reduce((s:number,x:any)=>s+(x.views||0),0)||1))*100,100)}%`,background:'#3B7BF6',borderRadius:2,minWidth:v>0?2:0}}/>
              </div>
            </div>;
          })}
        </div>
        {/* 가입 귀속 + 리텐션 */}
        <div style={CS.card}>
          <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:6}}>🔗 가입 귀속</div>
          {Object.keys(ss||{}).length>0?Object.entries(ss).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5).map(([src,cnt]:any)=>(
            <div key={src} style={{display:'flex',justifyContent:'space-between',fontSize:10,padding:'2px 0',color:'rgba(255,255,255,0.6)'}}>
              <span>{src.replace(/_/g,' ')}</span>
              <span style={{fontWeight:700,color:'#10B981'}}>{cnt}명</span>
            </div>
          )):<div style={{fontSize:10,color:'rgba(255,255,255,0.2)'}}>아직 귀속 데이터 없음</div>}
          {ret&&<div style={{marginTop:8,paddingTop:6,borderTop:'1px solid rgba(255,255,255,0.06)'}}>
            <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:4}}>📈 D7 리텐션</div>
            <div style={{display:'flex',alignItems:'baseline',gap:4}}>
              <span style={{fontSize:18,fontWeight:800,color:ret.d7Rate>10?'#10B981':'#EF4444'}}>{ret.d7Rate}%</span>
              <span style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>{ret.size}명 중 {ret.d7}명 복귀</span>
            </div>
          </div>}
        </div>
      </div>

      {/* ═══ 기능 건강도 ═══ */}
      <div style={CS.card}>
        <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:8}}>🔌 핵심 기능 사용 현황</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
          {[
            {name:'푸시구독',val:k.pushSubs??0,icon:'🔔'},
            {name:'이메일구독',val:k.emailSubs??0,icon:'📧'},
            {name:'관심단지',val:fh.aptBookmarks??0,icon:'🏠'},
            {name:'블로그저장',val:fh.blogBookmarks??0,icon:'📌'},
            {name:'관심종목',val:fh.stockWatchlist??0,icon:'⭐'},
            {name:'가격알림',val:fh.priceAlerts??0,icon:'🔔'},
            {name:'출석체크',val:fh.attendance??0,icon:'📅'},
            {name:'미션완료',val:fh.missionCompleted??0,icon:'🎯'},
          ].map(f=>(
            <div key={f.name} style={{padding:'6px 8px',borderRadius:6,background:f.val>0?'rgba(16,185,129,0.08)':'rgba(239,68,68,0.08)',border:`1px solid ${f.val>0?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.1)'}`}}>
              <div style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>{f.icon} {f.name}</div>
              <div style={{fontSize:16,fontWeight:800,color:f.val>0?'#10B981':'#EF4444'}}>{f.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 행동 분석 (user_events) ═══ */}
      {bv && (bv.eventsToday > 0 || bv.avgScroll > 0) && <div style={CS.card}>
        <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:8}}>📊 행동 분석 (오늘)</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:6}}>
          {[
            {l:'이벤트',v:bv.eventsToday||0,c:'#3B7BF6',i:'⚡'},
            {l:'평균 스크롤',v:bv.avgScroll>0?`${bv.avgScroll}%`:'—',c:bv.avgScroll>=50?'#10B981':bv.avgScroll>=25?'#F59E0B':'#EF4444',i:'📜'},
            {l:'평균 체류',v:bv.avgDwellSec>0?bv.avgDwellSec>=60?`${Math.floor(bv.avgDwellSec/60)}분${bv.avgDwellSec%60}초`:`${bv.avgDwellSec}초`:'—',c:bv.avgDwellSec>=30?'#10B981':bv.avgDwellSec>=10?'#F59E0B':'#EF4444',i:'⏱️'},
          ].map(kk=>(
            <div key={kk.l} style={{textAlign:'center',padding:'8px 0',background:'rgba(255,255,255,0.02)',borderRadius:8}}>
              <div style={{fontSize:14,marginBottom:2}}>{kk.i}</div>
              <div style={{fontSize:16,fontWeight:800,color:kk.c,lineHeight:1}}>{kk.v}</div>
              <div style={{fontSize:8,color:'rgba(255,255,255,0.25)',marginTop:3}}>{kk.l}</div>
            </div>
          ))}
        </div>
        {(bv.scrollSamples>0||bv.dwellSamples>0)&&<div style={{fontSize:9,color:'rgba(255,255,255,0.15)',marginTop:6,textAlign:'center'}}>스크롤 {bv.scrollSamples}샘플 · 체류 {bv.dwellSamples}샘플</div>}
      </div>}

      {/* ═══ 공유 현황 ═══ */}
      {<div style={CS.card}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <span style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)'}}>📤 공유 (7일)</span>
          <span style={{fontSize:13,fontWeight:700,color:'#06B6D4'}}>{shareTotal}건</span>
        </div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          {Object.entries(sharePlatforms).sort((a:any,b:any)=>b[1]-a[1]).slice(0,6).map(([p,cnt]:any)=>{
            const clr:any={'kakao':'#FEE500','naver-blog':'#03C75A','naver-cafe':'#1EC800','band':'#06C755','twitter':'#1DA1F2','facebook':'#1877F2','copy':'#888','daum-cafe':'#FF5722'};
            return <span key={p} style={{fontSize:10,padding:'3px 8px',borderRadius:12,background:clr[p]||'rgba(255,255,255,0.06)',color:clr[p]==='#FEE500'?'#191919':'#fff',fontWeight:600}}>{p.replace('-',' ')} {cnt}</span>;
          })}
        </div>
      </div>}

      {/* ═══ 리텐션 + 시스템 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        <div style={CS.card}>
          <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:6}}>🔔 리텐션</div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <Ring value={nr} size={44} stroke={4} color={nr>10?'#10B981':'#EF4444'}>
              <text x="22" y="20" textAnchor="middle" dominantBaseline="central" fill={nr>10?'#10B981':'#EF4444'} fontSize="12" fontWeight="800">{nr}%</text>
            </Ring>
            <div>
              <div style={{fontSize:9,color:'rgba(255,255,255,0.25)',marginBottom:3}}>알림 열람률</div>
              {[{l:'발송',v:f(g.notifTotal7d||0)},{l:'열람',v:f(g.notifRead7d||0),c:'#10B981'}].map(r=>(
                <div key={r.l} style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:10,padding:'1px 0'}}>
                  <span style={{color:'rgba(255,255,255,0.3)'}}>{r.l}</span>
                  <span style={{fontWeight:600,color:r.c||'rgba(255,255,255,0.45)'}}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={CS.card}>
          <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:6}}>🔧 시스템</div>
          <div style={{marginBottom:6}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:3}}>
              <span style={{color:'rgba(255,255,255,0.35)'}}>DB</span>
              <span style={{color:dbPct<50?'#10B981':'#F59E0B',fontWeight:600}}>{((k.dbMb||0)/1024).toFixed(1)}G / 8.4G</span>
            </div>
            <HBar value={dbPct} color={dbPct<50?'#10B981':'#F59E0B'} h={6}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,padding:'2px 0'}}>
            <span style={{color:'rgba(255,255,255,0.35)'}}>크론/일</span>
            <span style={{fontWeight:700,color:'rgba(255,255,255,0.5)'}}>{k.cronSuccess+k.cronFail} <span style={{fontSize:8,color:'rgba(255,255,255,0.2)'}}>/ 90개</span></span>
          </div>
          {fcn>0&&<div style={{marginTop:4}}>
            {Object.entries(fc||{}).slice(0,3).map(([name,info]:any)=>(
              <div key={name} style={{padding:'3px 6px',background:'rgba(239,68,68,0.06)',borderRadius:4,fontSize:9,color:'#EF4444',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>❌ {name.replace('cron-','').slice(0,18)}</div>
            ))}
          </div>}
        </div>
      </div>

      {/* ═══ 전환 현황 ═══ */}
      {Object.keys(cb||{}).length>0&&<div style={CS.card}>
        <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:8}}>🎯 전환 현황 (7일)</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:8}}>
          {[
            {l:'CTA 노출',v:Object.values(cb||{}).reduce((s:number,x:any)=>s+(x.views||0),0),c:'#3B7BF6'},
            {l:'CTA 클릭',v:Object.values(cb||{}).reduce((s:number,x:any)=>s+(x.clicks||0),0),c:'#F59E0B'},
            {l:'신규 가입',v:k.newUsers||0,c:'#10B981'},
          ].map(kk=>(
            <div key={kk.l} style={{textAlign:'center',background:'rgba(255,255,255,0.02)',borderRadius:8,padding:'6px 0'}}>
              <div style={{fontSize:16,fontWeight:800,color:kk.c,lineHeight:1}}>{kk.v}</div>
              <div style={{fontSize:8,color:'rgba(255,255,255,0.25)',marginTop:3}}>{kk.l}</div>
            </div>
          ))}
        </div>
        {Object.entries(cb||{}).sort((a:any,b:any)=>(b[1].views||0)-(a[1].views||0)).slice(0,5).map(([name,stat]:any)=>{
          const v=stat.views||0;const c=stat.clicks||0;const r=v>0?((c/v)*100).toFixed(1):'0';
          return <div key={name} style={{display:'flex',justifyContent:'space-between',fontSize:10,padding:'3px 0',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
            <span style={{color:'rgba(255,255,255,0.4)'}}>{name.replace(/_/g,' ')}</span>
            <span style={{fontWeight:600,color:parseFloat(r)>1?'#10B981':'rgba(255,255,255,0.3)'}}>{v}뷰 {c}클릭 <span style={{color:parseFloat(r)>1?'#10B981':'#EF4444'}}>{r}%</span></span>
          </div>;
        })}
      </div>}

      {/* ═══ 최근 활동 ═══ */}
      <div style={CS.card}>
        <div style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:6}}>🕐 최근 활동</div>
        {(ra||[]).slice(0,6).map((a:any,i:number)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0',borderBottom:i<Math.min(ra.length,6)-1?'1px solid rgba(255,255,255,0.03)':'none'}}>
            <span style={{width:32,fontSize:10,color:'rgba(255,255,255,0.25)',flexShrink:0}}>{ago(a.at)}</span>
            <Dot ok={a.type==='cron'?a.status==='success':true} size={6}/>
            <span style={{fontSize:11,color:'rgba(255,255,255,0.5)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{a.name}</span>
          </div>
        ))}
      </div>

      {/* ═══ 5버튼 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:4}}>
        {([['📈','성장','growth'],['👤','유저','users'],['🔧','크론','ops'],['🗄️','데이터','data'],['⚡','실행','execute']] as const).map(([i,l,t])=>(
          <button key={t} onClick={()=>onNavigate(t)} style={{padding:'8px 0',background:'rgba(12,21,40,0.5)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:8,cursor:'pointer',textAlign:'center',fontSize:10,color:'rgba(255,255,255,0.3)'}}>
            <div style={{fontSize:15,opacity:0.5,marginBottom:2}}>{i}</div>{l}
          </button>
        ))}
      </div>
    </div>
  );
}
