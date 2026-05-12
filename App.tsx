
import React, { useState, useRef, useEffect } from 'react';
import { generateQuizFromText } from './services/geminiService';
import { QuizItem, AnalysisResult, AppState, HistoryRecord, MistakeRecord, FavoriteRecord } from './types';
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

  // Load History, Mistakes, Favorites from LocalStorage on mount
  const [history, setHistory] = useState<HistoryRecord[]>(() => {
    const saved = localStorage.getItem('jlpt_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [mistakes, setMistakes] = useState<MistakeRecord[]>(() => {
    const saved = localStorage.getItem('jlpt_mistakes');
    return saved ? JSON.parse(saved) : [];
  });

  const [favorites, setFavorites] = useState<FavoriteRecord[]>(() => {
    const saved = localStorage.getItem('jlpt_favorites');
    return saved ? JSON.parse(saved) : [];
  });

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

  const saveToHistory = (result: AnalysisResult, text: string) => {
    const newRecord: HistoryRecord = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      title: result.title,
      originalText: text,
      analysis: result
    };
    const updatedHistory = [newRecord, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('jlpt_history', JSON.stringify(updatedHistory));
  };

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
      saveToHistory(result, inputText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setAppState('INPUT');
    }
  };

  const handleLoadHistory = (record: HistoryRecord) => {
    setInputText(record.originalText);
    setQuizData(record.analysis);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setAppState('COMPLETED'); // Start in Completed view to let user review first
  };

  const handleNextQuestion = () => {
    if (!quizData) return;
    
    if (currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    if (!quizData) return;
    
    // Save mistakes
    const newMistakes: MistakeRecord[] = [];
    quizData.questions.forEach(q => {
      const userAnswer = userAnswers[q.id];
      if (userAnswer !== undefined && userAnswer !== q.correctIndex) {
        newMistakes.push({
          id: `${q.id}-mistake`,
          date: new Date().toLocaleDateString(),
          articleTitle: quizData.title,
          question: q,
          userAnswerIndex: userAnswer
        });
      }
    });

    if (newMistakes.length > 0) {
      const updatedMistakes = [...newMistakes, ...mistakes];
      setMistakes(updatedMistakes);
      localStorage.setItem('jlpt_mistakes', JSON.stringify(updatedMistakes));
    }

    setAppState('COMPLETED');
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

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

  const toggleFavorite = (question: QuizItem, articleTitle: string) => {
    const existingIndex = favorites.findIndex(f => f.question.id === question.id);
    let updatedFavorites;
    if (existingIndex >= 0) {
      updatedFavorites = favorites.filter((_, i) => i !== existingIndex);
    } else {
      updatedFavorites = [{
        id: `${question.id}-fav-${Date.now()}`,
        date: new Date().toLocaleDateString(),
        articleTitle: articleTitle,
        question: question
      }, ...favorites];
    }
    setFavorites(updatedFavorites);
    localStorage.setItem('jlpt_favorites', JSON.stringify(updatedFavorites));
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
      return userAnswer !== undefined && userAnswer !== q.correctIndex;
    });
  };

  // Header Button Style helper
  const headerBtnClass = "px-3 py-2 rounded-lg text-sm font-semibold border transition-all flex items-center gap-2 shadow-sm ";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-20">
      <div ref={topRef} />
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-50 border-b border-indigo-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer self-start md:self-auto" onClick={() => setAppState('INPUT')}>
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              JLPT Reader
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 md:gap-3 self-end md:self-auto">
             <button 
                onClick={() => setAppState('FAVORITES')} 
                className={`${headerBtnClass} ${appState === 'FAVORITES' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-yellow-50'}`}
             >
               <svg className="w-4 h-4" fill={appState === 'FAVORITES' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
               <span className="hidden sm:inline">Favorites</span>
             </button>
             
             <button 
                onClick={() => setAppState('MISTAKES')} 
                className={`${headerBtnClass} ${appState === 'MISTAKES' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-red-50'}`}
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
               <span className="hidden sm:inline">Mistakes</span>
             </button>
             
             <button 
                onClick={() => setAppState('HISTORY')} 
                className={`${headerBtnClass} ${appState === 'HISTORY' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50'}`}
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
               <span className="hidden sm:inline">History</span>
             </button>

             {appState !== 'INPUT' && (
                <button 
                  onClick={resetApp} 
                  className="px-3 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md transition-colors"
                >
                   New Text
                </button>
             )}
          </div>
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
               Extracting N3+ vocabulary and generating comprehension questions...
             </p>
          </div>
        )}

        {/* HISTORY STATE */}
        {appState === 'HISTORY' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
               <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
               History
            </h2>
            {history.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No history found. Start a quiz!</div>
            ) : (
              <div className="grid gap-4">
                {history.map((record) => (
                  <div key={record.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex justify-between items-center group">
                    <div>
                      <h3 className="font-bold text-gray-800 mb-1">{record.title}</h3>
                      <p className="text-xs text-gray-400">{record.date} • {record.analysis.questions.length} Questions</p>
                    </div>
                    <Button onClick={() => handleLoadHistory(record)} variant="outline" className="px-4 py-2 text-sm">
                      Review
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-8 text-center">
              <Button onClick={() => setAppState('INPUT')} variant="secondary">Back to Home</Button>
            </div>
          </div>
        )}

        {/* MISTAKES STATE */}
        {appState === 'MISTAKES' && (
           <div className="animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                  Mistake Notebook
                </h2>
                <button 
                  onClick={() => {
                    if (confirm("Clear all mistakes?")) {
                      setMistakes([]);
                      localStorage.removeItem('jlpt_mistakes');
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Clear All
                </button>
             </div>
             
             {mistakes.length === 0 ? (
               <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                 <p className="text-gray-400 mb-4">Great job! No mistakes recorded yet.</p>
                 <Button onClick={() => setAppState('INPUT')}>Start Practice</Button>
               </div>
             ) : (
               <div className="space-y-6">
                 {mistakes.map((m) => (
                   <div key={m.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">
                     <div className="absolute top-4 right-4 text-xs font-bold text-gray-300">{m.date}</div>
                     <div className="mb-2">
                       <span className="text-xs font-bold uppercase text-indigo-500 bg-indigo-50 px-2 py-1 rounded">
                         {m.articleTitle}
                       </span>
                     </div>
                     <h3 className="text-lg font-jp font-bold text-gray-800 mb-2">{m.question.contextText}</h3>
                     <p className="text-gray-600 mb-4">{m.question.questionText}</p>
                     
                     <div className="grid md:grid-cols-2 gap-3 mb-4">
                        <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                           <span className="text-red-500 font-bold block mb-1">You Answered:</span>
                           {m.userAnswerIndex !== undefined ? m.question.options[m.userAnswerIndex] : 'Skipped'}
                        </div>
                        <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-sm">
                           <span className="text-green-600 font-bold block mb-1">Correct Answer:</span>
                           {m.question.options[m.question.correctIndex]}
                        </div>
                     </div>
                     
                     <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
                        <span className="font-bold block mb-1 text-gray-400">Explanation:</span>
                        {m.question.explanation}
                     </div>
                   </div>
                 ))}
               </div>
             )}
              <div className="mt-8 text-center">
                <Button onClick={() => setAppState('INPUT')} variant="secondary">Back to Home</Button>
              </div>
           </div>
        )}

        {/* FAVORITES STATE */}
        {appState === 'FAVORITES' && (
           <div className="animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <svg className="w-6 h-6 text-yellow-500" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                  Favorites Notebook
                </h2>
                <button 
                  onClick={() => {
                    if (confirm("Clear all favorites?")) {
                      setFavorites([]);
                      localStorage.removeItem('jlpt_favorites');
                    }
                  }}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Clear All
                </button>
             </div>
             
             {favorites.length === 0 ? (
               <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                 <p className="text-gray-400 mb-4">No favorites yet. Star questions to save them here!</p>
                 <Button onClick={() => setAppState('INPUT')}>Start Practice</Button>
               </div>
             ) : (
               <div className="space-y-6">
                 {favorites.map((f) => (
                   <div key={f.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">
                     <button 
                       onClick={() => toggleFavorite(f.question, f.articleTitle)}
                       className="absolute top-4 right-4 text-yellow-400 hover:text-yellow-600"
                       title="Remove from favorites"
                     >
                       <svg className="w-6 h-6" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                     </button>
                     <div className="mb-2">
                       <span className="text-xs font-bold uppercase text-indigo-500 bg-indigo-50 px-2 py-1 rounded">
                         {f.articleTitle}
                       </span>
                     </div>
                     <h3 className="text-lg font-jp font-bold text-gray-800 mb-2">{f.question.contextText}</h3>
                     <p className="text-gray-600 mb-4">{f.question.questionText}</p>
                     
                     <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-sm mb-4">
                        <span className="text-green-600 font-bold block mb-1">Correct Answer:</span>
                        {f.question.options[f.question.correctIndex]}
                     </div>
                     
                     <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
                        <span className="font-bold block mb-1 text-gray-400">Explanation:</span>
                        {f.question.explanation}
                     </div>
                   </div>
                 ))}
               </div>
             )}
              <div className="mt-8 text-center">
                <Button onClick={() => setAppState('INPUT')} variant="secondary">Back to Home</Button>
              </div>
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
                questions={quizData.questions}
                userAnswers={userAnswers}
                fullText={inputText}
                furiganaText={quizData.furiganaText}
                onNext={handleNextQuestion}
                onPrev={handlePrevQuestion}
                onJump={setCurrentQuestionIndex}
                onSubmit={finishQuiz}
                onAnswer={handleAnswer}
                isLast={currentQuestionIndex === quizData.questions.length - 1}
                isFirst={currentQuestionIndex === 0}
                questionIndex={currentQuestionIndex}
                totalQuestions={quizData.questions.length}
                isFavorite={favorites.some(f => f.question.id === quizData.questions[currentQuestionIndex].id)}
                onToggleFavorite={() => toggleFavorite(quizData.questions[currentQuestionIndex], quizData.title)}
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
                 Result Analysis for "{quizData.title}"
               </p>

               <div className="flex flex-col sm:flex-row justify-center gap-4">
                 <Button onClick={() => {
                   setUserAnswers({});
                   setCurrentQuestionIndex(0);
                   setAppState('QUIZ');
                 }} variant="outline">
                   Retry Quiz
                 </Button>
                 <Button onClick={resetApp} variant="secondary">
                   New Text
                 </Button>
               </div>
            </div>
            
            {/* Incorrect Answers Review */}
            {getIncorrectQuestions().length > 0 ? (
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
                    const isFav = favorites.some(f => f.question.id === q.id);
                    return (
                      <div key={q.id} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden relative">
                         <button 
                            onClick={() => toggleFavorite(q, quizData.title)}
                            className={`absolute top-4 right-4 z-10 p-1.5 rounded-full hover:bg-gray-100 transition-colors ${isFav ? 'text-yellow-400' : 'text-gray-300'}`}
                         >
                           <svg className="w-6 h-6" fill={isFav ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                           </svg>
                         </button>

                        {/* Header */}
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between pr-12">
                           <span className="font-bold text-gray-500">Mistake</span>
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
            ) : (
               <div className="p-8 bg-green-50 border border-green-100 rounded-2xl text-center text-green-800">
                  <span className="text-2xl block mb-2">🎉</span>
                  <span className="font-bold">Perfect Score!</span> No mistakes to review.
               </div>
            )}

            {/* Vocabulary Table */}
            {quizData.vocabulary && quizData.vocabulary.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden mt-8">
                <div className="bg-indigo-600 px-6 py-4 flex items-center gap-2">
                   <svg className="w-5 h-5 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                   <h3 className="text-white font-bold text-lg">Key Vocabulary (N3+)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold text-sm uppercase">
                      <tr>
                        <th className="px-6 py-3">Word</th>
                        <th className="px-6 py-3">Reading</th>
                        <th className="px-6 py-3">Meaning</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {quizData.vocabulary.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-jp font-bold text-gray-800 text-lg">{item.word}</td>
                          <td className="px-6 py-4 text-indigo-600 font-jp">{item.reading}</td>
                          <td className="px-6 py-4 text-gray-600">{item.meaning}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
