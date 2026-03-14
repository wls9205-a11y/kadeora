'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    Kakao: {
      init: (key: string) => void
      isInitialized: () => boolean
      Share: {
        sendDefault: (options: KakaoShareOptions) => void
      }
    }
  }
}

interface KakaoShareOptions {
  objectType: 'feed'
  content: {
    title: string
    description?: string
    imageUrl?: string
    link: { mobileWebUrl: string; webUrl: string }
  }
  buttons?: Array<{
    title: string
    link: { mobileWebUrl: string; webUrl: string }
  }>
}

interface KakaoShareParams {
  title: string
  description?: string
  imageUrl?: string
  url: string
  postId: number
}

export function useKakaoShare() {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
    if (!jsKey) return

    const script = document.createElement('script')
    script.src = 'https://developers.kakao.com/sdk/js/kakao.min.js'
    script.onload = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        window.Kakao.init(jsKey)
        initialized.current = true
      }
    }
    document.head.appendChild(script)
  }, [])

  function shareToKakao({ title, description, imageUrl, url }: KakaoShareParams) {
    if (!window.Kakao?.isInitialized()) {
      // 폴백: URL 복사
      navigator.clipboard.writeText(url)
      return false
    }

    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title,
        description: description ?? '카더라에서 확인하세요',
        imageUrl: imageUrl ?? `${window.location.origin}/og-default.png`,
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [
        {
          title: '카더라에서 보기',
          link: { mobileWebUrl: url, webUrl: url },
        },
      ],
    })
    return true
  }

  return { shareToKakao }
}
