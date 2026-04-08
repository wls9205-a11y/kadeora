'use client';
import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';

const tabs = ['focus','growth','users','data','ops','execute'] as const;
type T = typeof tabs[number];
const icons: Record<T,string> = { focus:'📊', growth:'📈', users:'👤', data:'🗄️', ops:'🔧', execute:'⚡' };
const labels: Record<T,string> = { focus:'대시보드', growth:'성장', users:'유저', data:'데이터', ops:'크론', execute:'실행' };

const Spin = () => <div style={{display:'flex',justifyContent:'center',padding:60}}><div style={{width:24,height:24,border:'3px solid rgba(255,255,255,0.1)',borderTopColor:'#3B7BF6',borderRadius:'50%',animation:'spin .5s linear infinite'}}/></div>;
const C: Record<T, React.ComponentType<{onNavigate:(t:T)=>void}>> = {
  focus: dynamic(()=>import('./tabs/FocusTab'),{loading:Spin}),
  growth: dynamic(()=>import('./tabs/GrowthTab'),{loading:Spin}),
  users: dynamic(()=>import('./tabs/UsersTab'),{loading:Spin}),
  data: dynamic(()=>import('./tabs/DataTab'),{loading:Spin}),
  ops: dynamic(()=>import('./tabs/OpsTab'),{loading:Spin}),
  execute: dynamic(()=>import('./tabs/ExecuteTab'),{loading:Spin}),
};

export default function AdminShell() {
  const [tab, setTab] = useState<T>('focus');
  const [hp, setHp] = useState<{s:number;cr:number;pv:number}|null>(null);
  const sw = useCallback((t:T)=>setTab(t),[]);
  const Tab = C[tab];

  useEffect(()=>{
    const ld=()=>fetch('/api/admin/v2?tab=focus').then(r=>r.json()).then(d=>{
      if(d?.healthScore!=null){const k=d.kpi||{};setHp({s:d.healthScore,cr:Math.round(k.cronSuccess/Math.max(k.cronSuccess+k.cronFail,1)*100),pv:k.pvToday||0});}
    }).catch(()=>{});
    ld(); const t=setInterval(ld,60000); return()=>clearInterval(t);
  },[]);

  const sc = hp ? hp.s>=71?'#10B981':hp.s>=41?'#F59E0B':'#EF4444' : '#666';

  return (
    <div style={{width:'100%',maxWidth:640,margin:'0 auto',boxSizing:'border-box',padding:'0 10px 80px',minHeight:'100vh',overflowX:'hidden'}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        .at{flex:1;padding:8px 0;text-align:center;font-size:11px;color:rgba(255,255,255,0.35);cursor:pointer;border:none;background:none;transition:all .15s;min-width:0}
        .at.on{color:#3B7BF6;font-weight:800}
        .at:hover{color:rgba(255,255,255,0.7)}
      `}</style>

      {/* 헤더 */}
      <div style={{position:'sticky',top:0,zIndex:50,background:'rgba(5,10,24,0.97)',backdropFilter:'blur(16px)',padding:'8px 0 4px',width:'100%',maxWidth:'100%',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:28,height:28,borderRadius:'50%',border:`2px solid ${sc}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:sc,flexShrink:0}}>{hp?.s??'—'}</div>
          {hp && <>
            <span style={{fontSize:10,color:hp.cr>=95?'#10B981':'#F59E0B',fontWeight:600}}>크론 {hp.cr}%</span>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.12)'}}>·</span>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>PV {hp.pv}</span>
          </>}
          <div style={{flex:1}}/>
          <span style={{fontSize:8,color:'rgba(255,255,255,0.12)',letterSpacing:1}}>MISSION CONTROL</span>
        </div>
      </div>

      {/* 탭 바 */}
      <div style={{display:'flex',position:'sticky',top:40,zIndex:49,background:'rgba(5,10,24,0.98)',padding:'2px 0 4px',width:'100%',maxWidth:'100%',marginBottom:8,borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
        {tabs.map(t=>(
          <button key={t} className={`at${tab===t?' on':''}`} onClick={()=>sw(t)}>
            <div style={{fontSize:14,marginBottom:1,opacity:tab===t?1:0.4}}>{icons[t]}</div>
            {labels[t]}
          </button>
        ))}
      </div>

      <Tab onNavigate={sw}/>
    </div>
  );
}
