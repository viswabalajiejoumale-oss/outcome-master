import { BookOpen, Trash2, Eye, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSyllabi, useQuestions } from "@/hooks/useQuestions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function SyllabiPage() {
  const { data: syllabi = [], isLoading } = useSyllabi();
  const { data: questions = [] } = useQuestions();
  const queryClient = useQueryClient();

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("syllabi").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Syllabus deleted" });
      queryClient.invalidateQueries({ queryKey: ["syllabi"] });
      queryClient.invalidateQueries({ queryKey: ["questions"] });
    }
  };

  const getQuestionCount = (syllabusId: string) => {
    return questions.filter((q) => q.syllabus_id === syllabusId).length;
  };

  return (
    <AppLayout title="Syllabi" description="Manage your uploaded syllabi">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button asChild>
            <Link to="/upload">
              <BookOpen className="w-4 h-4 mr-2" />
              Upload New
            </Link>
          </Button>
        </div>

        <div className="bg-card rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Title</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : syllabi.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No syllabi uploaded yet
                  </TableCell>
                </TableRow>
              ) : (
                syllabi.map((syllabus) => (
                  <TableRow key={syllabus.id}>
                    <TableCell className="font-medium">{syllabus.title}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {syllabus.file_name || "—"}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">{getQuestionCount(syllabus.id)}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(syllabus.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/questions?syllabus=${syllabus.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Questions
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(syllabus.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
