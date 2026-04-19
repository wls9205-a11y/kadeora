'use client';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import NotificationBell from './NotificationBell';

const Loader = () => <div style={{display:'flex',justifyContent:'center',padding:60}}><div style={{width:24,height:24,border:'3px solid rgba(255,255,255,0.1)',borderTopColor:'#3B7BF6',borderRadius:'50%',animation:'spin .5s linear infinite'}}/></div>;

const FocusTab = dynamic(() => import('./tabs/FocusTab'), { loading: Loader });
const IssueTab = dynamic(() => import('./tabs/IssueTab'), { loading: Loader });
const GrowthTab = dynamic(() => import('./tabs/GrowthTab'), { loading: Loader });
const UsersTab = dynamic(() => import('./tabs/UsersTab'), { loading: Loader });
const UsersListV2 = dynamic(() => import('./tabs/UsersListV2'), { loading: Loader });
const DataTab = dynamic(() => import('./tabs/DataTab'), { loading: Loader });
const OpsTab = dynamic(() => import('./tabs/OpsTab'), { loading: Loader });
const ExecuteTab = dynamic(() => import('./tabs/ExecuteTab'), { loading: Loader });
const CommunityTab = dynamic(() => import('./tabs/CommunityTab'), { loading: Loader });
const MasterControlTab = dynamic(() => import('./tabs/MasterControlTab'), { loading: Loader });
const NaverPublishTab = dynamic(() => import('./tabs/NaverPublishTab'), { loading: Loader });

type TabKey = 'master' | 'focus' | 'issue' | 'growth' | 'users' | 'users_v2' | 'data' | 'ops' | 'execute' | 'community' | 'naver';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'master', label: '마스터', icon: '🎛️' },
  { key: 'focus', label: '대시보드', icon: '📊' },
  { key: 'naver', label: '네이버 발행', icon: '🟢' },
  { key: 'issue', label: '이슈', icon: '🔍' },
  { key: 'growth', label: '성장', icon: '📈' },
  { key: 'users', label: '유저', icon: '👥' },
  { key: 'users_v2', label: '유저 v2', icon: '🆕' },
  { key: 'community', label: '커뮤니티', icon: '💬' },
  { key: 'data', label: '데이터', icon: '🗄️' },
  { key: 'ops', label: '운영', icon: '🔧' },
  { key: 'execute', label: '실행', icon: '⚡' },
];

export default function AdminShell() {
  const [hp, setHp] = useState<{s:number;cr:number;pv:number;nu:number;iss?:number}|null>(null);
  const [tab, setTab] = useState<TabKey>('master');

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
    <div style={{width:'100%',maxWidth:720,margin:'0 auto',boxSizing:'border-box',padding:'0 12px 40px',minHeight:'100vh',overflowX:'hidden'}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        *{box-sizing:border-box}
        .adm-sec{font-size:13px;font-weight:800;color:#94A3B8;margin:14px 0 8px;display:flex;align-items:center;gap:6px}
        .adm-tabs{display:flex;gap:0;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;border-bottom:1px solid rgba(255,255,255,0.06)}
        .adm-tabs::-webkit-scrollbar{display:none}
        .adm-tabs button{padding:10px 12px;font-size:12px;font-weight:600;border:none;cursor:pointer;white-space:nowrap;transition:all .15s;display:flex;align-items:center;gap:4px;border-bottom:2px solid transparent;flex-shrink:0}
        .adm-tabs button.active{background:transparent;color:#3B7BF6;border-bottom-color:#3B7BF6}
        .adm-tabs button:not(.active){background:transparent;color:#64748b}
        .adm-tabs button:not(.active):hover{color:#94a3b8;background:rgba(255,255,255,0.03)}
        .adm-card{background:rgba(12,21,40,0.6);border:1px solid rgba(255,255,255,0.04);border-radius:var(--radius-md);padding:10px 12px}
        .adm-btn{padding:6px 12px;font-size:12px;font-weight:600;border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);background:transparent;color:rgba(255,255,255,0.45);cursor:pointer;transition:all .15s}
        .adm-btn:hover{border-color:rgba(255,255,255,0.15);color:rgba(255,255,255,0.6)}
        .adm-kpi{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin-bottom:12px}
        .adm-kpi-c{background:rgba(12,21,40,0.6);border:1px solid rgba(255,255,255,0.04);border-radius:var(--radius-sm,8px);padding:10px 12px;text-align:center}
        .adm-kpi-v{font-size:18px;font-weight:800;color:#E2E8F0;line-height:1.2}
        .adm-kpi-l{font-size:10px;color:#64748b;margin-top:2px;font-weight:600}
        .adm-kpi-d{font-size:10px;color:#94A3B8;margin-top:1px}
        .adm-bar{width:100%;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-top:4px}
        .adm-bar-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#3B7BF6,#818CF8);transition:width .3s}
      `}</style>

      {/* 헤더 */}
      <div style={{position:'sticky',top:0,zIndex:50,background:'rgba(5,10,24,0.97)',backdropFilter:'blur(16px)',padding:'10px 0 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
          <div style={{width:32,height:32,borderRadius:'50%',border:`2.5px solid ${sc}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,color:sc,flexShrink:0}}>{hp?.s??'—'}</div>
          {hp && <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
            <span style={{color:hp.cr>=95?'#10B981':'#F59E0B',fontWeight:700}}>크론 {hp.cr}%</span>
            <span style={{color:'rgba(255,255,255,0.35)'}}>·</span>
            <span style={{color:'#10B981',fontWeight:700}}>+{hp.nu}명</span>
            <span style={{color:'rgba(255,255,255,0.35)'}}>·</span>
            <span style={{color:'rgba(255,255,255,0.45)'}}>PV {hp.pv.toLocaleString()}</span>
            {(hp.iss ?? 0) > 0 && <>
              <span style={{color:'rgba(255,255,255,0.35)'}}>·</span>
              <span style={{color:'#F59E0B',fontWeight:700}}>이슈 {hp.iss}</span>
            </>}
          </div>}
          <div style={{flex:1}}/>
          <NotificationBell />
          <span style={{fontSize: 10,color:'rgba(255,255,255,0.35)',letterSpacing:1,fontWeight:700,marginLeft:8}}>MISSION CONTROL</span>
        </div>

        {/* 탭 네비게이션 — 스크롤 가능 */}
        <div className="adm-tabs">
          {TABS.map(t => (
            <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      {tab === 'master' && <MasterControlTab />}
      {tab === 'focus' && <FocusTab onNavigate={(t: string) => setTab(t as TabKey)} />}
      {tab === 'naver' && <NaverPublishTab />}
      {tab === 'issue' && <IssueTab />}
      {tab === 'growth' && <GrowthTab onNavigate={(t: string) => setTab(t as TabKey)} />}
      {tab === 'users' && <UsersTab onNavigate={(t: string) => setTab(t as TabKey)} />}
      {tab === 'users_v2' && <UsersListV2 />}
      {tab === 'data' && <DataTab onNavigate={(t: string) => setTab(t as TabKey)} />}
      {tab === 'ops' && <OpsTab onNavigate={(t: string) => setTab(t as TabKey)} />}
      {tab === 'execute' && <ExecuteTab onNavigate={(t: string) => setTab(t as TabKey)} />}
      {tab === 'community' && <CommunityTab onNavigate={(t: string) => setTab(t as TabKey)} />}
    </div>
  );
}
