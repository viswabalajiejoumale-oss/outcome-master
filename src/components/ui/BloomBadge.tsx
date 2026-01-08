import { BloomLevel, BLOOM_LABELS } from "@/types/database";
import { cn } from "@/lib/utils";

interface BloomBadgeProps {
  level: BloomLevel;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function BloomBadge({ level, size = "md", showLabel = true, className }: BloomBadgeProps) {
  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2.5 py-0.5 text-xs",
    lg: "px-3 py-1 text-sm",
  };

  return (
    <span
      className={cn(
        "bloom-badge font-medium",
        `bloom-${level}`,
        sizeClasses[size],
        className
      )}
    >
      {showLabel ? BLOOM_LABELS[level] : level.charAt(0).toUpperCase()}
    </span>
  );
}
