'use client'

import { useEffect, useCallback } from 'react'

declare global {
  interface Window {
    Kakao: any
  }
}

interface ShareOptions {
  title: string
  description: string
  imageUrl?: string
  link: string
  buttonText?: string
}

export function useKakaoShare() {
  useEffect(() => {
    // Kakao SDK 로드
    if (typeof window !== 'undefined' && !window.Kakao) {
      const script = document.createElement('script')
      script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.6.0/kakao.min.js'
      script.async = true
      script.onload = () => {
        if (window.Kakao && !window.Kakao.isInitialized()) {
          // TODO: 실제 카카오 앱 키로 교체
          window.Kakao.init('YOUR_KAKAO_APP_KEY')
        }
      }
      document.head.appendChild(script)
    }
  }, [])

  const share = useCallback(({ title, description, imageUrl, link, buttonText = '자세히 보기' }: ShareOptions) => {
    if (typeof window === 'undefined' || !window.Kakao) {
      console.error('Kakao SDK not loaded')
      return false
    }

    try {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title,
          description,
          imageUrl: imageUrl || 'https://kadeora.vercel.app/icon.svg',
          link: {
            mobileWebUrl: link,
            webUrl: link,
          },
        },
        buttons: [
          {
            title: buttonText,
            link: {
              mobileWebUrl: link,
              webUrl: link,
            },
          },
        ],
      })
      return true
    } catch (error) {
      console.error('Kakao share error:', error)
      return false
    }
  }, [])

  const sharePost = useCallback((postId: string, title: string, content: string) => {
    const link = `https://kadeora.vercel.app/post/${postId}`
    return share({
      title,
      description: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
      link,
      buttonText: '게시글 보기',
    })
  }, [share])

  return { share, sharePost }
}
