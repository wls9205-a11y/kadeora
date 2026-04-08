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
      <span style={{fontSize:12,fontWeight:800,color:'#E2E8F0'}}>{title}</span>
    </div>
    {right}
  </div>
);

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

  const{healthScore:hs=0,kpi:k={} as any,growth:g={} as any,extended:x={} as any,failedCrons:fc={},recentActivity:ra=[],dailyTrend:dt=[],categoryStats:cs=[],trafficDetail:td={} as any}=d;
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

  const CS={card:{background:'rgba(12,21,40,0.65)',border:'1px solid rgba(255,255,255,0.05)',borderRadius:12,padding:'10px 12px',backdropFilter:'blur(8px)'} as const};

  const hourly=td?.hourlyPv||[];
  const hmx=hourly.length>0?Math.max(...hourly.map((h:any)=>h.count||0),1):1;
  const topPages=td?.topPages||[];
  const refSources=td?.referrerBreakdown||[];
  const refTotal=refSources.reduce((a:number,r:any)=>a+(r.count||0),0)||1;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:6}}>

      {/* ═══ 위험 신호 ═══ */}
      {warns.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {warns.map((w,i)=><span key={i} style={{fontSize:11,fontWeight:600,color:'#EF4444',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.15)',padding:'4px 10px',borderRadius:20}}>⚠ {w}</span>)}
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
              <div style={{fontSize:22,fontWeight:900,color:kk.c,lineHeight:1}}>{kk.v}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',marginTop:4}}>{kk.l}</div>
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
            <span style={{fontSize:8,color:'rgba(255,255,255,0.15)'}}>0시</span>
            <span style={{fontSize:8,color:'rgba(255,255,255,0.15)'}}>12시</span>
            <span style={{fontSize:8,color:'rgba(255,255,255,0.15)'}}>23시</span>
          </div>
        </>}
        {/* 최근 접속자 실시간 피드 */}
        {(td?.recentVisitors||[]).length>0&&<>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.25)',marginTop:8,marginBottom:4}}>최근 접속 (실시간)</div>
          {td.recentVisitors.slice(0,8).map((v:any,i:number)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 0',fontSize:10,borderBottom:i<7?'1px solid rgba(255,255,255,0.03)':'none'}}>
              <span style={{fontSize:12,flexShrink:0}}>{v.device}</span>
              <span style={{flex:1,color:'rgba(255,255,255,0.4)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,minWidth:0}}>{(() => { try { return decodeURIComponent(v.path||'').replace(/\(main\)\//g,'') } catch { return v.path } })().slice(0,25)}</span>
              <span style={{fontSize:9,padding:'1px 6px',borderRadius:8,background:v.ref==='Google'?'rgba(66,133,244,0.15)':v.ref==='Naver'?'rgba(0,199,60,0.15)':v.ref==='Kakao'?'rgba(254,229,0,0.15)':'rgba(255,255,255,0.04)',color:v.ref==='Google'?'#4285F4':v.ref==='Naver'?'#00C73C':v.ref==='Kakao'?'#FEE500':'rgba(255,255,255,0.3)',flexShrink:0}}>{v.ref}</span>
              <span style={{fontSize:9,color:'rgba(255,255,255,0.15)',flexShrink:0,width:24,textAlign:'right' as const}}>{ago(v.at)}</span>
            </div>
          ))}
        </>}
      </div>

      {/* ═══ 인기 페이지 + 유입 경로 ═══ */}
      {(topPages.length>0||refSources.length>0)&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,overflow:'hidden'}}>
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
          {refSources.slice(0,5).map((r:any)=>{const w=pct(r.count||0,refTotal);const clr:any={direct:'#3B7BF6',google:'#10B981',naver:'#00C73C',daum:'#F59E0B',kakao:'#FEE500'}; return <div key={r.source} style={{marginBottom:4}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}>
              <span style={{color:'rgba(255,255,255,0.45)'}}>{r.source}</span>
              <span style={{fontWeight:600,color:'rgba(255,255,255,0.55)'}}>{r.count} <span style={{fontSize:9,color:'rgba(255,255,255,0.2)'}}>({w}%)</span></span>
            </div>
            <HBar value={w} color={clr[r.source?.toLowerCase()]||'rgba(255,255,255,0.2)'} h={4}/>
          </div>;})}
        </div>
      </div>}

      {/* ═══ KPI — 2×2 그리드 (모바일 최적화) ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        {[
          {l:'유저',v:k.users,c:'#3B7BF6',sub:`+${k.newUsers}/7d`,ring:pct(g.onboardRate||0,100)},
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
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
        {[
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
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4}}>
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
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:6}}>
              {[{l:'완료',v:f(k.rewritten||0),c:'#10B981'},{l:'잔여',v:f((k.blogs||0)-(k.rewritten||0)),c:'#F59E0B'},{l:'오늘',v:x.newBlogs24||0,c:'#06B6D4'}].map(kk=>(
                <div key={kk.l} style={{textAlign:'center'}}>
                  <div style={{fontSize:15,fontWeight:800,color:kk.c,lineHeight:1}}>{kk.v}</div>
                  <div style={{fontSize:9,color:'rgba(255,255,255,0.3)',marginTop:2}}>{kk.l}</div>
                </div>
              ))}
            </div>
            {/* 리라이팅 세부 */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4,marginTop:6}}>
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
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4}}>
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
            <span style={{fontWeight:700,color:'rgba(255,255,255,0.5)'}}>{k.cronSuccess+k.cronFail}</span>
          </div>
          {fcn>0&&<div style={{marginTop:4}}>
            {Object.entries(fc||{}).slice(0,3).map(([name,info]:any)=>(
              <div key={name} style={{padding:'3px 6px',background:'rgba(239,68,68,0.06)',borderRadius:4,fontSize:9,color:'#EF4444',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>❌ {name.replace('cron-','').slice(0,18)}</div>
            ))}
          </div>}
        </div>
      </div>

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
