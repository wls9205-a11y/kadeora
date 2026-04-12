'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const FocusTab = dynamic(() => import('./tabs/FocusTab'), {
  loading: () => <div style={{display:'flex',justifyContent:'center',padding:80}}><div style={{width:24,height:24,border:'3px solid rgba(255,255,255,0.1)',borderTopColor:'#3B7BF6',borderRadius:'50%',animation:'spin .5s linear infinite'}}/></div>,
});
const IssueTab = dynamic(() => import('./tabs/IssueTab'), {
  loading: () => <div style={{display:'flex',justifyContent:'center',padding:80}}><div style={{width:24,height:24,border:'3px solid rgba(255,255,255,0.1)',borderTopColor:'#3B7BF6',borderRadius:'50%',animation:'spin .5s linear infinite'}}/></div>,
});

type TabKey = 'focus' | 'issue';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'focus', label: '대시보드', icon: '📊' },
  { key: 'issue', label: '이슈감지', icon: '🔍' },
];

export default function AdminShell() {
  const [hp, setHp] = useState<{s:number;cr:number;pv:number;nu:number;iss?:number}|null>(null);
  const [tab, setTab] = useState<TabKey>('focus');

  useEffect(() => {
    const ld = () => fetch('/api/admin/v2?tab=focus').then(r => r.json()).then(d => {
      if (d?.healthScore != null) {
        const k = d.kpi || {};
        setHp({ s: d.healthScore, cr: Math.round(k.cronSuccess / Math.max(k.cronSuccess + k.cronFail, 1) * 100), pv: k.pvToday || 0, nu: k.newUsersToday || 0, iss: k.issuePending || 0 });
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
        .adm-tab{display:flex;gap:0;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.06)}
        .adm-tab button{flex:1;padding:8px 0;font-size:12px;font-weight:600;border:none;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:4px}
        .adm-tab button.active{background:#3B7BF6;color:#fff}
        .adm-tab button:not(.active){background:rgba(255,255,255,0.03);color:#64748b}
        .adm-tab button:not(.active):hover{background:rgba(255,255,255,0.06);color:#94a3b8}
      `}</style>

      {/* 헤더 */}
      <div style={{position:'sticky',top:0,zIndex:50,background:'rgba(5,10,24,0.97)',backdropFilter:'blur(16px)',padding:'8px 0 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <div style={{width:26,height:26,borderRadius:'50%',border:`2px solid ${sc}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:900,color:sc,flexShrink:0}}>{hp?.s??'—'}</div>
          {hp && <>
            <span style={{fontSize:10,color:hp.cr>=95?'#10B981':'#F59E0B',fontWeight:600}}>크론 {hp.cr}%</span>
            <span style={{fontSize:8,color:'rgba(255,255,255,0.08)'}}>·</span>
            <span style={{fontSize:10,color:'#10B981',fontWeight:600}}>+{hp.nu}명</span>
            <span style={{fontSize:8,color:'rgba(255,255,255,0.08)'}}>·</span>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>PV {hp.pv}</span>
            {(hp.iss ?? 0) > 0 && <>
              <span style={{fontSize:8,color:'rgba(255,255,255,0.08)'}}>·</span>
              <span style={{fontSize:10,color:'#F59E0B',fontWeight:600}}>이슈 {hp.iss}</span>
            </>}
          </>}
          <div style={{flex:1}}/>
          <span style={{fontSize:7,color:'rgba(255,255,255,0.08)',letterSpacing:1}}>MISSION CONTROL</span>
        </div>

        {/* 탭 네비게이션 */}
        <div className="adm-tab">
          {TABS.map(t => (
            <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      {tab === 'focus' && <FocusTab onNavigate={() => {}} />}
      {tab === 'issue' && <IssueTab />}
    </div>
  );
}
