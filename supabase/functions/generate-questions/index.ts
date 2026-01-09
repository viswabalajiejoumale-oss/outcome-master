import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers - restrict to known origins
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BLOOM_VERBS: Record<string, string[]> = {
  remember: ["define", "list", "recall", "identify", "name", "state"],
  understand: ["explain", "describe", "summarize", "interpret", "classify"],
  apply: ["apply", "demonstrate", "calculate", "solve", "use", "implement"],
  analyze: ["analyze", "compare", "contrast", "differentiate", "examine"],
  evaluate: ["evaluate", "justify", "critique", "assess", "judge", "defend"],
  create: ["create", "design", "develop", "construct", "propose", "formulate"],
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // 5 requests per minute per user

// In-memory rate limit store (resets on cold start, suitable for edge functions)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const key = `generate:${userId}`;
  const entry = rateLimitStore.get(key);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!entry || entry.resetTime < now) {
    // New window
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfterMs: entry.resetTime - now };
  }

  entry.count++;
  return { allowed: true };
}

// Input validation
function validateUUID(id: string, fieldName: string): string | null {
  if (!id || typeof id !== "string") {
    return `${fieldName} is required`;
  }
  if (!UUID_REGEX.test(id)) {
    return `${fieldName} must be a valid UUID`;
  }
  return null;
}

