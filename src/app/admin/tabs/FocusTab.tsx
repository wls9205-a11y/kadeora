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
  const dash=d.dashboard||{};
  const rSignups=dash.recentSignups||[];
  const pIssues=dash.pendingIssues||[];
  const rPosts=dash.recentPosts||[];
  const rComments=dash.recentComments||[];

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

      {/* ═══ 3.5 미니위젯: 가입·이슈·커뮤니티 ═══ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,margin:'6px 0'}}>
        {/* 최근 가입자 */}
        <Card ch={<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.5)'}}>👤 최근 가입</span>
            <button onClick={()=>onNavigate('users')} style={{fontSize:10,color:'#3B7BF6',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>더보기→</button>
          </div>
          {rSignups.length===0?<div style={{fontSize:11,color:'rgba(255,255,255,0.25)',textAlign:'center',padding:8}}>없음</div>:
          rSignups.slice(0,5).map((u:any,i:number)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 0',borderBottom:i<4?'1px solid rgba(255,255,255,0.03)':'none'}}>
              <span style={{fontSize:10,width:14,textAlign:'center'}}>{u.provider==='kakao'?'💛':'🔵'}</span>
              <span style={{flex:1,fontSize:12,color:'#E2E8F0',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.nickname}</span>
              {!u.onboarded&&<span style={{fontSize:9,color:'#F59E0B',background:'rgba(245,158,11,0.1)',padding:'1px 5px',borderRadius:3}}>미온보딩</span>}
              <span style={{fontSize:10,color:'rgba(255,255,255,0.25)',flexShrink:0}}>{ago(u.at)}</span>
            </div>
          ))}
        </>} p="6px 8px"/>

        {/* 대기 이슈 */}
        <Card ch={<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.5)'}}>🔍 대기 이슈 <span style={{color:pIssues.length>0?'#F59E0B':'#64748b',fontWeight:800}}>{k.issuePending||pIssues.length}</span></span>
            <button onClick={()=>onNavigate('issue')} style={{fontSize:10,color:'#3B7BF6',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>더보기→</button>
          </div>
          {pIssues.length===0?<div style={{fontSize:11,color:'rgba(255,255,255,0.25)',textAlign:'center',padding:8}}>처리 대기 없음 ✅</div>:
          pIssues.slice(0,4).map((iss:any,i:number)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 0',borderBottom:i<3?'1px solid rgba(255,255,255,0.03)':'none'}}>
              <span style={{fontSize:10,fontWeight:800,color:iss.score>=50?'#EF4444':iss.score>=40?'#F59E0B':'#64748b',background:iss.score>=40?'rgba(245,158,11,0.1)':'rgba(100,116,139,0.1)',padding:'1px 5px',borderRadius:3,flexShrink:0}}>{iss.score}</span>
              <span style={{flex:1,fontSize:11,color:'rgba(255,255,255,0.6)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{iss.title}</span>
              <span style={{fontSize:10,color:'rgba(255,255,255,0.2)',flexShrink:0}}>{ago(iss.at)}</span>
            </div>
          ))}
        </>} p="6px 8px"/>
      </div>

      {/* 커뮤니티 + 가입경로 */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:6}}>
        {/* 커뮤니티 */}
        <Card ch={<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.5)'}}>💬 커뮤니티</span>
            <button onClick={()=>onNavigate('community')} style={{fontSize:10,color:'#3B7BF6',background:'none',border:'none',cursor:'pointer',fontWeight:600}}>더보기→</button>
          </div>
          <div style={{display:'flex',gap:8,marginBottom:6}}>
            <div style={{textAlign:'center',flex:1}}><div style={{fontSize:14,fontWeight:800,color:'#8B5CF6'}}>{g.postsToday||0}</div><div style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>글 오늘</div></div>
            <div style={{textAlign:'center',flex:1}}><div style={{fontSize:14,fontWeight:800,color:'#06B6D4'}}>{g.commentsToday||0}</div><div style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>댓글</div></div>
            <div style={{textAlign:'center',flex:1}}><div style={{fontSize:14,fontWeight:800,color:'#A855F7'}}>{f(x.totalPosts||0)}</div><div style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>총 글</div></div>
          </div>
          {rPosts.slice(0,3).map((p:any,i:number)=>(
            <div key={i} style={{fontSize:11,color:'rgba(255,255,255,0.5)',padding:'2px 0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {({'realestate':'🏠','stock':'📊','free':'💬','news':'📰'}[p.category as string])||'📝'} {p.title||'(제목없음)'} <span style={{color:'rgba(255,255,255,0.2)'}}>·{ago(p.at)}</span>
            </div>
          ))}
        </>} p="6px 8px"/>

        {/* 가입경로 분석 */}
        <Card ch={<>
          <div style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:6}}>📡 가입경로</div>
          {Object.entries(ss||{}).sort((a:any,b:any)=>b[1]-a[1]).slice(0,6).map(([src,cnt]:[string,any],i:number)=>{
            const srcLabel:Record<string,string>={'kakao':'카카오','google':'구글','apt_alert_cta':'청약알림CTA','action_bar':'액션바','content_gate':'콘텐츠게이트','content_lock':'콘텐츠락','blog_cta':'블로그CTA','blog_inline_cta':'블로그인라인','nav':'네비','direct':'직접','sidebar':'사이드바','blog_comment':'블로그댓글','stock_comment':'종목댓글','kakao_hero':'홈CTA','calc_cta':'계산기CTA'};
            return<div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'2px 0',color:'rgba(255,255,255,0.5)'}}>
              <span>{srcLabel[src]||src}</span>
              <span style={{fontWeight:700,color:'#E2E8F0'}}>{cnt}</span>
            </div>;
          })}
          {Object.keys(ss||{}).length===0&&<div style={{fontSize:11,color:'rgba(255,255,255,0.25)',textAlign:'center',padding:8}}>수집중</div>}
        </>} p="6px 8px"/>
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

      {/* ═══ 6.2 피드 커뮤니티 ═══ */}
      <Sec t="💬 피드 커뮤니티" open={false} ch={
        <Card ch={<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
          {[
            {l:'투표',v:k.postsToday||0,c:'#3B82F6',icon:'📊'},
            {l:'댓글',v:k.commentsToday||0,c:'#10B981',icon:'💬'},
            {l:'글',v:x.totalPosts||0,c:'#8B5CF6',icon:'📝'},
            {l:'댓글합',v:x.totalComments||0,c:'#06B6D4',icon:'💭'},
          ].map(s=><div key={s.l} style={{textAlign:'center',padding:4}}>
            <div style={{fontSize:10}}>{s.icon}</div>
            <div style={{fontSize:12,fontWeight:800,color:s.c}}>{f(s.v)}</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>{s.l}</div>
          </div>)}
        </div>} p="6px 8px"/>
      }/>

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

      {/* ═══ 이메일 현황 + 발송 ═══ */}
      <Sec t={`📧 이메일 시스템`} open={true} ch={<EmailDashboard/>}/>
    </div>
  );
}

function EmailDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'stats'|'logs'>('stats');

  const load = () => {
    setLoading(true);
    fetch('/api/admin/send-email').then(r=>r.json()).then(d=>{setData(d);setLoading(false);}).catch(()=>setLoading(false));
  };
  useEffect(()=>{load();},[]);

  const sub = data?.subscribers;
  const overall = data?.overall || {};
  const remaining = data?.remaining ?? 0;
  const sentToday = data?.sentToday ?? 0;
  const quotaColor = remaining < 20 ? '#EF4444' : remaining < 50 ? '#F59E0B' : '#10B981';

  const CAMPAIGN_LABELS: Record<string,string> = {
    're-engagement_all':'전체발송','re-engagement_dormant':'휴면발송',
    're-engagement_test':'테스트','weekly-digest':'주간다이제스트','churn-d7':'이탈방지D+7',
  };
  const campaignOrder = ['re-engagement_all','re-engagement_dormant','weekly-digest','churn-d7','re-engagement_test'];
  const summary = data?.summary || {};
  const sortedCampaigns = campaignOrder.filter(k=>summary[k]).concat(Object.keys(summary).filter(k=>!campaignOrder.includes(k)));
  const logs: any[] = data?.logs || [];

  const s = (n:number)=>n.toLocaleString();
  const pct = (n:number)=>`${n}%`;

  const StatBox = ({label,val,sub2,col,small}:{label:string;val:string|number;sub2?:string;col?:string;small?:boolean})=>(
    <div style={{flex:'1 1 0',minWidth:0,background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:'var(--radius-sm)',padding:'8px 10px'}}>
      <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',marginBottom:2,letterSpacing:'0.04em'}}>{label}</div>
      <div style={{fontSize:small?14:18,fontWeight:800,color:col||'#E2E8F0',lineHeight:1.1}}>{typeof val==='number'?s(val):val}</div>
      {sub2&&<div style={{fontSize:9,color:'rgba(255,255,255,0.3)',marginTop:2}}>{sub2}</div>}
    </div>
  );

  const tabBtn = (t:'stats'|'logs',label:string)=>(
    <button onClick={()=>setTab(t)} style={{
      padding:'4px 10px',borderRadius:'var(--radius-sm)',border:'none',cursor:'pointer',fontSize:11,fontWeight:600,
      background:tab===t?'rgba(59,123,246,0.15)':'transparent',
      color:tab===t?'#3B7BF6':'rgba(255,255,255,0.3)',
    }}>{label}</button>
  );

  return (
    <div style={{background:'rgba(12,21,40,0.6)',border:'1px solid rgba(255,255,255,0.04)',borderRadius:'var(--radius-md)',padding:'12px'}}>
      {loading ? <div style={{fontSize:12,color:'rgba(255,255,255,0.3)',textAlign:'center',padding:'20px 0'}}>로딩 중...</div> : <>

        {/* ── 핵심 KPI 6개 ── */}
        <div style={{display:'flex',gap:4,marginBottom:10,flexWrap:'wrap'}}>
          <StatBox label="활성 구독자" val={sub?.active??0} sub2={`이번주 +${sub?.newThisWeek??0}`} col="#3B7BF6"/>
          <StatBox label="수신거부" val={sub?.unsubscribed??0} sub2="누적" col="#F59E0B"/>
          <StatBox label="총 발송 (30일)" val={overall.totalSent??0} col="#94A3B8"/>
          <StatBox label="오픈율" val={pct(overall.openRate??0)} sub2={`${overall.totalOpened??0}명 열람`} col={overall.openRate>=30?'#10B981':overall.openRate>=15?'#F59E0B':'#EF4444'} small/>
          <StatBox label="클릭율" val={pct(overall.clickRate??0)} sub2={`${overall.totalClicked??0}명 클릭`} col={overall.clickRate>=5?'#10B981':overall.clickRate>=2?'#F59E0B':'#EF4444'} small/>
          <StatBox label="오늘 잔여" val={remaining} sub2={`${sentToday}/100 사용`} col={quotaColor}/>
        </div>

        {/* ── 탭 전환 ── */}
        <div style={{display:'flex',gap:2,borderBottom:'1px solid rgba(255,255,255,0.06)',marginBottom:10,paddingBottom:6}}>
          {tabBtn('stats','📊 캠페인 통계')}
          {tabBtn('logs','📋 발송 이력')}
        </div>

        {tab==='stats' && <>
          {/* ── Resend 한도 바 ── */}
          <div style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
              <span style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>오늘 한도</span>
              <span style={{fontSize:11,fontWeight:700,color:quotaColor}}>{sentToday}/100통</span>
            </div>
            <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${Math.min((sentToday/100)*100,100)}%`,background:quotaColor,borderRadius:2,transition:'width .3s'}}/>
            </div>
          </div>

          {/* ── 캠페인별 통계 (발송/오픈율/클릭율) ── */}
          {sortedCampaigns.length > 0 && <div style={{marginBottom:10}}>
            <div style={{display:'grid',gridTemplateColumns:'100px 1fr 52px 52px 52px',gap:4,padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
              {['캠페인','발송률','발송','오픈율','클릭율'].map(h=>(
                <div key={h} style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontWeight:700,letterSpacing:'0.04em'}}>{h}</div>
              ))}
            </div>
            {sortedCampaigns.map(k=>{
              const st = summary[k];
              const total = (st.sent||0) + (st.failed||0);
              const successRate = total>0 ? Math.round((st.sent/total)*100) : 0;
              const openRate = st.open_rate ?? 0;
              const clickRate = st.click_rate ?? 0;
              return (
                <div key={k} style={{display:'grid',gridTemplateColumns:'100px 1fr 52px 52px 52px',gap:4,padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,0.04)',alignItems:'center'}}>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.65)',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{CAMPAIGN_LABELS[k]||k}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:2}}>
                    <div style={{height:3,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${successRate}%`,background:'#3B7BF6',borderRadius:2}}/>
                    </div>
                    <div style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>
                      {s(st.sent??0)}발송 {st.failed>0?`/ ✗${st.failed}`:''}</div>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:'#E2E8F0',textAlign:'right'}}>{successRate}%</div>
                  <div style={{fontSize:12,fontWeight:700,textAlign:'right',color:openRate>=30?'#10B981':openRate>=15?'#F59E0B':'rgba(255,255,255,0.4)'}}>
                    {openRate>0?`${openRate}%`:'—'}
                  </div>
                  <div style={{fontSize:12,fontWeight:700,textAlign:'right',color:clickRate>=5?'#10B981':clickRate>=2?'#F59E0B':'rgba(255,255,255,0.4)'}}>
                    {clickRate>0?`${clickRate}%`:'—'}
                  </div>
                </div>
              );
            })}
          </div>}
        </>}

        {tab==='logs' && <>
          {/* ── 발송 이력 상세 (오픈/클릭 포함) ── */}
          <div style={{marginBottom:10,maxHeight:320,overflow:'auto'}}>
            <div style={{display:'grid',gridTemplateColumns:'14px 1fr 70px 28px 28px 60px',gap:4,padding:'3px 0',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
              {['','수신자','캠페인','열','클','발송일'].map(h=>(
                <div key={h} style={{fontSize:9,color:'rgba(255,255,255,0.3)',fontWeight:700}}>{h}</div>
              ))}
            </div>
            {logs.map((log,i)=>{
              const d = new Date(log.created_at);
              const ts = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
              const statusColor = log.status==='sent'||log.status==='delivered' ? '#10B981'
                : log.status==='bounced'||log.status==='complained' ? '#EF4444' : '#F59E0B';
              const statusIcon = log.status==='sent'||log.status==='delivered' ? '✓'
                : log.status==='bounced' ? '↩' : log.status==='complained' ? '⚠' : '✗';
              const opened = log.opened_at || log.open_count > 0;
              const clicked = log.clicked_at || log.click_count > 0;
              return (
                <div key={i} title={`제목: ${log.subject||'-'}
클릭URL: ${log.clicked_url||'-'}
오픈: ${log.open_count||0}회
클릭: ${log.click_count||0}회`}
                  style={{display:'grid',gridTemplateColumns:'14px 1fr 70px 28px 28px 60px',gap:4,padding:'3px 0',borderBottom:'1px solid rgba(255,255,255,0.03)',fontSize:11,alignItems:'center',cursor:'default'}}>
                  <span style={{color:statusColor,fontSize:10}}>{statusIcon}</span>
                  <span style={{color:'rgba(255,255,255,0.5)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.recipient_email}</span>
                  <span style={{color:'rgba(255,255,255,0.3)',fontSize:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{CAMPAIGN_LABELS[log.campaign]||log.campaign}</span>
                  <div style={{textAlign:'center'}}>
                    <span style={{
                      fontSize:10,padding:'1px 4px',borderRadius:3,
                      background:opened?'rgba(16,185,129,0.12)':'rgba(255,255,255,0.04)',
                      color:opened?'#10B981':'rgba(255,255,255,0.2)',
                    }}>{opened?`👁${log.open_count>1?log.open_count:''}` :'—'}</span>
                  </div>
                  <div style={{textAlign:'center'}}>
                    <span style={{
                      fontSize:10,padding:'1px 4px',borderRadius:3,
                      background:clicked?'rgba(59,123,246,0.12)':'rgba(255,255,255,0.04)',
                      color:clicked?'#3B7BF6':'rgba(255,255,255,0.2)',
                    }}>{clicked?`🔗${log.click_count>1?log.click_count:''}` :'—'}</span>
                  </div>
                  <span style={{color:'rgba(255,255,255,0.25)',textAlign:'right',fontSize:10}}>{ts}</span>
                </div>
              );
            })}
            {logs.length===0 && <div style={{fontSize:12,color:'rgba(255,255,255,0.2)',textAlign:'center',padding:'12px 0'}}>발송 이력 없음</div>}
          </div>
        </>}

        {/* ── 발송 UI ── */}
        <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:10,marginTop:2}}>
          <EmailSender onSent={load} remaining={remaining} sentToday={sentToday}/>
        </div>
      </>}
    </div>
  );
}


function EmailSender({onSent,remaining,sentToday}:{onSent?:()=>void;remaining?:number;sentToday?:number}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [preview, setPreview] = useState<{count:number;target:string}|null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [showFailed, setShowFailed] = useState(false);

  const rem = remaining ?? 100;
  const quotaColor = rem < 20 ? '#EF4444' : rem < 50 ? '#F59E0B' : '#10B981';

  const previewCount = async (target: 'dormant'|'all') => {
    const r = await fetch('/api/admin/send-email',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({target,previewOnly:true}),
    });
    const d = await r.json();
    if(d.count!=null) setPreview({count:d.count,target});
  };

  const send = async (target: 'test'|'dormant'|'all') => {
    if(sending) return;
    const label = target==='test'?`테스트 (${testEmail||'norich92@gmail.com'})`:
      target==='dormant'?`휴면유저 ${preview?.target===target?preview.count+'명':''}`:
      `전체유저 ${preview?.target===target?preview.count+'명':''}`;
    if(!confirm(`📧 ${label}에게 발송합니다. 계속?`)) return;
    setSending(true); setResult(null); setShowFailed(false);
    try {
      const d = await fetch('/api/admin/send-email',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body: JSON.stringify({target, testEmail: testEmail||undefined}),
      }).then(r=>r.json());
      setResult(d);
      onSent?.();
    } catch(e:any){setResult({error:e.message});}
    finally{setSending(false);}
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <span style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'0.05em'}}>발송하기</span>
        <span style={{fontSize:11,color:quotaColor}}>잔여 {rem}통</span>
      </div>
      <input type="email" placeholder="테스트 이메일 (기본: norich92@gmail.com)"
        value={testEmail} onChange={e=>setTestEmail(e.target.value)}
        style={{width:'100%',boxSizing:'border-box',padding:'6px 8px',borderRadius:'var(--radius-sm)',border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.7)',fontSize:12,marginBottom:6,outline:'none'}}
      />
      <div style={{display:'flex',gap:4,marginBottom:4}}>
        <button onClick={()=>send('test')} disabled={sending} style={{flex:1,padding:'6px',borderRadius:'var(--radius-sm)',border:'1px solid rgba(59,123,246,0.2)',background:'rgba(59,123,246,0.06)',color:'#3B7BF6',cursor:'pointer',fontSize:12,fontWeight:600}}>🧪 테스트</button>
        <button onClick={()=>previewCount('dormant')} onDoubleClick={()=>send('dormant')} disabled={sending}
          style={{flex:1,padding:'6px',borderRadius:'var(--radius-sm)',border:'1px solid rgba(245,158,11,0.2)',background:'rgba(245,158,11,0.06)',color:'#F59E0B',cursor:'pointer',fontSize:12,fontWeight:600}}
          title="클릭: 미리보기 / 더블클릭: 발송">
          😴 휴면{preview?.target==='dormant'?` (${preview.count})`:''}</button>
        <button onClick={()=>previewCount('all')} onDoubleClick={()=>send('all')} disabled={sending}
          style={{flex:1,padding:'6px',borderRadius:'var(--radius-sm)',border:'1px solid rgba(239,68,68,0.2)',background:'rgba(239,68,68,0.06)',color:'#EF4444',cursor:'pointer',fontSize:12,fontWeight:600}}
          title="클릭: 미리보기 / 더블클릭: 발송">
          📨 전체{preview?.target==='all'?` (${preview.count})`:''}</button>
      </div>
      {preview&&<div style={{fontSize:10,color:'rgba(255,255,255,0.3)',textAlign:'center',marginBottom:4}}>
        {preview.target==='dormant'?'휴면':'전체'} {preview.count}명 대상 · 더블클릭으로 발송
      </div>}
      {sending&&<div style={{fontSize:12,color:'rgba(255,255,255,0.4)',textAlign:'center',padding:4}}>발송 중... ⏳</div>}
      {result&&<div style={{fontSize:12,padding:'6px 8px',borderRadius:'var(--radius-sm)',background:result.error?'rgba(239,68,68,0.06)':'rgba(16,185,129,0.06)',color:result.error?'#EF4444':'#10B981'}}>
        {result.error ? `❌ ${result.error}` : <>
          ✓ {result.sent}건 발송
          {result.skippedByLimit>0&&<span style={{color:'#F59E0B'}}> · ⚠ 한도 {result.skippedByLimit}건 스킵</span>}
          {result.failed>0&&<span style={{color:'#EF4444'}}> · ✗ {result.failed}건 실패{' '}
            <button onClick={()=>setShowFailed(v=>!v)} style={{background:'none',border:'none',color:'#EF4444',cursor:'pointer',fontSize:10,textDecoration:'underline'}}>{showFailed?'숨기기':'보기'}</button>
          </span>}
        </>}
        {showFailed&&result.failedEmails?.length>0&&
          <div style={{marginTop:4,fontSize:10,opacity:.7}}>
            {result.failedEmails.map((f:any,i:number)=><div key={i}>{f.email}: {f.error}</div>)}
          </div>}
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
