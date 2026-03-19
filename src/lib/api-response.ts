import { NextResponse } from 'next/server'

export const ok = (data: unknown, status = 200) =>
  NextResponse.json({ ok: true, data }, { status })

export const err = (message: string, status = 400) =>
  NextResponse.json({ ok: false, error: message }, { status })

export const unauthorized = () => err('로그인이 필요합니다.', 401)
export const forbidden = () => err('권한이 없습니다.', 403)
export const rateLimitErr = () => err('잠시 후 다시 시도해주세요.', 429)
export const serverError = (e?: unknown) => {
  console.error('[server error]', e)
  return err('서버 오류가 발생했습니다.', 500)
}
