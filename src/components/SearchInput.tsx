'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  autoFocus?: boolean;
  debounceMs?: number;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 카더라 통일 검색 인풋
 * - sm: 페이지 내 필터용 (44px)
 * - md: 섹션 검색 (44px, 기본)
 * - lg: 통합 검색 페이지용 (48px)
 * 글씨는 세 크기 모두 16px 고정 — iOS 자동확대 하한이다.
 */
export default function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = '검색...',
  size = 'md',
  autoFocus = false,
  debounceMs = 0,
  loading = false,
  className,
  style,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internal, setInternal] = useState(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setInternal(value); }, [value]);

  const handleChange = useCallback((v: string) => {
    setInternal(v);
    if (debounceMs > 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(v), debounceMs);
    } else {
      onChange(v);
    }
  }, [onChange, debounceMs]);

  const handleClear = () => {
    setInternal('');
    onChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit(internal);
    }
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  // ⚠️ fontSize 를 16 아래로 내리지 말 것 — iOS 사파리는 16px 미만 input 에 포커스하면
  //    페이지를 «자동 확대» 하고 되돌아오지 않는다. 이전 값 12·13·15 가 전부 걸렸다.
  //    sm 은 16px 글씨가 34px 안에 안 들어가 44 로 함께 올렸다.
  const heights = { sm: 44, md: 44, lg: 48 };
  const fontSizes = { sm: 16, md: 16, lg: 16 };
  const iconSizes = { sm: 16, md: 16, lg: 17 };
  const paddings = { sm: '0 12px 0 38px', md: '0 12px 0 38px', lg: '0 14px 0 44px' };

  return (
    <div style={{ position: 'relative', width: '100%', ...style }} className={className}>
      {/* 검색 아이콘 */}
      <Search
        size={iconSizes[size]}
        style={{
          position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          color: internal ? 'var(--brand)' : 'var(--text-tertiary)',
          transition: 'color 0.15s',
          pointerEvents: 'none',
        }}
      />

      <input
        ref={inputRef}
        type="text"
        value={internal}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        style={{
          width: '100%',
          height: heights[size],
          padding: paddings[size],
          paddingRight: internal ? 36 : 12,
          border: '1px solid var(--border)',
          borderRadius: size === 'lg' ? 14 : size === 'md' ? 10 : 8,
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          fontSize: fontSizes[size],
          fontWeight: 500,
          outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxSizing: 'border-box',
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = 'var(--brand)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,123,246,0.1)';
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />

      {/* 로딩 또는 클리어 버튼 */}
      {(loading || internal) && (
        <button
          onClick={loading ? undefined : handleClear}
          aria-label={loading ? '검색 중' : '검색어 지우기'}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            width: 24, height: 24, borderRadius: '50%',
            border: 'none', cursor: loading ? 'default' : 'pointer',
            background: 'var(--bg-hover)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-tertiary)',
            transition: 'background 0.15s',
          }}
        >
          {loading ? (
            <div style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          ) : (
            <X size={12} />
          )}
        </button>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
