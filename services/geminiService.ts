import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, QuestionCategory, QuizItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the response schema for strict JSON output
const quizSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A short title for the reading passage" },
    vocabulary: {
      type: Type.ARRAY,
      description: "A list of N1, N2, and N3 level vocabulary words found in the text. EXCLUDE all N4/N5 words.",
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "The Kanji word" },
          reading: { type: Type.STRING, description: "Hiragana reading" },
          meaning: { type: Type.STRING, description: "Chinese meaning" }
        },
        required: ["word", "reading", "meaning"]
      }
    },
    furiganaText: { 
      type: Type.STRING, 
      description: "The complete original text where Kanji words are immediately followed by their Hiragana reading in parentheses. E.g., '私(わたし)は日本語(にほんご)を勉強(べんきょう)します'. Do this for almost all Kanji words to help learners." 
    },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            enum: [
              "VOCAB_READING",
              "VOCAB_MEANING",
              "GRAMMAR_EXPLANATION",
              "SENTENCE_TRANSLATION",
              "FULL_TEXT_COMPREHENSION"
            ],
            description: "The type of question."
          },
          contextText: { type: Type.STRING, description: "The specific text being quizzed. For VOCAB questions, this MUST be the WORD ONLY. For SENTENCE, it is the sentence." },
          questionText: { type: Type.STRING, description: "The question prompt. Must be in Chinese unless specified otherwise. STRICTLY NO FURIGANA/READINGS IN PARENTHESES even for Japanese questions." },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Exactly 4 options. STRICTLY NO FURIGANA/READINGS IN PARENTHESES."
          },
          correctIndex: { type: Type.INTEGER, description: "Index of the correct option (0-3)." },
          explanation: { type: Type.STRING, description: "Detailed explanation in Chinese." }
        },
        required: ["category", "contextText", "questionText", "options", "correctIndex", "explanation"],
        propertyOrdering: ["category", "contextText", "questionText", "options", "correctIndex", "explanation"]
      }
    }
  },
  required: ["title", "vocabulary", "furiganaText", "questions"]
};

export const generateQuizFromText = async (text: string): Promise<AnalysisResult> => {
  const model = "gemini-2.5-flash";
  
  const prompt = `
    You are a strict and expert JLPT (Japanese Language Proficiency Test) tutor (N1/N2/N3 Level). 
    Analyze the provided Japanese text and generate a structured quiz.

    **Goal:** Test N3+ vocabulary, Grammar, and Sentence-by-Sentence Comprehension.

    **CRITICAL RULES (STRICT COMPLIANCE REQUIRED):**
    1.  **NO FURIGANA IN QUIZ QUESTIONS/OPTIONS:** 
        - **NEVER** include Hiragana readings in parentheses (e.g., "来(く)る", "仕事(しごと)") inside \`questionText\` or \`options\`. 
        - **This applies strictly to FULL_TEXT_COMPREHENSION questions and options.** 
        - Write "筆者" NOT "筆者(ひっしゃ)". Write "重要" NOT "重要(じゅうよう)".
        - Use clean Kanji/Kana only for all quiz content.
    2.  **DIFFICULTY - N3+ ONLY:** 
        - Ignore simple N4/N5 words. Focus on N3, N2, N1.
    3.  **VOCAB LOGIC:**
        - **Meaning:** Ask for meaning (Chinese options) ONLY if it's a "False Friend" or difficult Katakana/Hiragana.
        - **Reading:** Ask for readings (Hiragana options) ONLY for difficult Kanji words.
    4.  **SENTENCE COMPREHENSION (Mandatory):**
        - You MUST generate a \`SENTENCE_TRANSLATION\` question for **EVERY** sentence in the text.
        - If the article is long, group short sentences (2-3 max) into one question, but ensure the \`contextText\` is not too long.
        - **Options:** Chinese (Test accurate translation/nuance).
    5.  **ORDER OF QUESTIONS (Strict Sequence):**
        - **First:** All VOCAB and GRAMMAR questions.
        - **Middle:** All SENTENCE_TRANSLATION questions (in order of text appearance).
        - **Last:** FULL_TEXT_COMPREHENSION questions (Japanese Options).
    6.  **ANSWER DISTRIBUTION (CRITICAL):**
        - **DO NOT** default to Option A (Index 0). 
        - You **MUST** randomize the position of the correct answer (0, 1, 2, 3) for every question.
        - **Actively avoid** making A the correct answer too often. Spread correct answers across B, C, and D.

    **Question Types:**
    
    1. **VOCAB_READING**: "请选择该单词的正确读音。" (Options: Hiragana).
    2. **VOCAB_MEANING**: "请选择该单词/短语的正确含义。" (Options: Chinese).
    3. **GRAMMAR_EXPLANATION**: "请选择对文中该语法现象最准确的解释。" (Options: Chinese).
    4. **SENTENCE_TRANSLATION**: "下列哪个选项最能表达这句话在文中的意思？" (Options: Chinese).
    5. **FULL_TEXT_COMPREHENSION**: Generate 2-3 questions about the main idea. **Question & Options in clean JAPANESE (NO FURIGANA).**

    **Process:**
    - Generate Vocab List (N3+).
    - Generate Furigana Text (Full text with annotations).
    - Generate Questions Array following the Strict Order.

    **Article:**
    ${text}
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: quizSchema,
        thinkingConfig: { thinkingBudget: 4096 }
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No response from AI");

    const data = JSON.parse(jsonText) as AnalysisResult;
    
    // Add IDs to questions for React keys and map enum
    const questionsWithIds = data.questions.map((q, index) => ({
      ...q,
      id: `q-${index}-${Date.now()}`,
      category: q.category as QuestionCategory 
    }));

    return {
      title: data.title,
      vocabulary: data.vocabulary || [],
      furiganaText: data.furiganaText || text,
      questions: questionsWithIds
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate quiz. Please try again.");
  }
};