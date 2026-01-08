import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BLOOM_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
const BLOOM_VERBS: Record<string, string[]> = {
  remember: ["define", "list", "recall", "identify", "name", "state"],
  understand: ["explain", "describe", "summarize", "interpret", "classify"],
  apply: ["apply", "demonstrate", "calculate", "solve", "use", "implement"],
  analyze: ["analyze", "compare", "contrast", "differentiate", "examine"],
  evaluate: ["evaluate", "justify", "critique", "assess", "judge", "defend"],
  create: ["create", "design", "develop", "construct", "propose", "formulate"],
};

interface CourseOutcome {
  code: string;
  description: string;
  unit: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { syllabusId, content, courseOutcomes } = await req.json();

    if (!syllabusId || !courseOutcomes || courseOutcomes.length === 0) {
      throw new Error("Missing required fields: syllabusId and courseOutcomes");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch course outcomes from DB
    const { data: dbCourseOutcomes, error: coError } = await supabase
      .from("course_outcomes")
      .select("*")
      .eq("syllabus_id", syllabusId);

    if (coError) throw coError;

    console.log(`Generating questions for ${dbCourseOutcomes.length} course outcomes`);

    const generatedQuestions: any[] = [];

    // Generate questions for each CO using MiMo-V2-Flash
    for (const co of dbCourseOutcomes) {
      const prompt = `You are an expert educator creating exam questions. Generate 5 questions for the following course outcome:

Course Outcome: ${co.code} - ${co.description}

Syllabus Context:
${content || "General knowledge in the subject area"}

Requirements:
1. Create exactly 5 questions, one for each Bloom's Taxonomy level from "remember" to "create" (skip one level)
2. Each question should directly assess the course outcome
3. Include appropriate marks (2-10 based on complexity)
4. Use action verbs appropriate to each cognitive level

Bloom's Taxonomy Levels and Verbs:
- remember: ${BLOOM_VERBS.remember.join(", ")}
- understand: ${BLOOM_VERBS.understand.join(", ")}
- apply: ${BLOOM_VERBS.apply.join(", ")}
- analyze: ${BLOOM_VERBS.analyze.join(", ")}
- evaluate: ${BLOOM_VERBS.evaluate.join(", ")}
- create: ${BLOOM_VERBS.create.join(", ")}

Respond ONLY with a JSON array of questions in this exact format:
[
  {
    "question_text": "The complete question text",
    "bloom_level": "remember|understand|apply|analyze|evaluate|create",
    "marks": 2-10,
    "source_context": "Brief context from syllabus this relates to"
  }
]`;

      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": SUPABASE_URL,
          },
          body: JSON.stringify({
            model: "xiaomi/mimo-v2-flash",
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Generator API error: ${response.status} - ${errorText}`);
          continue;
        }

        const data = await response.json();
        const responseContent = data.choices?.[0]?.message?.content || "";

        // Parse JSON from response
        const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const questions = JSON.parse(jsonMatch[0]);
          for (const q of questions) {
            generatedQuestions.push({
              syllabus_id: syllabusId,
              course_outcome_id: co.id,
              question_text: q.question_text,
              bloom_level: q.bloom_level,
              marks: q.marks || 5,
              source_paragraph: q.source_context || null,
              quality_score: 0,
              status: "draft",
            });
          }
        }
      } catch (err) {
        console.error(`Error generating for ${co.code}:`, err);
      }
    }

    console.log(`Generated ${generatedQuestions.length} questions total`);

    // Insert questions into database
    if (generatedQuestions.length > 0) {
      const { data: insertedQuestions, error: insertError } = await supabase
        .from("questions")
        .insert(generatedQuestions)
        .select();

      if (insertError) throw insertError;

      // Now audit each question using Gemini 2.5 Flash
      console.log("Starting audit process...");

      for (const question of insertedQuestions || []) {
        try {
          const auditPrompt = `You are an expert educational quality assessor. Evaluate this exam question for quality and alignment.

Question: "${question.question_text}"
Assigned Bloom Level: ${question.bloom_level}
Assigned Marks: ${question.marks}

Evaluate based on:
1. Does the question text use appropriate action verbs for the ${question.bloom_level} level?
2. Is the cognitive complexity appropriate for the assigned Bloom level?
3. Is the mark allocation reasonable for the question's complexity?
4. Is the question clear, unambiguous, and well-structured?

Respond ONLY with a JSON object:
{
  "quality_score": 0-100,
  "feedback": "Brief constructive feedback",
  "verb_alignment": true/false,
  "level_appropriate": true/false
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
              max_tokens: 500,
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
                .eq("id", question.id);
            }
          }
        } catch (auditErr) {
          console.error(`Audit error for question ${question.id}:`, auditErr);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        questionsGenerated: generatedQuestions.length,
        message: `Generated and audited ${generatedQuestions.length} questions`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Generate questions error:", error);
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
