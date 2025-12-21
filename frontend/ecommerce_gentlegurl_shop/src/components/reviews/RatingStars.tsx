type RatingStarsProps = {
  value: number;
  size?: "sm" | "md";
};

export function RatingStars({ value, size = "md" }: RatingStarsProps) {
  const clamped = Math.max(0, Math.min(5, value));
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="flex items-center gap-1 text-amber-500" aria-label={`${clamped} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const isActive = index < Math.round(clamped);
        return (
          <svg
            key={index}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={isActive ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.5}
            className={iconSize}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.57a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.987 20.507a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.57a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
            />
          </svg>
        );
      })}
    </div>
  );
}
