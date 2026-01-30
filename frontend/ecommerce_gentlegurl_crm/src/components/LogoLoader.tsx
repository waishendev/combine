'use client'

import { useEffect, useState } from 'react'

type LogoLoaderProps = {
  children: React.ReactNode
}

export function LogoLoader({ children }: LogoLoaderProps) {
  const [logoLoaded, setLogoLoaded] = useState(false)
  const storageKey = 'branding.crm_logo_url'

  useEffect(() => {
    // 从 sessionStorage 获取缓存的 logo，或者使用默认 logo
    const cachedLogo = typeof window !== 'undefined' 
      ? window.sessionStorage.getItem(storageKey) 
      : null
    const logoToLoad = cachedLogo || '/images/logo.png'

    const img = new Image()
    let timeoutId: NodeJS.Timeout

    const handleLoad = () => {
      setLogoLoaded(true)
    }

    const handleError = () => {
      // 即使加载失败也继续显示
      setLogoLoaded(true)
    }

    // 设置超时，最多等待 5 秒
    timeoutId = setTimeout(() => {
      setLogoLoaded(true)
    }, 5000)

    img.onload = handleLoad
    img.onerror = handleError
    img.src = logoToLoad

    return () => {
      clearTimeout(timeoutId)
      img.onload = null
      img.onerror = null
    }
  }, [])

  // 如果 logo 还没加载完成，显示加载状态
  if (!logoLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-[120px] flex items-center justify-center">
            <div className="h-8 w-[120px] animate-pulse bg-slate-200 rounded" />
          </div>
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
