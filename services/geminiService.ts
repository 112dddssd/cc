
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, QuestionCategory, QuizItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the response schema for strict JSON output
const quizSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "A short title for the reading passage" },
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
          contextText: { type: Type.STRING, description: "The specific Japanese sentence or phrase being quizzed (must match exactly with a part of the original text)." },
          questionText: { type: Type.STRING, description: "The question prompt." },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Exactly 4 options."
          },
          correctIndex: { type: Type.INTEGER, description: "Index of the correct option (0-3)." },
          explanation: { type: Type.STRING, description: "Detailed explanation including parsing of the sentence/word and why distractors are wrong (in Chinese)." }
        },
        required: ["category", "contextText", "questionText", "options", "correctIndex", "explanation"],
        propertyOrdering: ["category", "contextText", "questionText", "options", "correctIndex", "explanation"]
      }
    }
  },
  required: ["title", "questions"]
};

export const generateQuizFromText = async (text: string): Promise<AnalysisResult> => {
  const model = "gemini-2.5-flash";
  
  const prompt = `
    You are an expert JLPT (Japanese Language Proficiency Test) reading comprehension tutor (N1/N2 Level). 
    Analyze the provided Japanese text and generate a challenging structured quiz.

    **Goal:** Test deep understanding, nuance, and precise vocabulary usage. Avoid easy questions.

    **Process Sequence (Iterate through the text sentence by sentence):**
    
    For EACH sentence in the text:
    1. **Vocabulary & Grammar (Prioritize Difficult Items):**
       - **Vocabulary Logic:**
         * IF the word is Kanji and the meaning is obvious to a Chinese speaker (e.g., '安全', '銀行'): Create a 'VOCAB_READING' question (Options: Hiragana).
         * IF the word is Kana, Katakana, or the Kanji meaning is different/nuanced in Japanese vs Chinese (e.g., '手紙', '丈夫', '真面目'): Create a 'VOCAB_MEANING' question (Options: Chinese definitions).
       - **Grammar:** Create 'GRAMMAR_EXPLANATION' questions focusing on **usage and nuance**, not just translation. Explain *why* this grammar point is used here.
       - **Phrases:** Focus on common Japanese set phrases or idioms. Do not test trivial words in simple contexts.

    2. **Sentence Comprehension (Mandatory for key sentences):**
       - Create a 'SENTENCE_TRANSLATION' question.
       - **Context:** The full sentence.
       - **Question:** "Which option best represents the meaning of this sentence?"
       - **Options (Chinese):**
          *   **Correct:** Accurate meaning capturing the nuance.
          *   **Distractors (HARD):** MUST be subtle.
              - **Logical Traps:** Reverse cause/effect, mix up subject/object.
              - **Nuance Traps:** Mistake conjecture ("might be") for assertion ("is"), or confuse the author's opinion with a general fact.
              - **Lexical Traps:** Incorrect interpretation of a polysemous word in this specific context.
          *   **Constraint:** All options should be roughly the same length and complexity. Do NOT make the correct answer obviously more detailed.

    **After processing all sentences:**
    3. **Full Text Comprehension:**
       - Create 2-3 'FULL_TEXT_COMPREHENSION' questions about the main idea, author's stance, or tone.
       - **Constraint:** **The options for these questions MUST be in JAPANESE (summarized/paraphrased).** Do NOT use Chinese for options here. Do NOT copy exact sentences from the text; paraphrase them.

    **Output Constraints:**
    - Output must be valid JSON matching the schema.
    - 'contextText' must be the exact Japanese string from the source text.
    - Difficulty should be calibrated for N2/N1 learners.

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
        thinkingConfig: { thinkingBudget: 4096 } // Increased budget for harder logic generation
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
      questions: questionsWithIds
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate quiz. Please try again.");
  }
};
