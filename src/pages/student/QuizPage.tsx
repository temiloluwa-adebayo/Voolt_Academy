import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Trophy, 
  Clock, 
  HelpCircle,
  ChevronRight,
  Loader2,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

export default function QuizPage() {
  const { courseId, weekNumber } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState<any>(null);
  const [course, setCourse] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (courseId && weekNumber) {
      fetchQuizData();
    }
  }, [courseId, weekNumber]);

  const fetchQuizData = async () => {
    setLoading(true);
    try {
      // Fetch course data to check for completion later
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();
      
      setCourse(courseData);

      const weekNum = parseInt(weekNumber || '1');
      console.log('Fetching quiz for:', { courseId, weekNum });

      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('course_id', courseId)
        .eq('week_number', weekNum);

      if (quizError) {
        console.error('Quiz fetch error:', quizError);
        throw quizError;
      }
      
      const currentQuiz = quizData?.[0];

      if (!currentQuiz) {
        console.log('No quiz found for this week');
        setQuiz(null);
        setLoading(false);
        return;
      }

      setQuiz(currentQuiz);

      const { data: questionsData, error: questionsError } = await supabase
        .from('quiz_questions')
        .select(`
          id,
          question_text,
          quiz_options (id, option_text, is_correct)
        `)
        .eq('quiz_id', currentQuiz.id);

      if (questionsError) {
        console.error('Questions fetch error:', questionsError);
        throw questionsError;
      }

      if (questionsData) {
        console.log('Fetched questions:', questionsData.length);
        setQuestions(questionsData);
      }
    } catch (err) {
      console.error('Error fetching quiz data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (selectedOptionIdx === null) return;

    const newAnswers = [...answers, selectedOptionIdx];
    setAnswers(newAnswers);
    setSelectedOptionIdx(null);

    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    } else {
      calculateResult(newAnswers);
    }
  };

  const calculateResult = async (finalAnswers: number[]) => {
    setSaving(true);
    let correctCount = 0;
    
    finalAnswers.forEach((answerIdx, qIdx) => {
      if (questions[qIdx].quiz_options[answerIdx].is_correct) {
        correctCount++;
      }
    });

    const finalScore = Math.round((correctCount / questions.length) * 100);
    const passed = finalScore >= (quiz.pass_score || 70);
    setScore(finalScore);
    setIsFinished(true);

    if (profile && quiz) {
      try {
        await supabase.from('quiz_attempts').insert({
          user_id: profile.id,
          quiz_id: quiz.id,
          score: correctCount,
          total: questions.length,
          percentage: finalScore,
          passed: passed
        });

        // If passed and it's the final week (or we want to mark progress)
        if (passed && course) {
          // Check if this is the last week or just mark as a milestone
          // For now, if they pass any quiz, we could update enrollment metadata if needed
          // But specifically if it's the last week, mark course as completed
          
          // Simple check: if weekNumber is >= some threshold or if we can determine it's the last
          // Better: fetch all lessons and see if this is the max week
          const { data: lessons } = await supabase
            .from('lessons')
            .select('week_number')
            .eq('course_id', courseId)
            .order('week_number', { ascending: false })
            .limit(1);

          if (lessons && lessons.length > 0 && parseInt(weekNumber || '0') >= lessons[0].week_number) {
            await supabase.from('enrollments')
              .update({ status: 'completed' })
              .eq('user_id', profile.id)
              .eq('course_id', courseId);
          }
        }
      } catch (err) {
        console.error('Error saving quiz attempt:', err);
      }
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-brand-bg">
      <Loader2 className="animate-spin text-brand-primary" size={32} />
    </div>
  );

  if (!quiz) return (
    <div className="h-screen flex items-center justify-center bg-brand-bg p-6">
      <div className="premium-card p-10 text-center max-w-md">
        <AlertCircle className="text-amber-500 mx-auto mb-6" size={48} />
        <h2 className="text-2xl font-black font-display mb-2">Quiz Not Found</h2>
        <p className="text-slate-500 mb-8">The assessment for this week hasn't been published yet.</p>
        <button onClick={() => navigate(-1)} className="btn-primary w-full">Go Back</button>
      </div>
    </div>
  );

  if (questions.length === 0) return (
    <div className="h-screen flex items-center justify-center bg-brand-bg p-6">
      <div className="premium-card p-10 text-center max-w-md">
        <HelpCircle className="text-brand-primary mx-auto mb-6" size={48} />
        <h2 className="text-2xl font-black font-display mb-2">No Questions Found</h2>
        <p className="text-slate-500 mb-8">This quiz doesn't have any questions yet. Please contact the instructor.</p>
        <button onClick={() => navigate(-1)} className="btn-primary w-full">Go Back</button>
      </div>
    </div>
  );

  if (isFinished) {
    const passed = score >= (quiz?.pass_score || 70);
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="premium-card w-full max-w-2xl p-12 text-center"
        >
          <div className={`size-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 ${passed ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
            {passed ? <Trophy size={48} /> : <AlertCircle size={48} />}
          </div>

          <h1 className="text-4xl font-black font-display tracking-tight mb-2">
            {passed ? 'Outstanding Work!' : 'Keep Practicing'}
          </h1>
          <p className="text-slate-500 font-medium mb-10">
            {passed 
              ? `You've mastered the concepts of Week ${weekNumber}.` 
              : `You scored ${score}%, but you need ${quiz?.pass_score || 70}% to pass.`}
          </p>

          <div className="grid grid-cols-2 gap-6 mb-12">
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Your Score</p>
              <p className={`text-3xl font-black font-display ${passed ? 'text-emerald-600' : 'text-red-600'}`}>{score}%</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
              <p className={`text-3xl font-black font-display ${passed ? 'text-emerald-600' : 'text-red-600'}`}>
                {passed ? 'PASSED' : 'FAILED'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => window.location.reload()}
              className="flex-1 px-8 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all"
            >
              Try Again
            </button>
            <Link 
              to={`/student/course/${courseId}`}
              className="flex-1 btn-primary"
            >
              Back to Course <ArrowRight size={20} />
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIdx];
  const progress = ((currentQuestionIdx + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <header className="h-24 glass-nav flex items-center justify-between px-10 shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-black font-display tracking-tight">Week {weekNumber} Assessment</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Question {currentQuestionIdx + 1} of {questions.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Time Elapsed</p>
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <Clock size={16} className="text-brand-primary" /> 04:12
            </div>
          </div>
        </div>
      </header>

      <div className="h-1.5 bg-slate-100 w-full">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-brand-primary"
        />
      </div>

      <main className="flex-1 flex items-center justify-center p-6">
        <motion.div 
          key={currentQuestionIdx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="w-full max-w-3xl"
        >
          <div className="premium-card p-12">
            <h3 className="text-2xl md:text-3xl font-black font-display text-slate-900 mb-10 leading-tight">
              {currentQuestion.question_text}
            </h3>

            <div className="space-y-4">
              {currentQuestion.quiz_options.map((option: any, idx: number) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedOptionIdx(idx)}
                  className={`
                    w-full text-left p-6 rounded-3xl border-2 transition-all flex items-center justify-between group
                    ${selectedOptionIdx === idx 
                      ? 'border-brand-primary bg-brand-primary/5 ring-4 ring-brand-primary/5' 
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                    }
                  `}
                >
                  <div className="flex items-center gap-5">
                    <span className={`
                      size-10 rounded-xl flex items-center justify-center font-black text-sm transition-all
                      ${selectedOptionIdx === idx ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}
                    `}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className={`font-bold ${selectedOptionIdx === idx ? 'text-slate-900' : 'text-slate-600'}`}>
                      {option.option_text}
                    </span>
                  </div>
                  {selectedOptionIdx === idx && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <CheckCircle2 className="text-brand-primary" size={24} />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-12 flex justify-end">
              <button
                onClick={handleNext}
                disabled={selectedOptionIdx === null || saving}
                className="btn-primary px-12 py-5 disabled:opacity-50 disabled:hover:scale-100"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <>
                    {currentQuestionIdx === questions.length - 1 ? 'Finish Assessment' : 'Next Question'}
                    <ChevronRight size={24} />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
