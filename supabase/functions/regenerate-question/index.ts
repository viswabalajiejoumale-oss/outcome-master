import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BLOOM_VERBS: Record<string, string[]> = {
  remember: ["define", "list", "recall", "identify", "name", "state"],
  understand: ["explain", "describe", "summarize", "interpret", "classify"],
  apply: ["apply", "demonstrate", "calculate", "solve", "use", "implement"],
  analyze: ["analyze", "compare", "contrast", "differentiate", "examine"],
  evaluate: ["evaluate", "justify", "critique", "assess", "judge", "defend"],
  create: ["create", "design", "develop", "construct", "propose", "formulate"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { questionId } = await req.json();

    if (!questionId) {
      throw new Error("Missing questionId");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the existing question with its course outcome
    const { data: question, error: qError } = await supabase
      .from("questions")
      .select(`
        *,
        course_outcome:course_outcomes(*),
        syllabus:syllabi(*)
      `)
      .eq("id", questionId)
      .single();

    if (qError || !question) throw qError || new Error("Question not found");

    const co = question.course_outcome;
    const syllabus = question.syllabus;

    // Generate a new question using MiMo-V2-Flash
    const prompt = `You are an expert educator. Generate a NEW, DIFFERENT question for:

Course Outcome: ${co?.code || "CO"} - ${co?.description || "General topic"}
Target Bloom Level: ${question.bloom_level}
Previous Question (create something different): "${question.question_text}"

Requirements:
1. Create a completely different question at the ${question.bloom_level} level
2. Use appropriate action verbs: ${BLOOM_VERBS[question.bloom_level]?.join(", ")}
3. Keep similar mark allocation: ${question.marks} marks

Respond ONLY with a JSON object:
{
  "question_text": "The new question text",
  "marks": ${question.marks},
  "source_context": "Brief context"
}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": SUPABASE_URL,
      },
      body: JSON.stringify({
        model: "xiaomi/mimo-v2-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`Generator API error: ${response.status}`);
    }

    const data = await response.json();
    const responseContent = data.choices?.[0]?.message?.content || "";
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Failed to parse generated question");
    }

    const newQuestion = JSON.parse(jsonMatch[0]);

    // Update the question
    const { error: updateError } = await supabase
      .from("questions")
      .update({
        question_text: newQuestion.question_text,
        marks: newQuestion.marks || question.marks,
        source_paragraph: newQuestion.source_context,
        quality_score: 0,
        audit_feedback: null,
        status: "draft",
      })
      .eq("id", questionId);

    if (updateError) throw updateError;

    // Now audit the new question
    const auditPrompt = `Evaluate this exam question:
Question: "${newQuestion.question_text}"
Bloom Level: ${question.bloom_level}
Marks: ${newQuestion.marks || question.marks}

Respond with JSON:
{
  "quality_score": 0-100,
  "feedback": "Brief feedback"
}`;

    const auditResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": SUPABASE_URL,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-preview",
        messages: [{ role: "user", content: auditPrompt }],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (auditResponse.ok) {
      const auditData = await auditResponse.json();
      const auditContent = auditData.choices?.[0]?.message?.content || "";
      const auditMatch = auditContent.match(/\{[\s\S]*\}/);

      if (auditMatch) {
        const audit = JSON.parse(auditMatch[0]);
        await supabase
          .from("questions")
          .update({
            quality_score: audit.quality_score || 50,
            audit_feedback: audit.feedback,
            status: "audited",
          })
          .eq("id", questionId);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Question regenerated" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Regenerate error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
