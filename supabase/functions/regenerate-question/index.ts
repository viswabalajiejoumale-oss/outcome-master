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
const MAX_REQUESTS_PER_WINDOW = 10; // 10 regenerations per minute per user

// In-memory rate limit store (resets on cold start, suitable for edge functions)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const key = `regenerate:${userId}`;
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
    const { questionId } = body;

    // Validate questionId
    const questionIdError = validateUUID(questionId, "questionId");
    if (questionIdError) {
      return new Response(
        JSON.stringify({ error: questionIdError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the existing question with its course outcome and syllabus
    const { data: question, error: qError } = await supabase
      .from("questions")
      .select(`
        *,
        course_outcome:course_outcomes(*),
        syllabus:syllabi(*)
      `)
      .eq("id", questionId)
      .single();

    if (qError || !question) {
      return new Response(
        JSON.stringify({ error: "Question not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership via syllabus
    if (question.syllabus?.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const co = question.course_outcome;

    // Generate a new question using Lovable AI (Gemini 2.5 Flash)
    const sanitizedCoCode = sanitizeForPrompt(co?.code || "CO", 50);
    const sanitizedCoDescription = sanitizeForPrompt(co?.description || "General topic", 500);
    const sanitizedQuestionText = sanitizeForPrompt(question.question_text, 2000);

    const prompt = `You are an expert educator. Generate a NEW, DIFFERENT question for:

Course Outcome: ${sanitizedCoCode} - ${sanitizedCoDescription}
Target Bloom Level: ${question.bloom_level}
Previous Question (create something different): "${sanitizedQuestionText}"

Requirements:
1. Create a completely different question at the ${question.bloom_level} level
2. Use appropriate action verbs: ${BLOOM_VERBS[question.bloom_level]?.join(", ") || "appropriate verbs"}
3. Keep similar mark allocation: ${question.marks} marks

Respond ONLY with a JSON object:
{
  "question_text": "The new question text",
  "marks": ${question.marks},
  "source_context": "Brief context"
}`;

    console.log(`Regenerating question ${questionId} for CO: ${sanitizedCoCode}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Generator API error: ${response.status} - ${errorText}`);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited by AI service. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to generate question" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const responseContent = data.choices?.[0]?.message?.content || "";
    
    // Log raw response for debugging
    console.log(`Raw regenerate response:`, responseContent.substring(0, 300));
    
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error("No JSON found in regenerate response");
      return new Response(
        JSON.stringify({ error: "Failed to parse generated question" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newQuestion = JSON.parse(jsonMatch[0]);
    console.log(`Parsed new question:`, newQuestion.question_text?.substring(0, 100));

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
Question: "${sanitizeForPrompt(newQuestion.question_text, 2000)}"
Bloom Level: ${question.bloom_level}
Marks: ${newQuestion.marks || question.marks}

Respond with JSON:
{
  "quality_score": 0-100,
  "feedback": "Brief feedback"
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
        max_tokens: 300,
      }),
    });

    if (auditResponse.ok) {
      const auditData = await auditResponse.json();
      const auditContent = auditData.choices?.[0]?.message?.content || "";
      
      console.log(`Audit response:`, auditContent.substring(0, 200));
      
      const auditMatch = auditContent.match(/\{[\s\S]*\}/);

      if (auditMatch) {
        const audit = JSON.parse(auditMatch[0]);
        const finalScore = Math.max(audit.quality_score || 50, 30);
        
        await supabase
          .from("questions")
          .update({
            quality_score: finalScore,
            audit_feedback: audit.feedback,
            status: "audited",
          })
          .eq("id", questionId);
          
        console.log(`Question ${questionId} audited with score ${finalScore}`);
      }
    } else {
      console.error(`Audit failed: ${auditResponse.status}`);
      // Set default score if audit fails
      await supabase
        .from("questions")
        .update({
          quality_score: 50,
          audit_feedback: "Audit pending",
          status: "audited",
        })
        .eq("id", questionId);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Question regenerated" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Regenerate error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});