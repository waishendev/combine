"use client";

import { useEffect, useState } from "react";

type LogoLoaderProps = {
  logoUrl: string | null;
  children: React.ReactNode;
};

export function LogoLoader({ logoUrl, children }: LogoLoaderProps) {
  const [logoLoaded, setLogoLoaded] = useState(false);
  const fallbackLogo = "/images/logo.png";
  const resolvedLogoUrl = logoUrl || fallbackLogo;

  useEffect(() => {
    // 预加载 logo 图片
    const img = new Image();
    let timeoutId: NodeJS.Timeout;

    const handleLoad = () => {
      setLogoLoaded(true);
    };

    const handleError = () => {
      // 即使加载失败也继续显示，使用 fallback
      setLogoLoaded(true);
    };

    // 设置超时，最多等待 5 秒
    timeoutId = setTimeout(() => {
      setLogoLoaded(true);
    }, 5000);

    img.onload = handleLoad;
    img.onerror = handleError;
    img.src = resolvedLogoUrl;

    return () => {
      clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
    };
  }, [resolvedLogoUrl]);

  // 如果 logo 还没加载完成，显示加载状态
  if (!logoLoaded) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-[120px] flex items-center justify-center">
            <div className="h-8 w-[120px] animate-pulse bg-[var(--muted)]/30 rounded" />
          </div>
          <p className="text-sm text-[var(--foreground)]/60">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
