'use client';
import { useEffect, useRef, useCallback } from 'react';

/**
 * useModalA11y — 모달 접근성 훅
 * - Escape 키로 닫기
 * - 포커스 트랩 (Tab 키 모달 내부 순환)
 * - 열릴 때 첫 포커스 가능 요소에 포커스
 * - 닫힐 때 이전 포커스 복원
 */
export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Escape 키 닫기
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }

    // Tab 키 포커스 트랩
    if (e.key === 'Tab' && modalRef.current) {
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // 이전 포커스 저장
    previousFocus.current = document.activeElement as HTMLElement;

    // 첫 포커스 가능 요소에 포커스
    requestAnimationFrame(() => {
      if (modalRef.current) {
        const first = modalRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        first?.focus();
      }
    });

    document.addEventListener('keydown', handleKeyDown);
    // 배경 스크롤 방지
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      // 이전 포커스 복원
      previousFocus.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  return modalRef;
}
