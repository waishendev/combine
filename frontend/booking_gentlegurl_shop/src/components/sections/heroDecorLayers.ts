/**
 * Decorative “scribble” layers behind the booking hero copy.
 * Replace files under `public/images/sliders_design/` to customize artwork.
 *
 * 每个图层用 `mergeHeroDecor({ pc, phone, ipad })` 写三段，方便微调：
 * ① `pc`    — 电脑：建议用 `sm:` / `lg:` 等（当前项目里宽 hero 从 `sm:` 起）
 * ② `phone` — 电话：无前缀，只影响默认小屏
 * ③ `ipad`  — iPad（可选）：建议用 `md:`；不需要就传 `""` 或省略
 *
 * 合并顺序为 phone → ipad → pc（与 Tailwind 移动优先一致，只是书写顺序按你习惯来）。
 */
export type HeroDecorLayer = { src: string; className: string };

type HeroDecorBreakpoints = {
  /** ① 电脑 */
  pc: string;
  /** ② 电话（小屏默认） */
  phone: string;
  /** ③ iPad（可选） */
  ipad?: string;
};

function mergeHeroDecor({ pc, phone, ipad = "" }: HeroDecorBreakpoints): string {
  return [phone.trim(), ipad.trim(), pc.trim()].filter(Boolean).join(" ");
}

export const HERO_DECOR_LAYERS: HeroDecorLayer[] = [
  {
    src: "/images/sliders_design/6.png",
    className: mergeHeroDecor({
      pc: "sm:left-[-21%] sm:top-[-32%] sm:w-[30%] sm:max-w-[175px] sm:rotate-6",
      phone: "left-[2%] top-[-40%] w-[36%] max-w-[200px] rotate-3 opacity-50",
      ipad: "",
    }),
  },
  {
    src: "/images/sliders_design/7.webp",
    className: mergeHeroDecor({
      pc: "sm:left-[-28%] sm:top-[10%] sm:w-[28%] sm:max-w-[165px] sm:-rotate-12",
      phone: "left-[-5%] top-[0%] w-[36%] max-w-[200px] -rotate-20 opacity-50",
      ipad: "",
    }),
  },
  {
    src: "/images/sliders_design/5.png",
    className: mergeHeroDecor({
      pc: "sm:left-[-30%] sm:bottom-[-18%] sm:max-w-[132px] sm:w-[24%]",
      phone: "left-[5%] bottom-[-8%] w-[28%] max-w-[80px] opacity-50",
      ipad: "",
    }),
  },
  {
    src: "/images/sliders_design/3.webp",
    className: mergeHeroDecor({
      pc: "sm:left-[-25%] sm:bottom-[-40%] sm:max-w-[130px] sm:w-[24%]",
      phone: "bottom-[-30%] w-[28%] max-w-[100px] opacity-50",
      ipad: "",
    }),
  },
  {
    src: "/images/sliders_design/2.webp",
    className: mergeHeroDecor({
      pc: "sm:left-[12%] sm:top-[21%] sm:max-w-[105px] sm:w-[22%]",
      phone: "left-[10%] top-[23%] w-[40%] max-w-[80px] opacity-50",
      ipad: "",
    }),
  },
  {
    src: "/images/sliders_design/8.webp",
    className: mergeHeroDecor({
      pc: "sm:right-[-30%] sm:top-[-30%] sm:max-w-[185px] sm:w-[30%] sm:rotate-6",
      phone: "right-[-12%] top-[-30%] w-[36%] max-w-[200px] rotate-3 opacity-50",
      ipad: "",
    }),
  },
  {
    src: "/images/sliders_design/4.webp",
    className: mergeHeroDecor({
      pc: "sm:right-[-37%] sm:bottom-[0%] sm:max-w-[135px] sm:w-[24%] sm:-rotate-10",
      phone: "right-[0%] bottom-[-1%] w-[28%] max-w-[80px] opacity-50 -rotate-10",
      ipad: "",
    }),
  },
  {
    src: "/images/sliders_design/1.webp",
    className: mergeHeroDecor({
      pc: "sm:right-[-30%] sm:bottom-[-60%] sm:max-w-[135px] sm:w-[24%] sm:rotate-55",
      phone: "right-[8%] bottom-[-40%] w-[28%] max-w-[80px] opacity-50 rotate-55",
      ipad: "",
    }),
  },
];
