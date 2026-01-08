import { useState } from "react";
import { MoreHorizontal, RefreshCw, Trash2, Eye, CheckCircle, XCircle } from "lucide-react";
import { Question, BLOOM_LABELS } from "@/types/database";
import { BloomBadge } from "@/components/ui/BloomBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { QualityScore } from "@/components/ui/QualityScore";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuestionTableProps {
  questions: Question[];
  isLoading?: boolean;
  onRegenerate?: (questionId: string) => void;
  onDelete?: (questionId: string) => void;
  onApprove?: (questionId: string) => void;
  onReject?: (questionId: string) => void;
}

export function QuestionTable({
  questions,
  isLoading,
  onRegenerate,
  onDelete,
  onApprove,
  onReject,
}: QuestionTableProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading questions...</span>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <p className="text-sm">No questions yet</p>
        <p className="text-xs mt-1">Upload a syllabus to generate questions</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40%]">Question</TableHead>
              <TableHead className="w-[10%]">CO</TableHead>
              <TableHead className="w-[12%]">Bloom Level</TableHead>
              <TableHead className="w-[8%]">Marks</TableHead>
              <TableHead className="w-[12%]">Quality</TableHead>
              <TableHead className="w-[10%]">Status</TableHead>
              <TableHead className="w-[8%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((question) => (
              <TableRow key={question.id} className="animate-fade-in">
                <TableCell>
                  <p className="text-sm line-clamp-2">{question.question_text}</p>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-mono text-muted-foreground">
                    {question.course_outcome?.code || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <BloomBadge level={question.bloom_level} size="sm" />
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{question.marks}</span>
                </TableCell>
                <TableCell>
                  <QualityScore score={question.quality_score} size="sm" />
                </TableCell>
                <TableCell>
                  <StatusBadge status={question.status} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedQuestion(question)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      {onRegenerate && (
                        <DropdownMenuItem onClick={() => onRegenerate(question.id)}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Regenerate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {onApprove && question.status !== "approved" && (
                        <DropdownMenuItem onClick={() => onApprove(question.id)}>
                          <CheckCircle className="w-4 h-4 mr-2 text-bloom-understand" />
                          Approve
                        </DropdownMenuItem>
                      )}
                      {onReject && question.status !== "rejected" && (
                        <DropdownMenuItem onClick={() => onReject(question.id)}>
                          <XCircle className="w-4 h-4 mr-2 text-destructive" />
                          Reject
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={() => onDelete(question.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Question Detail Dialog */}
      <Dialog open={!!selectedQuestion} onOpenChange={() => setSelectedQuestion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Question Details</DialogTitle>
          </DialogHeader>
          {selectedQuestion && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Question</h4>
                <p className="text-sm">{selectedQuestion.question_text}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Bloom Level</h4>
                  <BloomBadge level={selectedQuestion.bloom_level} />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Status</h4>
                  <StatusBadge status={selectedQuestion.status} />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Marks</h4>
                  <span className="font-mono">{selectedQuestion.marks}</span>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Quality Score</h4>
                  <QualityScore score={selectedQuestion.quality_score} />
                </div>
              </div>
              {selectedQuestion.source_paragraph && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Source Paragraph</h4>
                  <p className="text-sm bg-muted p-3 rounded-lg text-muted-foreground">
                    {selectedQuestion.source_paragraph}
                  </p>
                </div>
              )}
              {selectedQuestion.audit_feedback && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Audit Feedback</h4>
                  <p className="text-sm bg-bloom-evaluate-bg p-3 rounded-lg">
                    {selectedQuestion.audit_feedback}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
