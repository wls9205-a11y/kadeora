// DS-2 표준 ⑤ — 폼 필드.
//
// ⚠️ 입력 글자는 «16px 하한» 이다(설계서 §2 고정값). iOS 사파리는 16px 미만 입력에
//    포커스가 가면 «화면을 확대» 한다. 그러면 폼이 화면 밖으로 밀리고, 사용자는
//    자기가 뭘 잘못 눌렀는지 모른 채 폼을 떠난다. 리드폼에서 이건 곧 전환 손실이다.
//    globals.css 가 이미 `input, textarea, select { font-size: max(16px, var(--fs-sm)) }`
//    를 걸어 뒀다 — 여기서 그보다 «작게» 덮어쓰지 않는다.
//
// ⚠️ 에러는 «색으로만» 말하지 않는다. 문장이 함께 가고 aria-invalid·aria-describedby 로
//    보조기술에도 전달한다. 색만 쓰면 색각 이상 사용자에게는 아무 일도 안 일어난 화면이다.
//
// ⚠️ 에러 문구는 «다음 행동» 을 말한다(설계서 §2). 「잘못된 입력입니다」가 아니라
//    「휴대폰 번호를 - 없이 11자리로 입력해 주세요」.

'use client';

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  label: string;
  /** 입력 아래 보조 설명. 에러가 있으면 에러가 이 자리를 «대신» 한다(둘을 겹쳐 쌓지 않는다). */
  hint?: ReactNode;
  /** 에러 문장. 다음 행동을 말할 것. */
  error?: string | null;
  required?: boolean;
}

export default function Field({ label, hint, error, required, ...input }: FieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  const invalid = !!error;

  return (
    <div data-ds="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        htmlFor={id}
        style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text-secondary)' }}
      >
        {label}
        {required && (
          // ⚠️ 별표만 두지 않는다. 별표는 보조기술에서 「별」로 읽힌다.
          <span style={{ color: 'var(--error)', marginLeft: 3 }} aria-hidden="true">*</span>
        )}
        {required && <span className="sr-only"> (필수)</span>}
      </label>

      <input
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={hint || error ? msgId : undefined}
        required={required}
        {...input}
        style={{
          width: '100%',
          minHeight: 48,
          padding: '0 12px',
          borderRadius: 'var(--radius-md)',
          border: `1px solid var(${invalid ? '--error' : '--border'})`,
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          // ⛔ font-size 를 여기서 주지 않는다 — globals.css 의 16px 하한을 덮게 된다.
          outlineOffset: 2,
          boxSizing: 'border-box',
        }}
      />

      {(error || hint) && (
        <p
          id={msgId}
          // 에러는 등장 시점에 읽혀야 한다. hint 는 조용히 있어야 한다.
          role={invalid ? 'alert' : undefined}
          style={{
            margin: 0,
            fontSize: 'var(--fs-xs)',
            lineHeight: 1.5,
            color: `var(${invalid ? '--error' : '--text-tertiary'})`,
          }}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
