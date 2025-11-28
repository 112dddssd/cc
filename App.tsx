
import React, { useState, useRef, useEffect } from 'react';
import { generateQuizFromText } from './services/geminiService';
import { QuizItem, AnalysisResult, AppState } from './types';
import { QuizCard } from './components/QuizCard';
import { Button } from './components/Button';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('INPUT');
  const [inputText, setInputText] = useState('');
  const [quizData, setQuizData] = useState<AnalysisResult | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Track user answers: { [questionId]: selectedIndex }
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});

  // Auto-scroll ref
  const topRef = useRef<HTMLDivElement>(null);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (appState !== 'QUIZ' || !quizData) return;

      if (e.key === 'ArrowLeft') {
        handlePrevQuestion();
      } else if (e.key === 'ArrowRight') {
        handleNextQuestion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState, quizData, currentQuestionIndex]);

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      setError("Please enter some Japanese text.");
      return;
    }
    
    if (!process.env.API_KEY) {
       setError("API_KEY is missing from environment.");
       return;
    }

    setAppState('LOADING');
    setError(null);
    setUserAnswers({});
    
    try {
      const result = await generateQuizFromText(inputText);
      setQuizData(result);
      setCurrentQuestionIndex(0);
      setAppState('QUIZ');
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setAppState('INPUT');
    }
  };

  const handleNextQuestion = () => {
    if (!quizData) return;
    
    if (currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setAppState('COMPLETED');
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handlePrevQuestion = () => {
    if (!quizData) return;
    
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleAnswer = (selectedIndex: number) => {
    if (!quizData) return;
    const currentQ = quizData.questions[currentQuestionIndex];
    setUserAnswers(prev => ({
      ...prev,
      [currentQ.id]: selectedIndex
    }));
  };

  const resetApp = () => {
    setAppState('INPUT');
    setInputText('');
    setQuizData(null);
    setCurrentQuestionIndex(0);
    setError(null);
    setUserAnswers({});
  };

  const getIncorrectQuestions = () => {
    if (!quizData) return [];
    return quizData.questions.filter(q => {
      const userAnswer = userAnswers[q.id];
      // Include unanswered questions as incorrect? Or just wrong answers?
      // Assuming 'wrong' means explicitly selected wrong index or not answered.
      return userAnswer !== undefined && userAnswer !== q.correctIndex;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-20">
      <div ref={topRef} />
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-50 border-b border-indigo-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              JLPT Intelligent Reader
            </h1>
          </div>
          {appState !== 'INPUT' && (
             <button onClick={resetApp} className="text-sm font-medium text-gray-500 hover:text-indigo-600">
                New Text
             </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {/* INPUT STATE */}
        {appState === 'INPUT' && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Practice Japanese Reading</h2>
              <p className="text-gray-500 max-w-lg mx-auto">
                Paste a JLPT article below. AI will generate difficult questions focusing on nuance, logic, and deep comprehension.
              </p>
            </div>

            <div className="bg-white p-2 rounded-2xl shadow-xl shadow-indigo-100/50 border border-gray-100">
              <textarea
                className="w-full h-64 p-6 rounded-xl text-lg font-jp text-gray-700 bg-gray-50 border-0 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none placeholder-gray-400"
                placeholder="ここに日本語の文章を貼り付けてください..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>
            
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 flex items-center gap-2">
                 <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 {error}
              </div>
            )}

            <div className="flex justify-center">
              <Button onClick={handleGenerate} className="w-full md:w-1/3 shadow-xl shadow-indigo-200">
                Generate Quizzes
              </Button>
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {appState === 'LOADING' && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
             <div className="relative w-24 h-24 mb-8">
               <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
             </div>
             <h3 className="text-xl font-semibold text-gray-800 mb-2">Analyzing Text...</h3>
             <p className="text-gray-500 text-center max-w-sm">
               Analyzing grammar nuances, vocabulary context, and logical flow...
             </p>
          </div>
        )}

        {/* QUIZ STATE */}
        {appState === 'QUIZ' && quizData && (
          <div className="animate-fade-in">
             <div className="mb-6 flex justify-center">
               <div className="bg-gray-200 h-2 w-64 rounded-full overflow-hidden">
                 <div 
                    className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                    style={{ width: `${((currentQuestionIndex) / quizData.questions.length) * 100}%` }}
                 />
               </div>
             </div>

             <QuizCard 
                question={quizData.questions[currentQuestionIndex]}
                fullText={inputText}
                onNext={handleNextQuestion}
                onPrev={handlePrevQuestion}
                onAnswer={handleAnswer}
                isLast={currentQuestionIndex === quizData.questions.length - 1}
                isFirst={currentQuestionIndex === 0}
                questionIndex={currentQuestionIndex}
                totalQuestions={quizData.questions.length}
             />
          </div>
        )}

        {/* COMPLETED STATE */}
        {appState === 'COMPLETED' && quizData && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            {/* Summary Card */}
            <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-gray-100 text-center">
               <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
               </div>
               
               <h2 className="text-3xl font-bold text-gray-800 mb-2">Reading Completed!</h2>
               <p className="text-gray-500 mb-8 text-lg">
                 You have analyzed the entire text. <br/>
                 Mistakes: <span className="font-bold text-red-500">{getIncorrectQuestions().length}</span> / {quizData.questions.length}
               </p>

               <div className="flex justify-center">
                 <Button onClick={resetApp} variant="secondary">
                   Practice New Text
                 </Button>
               </div>
            </div>

            {/* Incorrect Answers Review */}
            {getIncorrectQuestions().length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 py-4">
                  <h3 className="text-2xl font-bold text-gray-800">Review Incorrect Answers</h3>
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                    {getIncorrectQuestions().length} Questions
                  </span>
                </div>

                <div className="space-y-6">
                  {getIncorrectQuestions().map((q, idx) => {
                    const userAnswerIdx = userAnswers[q.id];
                    return (
                      <div key={q.id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between">
                           <span className="font-bold text-gray-500">Question {idx + 1}</span>
                           <span className="text-xs font-bold uppercase px-2 py-1 bg-gray-200 text-gray-600 rounded">
                             {q.category.replace(/_/g, ' ')}
                           </span>
                        </div>

                        <div className="p-6 md:p-8">
                          {/* Context */}
                          <div className="mb-4">
                             <p className="text-sm text-gray-400 font-bold uppercase mb-1">Context</p>
                             <div className="p-3 bg-indigo-50 rounded-lg text-lg font-jp text-gray-800 font-medium">
                               {q.contextText}
                             </div>
                          </div>

                          {/* Question */}
                          <p className="text-gray-700 font-semibold text-lg mb-6">{q.questionText}</p>

                          {/* Choices Comparison */}
                          <div className="grid md:grid-cols-2 gap-4 mb-6">
                            {/* User Selection */}
                            <div className="p-4 rounded-xl border-2 border-red-200 bg-red-50">
                              <p className="text-xs font-bold text-red-500 uppercase mb-2">Your Answer</p>
                              <div className="flex items-start">
                                <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold mr-2 mt-0.5 flex-shrink-0">
                                  {String.fromCharCode(65 + (userAnswerIdx ?? 0))}
                                </span>
                                <span className="text-red-900 font-medium">
                                  {userAnswerIdx !== undefined ? q.options[userAnswerIdx] : "Not Answered"}
                                </span>
                              </div>
                            </div>

                            {/* Correct Selection */}
                            <div className="p-4 rounded-xl border-2 border-green-200 bg-green-50">
                              <p className="text-xs font-bold text-green-600 uppercase mb-2">Correct Answer</p>
                              <div className="flex items-start">
                                <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold mr-2 mt-0.5 flex-shrink-0">
                                  {String.fromCharCode(65 + q.correctIndex)}
                                </span>
                                <span className="text-green-900 font-medium">
                                  {q.options[q.correctIndex]}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Explanation */}
                          <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                             <div className="flex items-center gap-2 mb-2">
                               <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                               <span className="font-bold text-gray-700">Explanation</span>
                             </div>
                             <p className="text-gray-600 leading-relaxed">{q.explanation}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
