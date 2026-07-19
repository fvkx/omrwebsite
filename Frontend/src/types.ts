export interface Exam {
  id: string;
  name: string;
  answer_key: Record<string, string>; // Maps question number "1" - "50" to answer "A"-"E"
  created_at: string;
}

export interface Submission {
  id: string;
  exam_id: string;
  student_id: string;
  score: number;
  total_questions: number;
  answers: Record<string, {
    selected: string | null;
    is_ambiguous: boolean;
    is_empty: boolean;
  }>;
  created_at: string;
}

export interface QuickScanResult {
  student_id: string;
  answers: Record<string, string | null>;
  overlay_image: string; // Base64 string
}

export interface GradeResult {
  submission_id: string;
  student_id: string;
  score: number;
  total_questions: number;
  answers: Record<string, {
    selected: string | null;
    is_ambiguous: boolean;
    is_empty: boolean;
  }>;
  overlay_image: string; // Base64 string
}
