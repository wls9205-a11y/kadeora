/**
 * Naver Cafe Open API client
 *
 * 핵심: application/x-www-form-urlencoded; charset=utf-8 사용
 * → URLSearchParams 가 자동 percent-encoding (UTF-8) 해줌 → 한글 안전
 *
 * 이전 multipart/form-data 방식은 part header에 charset 안 붙어서 EUC-KR로 해석돼서 한글 깨졌음.
 */

import { errMsg } from '@/lib/error-utils';

export interface CafePostResult {
  ok: boolean;
  articleId?: string;
  status?: number;
  error?: string;
  raw?: any;
}

export interface CafePostParams {
  accessToken: string;
  cafeId: string;     // clubId
  menuId: string;
  subject: string;
  content: string;
  timeoutMs?: number;
}

/**
 * 네이버 카페에 게시글 작성
 * @returns articleId 포함 결과
 */
export async function postCafeArticle(p: CafePostParams): Promise<CafePostResult> {
  const { accessToken, cafeId, menuId, subject, content, timeoutMs = 15000 } = p;

  if (!accessToken) return { ok: false, error: 'access_token_missing' };
  if (!cafeId || !menuId) return { ok: false, error: 'cafe_or_menu_missing' };
  if (!subject?.trim()) return { ok: false, error: 'subject_empty' };
  if (!content?.trim()) return { ok: false, error: 'content_empty' };

  // URLSearchParams: 자동 UTF-8 percent-encoding
  const body = new URLSearchParams();
  body.append('subject', subject);
  body.append('content', content);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/cafe/${encodeURIComponent(cafeId)}/menu/${encodeURIComponent(menuId)}/articles`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          'Accept': 'application/json; charset=utf-8',
        },
        body: body.toString(),
        signal: ctrl.signal,
      }
    );
    clearTimeout(timer);

    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}

    if (!res.ok) {
      const errorMsg = parsed?.message?.error?.errorMessage
        || parsed?.errorMessage
        || parsed?.message
        || text.slice(0, 300);
      return {
        ok: false, status: res.status, error: errorMsg, raw: parsed ?? text,
      };
    }

    const articleId = parsed?.message?.result?.articleId?.toString()
      || parsed?.result?.articleId?.toString();

    if (!articleId) {
      return {
        ok: false, status: res.status, error: 'no_article_id_in_response', raw: parsed,
      };
    }

    return { ok: true, articleId, status: res.status, raw: parsed };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: errMsg(e) };
  }
}

/**
 * 네이버 카페 게시글 조회 (검증용)
 */
export async function getCafeArticle(p: {
  accessToken: string;
  cafeId: string;
  articleId: string;
}): Promise<{ ok: boolean; article?: any; error?: string }> {
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/cafe/${encodeURIComponent(p.cafeId)}/articles/${encodeURIComponent(p.articleId)}.json`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${p.accessToken}`,
          'Accept': 'application/json; charset=utf-8',
        },
      }
    );
    const data = await res.json();
    if (!res.ok) return { ok: false, error: JSON.stringify(data).slice(0, 200) };
    return { ok: true, article: data };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
