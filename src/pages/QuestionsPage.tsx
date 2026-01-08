import { useState } from "react";
import { Filter, Download, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { QuestionTable } from "@/components/questions/QuestionTable";
import { BloomBadge } from "@/components/ui/BloomBadge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuestions, useSyllabi, useDeleteQuestion, useUpdateQuestionStatus } from "@/hooks/useQuestions";
import { BloomLevel, BLOOM_LEVELS, BLOOM_LABELS, QuestionStatus } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function QuestionsPage() {
  const [selectedSyllabus, setSelectedSyllabus] = useState<string>("all");
  const [selectedBloom, setSelectedBloom] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { data: syllabi = [] } = useSyllabi();
  const { data: questions = [], isLoading, refetch } = useQuestions(
    selectedSyllabus !== "all" ? selectedSyllabus : undefined
  );
  const deleteQuestion = useDeleteQuestion();
  const updateStatus = useUpdateQuestionStatus();

  // Filter questions
  const filteredQuestions = questions.filter((q) => {
    if (selectedBloom !== "all" && q.bloom_level !== selectedBloom) return false;
    if (selectedStatus !== "all" && q.status !== selectedStatus) return false;
    return true;
  });

  const handleRegenerate = async (questionId: string) => {
    setIsRegenerating(true);
    try {
      const question = questions.find((q) => q.id === questionId);
      if (!question) return;

      const { error } = await supabase.functions.invoke("regenerate-question", {
        body: { questionId },
      });

      if (error) throw error;

      toast({ title: "Question regenerated" });
      refetch();
    } catch (error: any) {
      toast({
        title: "Regeneration failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <AppLayout title="Question Bank" description="Manage and review generated questions">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>

          <Select value={selectedSyllabus} onValueChange={setSelectedSyllabus}>
            <SelectTrigger className="w-[200px]">
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

          <Select value={selectedBloom} onValueChange={setSelectedBloom}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {BLOOM_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {BLOOM_LABELS[level]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="audited">Audited</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Bloom Level Summary */}
        <div className="flex flex-wrap gap-2">
          {BLOOM_LEVELS.map((level) => {
            const count = questions.filter((q) => q.bloom_level === level).length;
            return (
              <button
                key={level}
                onClick={() => setSelectedBloom(selectedBloom === level ? "all" : level)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                  selectedBloom === level
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-accent"
                }`}
              >
                <BloomBadge level={level} size="sm" />
                <span className="text-sm font-medium">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Questions Table */}
        <div className="bg-card rounded-xl border">
          <QuestionTable
            questions={filteredQuestions}
            isLoading={isLoading || isRegenerating}
            onRegenerate={handleRegenerate}
            onDelete={(id) => deleteQuestion.mutate(id)}
            onApprove={(id) => updateStatus.mutate({ questionId: id, status: "approved" })}
            onReject={(id) => updateStatus.mutate({ questionId: id, status: "rejected" })}
          />
        </div>

        {/* Stats */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredQuestions.length} of {questions.length} questions
        </div>
      </div>
    </AppLayout>
  );
}
