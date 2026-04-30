'use client';

/**
 * PageHeader
 *
 * 페이지 최상단 sticky 영역. 지역 셀렉터 + 탭별 KPI inline.
 * sticky로 동작하여 어느 위치에서든 지역 변경 + 핵심 수치 가시화.
 */

import { useState } from 'react';
import type { Region, Kpi } from '../types';

type Props = {
  region: Region;
  kpis: Kpi[];
  onRegionChange?: () => void;
};

export function PageHeader({ region, kpis, onRegionChange }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleClick = () => {
    if (onRegionChange) {
      onRegionChange();
    } else {
      setDrawerOpen(true);
    }
  };

  return (
    <>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--aptr-bg-card)',
          borderBottom: '0.5px solid var(--aptr-border-subtle)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          backdropFilter: 'saturate(1.4) blur(8px)',
          flexWrap: 'wrap',
          rowGap: '8px',
        }}
      >
        {/* 지역 영역 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            minWidth: 0,
            flexShrink: 0,
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--aptr-brand)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--aptr-text-secondary)',
              whiteSpace: 'nowrap',
            }}
          >
            {region.parentName}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--aptr-text-tertiary)' }}>›</span>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--aptr-text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {region.name}
          </span>
          <button
            type="button"
            onClick={handleClick}
            className="aptr-focus"
            style={{
              marginLeft: '4px',
              fontSize: '11px',
              padding: '3px 9px',
              border: '0.5px solid var(--aptr-border-default)',
              borderRadius: 'var(--aptr-radius-sm)',
              background: 'transparent',
              color: 'var(--aptr-text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            변경
          </button>
        </div>

        {/* KPI 영역 */}
        <div
          className="aptr-scroll-x"
          style={{
            display: 'flex',
            gap: '14px',
            fontSize: '11px',
            minWidth: 0,
            flex: '1 1 auto',
            justifyContent: 'flex-end',
            paddingBottom: '2px',
          }}
        >
          {kpis.map((kpi) => (
            <span
              key={kpi.label}
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ color: 'var(--aptr-text-tertiary)' }}>{kpi.label}</span>
              <span
                className="aptr-num"
                style={{ fontWeight: 500, color: 'var(--aptr-text-primary)' }}
              >
                {kpi.value}
              </span>
              {kpi.delta ? (
                <span
                  className="aptr-num"
                  style={{
                    color:
                      kpi.deltaTone === 'positive'
                        ? 'var(--aptr-positive)'
                        : kpi.deltaTone === 'negative'
                        ? 'var(--aptr-negative)'
                        : 'var(--aptr-text-tertiary)',
                  }}
                >
                  {kpi.delta}
                </span>
              ) : null}
            </span>
          ))}
        </div>
      </div>

      {drawerOpen ? (
        <div
          role="dialog"
          aria-label="지역 선택"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-end',
          }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--aptr-bg-card)',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              padding: '20px',
              width: '100%',
              maxHeight: '60vh',
              overflow: 'auto',
            }}
          >
            <p
              style={{
                fontSize: '14px',
                fontWeight: 500,
                marginBottom: '12px',
                color: 'var(--aptr-text-primary)',
              }}
            >
              지역 선택
            </p>
            <p
              className="aptr-prose"
              style={{ fontSize: '12px', color: 'var(--aptr-text-secondary)' }}
            >
              지역 선택 드로어 — 기존 카더라 지역 셀렉터 컴포넌트로 교체 예정.
              (region_code: <code>{region.code}</code>)
            </p>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                border: '0.5px solid var(--aptr-border-default)',
                borderRadius: 'var(--aptr-radius-md)',
                background: 'var(--aptr-bg-elevated)',
                color: 'var(--aptr-text-primary)',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
