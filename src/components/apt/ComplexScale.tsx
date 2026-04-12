'use client';

interface ComplexScaleProps {
  totalHouseholds: number;      // 단지 전체 총세대수
  supplyUnits: number;          // 이번 분양 공급세대수
  generalSupply: number;        // 일반공급
  specialSupply: number;        // 특별공급
  dongCount: number;            // 동수
  maxFloor: number;             // 최고층
  parkingCount: number;         // 주차대수
}

export default function ComplexScale({
  totalHouseholds, supplyUnits, generalSupply, specialSupply,
  dongCount, maxFloor, parkingCount,
}: ComplexScaleProps) {
  const supplyPct = totalHouseholds > 0 && supplyUnits > 0
    ? Math.round((supplyUnits / totalHouseholds) * 100) : 0;

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 12px',
      marginBottom: 14,
    }}>
      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>🏗️</span>
        <span>단지 규모</span>
      </div>

      {/* 총세대수 vs 공급세대수 비교 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, marginBottom: 12 }}>
        {/* 총세대수 */}
        <div style={{
          background: 'rgba(59,123,246,0.06)',
          border: '1px solid rgba(59,123,246,0.15)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 8px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, letterSpacing: 0.5 }}>단지 전체 총세대수</div>
          {totalHouseholds > 0 ? (
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: 'var(--brand)' }}>
              {totalHouseholds.toLocaleString()}<span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }}>세대</span>
            </div>
          ) : (
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-tertiary)' }}>🔍 확인중</div>
          )}
        </div>

        {/* 공급세대수 */}
        <div style={{
          background: 'rgba(34,197,94,0.06)',
          border: '1px solid rgba(34,197,94,0.15)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 8px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, letterSpacing: 0.5 }}>이번 분양 공급세대수</div>
          {supplyUnits > 0 ? (
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: 'var(--accent-green)' }}>
              {supplyUnits.toLocaleString()}<span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }}>세대</span>
            </div>
          ) : (
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-tertiary)' }}>-</div>
          )}
        </div>
      </div>

      {/* 비율 바 (둘 다 있을 때만) */}
      {totalHouseholds > 0 && supplyUnits > 0 && totalHouseholds !== supplyUnits && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>
            <span>공급 비율</span>
            <span>{supplyPct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-hover)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(supplyPct, 100)}%`,
              borderRadius: 3,
              background: 'linear-gradient(90deg, var(--brand), var(--accent-green))',
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}

      {/* 공급 상세 + 건물 스펙 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {(generalSupply > 0 || specialSupply > 0) && (
          <>
            <div style={{ textAlign: 'center', padding: '6px 0' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>일반공급</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)' }}>{generalSupply > 0 ? generalSupply.toLocaleString() : '-'}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '6px 0' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>특별공급</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)' }}>{specialSupply > 0 ? specialSupply.toLocaleString() : '-'}</div>
            </div>
          </>
        )}
        {dongCount > 0 && (
          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>동수</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)' }}>{dongCount}개동</div>
          </div>
        )}
        {maxFloor > 0 && (
          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>최고층</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)' }}>{maxFloor}층</div>
          </div>
        )}
        {parkingCount > 0 && (
          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>주차</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 800, color: 'var(--text-primary)' }}>{parkingCount.toLocaleString()}대</div>
          </div>
        )}
      </div>
    </div>
  );
}
