import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Question, QuestionStatus } from "@/types/database";
import { toast } from "@/hooks/use-toast";

export function useQuestions(syllabusId?: string) {
  return useQuery({
    queryKey: ["questions", syllabusId],
    queryFn: async () => {
      let query = supabase
        .from("questions")
        .select(`
          *,
          course_outcome:course_outcomes(*)
        `)
        .order("created_at", { ascending: false });

      if (syllabusId) {
        query = query.eq("syllabus_id", syllabusId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Question[];
    },
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (questionId: string) => {
      const { error } = await supabase
        .from("questions")
        .delete()
        .eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      toast({ title: "Question deleted" });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to delete question", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

export function useUpdateQuestionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, status }: { questionId: string; status: QuestionStatus }) => {
      const { error } = await supabase
        .from("questions")
        .update({ status })
        .eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
      toast({ title: `Question ${status}` });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to update status", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });
}

export function useSyllabi() {
  return useQuery({
    queryKey: ["syllabi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("syllabi")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCourseOutcomes(syllabusId?: string) {
  return useQuery({
    queryKey: ["course_outcomes", syllabusId],
    queryFn: async () => {
      let query = supabase
        .from("course_outcomes")
        .select("*")
        .order("unit_number", { ascending: true });

      if (syllabusId) {
        query = query.eq("syllabus_id", syllabusId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!syllabusId || syllabusId === undefined,
  });
}
