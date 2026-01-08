import { cn } from "@/lib/utils";

interface QualityScoreProps {
  score: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function QualityScore({ score, showLabel = true, size = "md", className }: QualityScoreProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-bloom-understand";
    if (score >= 50) return "bg-bloom-analyze";
    return "bg-destructive";
  };

  const sizeClasses = {
    sm: "h-1.5 w-16",
    md: "h-2 w-24",
    lg: "h-2.5 w-32",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("quality-bar", sizeClasses[size])}>
        <div
          className={cn("quality-fill", getScoreColor(score))}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn(
          "font-mono font-medium",
          size === "sm" ? "text-[10px]" : size === "md" ? "text-xs" : "text-sm"
        )}>
          {score}
        </span>
      )}
    </div>
  );
}
