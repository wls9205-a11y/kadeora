import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 블로그 글을 안전하게 INSERT하는 유틸리티
 * 
 * - is_published = false (큐 대기 상태)
 * - published_at = null (발행 크론이 세팅)
 * - 제목 유사도 체크 (40% 이상 유사하면 스킵)
 * - 하루 생성 상한 체크
 * 
 * 모든 블로그 크론에서 직접 .insert() 대신 이 함수를 사용합니다.
 */

const DAILY_CREATE_LIMIT = 10; // 하루 최대 생성 (발행과 별도)

interface BlogInsertData {
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  category: string;
  tags?: string[];
  source_type?: string;
  cron_type?: string;
  data_date?: string;
  source_ref?: string;
  cover_image?: string;
  image_alt?: string;
  meta_description?: string;
  meta_keywords?: string;
}

interface SafeInsertResult {
  success: boolean;
  reason?: 'duplicate_slug' | 'similar_title' | 'daily_limit' | 'error';
  id?: string;
  similarTo?: string;
}

export async function safeBlogInsert(
  admin: SupabaseClient,
  data: BlogInsertData
): Promise<SafeInsertResult> {
  try {
    // 1. 슬러그 중복 체크
    const { data: existing } = await admin
      .from('blog_posts')
      .select('id')
      .eq('slug', data.slug)
      .maybeSingle();

    if (existing) {
      return { success: false, reason: 'duplicate_slug' };
    }

    // 2. 제목 유사도 체크 (pg_trgm)
    // similarity 함수가 없을 수 있으므로 try-catch
    try {
      const { data: similar } = await admin.rpc('check_blog_similarity', {
        p_title: data.title,
        p_threshold: 0.4,
      });
      if (similar && similar.length > 0) {
        console.log(`[safeBlogInsert] Similar title found: "${data.title}" ≈ "${similar[0].title}" (${(similar[0].similarity * 100).toFixed(0)}%)`);
        return { success: false, reason: 'similar_title', similarTo: similar[0].title };
      }
    } catch {
      // pg_trgm 미설치 또는 RPC 미존재 → 스킵
    }

    // 3. 하루 생성량 체크
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await admin
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());

    if ((count ?? 0) >= DAILY_CREATE_LIMIT) {
      console.log(`[safeBlogInsert] Daily create limit reached: ${count}/${DAILY_CREATE_LIMIT}`);
      return { success: false, reason: 'daily_limit' };
    }

    // 4. INSERT (큐 대기 상태)
    const { data: inserted, error } = await admin
      .from('blog_posts')
      .insert({
        slug: data.slug,
        title: data.title,
        content: data.content,
        excerpt: data.excerpt || data.content.slice(0, 100).replace(/[#|*\n]/g, ''),
        category: data.category,
        tags: data.tags || [],
        source_type: data.source_type || 'auto',
        cron_type: data.cron_type,
        data_date: data.data_date,
        source_ref: data.source_ref,
        cover_image: data.cover_image,
        image_alt: data.image_alt,
        meta_description: data.meta_description,
        meta_keywords: data.meta_keywords,
        // ★ 핵심: 큐 대기 상태
        is_published: false,
        published_at: null,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`[safeBlogInsert] Insert error:`, error.message);
      return { success: false, reason: 'error' };
    }

    return { success: true, id: inserted?.id };
  } catch (err: any) {
    console.error(`[safeBlogInsert] Error:`, err.message);
    return { success: false, reason: 'error' };
  }
}
