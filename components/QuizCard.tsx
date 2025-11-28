
import React, { useState, useEffect, useRef } from 'react';
import { QuizItem, QuestionCategory } from '../types';
import { Button } from './Button';

interface QuizCardProps {
  question: QuizItem;
  fullText: string;
  onNext: () => void;
  onPrev: () => void;
  onAnswer: (selectedIndex: number) => void;
  isLast: boolean;
  isFirst: boolean;
  questionIndex: number;
  totalQuestions: number;
}

export const QuizCard: React.FC<QuizCardProps> = ({ 
  question, 
  fullText,
  onNext, 
  onPrev,
  onAnswer,
  isLast,
  isFirst,
  questionIndex,
  totalQuestions
}) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<HTMLSpanElement>(null);

  // Reset state when question changes
  useEffect(() => {
    setSelectedOption(null);
    setShowResult(false);
  }, [question.id]);

  // Scroll to highlighted text when question changes
  useEffect(() => {
    if (highlightedRef.current && textContainerRef.current) {
      highlightedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [question.id, fullText]);

  const handleOptionClick = (index: number) => {
    if (showResult) return; // Prevent changing answer
    setSelectedOption(index);
    setShowResult(true);
    onAnswer(index);
  };

  const isCorrect = selectedOption === question.correctIndex;

  const getCategoryLabel = (cat: QuestionCategory) => {
    switch(cat) {
      case QuestionCategory.VOCAB_READING: return "单词读音 (Reading)";
      case QuestionCategory.VOCAB_MEANING: return "单词释义 (Meaning)";
      case QuestionCategory.GRAMMAR_EXPLANATION: return "语法解析 (Grammar)";
      case QuestionCategory.SENTENCE_TRANSLATION: return "句子理解 (Comprehension)";
      case QuestionCategory.FULL_TEXT_COMPREHENSION: return "全文理解 (Full Text)";
    }
  };

  const getCategoryColor = (cat: QuestionCategory) => {
     switch(cat) {
      case QuestionCategory.VOCAB_READING: return "bg-blue-100 text-blue-800";
      case QuestionCategory.VOCAB_MEANING: return "bg-purple-100 text-purple-800";
      case QuestionCategory.GRAMMAR_EXPLANATION: return "bg-pink-100 text-pink-800";
      case QuestionCategory.SENTENCE_TRANSLATION: return "bg-indigo-100 text-indigo-800";
      case QuestionCategory.FULL_TEXT_COMPREHENSION: return "bg-amber-100 text-amber-800";
    }
  };

  // Function to render text with highlight
  const renderHighlightedText = () => {
    if (!fullText) return null;
    
    const parts = fullText.split(question.contextText);
    
    if (parts.length === 1) return <p className="leading-relaxed whitespace-pre-wrap text-gray-600">{fullText}</p>;

    return (
      <p className="leading-8 whitespace-pre-wrap text-gray-600 font-jp text-lg">
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            {part}
            {i < parts.length - 1 && (
              <span 
                ref={i === 0 ? highlightedRef : null} 
                className="bg-yellow-200 text-gray-900 font-semibold px-1 py-0.5 rounded box-decoration-clone border-b-2 border-yellow-400"
              >
                {question.contextText}
              </span>
            )}
          </React.Fragment>
        ))}
      </p>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto gap-6 flex flex-col">
      
      {/* Original Text Panel (Always Visible) */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
         <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Original Text / 原文</h3>
         </div>
         <div 
            ref={textContainerRef}
            className="p-6 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent"
         >
           {renderHighlightedText()}
         </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${getCategoryColor(question.category)}`}>
            {getCategoryLabel(question.category)}
          </span>
          <span className="text-sm font-medium text-gray-500">
            Question {questionIndex + 1} / {totalQuestions}
          </span>
        </div>

        <div className="p-6 md:p-8">
          {/* Question Prompt */}
          <div className="mb-6">
            <div className="mb-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-50">
               <h2 className="text-xl md:text-2xl font-jp font-medium text-gray-800 leading-relaxed mb-2">
                 {question.contextText}
               </h2>
            </div>
            <p className="text-gray-600 font-medium text-lg">{question.questionText}</p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {question.options.map((option, idx) => {
              let itemClass = "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 relative ";
              
              if (showResult) {
                if (idx === question.correctIndex) {
                  itemClass += "border-green-500 bg-green-50 text-green-900 font-semibold";
                } else if (idx === selectedOption) {
                  itemClass += "border-red-500 bg-red-50 text-red-900";
                } else {
                  itemClass += "border-gray-100 opacity-50";
                }
              } else {
                itemClass += "border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer";
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(idx)}
                  className={itemClass}
                  disabled={showResult}
                >
                  <div className="flex items-center">
                    <span className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full mr-4 text-sm font-bold border ${
                      showResult && idx === question.correctIndex ? 'bg-green-500 text-white border-green-500' :
                      showResult && idx === selectedOption ? 'bg-red-500 text-white border-red-500' :
                      'bg-white text-gray-500 border-gray-300'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="leading-relaxed">{option}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Feedback Section */}
          {showResult && (
            <div className="mt-8 animate-fade-in-up">
              <div className={`p-5 rounded-xl border ${isCorrect ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <div className="flex items-center mb-3">
                  <div className={`p-2 rounded-full mr-3 ${isCorrect ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'}`}>
                    {isCorrect ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                    )}
                  </div>
                  <h3 className={`font-bold text-lg ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                    {isCorrect ? 'Correct! 正确' : 'Incorrect 错误'}
                  </h3>
                </div>
                
                <div className="text-gray-700 space-y-2">
                  <p className="font-semibold text-sm uppercase text-gray-400 tracking-wider">解析 (Explanation)</p>
                  <p className="text-base leading-relaxed">{question.explanation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="mt-8 flex justify-between items-center pt-6 border-t border-gray-100">
             <Button 
                onClick={onPrev} 
                variant="outline" 
                disabled={isFirst}
                className="flex items-center gap-2"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                Previous
             </Button>

             <span className="text-xs text-gray-400 font-medium hidden sm:block">
               Use ← → arrow keys to navigate
             </span>

             <Button 
                onClick={onNext} 
                variant="primary" 
                className="flex items-center gap-2"
             >
                {isLast ? "Summary" : "Next"}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
             </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
