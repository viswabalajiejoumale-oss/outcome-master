import { QuestionStatus, STATUS_LABELS } from "@/types/database";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: QuestionStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "status-badge",
        `status-${status}`,
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
