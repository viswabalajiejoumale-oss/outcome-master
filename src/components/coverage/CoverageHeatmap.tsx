import { useMemo } from "react";
import { BloomLevel, BLOOM_LABELS, BLOOM_LEVELS } from "@/types/database";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CoverageData {
  unit: number;
  coCode: string;
  counts: Record<BloomLevel, number>;
}

interface CoverageHeatmapProps {
  data: CoverageData[];
  maxCount?: number;
}

export function CoverageHeatmap({ data, maxCount = 10 }: CoverageHeatmapProps) {
  const units = useMemo(() => {
    const unitSet = new Set(data.map((d) => d.unit));
    return Array.from(unitSet).sort((a, b) => a - b);
  }, [data]);

  const getHeatColor = (count: number, level: BloomLevel) => {
    if (count === 0) return "bg-muted";
    const intensity = Math.min(count / maxCount, 1);
    
    // Use bloom level colors with varying opacity
    const baseColors: Record<BloomLevel, string> = {
      remember: "bg-bloom-remember",
      understand: "bg-bloom-understand",
      apply: "bg-bloom-apply",
      analyze: "bg-bloom-analyze",
      evaluate: "bg-bloom-evaluate",
      create: "bg-bloom-create",
    };
    
    return cn(
      baseColors[level],
      intensity < 0.3 ? "opacity-30" : intensity < 0.6 ? "opacity-60" : "opacity-100"
    );
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No coverage data available. Generate questions to see the heatmap.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {/* Header */}
        <div className="flex gap-1 mb-2">
          <div className="w-20" />
          {BLOOM_LEVELS.map((level) => (
            <div
              key={level}
              className="w-14 text-center text-[10px] font-medium text-muted-foreground truncate"
            >
              {BLOOM_LABELS[level].slice(0, 3)}
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="space-y-1">
          {units.map((unit) => {
            const unitData = data.filter((d) => d.unit === unit);
            return (
              <div key={unit}>
                {unitData.map((row) => (
                  <div key={row.coCode} className="flex gap-1 items-center">
                    <div className="w-20 text-xs font-medium text-muted-foreground truncate pr-2">
                      {row.coCode}
                    </div>
                    {BLOOM_LEVELS.map((level) => (
                      <Tooltip key={level}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "heatmap-cell w-14 h-8 flex items-center justify-center cursor-pointer",
                              getHeatColor(row.counts[level] || 0, level)
                            )}
                          >
                            {(row.counts[level] || 0) > 0 && (
                              <span className="text-xs font-medium text-white drop-shadow-sm">
                                {row.counts[level]}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{row.coCode} - {BLOOM_LABELS[level]}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.counts[level] || 0} questions
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t">
          <span className="text-xs text-muted-foreground">Bloom Levels:</span>
          <div className="flex gap-2">
            {BLOOM_LEVELS.map((level) => (
              <div key={level} className="flex items-center gap-1">
                <div className={cn("w-3 h-3 rounded-sm", `bloom-${level}`)} />
                <span className="text-[10px] text-muted-foreground">
                  {BLOOM_LABELS[level]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
