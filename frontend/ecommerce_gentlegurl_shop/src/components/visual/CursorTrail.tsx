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

const COLORS = [
  { hue: 0 },    // 白
  { hue: 350 },  // 樱花粉
  { hue: 340 },  // 粉红
  { hue: 330 },  // 玫瑰粉
  { hue: 320 },  // 淡粉
  { hue: 45 },   // 金
  { hue: 60 },   // 淡黄
];

export default function CursorTrail() {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const counter = useRef(0);
  const mountedRef = useRef(true);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const threshold = 6;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const palette = useMemo(() => COLORS, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const x = e.clientX;
      const y = e.clientY;

      if (lastPos.current) {
        const dx = x - lastPos.current.x;
        const dy = y - lastPos.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          lastPos.current = { x, y };
          return;
        }
      }

      lastPos.current = { x, y };

      const color = palette[Math.floor(Math.random() * palette.length)];
      const id = counter.current++;

      const sparkle: Sparkle = {
        id,
        x,
        y,
        hue: color.hue,
        size: 10 + Math.random() * 10,
        rotation: -180 + Math.random() * 360,
        driftX: 20 + Math.random() * 40,
        driftY: 45 + Math.random() * 55,
        duration: 1500 + Math.random() * 700,
      };

      setSparkles((s) => [...s.slice(-20), sparkle]);

      setTimeout(() => {
        if (!mountedRef.current) return;
        setSparkles((s) => s.filter((i) => i.id !== id));
      }, 900);
    };

    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [palette]);

  const heartMask = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="white" d="M12 21s-7.1-4.35-9.33-8.06C.9 9.6 2.2 6.8 5.1 5.9c1.7-.52 3.5.05 4.7 1.38C10.98 5.95 12.8 5.38 14.5 5.9c2.9.9 4.2 3.7 2.43 7.04C19.1 16.65 12 21 12 21z"/>
    </svg>
  `);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {sparkles.map((s) => {
        const isWhite = s.hue === 0;
        const bg = isWhite
          ? "hsl(0 0% 100%)"
          : `hsl(${s.hue} 90% 60%)`;

        const style: CSSProperties = {
          left: s.x,
          top: s.y,
          width: s.size,
          height: s.size,
          background: bg,

          WebkitMaskImage: `url("data:image/svg+xml,${heartMask}")`,
          maskImage: `url("data:image/svg+xml,${heartMask}")`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",

          transform: `translate(-50%, -50%) rotate(${s.rotation}deg)`,

          boxShadow: isWhite
            ? "0 0 10px rgba(255,255,255,.9), 0 0 18px rgba(255,255,255,.6)"
            : `0 0 10px hsla(${s.hue} 90% 70% / .9),
               0 0 18px hsla(${s.hue} 90% 60% / .6)`,

          filter: `drop-shadow(0 0 6px ${
            isWhite
              ? "rgba(255,255,255,.8)"
              : `hsla(${s.hue} 90% 70% / .8)`
          })`,

          ["--dx" as any]: `${s.driftX}px`,
          ["--dy" as any]: `${s.driftY}px`,
          ["--dur" as any]: `${s.duration}ms`,
        };

        return (
          <span
            key={s.id}
            style={style}
            className="absolute will-change-transform animate-[heart-fall_var(--dur)_ease-out]"
          />
        );
      })}

      <style jsx global>{`
        @keyframes heart-fall {
          from {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          to {
            opacity: 0;
            transform: translate(
                calc(-50% + var(--dx)),
                calc(-50% + var(--dy))
              )
              scale(0.2);
          }
        }
      `}</style>
    </div>
  );
}
