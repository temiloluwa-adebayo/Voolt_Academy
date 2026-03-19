import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  CheckCircle2, 
  Lock, 
  ChevronLeft, 
  ChevronRight, 
  Menu, 
  X, 
  Clock, 
  FileText, 
  HelpCircle,
  ArrowLeft,
  Maximize2,
  Volume2,
  Settings,
  SkipForward,
  Loader2,
  Trophy
} from 'lucide-react';

export default function CoursePlayer() {
  const { courseId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [currentLesson, setCurrentLesson] = useState<any>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [quizAvailable, setQuizAvailable] = useState<any>(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [pendingQuizWeek, setPendingQuizWeek] = useState<number | null>(null);

  useEffect(() => {
    fetchCourseData();
  }, [courseId, profile]);

  const fetchCourseData = async () => {
    if (!courseId || !profile) return;

    try {
      const [courseRes, lessonsRes, progressRes] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase.from('lessons').select('*').eq('course_id', courseId).order('week_number', { ascending: true }).order('order_index', { ascending: true }),
        supabase.from('lesson_progress').select('lesson_id').eq('user_id', profile.id)
      ]);

      if (courseRes.data) setCourse(courseRes.data);
      if (lessonsRes.data) {
        setLessons(lessonsRes.data);
        // Default to first incomplete lesson or first lesson
        const completedIds = (progressRes.data || []).map(p => p.lesson_id);
        setProgress(completedIds);
        
        const firstIncomplete = lessonsRes.data.find(l => !completedIds.includes(l.id));
        setCurrentLesson(firstIncomplete || lessonsRes.data[0]);
      }
    } catch (err) {
      console.error('Error fetching course:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentLesson) {
      checkQuizAvailability();
    }
  }, [currentLesson]);

  const checkQuizAvailability = async () => {
    if (!courseId || !currentLesson) return;
    
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id')
        .eq('course_id', courseId)
        .eq('week_number', currentLesson.week_number);
      
      if (error) {
        console.error('Error checking quiz availability:', error);
      }
      setQuizAvailable(data?.[0] || null);
    } catch (err) {
      console.error('Unexpected error checking quiz:', err);
    }
  };

  const handleLessonComplete = async () => {
    if (!profile || !currentLesson || completing) return;
    setCompleting(true);

    try {
      // Use insert instead of upsert to be more resilient to missing constraints
      // If it already exists, it will return an error which we can ignore if it's a duplicate key error
      const { error: insertError } = await supabase.from('lesson_progress').insert({
        user_id: profile.id,
        lesson_id: currentLesson.id,
        completed_at: new Date().toISOString()
      });

      // Error code 23505 is unique_violation in PostgreSQL
      if (insertError && (insertError as any).code !== '23505') {
        console.error('Failed to save progress:', insertError);
        throw insertError;
      }

      const newProgress = [...progress, currentLesson.id];
      setProgress(newProgress);

      // Find next lesson
      const currentIndex = lessons.findIndex(l => l.id === currentLesson.id);
      const nextLesson = lessons[currentIndex + 1];

      if (nextLesson) {
        // If next lesson is in a new week, check if we should show quiz first
        if (nextLesson.week_number > currentLesson.week_number && quizAvailable) {
          setPendingQuizWeek(currentLesson.week_number);
          setShowQuizModal(true);
          return;
        }
        setCurrentLesson(nextLesson);
      } else {
        // Course completed!
        // Check for final week quiz
        if (quizAvailable) {
          setPendingQuizWeek(currentLesson.week_number);
          setShowQuizModal(true);
          return;
        }

        const { error: enrollmentError } = await supabase.from('enrollments')
          .update({ status: 'completed' })
          .eq('user_id', profile.id)
          .eq('course_id', courseId);
        
        if (enrollmentError) {
          console.error('Failed to update enrollment status:', enrollmentError);
        }
        
        alert('Congratulations! You have completed the course.');
        navigate('/student');
      }
    } catch (err) {
      console.error('Error in handleLessonComplete:', err);
      // Don't use alert, maybe just log it or show a non-blocking error
    } finally {
      setCompleting(false);
    }
  };

  const isLessonLocked = (lesson: any) => {
    const index = lessons.findIndex(l => l.id === lesson.id);
    if (index === 0) return false;
    const prevLesson = lessons[index - 1];
    return !progress.includes(prevLesson.id);
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const id = url.includes('v=') ? url.split('v=')[1].split('&')[0] : url.split('/').pop();
      return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
    }
    
    // Vimeo
    if (url.includes('vimeo.com')) {
      const id = url.split('/').pop();
      return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }

    // Google Drive
    if (url.includes('drive.google.com')) {
      const id = url.includes('id=') ? url.split('id=')[1].split('&')[0] : url.split('/d/')[1]?.split('/')[0];
      return `https://drive.google.com/file/d/${id}/preview`;
    }

    return url;
  };

  if (loading) return (
    <div className="h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="size-16 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mx-auto mb-6" />
        <p className="text-slate-400 font-bold font-display tracking-widest uppercase text-xs">Initializing Academy Player</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Player Header */}
      <header className="h-20 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-6">
          <Link to="/student" className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-all">
            <ArrowLeft size={20} />
          </Link>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <h1 className="text-white font-black font-display tracking-tight truncate max-w-md">{course?.title}</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-0.5">
              Week {currentLesson?.week_number} • {currentLesson?.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="size-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Live Progress Sync</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition-all"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Area */}
        <main className="flex-1 flex flex-col bg-black relative">
          <div className="flex-1 relative group">
            {currentLesson ? (
              <iframe
                src={getEmbedUrl(currentLesson.video_url)}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                Select a lesson to start learning
              </div>
            )}
          </div>

          {/* Player Controls Bar */}
          <div className="h-24 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800/50 flex items-center justify-between px-10 shrink-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-4">
                <button className="p-2 text-slate-400 hover:text-white transition-colors"><Volume2 size={20} /></button>
                <button className="p-2 text-slate-400 hover:text-white transition-colors"><Settings size={20} /></button>
                <button className="p-2 text-slate-400 hover:text-white transition-colors"><Maximize2 size={20} /></button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={handleLessonComplete}
                disabled={completing || progress.includes(currentLesson?.id)}
                className={`
                  px-8 py-4 rounded-2xl font-black font-display text-sm flex items-center gap-3 transition-all
                  ${progress.includes(currentLesson?.id)
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 cursor-default'
                    : 'bg-brand-primary text-white shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98]'
                  }
                `}
              >
                {completing ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : progress.includes(currentLesson?.id) ? (
                  <><CheckCircle2 size={20} /> Lesson Completed</>
                ) : (
                  <><SkipForward size={20} /> Mark as Complete</>
                )}
              </button>

              {quizAvailable && progress.includes(currentLesson?.id) && (
                <Link 
                  to={`/student/quiz/${courseId}/${currentLesson.week_number}`}
                  className="px-8 py-4 bg-brand-secondary text-white rounded-2xl font-black font-display text-sm shadow-xl shadow-brand-secondary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3"
                >
                  <HelpCircle size={20} /> Take Week {currentLesson.week_number} Quiz
                </Link>
              )}
            </div>
          </div>
        </main>

        {/* Sidebar - Curriculum */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-slate-900 border-l border-slate-800 flex flex-col shrink-0"
            >
              <div className="p-8 border-b border-slate-800">
                <h3 className="text-white font-black font-display text-xl mb-2">Course Curriculum</h3>
                <div className="flex items-center justify-between">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                    {progress.length} / {lessons.length} Completed
                  </p>
                  <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-primary rounded-full" 
                      style={{ width: `${(progress.length / lessons.length) * 100}%` }} 
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
                {Array.from({ length: course?.duration_weeks || 0 }).map((_, i) => {
                  const weekNum = i + 1;
                  const weekLessons = lessons.filter(l => l.week_number === weekNum);
                  
                  return (
                    <div key={weekNum} className="space-y-3">
                      <div className="flex items-center gap-3 px-4 mb-4">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Week {weekNum}</span>
                        <div className="h-px flex-1 bg-slate-800" />
                      </div>

                      {weekLessons.map((lesson) => {
                        const isCompleted = progress.includes(lesson.id);
                        const isLocked = isLessonLocked(lesson);
                        const isActive = currentLesson?.id === lesson.id;

                        return (
                          <button
                            key={lesson.id}
                            disabled={isLocked}
                            onClick={() => setCurrentLesson(lesson)}
                            className={`
                              w-full text-left p-4 rounded-2xl transition-all flex items-center gap-4 group
                              ${isActive ? 'bg-brand-primary/10 border border-brand-primary/20' : 'hover:bg-slate-800/50 border border-transparent'}
                              ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            `}
                          >
                            <div className={`
                              size-10 rounded-xl flex items-center justify-center shrink-0 transition-colors
                              ${isCompleted ? 'bg-emerald-500/10 text-emerald-500' : isActive ? 'bg-brand-primary text-white' : 'bg-slate-800 text-slate-500'}
                            `}>
                              {isLocked ? <Lock size={18} /> : isCompleted ? <CheckCircle2 size={20} /> : <Play size={18} fill={isActive ? 'currentColor' : 'none'} />}
                            </div>
                            <div className="min-w-0">
                              <h4 className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                {lesson.title}
                              </h4>
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                                {lesson.duration || '15:00'} • Video Lesson
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Quiz Prompt Modal */}
      <AnimatePresence>
        {showQuizModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] max-w-md w-full text-center shadow-2xl"
            >
              <div className="size-20 bg-brand-primary/10 text-brand-primary rounded-3xl flex items-center justify-center mx-auto mb-8">
                <Trophy size={40} />
              </div>
              <h2 className="text-3xl font-black font-display text-white mb-4 tracking-tight">Week {pendingQuizWeek} Complete!</h2>
              <p className="text-slate-400 mb-10 leading-relaxed">
                Outstanding progress! You've mastered the content for this week. Are you ready to take the assessment and unlock the next phase?
              </p>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => navigate(`/student/quiz/${courseId}/${pendingQuizWeek}`)}
                  className="w-full py-5 bg-brand-primary text-white font-black font-display rounded-2xl shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Start Assessment
                </button>
                <button
                  onClick={() => {
                    setShowQuizModal(false);
                    // If there's a next lesson, move to it
                    const currentIndex = lessons.findIndex(l => l.id === currentLesson.id);
                    const nextLesson = lessons[currentIndex + 1];
                    if (nextLesson) {
                      setCurrentLesson(nextLesson);
                    } else {
                      // If it was the last lesson, go to dashboard
                      navigate('/student');
                    }
                  }}
                  className="w-full py-5 text-slate-500 font-bold hover:text-white transition-colors"
                >
                  Continue to Next Lesson
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
