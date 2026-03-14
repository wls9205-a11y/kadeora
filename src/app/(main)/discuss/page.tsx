import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { MessageSquare, Users, TrendingUp, Building2, Hash } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '토론방' }

const ROOM_TYPE_ICONS = {
  stock: TrendingUp,
  apt: Building2,
  theme: Hash,
}

const ROOM_TYPE_LABELS = {
  stock: '종목',
  apt: '청약',
  theme: '테마',
}

export default async function DiscussPage() {
  const supabase = await createClient()

  const { data: rooms } = await supabase
    .from('discussion_rooms')
    .select('*')
    .eq('is_active', true)
    .order('member_count', { ascending: false })

  const grouped = {
    stock: rooms?.filter(r => r.room_type === 'stock') ?? [],
    apt: rooms?.filter(r => r.room_type === 'apt') ?? [],
    theme: rooms?.filter(r => r.room_type === 'theme') ?? [],
  }

  return (
    <div className="min-h-screen px-4 pt-4 pb-6">
      <h1 className="text-xl font-bold text-white mb-4">토론방</h1>

      {(['stock', 'apt', 'theme'] as const).map(type => {
        const Icon = ROOM_TYPE_ICONS[type]
        const list = grouped[type]
        if (list.length === 0) return null

        return (
          <section key={type} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Icon size={15} className="text-white/40" />
              <h2 className="text-sm font-semibold text-white/60">{ROOM_TYPE_LABELS[type]} 토론방</h2>
            </div>

            <div className="space-y-2">
              {list.map(room => (
                <Link
                  key={room.id}
                  href={`/discuss/${room.id}`}
                  className="card flex items-center gap-3 px-4 py-3.5 active:bg-white/[0.05] transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-white truncate">{room.display_name}</p>
                    {room.description && (
                      <p className="text-[12px] text-white/40 truncate mt-0.5">{room.description}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="flex items-center gap-1 text-[12px] text-white/30 justify-end">
                      <Users size={11} />
                      <span>{room.member_count.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[12px] text-white/20 justify-end mt-0.5">
                      <MessageSquare size={11} />
                      <span>{room.post_count.toLocaleString()}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )
      })}

      {(!rooms || rooms.length === 0) && (
        <div className="py-20 text-center text-white/30">
          <p className="text-4xl mb-3">💬</p>
          <p className="text-sm">토론방이 없어요</p>
        </div>
      )}
    </div>
  )
}
