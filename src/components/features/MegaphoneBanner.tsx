import { createClient } from '@/lib/supabase/server'

export async function MegaphoneBanner() {
  const supabase = await createClient()

  const { data: megaphones } = await supabase
    .from('megaphones')
    .select('id, message, nickname, text_color, bg_color, tier')
    .eq('is_active', true)
    .eq('queue_status', 'active')
    .order('tier', { ascending: false })
    .limit(3)

  if (!megaphones || megaphones.length === 0) return null

  const current = megaphones[0]

  return (
    <div
      className="fixed top-14 left-1/2 -translate-x-1/2 w-full max-w-mobile z-30
                  h-8 overflow-hidden flex items-center"
      style={{ backgroundColor: current.bg_color ?? '#000000' }}
    >
      {/* 📢 아이콘 */}
      <div className="flex-shrink-0 pl-3 pr-2 text-sm">
        {current.tier === 'urgent' ? '🚨' : '📢'}
      </div>

      {/* 마퀴 텍스트 */}
      <div className="flex-1 overflow-hidden">
        <p
          className="megaphone-marquee text-sm font-medium"
          style={{ color: current.text_color ?? '#00ff88' }}
        >
          <span className="opacity-70 mr-2">{current.nickname}</span>
          {current.message}
        </p>
      </div>
    </div>
  )
}
