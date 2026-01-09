-- Add user_id column to syllabi table for ownership tracking
ALTER TABLE public.syllabi ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop all existing overly permissive policies on syllabi
DROP POLICY IF EXISTS "Public delete access for syllabi" ON public.syllabi;
DROP POLICY IF EXISTS "Public insert access for syllabi" ON public.syllabi;
DROP POLICY IF EXISTS "Public read access for syllabi" ON public.syllabi;
DROP POLICY IF EXISTS "Public update access for syllabi" ON public.syllabi;

-- Drop all existing overly permissive policies on course_outcomes
DROP POLICY IF EXISTS "Public delete access for course_outcomes" ON public.course_outcomes;
DROP POLICY IF EXISTS "Public insert access for course_outcomes" ON public.course_outcomes;
DROP POLICY IF EXISTS "Public read access for course_outcomes" ON public.course_outcomes;
DROP POLICY IF EXISTS "Public update access for course_outcomes" ON public.course_outcomes;

-- Drop all existing overly permissive policies on questions
DROP POLICY IF EXISTS "Public delete access for questions" ON public.questions;
DROP POLICY IF EXISTS "Public insert access for questions" ON public.questions;
DROP POLICY IF EXISTS "Public read access for questions" ON public.questions;
DROP POLICY IF EXISTS "Public update access for questions" ON public.questions;

-- Create helper function to check syllabus ownership (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.owns_syllabus(_user_id uuid, _syllabus_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.syllabi
    WHERE id = _syllabus_id
      AND user_id = _user_id
  )
$$;

-- Create user-scoped RLS policies for syllabi
CREATE POLICY "Users can view own syllabi" ON public.syllabi
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own syllabi" ON public.syllabi
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own syllabi" ON public.syllabi
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own syllabi" ON public.syllabi
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create user-scoped RLS policies for course_outcomes (via syllabus ownership)
CREATE POLICY "Users can view own course_outcomes" ON public.course_outcomes
  FOR SELECT TO authenticated
  USING (public.owns_syllabus(auth.uid(), syllabus_id));

CREATE POLICY "Users can insert own course_outcomes" ON public.course_outcomes
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_syllabus(auth.uid(), syllabus_id));

CREATE POLICY "Users can update own course_outcomes" ON public.course_outcomes
  FOR UPDATE TO authenticated
  USING (public.owns_syllabus(auth.uid(), syllabus_id));

CREATE POLICY "Users can delete own course_outcomes" ON public.course_outcomes
  FOR DELETE TO authenticated
  USING (public.owns_syllabus(auth.uid(), syllabus_id));

-- Create user-scoped RLS policies for questions (via syllabus ownership)
CREATE POLICY "Users can view own questions" ON public.questions
  FOR SELECT TO authenticated
  USING (public.owns_syllabus(auth.uid(), syllabus_id));

CREATE POLICY "Users can insert own questions" ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_syllabus(auth.uid(), syllabus_id));

CREATE POLICY "Users can update own questions" ON public.questions
  FOR UPDATE TO authenticated
  USING (public.owns_syllabus(auth.uid(), syllabus_id));

CREATE POLICY "Users can delete own questions" ON public.questions
  FOR DELETE TO authenticated
  USING (public.owns_syllabus(auth.uid(), syllabus_id));