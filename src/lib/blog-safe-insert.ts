import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 블로그 글을 안전하게 INSERT하는 유틸리티 (v2)
 * 
 * DB의 blog_publish_config에서 설정을 읽어 적용:
 * - is_published = false (큐 대기 상태)
 * - published_at = null (발행 크론이 세팅)
 * - 제목 유사도 체크 (threshold는 DB 설정)
 * - 하루 생성 상한 체크 (DB 설정)
 * - 최소 콘텐츠 길이 체크 (DB 설정)
 * 
 * 모든 블로그 크론에서 직접 .insert() 대신 이 함수를 사용합니다.
 */

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
  is_published?: boolean;
}

interface SafeInsertResult {
  success: boolean;
  reason?: 'duplicate_slug' | 'similar_title' | 'daily_limit' | 'content_too_short' | 'error';
  id?: string;
  similarTo?: string;
}

// config 캐시 (크론 1회 실행 내 재사용)
let configCache: { daily_create_limit: number; min_content_length: number; title_similarity_threshold: number } | null = null;

async function getConfig(admin: SupabaseClient) {
  if (configCache) return configCache;
  const { data } = await admin.from('blog_publish_config').select('daily_create_limit, min_content_length, title_similarity_threshold').eq('id', 1).single();
  configCache = data ?? { daily_create_limit: 10, min_content_length: 1200, title_similarity_threshold: 0.4 };
  return configCache;
}

export async function safeBlogInsert(
  admin: SupabaseClient,
  data: BlogInsertData
): Promise<SafeInsertResult> {
  try {
    const config = await getConfig(admin);

    // 1. 최소 콘텐츠 길이 체크
    if (data.content.length < config.min_content_length) {
      return { success: false, reason: 'content_too_short' };
    }

    // 2. 슬러그 중복 체크
    const { data: existing } = await admin
      .from('blog_posts')
      .select('id')
      .eq('slug', data.slug)
      .maybeSingle();

    if (existing) {
      return { success: false, reason: 'duplicate_slug' };
    }

    // 3. 제목 유사도 체크 (pg_trgm)
    try {
      const { data: similar } = await admin.rpc('check_blog_similarity', {
        p_title: data.title,
        p_threshold: config.title_similarity_threshold,
      });
      if (similar && similar.length > 0) {
        return { success: false, reason: 'similar_title', similarTo: similar[0].title };
      }
    } catch {
      // pg_trgm 미설치 → 스킵
    }

    // 4. 하루 생성량 체크
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await admin
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());

    if ((count ?? 0) >= config.daily_create_limit) {
      return { success: false, reason: 'daily_limit' };
    }

    // 5. INSERT (큐 대기 상태)
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
        is_published: data.is_published ?? false,
        published_at: data.is_published ? new Date().toISOString() : null,
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
