
export enum QuestionCategory {
  VOCAB_READING = 'VOCAB_READING', // Hiragana reading
  VOCAB_MEANING = 'VOCAB_MEANING', // Word meaning
  GRAMMAR_EXPLANATION = 'GRAMMAR_EXPLANATION', // Grammar point explanation
  SENTENCE_TRANSLATION = 'SENTENCE_TRANSLATION', // Sentence translation/comprehension
  FULL_TEXT_COMPREHENSION = 'FULL_TEXT_COMPREHENSION' // Overall understanding
}

export interface QuizItem {
  id: string;
  category: QuestionCategory;
  contextText: string; // The specific sentence or word being quizzed
  questionText: string; // The prompt
  options: string[]; // Array of 4 strings
  correctIndex: number; // 0-3
  explanation: string; // Detailed parsing
}

export interface AnalysisResult {
  title: string;
  questions: QuizItem[];
}

export type AppState = 'INPUT' | 'LOADING' | 'QUIZ' | 'COMPLETED';
