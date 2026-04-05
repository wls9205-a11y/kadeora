'use client';
import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

const FocusTab = dynamic(() => import('./tabs/FocusTab'), { loading: () => <Spin /> });
const GrowthTab = dynamic(() => import('./tabs/GrowthTab'), { loading: () => <Spin /> });
const UsersTab = dynamic(() => import('./tabs/UsersTab'), { loading: () => <Spin /> });
const DataTab = dynamic(() => import('./tabs/DataTab'), { loading: () => <Spin /> });
const OpsTab = dynamic(() => import('./tabs/OpsTab'), { loading: () => <Spin /> });
const ExecuteTab = dynamic(() => import('./tabs/ExecuteTab'), { loading: () => <Spin /> });

function Spin() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin .6s linear infinite' }} />
    </div>
  );
}

type Tab = 'focus' | 'growth' | 'users' | 'data' | 'ops' | 'execute';

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'focus', icon: '🎯', label: '집중' },
  { key: 'growth', icon: '📊', label: '성장' },
  { key: 'users', icon: '👤', label: '사용자' },
  { key: 'data', icon: '🗄️', label: '데이터' },
  { key: 'ops', icon: '🔧', label: '운영' },
  { key: 'execute', icon: '⚡', label: '실행' },
];

const TAB_MAP: Record<Tab, React.ComponentType<{ onNavigate: (t: Tab) => void }>> = {
  focus: FocusTab, growth: GrowthTab, users: UsersTab,
  data: DataTab, ops: OpsTab, execute: ExecuteTab,
};

export default function AdminShell() {
  const [tab, setTab] = useState<Tab>('focus');
  const switchTab = useCallback((t: Tab) => setTab(t), []);
  const ActiveTab = TAB_MAP[tab];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 12px 80px', minHeight: '100vh' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse-glow { 0%,100% { opacity: 1 } 50% { opacity: .6 } }
        .adm-tab { flex: 1; padding: 10px 0; text-align: center; font-size: 11px; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; transition: all .15s; background: none; border-top: none; border-left: none; border-right: none; }
        .adm-tab.on { color: var(--brand); border-bottom-color: var(--brand); font-weight: 700; }
        .adm-tab:hover { color: var(--text-primary); }
        .adm-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-card, 12px); padding: 14px; margin-bottom: 10px; }
        .adm-kpi { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
        .adm-kpi-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; margin: 10px 0; }
        .adm-kpi-c { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px; }
        .adm-kpi-v { font-size: 22px; font-weight: 700; color: var(--text-primary); }
        .adm-kpi-l { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
        .adm-kpi-d { font-size: 10px; margin-top: 3px; }
        .adm-btn { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 14px; font-size: 12px; color: var(--text-secondary); cursor: pointer; transition: border-color .15s; }
        .adm-btn:hover { border-color: var(--brand); color: var(--brand); }
        .adm-sec { font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 18px 0 8px; display: flex; align-items: center; gap: 6px; }
        .adm-bar { height: 8px; border-radius: 4px; background: var(--bg-hover); overflow: hidden; margin: 4px 0 8px; }
        .adm-bar-fill { height: 100%; border-radius: 4px; transition: width .6s; }
        .adm-feed-i { display: flex; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 12px; color: var(--text-secondary); }
        .adm-feed-i:last-child { border: none; }
        .adm-alert { border-radius: 10px; padding: 12px; margin: 8px 0; font-size: 12px; }
        .adm-alert-red { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: #EF4444; }
        .adm-alert-yellow { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); color: #F59E0B; }
        .adm-alert-green { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); color: #10B981; }
      `}</style>

      {/* 플로팅 상단 바 */}
      <div style={{ position: 'sticky', top: 44, zIndex: 50, background: 'rgba(5,10,24,0.92)', backdropFilter: 'blur(12px)', padding: '8px 0', marginBottom: 8, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => switchTab('execute')}
            style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            ⚡ 최신화
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>카더라 미션 컨트롤</span>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16, position: 'sticky', top: 88, zIndex: 49, background: 'var(--bg-base)' }}>
        {TABS.map(t => (
          <button key={t.key} className={`adm-tab${tab === t.key ? ' on' : ''}`} onClick={() => switchTab(t.key)}>
            <div style={{ fontSize: 16, marginBottom: 2 }}>{t.icon}</div>
            {t.label}
          </button>
        ))}
      </div>

      {/* 활성 탭 */}
      <ActiveTab onNavigate={switchTab} />
    </div>
  );
}
