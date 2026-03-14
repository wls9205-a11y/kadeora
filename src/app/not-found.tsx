import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-dvh max-w-mobile mx-auto flex flex-col items-center justify-center px-6 bg-[#0F0F0F]">
      <p className="text-7xl mb-4">🌾</p>
      <h1 className="text-2xl font-bold text-white mb-2">페이지를 찾을 수 없어요</h1>
      <p className="text-sm text-white/40 text-center mb-8">
        삭제됐거나 잘못된 주소예요
      </p>
      <Link href="/" className="btn-brand px-8 py-3">
        홈으로 돌아가기
      </Link>
    </div>
  )
}
