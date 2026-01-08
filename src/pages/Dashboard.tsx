import { HelpCircle, BookOpen, CheckCircle, AlertTriangle, Upload, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { CoverageHeatmap } from "@/components/coverage/CoverageHeatmap";
import { QuestionTable } from "@/components/questions/QuestionTable";
import { Button } from "@/components/ui/button";
import { useQuestions, useSyllabi, useCourseOutcomes, useDeleteQuestion, useUpdateQuestionStatus } from "@/hooks/useQuestions";
import { BloomLevel, BLOOM_LEVELS } from "@/types/database";

export default function Dashboard() {
  const { data: questions = [], isLoading: questionsLoading } = useQuestions();
  const { data: syllabi = [] } = useSyllabi();
  const { data: courseOutcomes = [] } = useCourseOutcomes();
  const deleteQuestion = useDeleteQuestion();
  const updateStatus = useUpdateQuestionStatus();

  // Calculate stats
  const totalQuestions = questions.length;
  const approvedQuestions = questions.filter((q) => q.status === "approved").length;
  const avgQualityScore = questions.length > 0
    ? Math.round(questions.reduce((acc, q) => acc + q.quality_score, 0) / questions.length)
    : 0;
  const lowQualityCount = questions.filter((q) => q.quality_score < 50).length;

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

  // Get recent questions
  const recentQuestions = questions.slice(0, 5);

  return (
    <AppLayout title="Dashboard" description="Overview of your question bank">
      {syllabi.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Get Started</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Upload your first syllabus to generate outcome-aligned questions using AI
          </p>
          <Button asChild>
            <Link to="/upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload Syllabus
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Questions"
              value={totalQuestions}
              icon={<HelpCircle className="w-5 h-5 text-muted-foreground" />}
              description="Across all syllabi"
            />
            <StatsCard
              title="Syllabi Uploaded"
              value={syllabi.length}
              icon={<BookOpen className="w-5 h-5 text-muted-foreground" />}
            />
            <StatsCard
              title="Approved"
              value={approvedQuestions}
              icon={<CheckCircle className="w-5 h-5 text-bloom-understand" />}
              description={`${totalQuestions > 0 ? Math.round((approvedQuestions / totalQuestions) * 100) : 0}% of total`}
            />
            <StatsCard
              title="Avg Quality Score"
              value={avgQualityScore}
              icon={<AlertTriangle className={`w-5 h-5 ${avgQualityScore >= 70 ? 'text-bloom-understand' : 'text-bloom-analyze'}`} />}
              description={lowQualityCount > 0 ? `${lowQualityCount} need attention` : "All looking good"}
            />
          </div>

          {/* Coverage Heatmap */}
          <div className="bg-card rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">CO × Bloom Coverage</h3>
                <p className="text-xs text-muted-foreground">
                  Question distribution across outcomes and cognitive levels
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/coverage">
                  View Full Map
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            </div>
            <CoverageHeatmap data={coverageData} />
          </div>

          {/* Recent Questions */}
          <div className="bg-card rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Recent Questions</h3>
                <p className="text-xs text-muted-foreground">
                  Latest generated and audited questions
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/questions">
                  View All
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            </div>
            <QuestionTable
              questions={recentQuestions}
              isLoading={questionsLoading}
              onDelete={(id) => deleteQuestion.mutate(id)}
              onApprove={(id) => updateStatus.mutate({ questionId: id, status: "approved" })}
              onReject={(id) => updateStatus.mutate({ questionId: id, status: "rejected" })}
            />
          </div>
        </div>
      )}
    </AppLayout>
  );
}
