'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('./tabs/FocusTab'), {
  loading: () => <div style={{display:'flex',justifyContent:'center',padding:80}}><div style={{width:24,height:24,border:'3px solid rgba(255,255,255,0.1)',borderTopColor:'#3B7BF6',borderRadius:'50%',animation:'spin .5s linear infinite'}}/></div>,
});

export default function AdminShell() {
  const [hp, setHp] = useState<{s:number;cr:number;pv:number;nu:number}|null>(null);

  useEffect(() => {
    const ld = () => fetch('/api/admin/v2?tab=focus').then(r => r.json()).then(d => {
      if (d?.healthScore != null) {
        const k = d.kpi || {};
        setHp({ s: d.healthScore, cr: Math.round(k.cronSuccess / Math.max(k.cronSuccess + k.cronFail, 1) * 100), pv: k.pvToday || 0, nu: k.newUsersToday || 0 });
      }
    }).catch(() => {});
    ld(); const t = setInterval(ld, 60000); return () => clearInterval(t);
  }, []);

  const sc = hp ? hp.s >= 71 ? '#10B981' : hp.s >= 41 ? '#F59E0B' : '#EF4444' : '#666';

  return (
    <div style={{width:'100%',maxWidth:640,margin:'0 auto',boxSizing:'border-box',padding:'0 10px 40px',minHeight:'100vh',overflowX:'hidden'}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        *{box-sizing:border-box}
        .adm-sec{font-size:12px;font-weight:800;color:#CBD5E1;margin:10px 0 6px;display:flex;align-items:center;gap:4px}
      `}</style>

      {/* 헤더 */}
      <div style={{position:'sticky',top:0,zIndex:50,background:'rgba(5,10,24,0.97)',backdropFilter:'blur(16px)',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:26,height:26,borderRadius:'50%',border:`2px solid ${sc}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:900,color:sc,flexShrink:0}}>{hp?.s??'—'}</div>
          {hp && <>
            <span style={{fontSize:10,color:hp.cr>=95?'#10B981':'#F59E0B',fontWeight:600}}>크론 {hp.cr}%</span>
            <span style={{fontSize:8,color:'rgba(255,255,255,0.08)'}}>·</span>
            <span style={{fontSize:10,color:'#10B981',fontWeight:600}}>+{hp.nu}명</span>
            <span style={{fontSize:8,color:'rgba(255,255,255,0.08)'}}>·</span>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>PV {hp.pv}</span>
          </>}
          <div style={{flex:1}}/>
          <span style={{fontSize:7,color:'rgba(255,255,255,0.08)',letterSpacing:1}}>MISSION CONTROL</span>
        </div>
      </div>

      <Dashboard onNavigate={() => {}} />
    </div>
  );
}
