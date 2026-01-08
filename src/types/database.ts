export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
export type QuestionStatus = 'draft' | 'audited' | 'approved' | 'rejected';

export interface Syllabus {
  id: string;
  title: string;
  file_url: string | null;
  file_name: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseOutcome {
  id: string;
  syllabus_id: string;
  code: string;
  description: string;
  unit_number: number;
  created_at: string;
}

export interface Question {
  id: string;
  syllabus_id: string;
  course_outcome_id: string | null;
  question_text: string;
  bloom_level: BloomLevel;
  marks: number;
  source_paragraph: string | null;
  quality_score: number;
  audit_feedback: string | null;
  status: QuestionStatus;
  created_at: string;
  updated_at: string;
  course_outcome?: CourseOutcome;
}

export const BLOOM_LEVELS: BloomLevel[] = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

export const BLOOM_LABELS: Record<BloomLevel, string> = {
  remember: 'Remember',
  understand: 'Understand',
  apply: 'Apply',
  analyze: 'Analyze',
  evaluate: 'Evaluate',
  create: 'Create',
};

export const BLOOM_VERBS: Record<BloomLevel, string[]> = {
  remember: ['define', 'list', 'recall', 'identify', 'name', 'state'],
  understand: ['explain', 'describe', 'summarize', 'interpret', 'classify'],
  apply: ['apply', 'demonstrate', 'calculate', 'solve', 'use', 'implement'],
  analyze: ['analyze', 'compare', 'contrast', 'differentiate', 'examine'],
  evaluate: ['evaluate', 'justify', 'critique', 'assess', 'judge', 'defend'],
  create: ['create', 'design', 'develop', 'construct', 'propose', 'formulate'],
};

export const STATUS_LABELS: Record<QuestionStatus, string> = {
  draft: 'Draft',
  audited: 'Audited',
  approved: 'Approved',
  rejected: 'Rejected',
};
