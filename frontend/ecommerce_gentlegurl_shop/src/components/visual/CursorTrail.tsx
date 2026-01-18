"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";

type Sparkle = {
  id: number;
  x: number;
  y: number;
  hue: number;
  size: number;
  rotation: number;
  driftX: number;
  driftY: number;
  duration: number;
};

type PetalStyle = CSSProperties & {
  "--drift-x": string;
  "--drift-y": string;
  "--rotation": string;
  "--duration": string;
};

// 星星颜色：金色、黄色、淡黄色、白色
const SPARKLE_COLORS = [
  { hue: 45 },   // 金色
  { hue: 50 },   // 黄色
  { hue: 60 },   // 淡黄色
  { hue: 0 },    // 白色（特殊处理）
  { hue: 340 },  // 粉红色
  { hue: 330 },  // 玫瑰粉
  { hue: 320 },  // 淡粉色
  { hue: 350 },  // 樱花粉
];

export default function CursorTrail() {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const counter = useRef(0);
  const mountedRef = useRef(true);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
  const movementThreshold = 5; // 最小移动距离（像素）

  useEffect(() => {
    setIsMounted(true);
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const palette = useMemo(() => SPARKLE_COLORS, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const currentX = event.clientX;
      const currentY = event.clientY;

      // 检查是否有上一次的位置
      if (lastPositionRef.current) {
        // 计算移动距离
        const deltaX = currentX - lastPositionRef.current.x;
        const deltaY = currentY - lastPositionRef.current.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // 只有当移动距离超过阈值时才创建星星
        if (distance < movementThreshold) {
          // 更新位置但不创建星星
          lastPositionRef.current = { x: currentX, y: currentY };
          return;
        }
      }

      // 更新位置
      lastPositionRef.current = { x: currentX, y: currentY };

      // 创建星星 - RIGHT DOWN 效果：向右下方飘落
      const color = palette[Math.floor(Math.random() * palette.length)];
      const id = counter.current++;
      // 向右下方：driftX 为正（向右），driftY 为正（向下）
      const driftX = 15 + Math.random() * 35; // 15-50px 向右
      const driftY = 40 + Math.random() * 50; // 40-90px 向下
      const sparkle: Sparkle = {
        id,
        x: currentX,
        y: currentY,
        hue: color.hue,
        size: 8 + Math.random() * 10, // 星星稍小一点
        rotation: -180 + Math.random() * 360, // 随机旋转角度
        driftX,
        driftY,
        duration: 1500 + Math.random() * 800, // 稍慢的飘落速度
      };

      setSparkles((current) => {
        const next = [...current.slice(-18), sparkle];
        return next;
      });

      window.setTimeout(() => {
        if (!mountedRef.current) return;
        setSparkles((current) => current.filter((item) => item.id !== id));
      }, 800);
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [palette]);

  if (!isMounted) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {sparkles.map((sparkle) => {
        // 爱心 clip-path
        const heartPath =
          "path('M50% 15% C35% 0% 0% 20% 50% 60% C100% 20% 65% 0% 50% 15% Z')";
        
        const isWhite = sparkle.hue === 0;
        const bgColor = isWhite 
          ? `hsl(0 0% 100%)` 
          : `hsl(${sparkle.hue} 90% 60%)`;
        
        const style: PetalStyle = {
          left: sparkle.x,
          top: sparkle.y,
          width: sparkle.size,
          height: sparkle.size,
          background: bgColor,
          clipPath: heartPath,
          transform: `translate(-50%, -50%) rotate(${sparkle.rotation}deg) scale(1)`,
          boxShadow: isWhite
            ? `0 0 10px rgba(255, 255, 255, 0.9), 0 0 15px rgba(255, 255, 255, 0.6)`
            : `0 0 10px hsla(${sparkle.hue} 90% 70% / 0.9), 0 0 15px hsla(${sparkle.hue} 90% 60% / 0.6)`,
          filter: `drop-shadow(0 0 6px ${isWhite ? 'rgba(255, 255, 255, 0.8)' : `hsla(${sparkle.hue} 90% 70% / 0.8)`})`,
          "--drift-x": `${sparkle.driftX}px`,
          "--drift-y": `${sparkle.driftY}px`,
          "--rotation": `${sparkle.rotation}deg`,
          "--duration": `${sparkle.duration}ms`,
        };

        return (
          <span
            key={sparkle.id}
            className="absolute will-change-transform animate-[petal-fall_var(--duration)_ease-out]"
            style={style}
          />
        );
      })}
    </div>
  );
}
