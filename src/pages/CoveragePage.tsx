import { AppLayout } from "@/components/layout/AppLayout";
import { CoverageHeatmap } from "@/components/coverage/CoverageHeatmap";
import { useQuestions, useCourseOutcomes, useSyllabi } from "@/hooks/useQuestions";
import { BloomLevel, BLOOM_LEVELS, BLOOM_LABELS } from "@/types/database";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

export default function CoveragePage() {
  const [selectedSyllabus, setSelectedSyllabus] = useState<string>("all");
  
  const { data: syllabi = [] } = useSyllabi();
  const { data: questions = [] } = useQuestions(
    selectedSyllabus !== "all" ? selectedSyllabus : undefined
  );
  const { data: courseOutcomes = [] } = useCourseOutcomes(
    selectedSyllabus !== "all" ? selectedSyllabus : undefined
  );

  // Prepare coverage data
  const coverageData = courseOutcomes.map((co) => {
    const coQuestions = questions.filter((q) => q.course_outcome_id === co.id);
    const counts: Record<BloomLevel, number> = {
      remember: 0,
      understand: 0,
      apply: 0,
      analyze: 0,
      evaluate: 0,
      create: 0,
    };
    coQuestions.forEach((q) => {
      counts[q.bloom_level]++;
    });
    return {
      unit: co.unit_number,
      coCode: co.code,
      counts,
    };
  });

  // Calculate totals
  const bloomTotals = BLOOM_LEVELS.reduce((acc, level) => {
    acc[level] = questions.filter((q) => q.bloom_level === level).length;
    return acc;
  }, {} as Record<BloomLevel, number>);

  const totalQuestions = questions.length;

  return (
    <AppLayout title="Coverage Map" description="Visualize question distribution across outcomes and cognitive levels">
      <div className="space-y-6">
        {/* Syllabus Filter */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Syllabus:</span>
          <Select value={selectedSyllabus} onValueChange={setSelectedSyllabus}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="All Syllabi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Syllabi</SelectItem>
              {syllabi.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bloom Distribution Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {BLOOM_LEVELS.map((level) => (
            <div key={level} className="bg-card rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full bloom-${level}`} />
                <span className="text-sm font-medium">{BLOOM_LABELS[level]}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{bloomTotals[level]}</span>
                <span className="text-xs text-muted-foreground">
                  {totalQuestions > 0
                    ? `${Math.round((bloomTotals[level] / totalQuestions) * 100)}%`
                    : "0%"}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Heatmap */}
        <div className="bg-card rounded-xl border p-6">
          <div className="mb-6">
            <h3 className="font-semibold">CO × Bloom's Taxonomy Matrix</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Each cell shows the number of questions for that course outcome at the specified cognitive level
            </p>
          </div>
          <CoverageHeatmap data={coverageData} />
        </div>

        {/* Course Outcomes List */}
        {courseOutcomes.length > 0 && (
          <div className="bg-card rounded-xl border p-6">
            <h3 className="font-semibold mb-4">Course Outcomes</h3>
            <div className="space-y-3">
              {courseOutcomes.map((co) => {
                const coQuestionCount = questions.filter(
                  (q) => q.course_outcome_id === co.id
                ).length;
                return (
                  <div
                    key={co.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-medium text-muted-foreground">
                        {co.code}
                      </span>
                      <span className="text-sm">{co.description}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {coQuestionCount} questions
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
