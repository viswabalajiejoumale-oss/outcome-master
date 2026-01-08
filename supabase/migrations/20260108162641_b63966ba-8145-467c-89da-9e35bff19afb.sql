-- Create enum for Bloom's Taxonomy levels
CREATE TYPE public.bloom_level AS ENUM ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create');

-- Create enum for question status
CREATE TYPE public.question_status AS ENUM ('draft', 'audited', 'approved', 'rejected');

-- Create syllabi table
CREATE TABLE public.syllabi (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    file_url TEXT,
    file_name TEXT,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create course_outcomes table
CREATE TABLE public.course_outcomes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    syllabus_id UUID REFERENCES public.syllabi(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    unit_number INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create questions table
CREATE TABLE public.questions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    syllabus_id UUID REFERENCES public.syllabi(id) ON DELETE CASCADE NOT NULL,
    course_outcome_id UUID REFERENCES public.course_outcomes(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    bloom_level bloom_level NOT NULL DEFAULT 'remember',
    marks INTEGER DEFAULT 5,
    source_paragraph TEXT,
    quality_score INTEGER DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
    audit_feedback TEXT,
    status question_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.syllabi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Create public access policies (for MVP without auth)
CREATE POLICY "Public read access for syllabi" ON public.syllabi FOR SELECT USING (true);
CREATE POLICY "Public insert access for syllabi" ON public.syllabi FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for syllabi" ON public.syllabi FOR UPDATE USING (true);
CREATE POLICY "Public delete access for syllabi" ON public.syllabi FOR DELETE USING (true);

CREATE POLICY "Public read access for course_outcomes" ON public.course_outcomes FOR SELECT USING (true);
CREATE POLICY "Public insert access for course_outcomes" ON public.course_outcomes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for course_outcomes" ON public.course_outcomes FOR UPDATE USING (true);
CREATE POLICY "Public delete access for course_outcomes" ON public.course_outcomes FOR DELETE USING (true);

CREATE POLICY "Public read access for questions" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Public insert access for questions" ON public.questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for questions" ON public.questions FOR UPDATE USING (true);
CREATE POLICY "Public delete access for questions" ON public.questions FOR DELETE USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_syllabi_updated_at
    BEFORE UPDATE ON public.syllabi
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_questions_updated_at
    BEFORE UPDATE ON public.questions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();