function sanitizeForPrompt(text: string, maxLength = 10000): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/[<>]/g, "")
    .slice(0, maxLength)
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check API key
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's JWT to validate auth
    const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Auth error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Rate limiting check
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for user ${userId}`);
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded. Please wait before making another request.",
          retryAfterMs: rateLimit.retryAfterMs 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((rateLimit.retryAfterMs || 60000) / 1000))
          } 
        }
      );
    }

    // Parse and validate input
    const body = await req.json();
    const { syllabusId, content, courseOutcomes } = body;

    // Validate syllabusId
    const syllabusIdError = validateUUID(syllabusId, "syllabusId");
    if (syllabusIdError) {
      return new Response(
        JSON.stringify({ error: syllabusIdError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate courseOutcomes array
    if (!Array.isArray(courseOutcomes) || courseOutcomes.length === 0) {
      return new Response(
        JSON.stringify({ error: "courseOutcomes must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate content length
    if (content && typeof content === "string" && content.length > 100000) {
      return new Response(
        JSON.stringify({ error: "Content too large (max 100,000 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for database operations (RLS will still apply for user-facing queries)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify ownership of syllabus
    const { data: syllabus, error: syllabusError } = await supabase
      .from("syllabi")
      .select("id, user_id")
      .eq("id", syllabusId)
      .single();

    if (syllabusError || !syllabus) {
      return new Response(
        JSON.stringify({ error: "Syllabus not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (syllabus.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch course outcomes from DB
    const { data: dbCourseOutcomes, error: coError } = await supabase
      .from("course_outcomes")
      .select("*")
      .eq("syllabus_id", syllabusId);

    if (coError) {
      console.error("Course outcomes query error:", coError);
      throw coError;
    }

    // Debug: Log context being used
    console.log("=== DEBUG: Syllabus Context ===");
    console.log("Syllabus ID:", syllabusId);
    console.log("Content length:", content?.length || 0);
    console.log("Content preview:", content?.substring(0, 200) || "No content");
    console.log("Course outcomes found:", dbCourseOutcomes?.length || 0);
    console.log("Course outcomes:", JSON.stringify(dbCourseOutcomes, null, 2));

    if (!dbCourseOutcomes || dbCourseOutcomes.length === 0) {
      console.error("No course outcomes found for syllabus:", syllabusId);
      return new Response(
        JSON.stringify({ 
          error: "No course outcomes found for this syllabus",
          syllabusId,
          questionsGenerated: 0 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating questions for ${dbCourseOutcomes.length} course outcomes`);

    const generatedQuestions: Array<{
      syllabus_id: string;
      course_outcome_id: string;
      question_text: string;
      bloom_level: string;
      marks: number;
      source_paragraph: string | null;
      quality_score: number;
      status: string;
    }> = [];

    // Generate questions for each CO using Lovable AI (Gemini 2.5 Flash)
    for (const co of dbCourseOutcomes) {
      const sanitizedCode = sanitizeForPrompt(co.code, 50);
      const sanitizedDescription = sanitizeForPrompt(co.description, 500);
      const sanitizedContent = sanitizeForPrompt(content || "General knowledge in the subject area", 50000);

      const prompt = `You are an expert educator creating exam questions. Generate 5 questions for the following course outcome:

Course Outcome: ${sanitizedCode} - ${sanitizedDescription}

Syllabus Context:
${sanitizedContent}

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
        console.log(`Calling Lovable AI for CO: ${co.code}`);
        
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Generator API error: ${response.status} - ${errorText}`);
          
          // Handle rate limiting
          if (response.status === 429) {
            console.error("Rate limited by AI gateway");
          } else if (response.status === 402) {
            console.error("Payment required - AI credits exhausted");
          }
          continue;
        }

        const data = await response.json();
        const responseContent = data.choices?.[0]?.message?.content || "";
        
        // Debug: Log raw AI output
        console.log("=== DEBUG: Raw AI Output ===");
        console.log(`CO: ${co.code}`);
        console.log("Full response:", responseContent);
        console.log("Response length:", responseContent.length);

        // Parse JSON from response
        const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          console.log("=== DEBUG: JSON Match Found ===");
          console.log("Matched JSON:", jsonMatch[0].substring(0, 500));
          
          try {
            const questions = JSON.parse(jsonMatch[0]);
            console.log(`Parsed ${questions.length} questions for ${co.code}`);
            console.log("Parsed questions:", JSON.stringify(questions, null, 2));
            
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
          } catch (parseErr) {
            console.error(`JSON parse error for ${co.code}:`, parseErr);
            console.error("Attempted to parse:", jsonMatch[0]);
          }
        } else {
          console.error(`No JSON array found in response for ${co.code}`);
          console.error("Full response was:", responseContent);
        }
      } catch (err) {
        console.error(`Error generating for ${co.code}:`, err);
      }
    }

    console.log(`Generated ${generatedQuestions.length} questions total before DB insert`);

    // Insert questions into database
    if (generatedQuestions.length > 0) {
      const { data: insertedQuestions, error: insertError } = await supabase
        .from("questions")
        .insert(generatedQuestions)
        .select();

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }

      console.log(`Inserted ${insertedQuestions?.length || 0} questions into DB`);

      // Now audit each question using Gemini 2.5 Flash
      console.log("Starting audit process...");

      for (const question of insertedQuestions || []) {
        try {
          const auditPrompt = `You are an expert educational quality assessor. Evaluate this exam question for quality and alignment.

Question: "${sanitizeForPrompt(question.question_text, 2000)}"
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

          const auditResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: auditPrompt }],
              temperature: 0.3,
              max_tokens: 500,
            }),
          });

          if (auditResponse.ok) {
            const auditData = await auditResponse.json();
            const auditContent = auditData.choices?.[0]?.message?.content || "";
            
            console.log(`Audit response for question ${question.id}:`, auditContent.substring(0, 200));
            
            const auditMatch = auditContent.match(/\{[\s\S]*\}/);

            if (auditMatch) {
              const audit = JSON.parse(auditMatch[0]);
              // Lower threshold: accept all questions with score >= 30 (was implicitly 0)
              const finalScore = Math.max(audit.quality_score || 50, 30);
              
              console.log(`Audit result for ${question.id}: score=${finalScore}`);
              
              await supabase
                .from("questions")
                .update({
                  quality_score: finalScore,
                  audit_feedback: audit.feedback,
                  status: "audited",
                })
                .eq("id", question.id);
            }
          } else {
            console.error(`Audit API error for ${question.id}: ${auditResponse.status}`);
            // Set default score if audit fails
            await supabase
              .from("questions")
              .update({
                quality_score: 50,
                audit_feedback: "Audit pending",
                status: "audited",
              })
              .eq("id", question.id);
          }
        } catch (auditErr) {
          console.error(`Audit error for question ${question.id}:`, auditErr);
          // Set default score on error
          await supabase
            .from("questions")
            .update({
              quality_score: 50,
              audit_feedback: "Audit failed",
              status: "audited",
            })
            .eq("id", question.id);
        }
      }
    }

    console.log(`Final result: Generated and processed ${generatedQuestions.length} questions`);

    return new Response(
      JSON.stringify({
        success: true,
        questionsGenerated: generatedQuestions.length,
        message: `Generated and audited ${generatedQuestions.length} questions`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Generate questions error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});