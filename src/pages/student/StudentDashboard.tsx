import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  Play, Clock, BookOpen, Trophy, ArrowRight, Flame,
  CheckCircle2, Lock, Star, TrendingUp, Calendar,
  Zap, Target, Award, ChevronRight
} from 'lucide-react';

interface Enrollment {
  id: string;
  course_id: string;
  current_week: number;
  status: string;
  enrolled_at: string;
  courses: {
    id: string;
    title: string;
    description: string;
    thumbnail_url: string;
    duration_weeks: number;
    slug: string;
  };
}

interface LessonProgress {
  lesson_id: string;
  completed_at: string | null;
  watch_percentage: number;
}

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [lessonCounts, setLessonCounts] = useState<Record<string, { total: number; completed: number }>>({});
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    try {
      // Fetch enrollments with course data
      const { data: enrollData } = await supabase
        .from('enrollments')
        .select('*, courses(*)')
        .eq('user_id', profile?.id)
        .eq('status', 'active');

      const enroll = enrollData || [];
      setEnrollments(enroll);

      // For each enrollment, fetch lesson counts and progress
      const progressData: Record<string, number> = {};
      const countData: Record<string, { total: number; completed: number }> = {};

      await Promise.all(enroll.map(async (e: Enrollment) => {
        const [lessonsRes, progressRes] = await Promise.all([
          supabase.from('lessons').select('id').eq('course_id', e.course_id),
          supabase.from('lesson_progress')
            .select('lesson_id, completed_at')
            .eq('user_id', profile?.id)
            .eq('course_id', e.course_id)
            .not('completed_at', 'is', null)
        ]);

        const total = lessonsRes.data?.length || 0;
        const completed = progressRes.data?.length || 0;
        countData[e.course_id] = { total, completed };
        progressData[e.course_id] = total > 0 ? Math.round((completed / total) * 100) : 0;
      }));

      setProgressMap(progressData);
      setLessonCounts(countData);

      // Calculate streak from lesson_progress
      const { data: allProgress } = await supabase
        .from('lesson_progress')
        .select('completed_at')
        .eq('user_id', profile?.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false });

      if (allProgress && allProgress.length > 0) {
        let streakCount = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const uniqueDays = new Set(
          allProgress.map(p => new Date(p.completed_at!).toDateString())
        );
        for (let i = 0; i < 365; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          if (uniqueDays.has(d.toDateString())) streakCount++;
          else if (i > 0) break;
        }
        setStreak(streakCount);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const countValues: { total: number; completed: number }[] = Object.values(lessonCounts);
  const totalCompleted: number = countValues.reduce((a, b) => a + b.completed, 0);
  const totalLessons: number = countValues.reduce((a, b) => a + b.total, 0);
  const overallProgress: number = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  const firstName = profile?.full_name?.split(' ')[0] || 'Student';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center">
            <div className="size-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-slate-400 font-medium text-sm">Loading your academy...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">

      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[2rem] p-8 md:p-12 text-white"
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-secondary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <p className="text-slate-400 font-medium mb-2 text-sm md:text-base">{greeting} 👋</p>
            <h1 className="text-3xl md:text-5xl font-black font-display tracking-tight mb-3">
              Welcome back, <span className="text-brand-primary">{firstName}</span>
            </h1>
            <p className="text-slate-400 font-medium text-sm md:text-base max-w-md">
              {enrollments.length > 0
                ? `You have ${enrollments.length} active course${enrollments.length > 1 ? 's' : ''}. Keep the momentum going!`
                : 'Your learning journey is waiting. Contact your administrator to get enrolled.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            {/* Streak card */}
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-4">
              <div className="size-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Flame className="text-orange-400" size={24} fill="currentColor" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Study Streak</p>
                <p className="text-2xl font-black text-white">{streak > 0 ? `${streak} Days` : 'Start Today!'}</p>
              </div>
            </div>

            {/* Overall progress */}
            {totalLessons > 0 && (
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-4">
                <div className="size-12 rounded-xl bg-brand-primary/20 flex items-center justify-center">
                  <TrendingUp className="text-brand-primary" size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Overall Progress</p>
                  <p className="text-2xl font-black text-white">{overallProgress}%</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {totalLessons > 0 && (
          <div className="relative mt-8">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {totalCompleted} of {totalLessons} lessons completed
              </p>
              <p className="text-xs font-bold text-brand-primary">{overallProgress}%</p>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-brand-primary to-emerald-400 rounded-full"
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* Stats Row */}
      {enrollments.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[
            {
              label: 'Courses Enrolled',
              value: enrollments.length,
              icon: BookOpen,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
              border: 'border-blue-100'
            },
            {
              label: 'Lessons Completed',
              value: totalCompleted,
              icon: CheckCircle2,
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
              border: 'border-emerald-100'
            },
            {
              label: 'Days Streak',
              value: streak,
              icon: Flame,
              color: 'text-orange-600',
              bg: 'bg-orange-50',
              border: 'border-orange-100'
            },
            {
              label: 'Completion Rate',
              value: `${overallProgress}%`,
              icon: Target,
              color: 'text-purple-600',
              bg: 'bg-purple-50',
              border: 'border-purple-100'
            },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`premium-card p-5 md:p-6 border ${stat.border}`}
            >
              <div className={`size-10 md:size-12 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4`}>
                <stat.icon size={20} />
              </div>
              <p className="text-2xl md:text-3xl font-black font-display text-slate-900">{stat.value}</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">

        {/* Course List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-black font-display flex items-center gap-3">
              <Play size={22} className="text-brand-primary" fill="currentColor" />
              Continue Learning
            </h2>
          </div>

          <AnimatePresence>
            {enrollments.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="premium-card p-12 md:p-20 text-center"
              >
                <div className="size-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-slate-300">
                  <BookOpen size={40} />
                </div>
                <h3 className="text-xl md:text-2xl font-black font-display mb-3">No active courses yet</h3>
                <p className="text-slate-500 font-medium text-sm md:text-base max-w-sm mx-auto">
                  You haven't been enrolled in any courses. Your administrator will add you to a course after payment is confirmed.
                </p>
              </motion.div>
            ) : (
              <div className="space-y-5">
                {enrollments.map((enrollment, idx) => {
                  const progress = progressMap[enrollment.course_id] || 0;
                  const counts = lessonCounts[enrollment.course_id] || { total: 0, completed: 0 };
                  const isComplete = progress === 100;

                  return (
                    <motion.div
                      key={enrollment.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="premium-card overflow-hidden group hover:border-brand-primary/30 hover:shadow-lg transition-all duration-300"
                    >
                      <div className="flex flex-col sm:flex-row gap-0">
                        {/* Thumbnail */}
                        <div className="w-full sm:w-48 md:w-56 h-44 sm:h-auto relative overflow-hidden flex-shrink-0">
                          <img
                            src={enrollment.courses?.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800'}
                            alt={enrollment.courses?.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          {isComplete && (
                            <div className="absolute top-3 left-3 bg-emerald-500 text-white text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={12} /> Complete
                            </div>
                          )}
                          {!isComplete && (
                            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full">
                              Week {enrollment.current_week || 1}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <h3 className="text-lg md:text-xl font-black font-display text-slate-900 group-hover:text-brand-primary transition-colors leading-tight">
                                {enrollment.courses?.title || 'Untitled Course'}
                              </h3>
                              <span className={`text-xs font-black px-3 py-1 rounded-full shrink-0 ${
                                isComplete
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-brand-primary/10 text-brand-primary'
                              }`}>
                                {isComplete ? 'Completed' : 'Active'}
                              </span>
                            </div>
                            <p className="text-slate-500 text-sm font-medium line-clamp-2 mb-5">
                              {enrollment.courses?.description}
                            </p>
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
                              <span className="text-slate-400">
                                {counts.completed}/{counts.total} Lessons
                              </span>
                              <span className={progress === 100 ? 'text-emerald-600' : 'text-brand-primary'}>
                                {progress}%
                              </span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 1, delay: 0.3 }}
                                className={`h-full rounded-full ${
                                  progress === 100
                                    ? 'bg-emerald-500'
                                    : 'bg-gradient-to-r from-brand-primary to-emerald-400'
                                }`}
                              />
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
                                <span className="flex items-center gap-1.5">
                                  <Clock size={12} />
                                  {enrollment.courses?.duration_weeks} weeks
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <BookOpen size={12} />
                                  {counts.total} lessons
                                </span>
                              </div>
                              <Link
                                to={`/student/course/${enrollment.course_id}`}
                                className="btn-primary py-2.5 px-5 text-sm"
                              >
                                {progress === 0 ? 'Start Course' : progress === 100 ? 'Review' : 'Continue'}
                                <ArrowRight size={16} />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">

          {/* Achievement Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 to-brand-secondary p-8 text-white"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <Star className="text-yellow-400 mb-5" size={28} fill="currentColor" />
            <h4 className="text-xl font-black font-display mb-3">Academy Insight</h4>
            <p className="text-indigo-200 font-medium leading-relaxed text-sm mb-6">
              {streak > 0
                ? `Outstanding! You've maintained a ${streak}-day learning streak. Consistency like yours leads to mastery.`
                : 'Start your learning streak today. Even 20 minutes of focused study daily compounds into extraordinary results.'}
            </p>
            <div className="flex items-center gap-3 bg-white/10 rounded-2xl p-4">
              <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Zap size={18} className="text-yellow-400" fill="currentColor" />
              </div>
              <div>
                <p className="text-xs font-black text-indigo-300 uppercase tracking-widest">Daily Goal</p>
                <p className="font-bold text-sm">Complete 1 lesson today</p>
              </div>
            </div>
          </motion.div>

          {/* Course Overview Cards */}
          {enrollments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="premium-card p-6 md:p-8"
            >
              <h4 className="text-lg font-black font-display mb-6 flex items-center gap-2">
                <Award size={20} className="text-brand-primary" />
                Course Progress
              </h4>
              <div className="space-y-5">
                {enrollments.map((e) => {
                  const p = progressMap[e.course_id] || 0;
                  return (
                    <div key={e.id}>
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-bold text-slate-800 text-sm truncate max-w-[70%]">
                          {e.courses?.title}
                        </p>
                        <p className="text-xs font-black text-brand-primary">{p}%</p>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${p}%` }}
                          transition={{ duration: 1 }}
                          className="h-full bg-gradient-to-r from-brand-primary to-emerald-400 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Upcoming Milestones */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="premium-card p-6 md:p-8"
          >
            <h4 className="text-lg font-black font-display mb-6 flex items-center gap-2">
              <Calendar size={20} className="text-brand-primary" />
              Your Journey
            </h4>
            <div className="space-y-5">
              {enrollments.length > 0 ? (
                enrollments.map((e) => {
                  const p = progressMap[e.course_id] || 0;
                  const counts = lessonCounts[e.course_id] || { total: 0, completed: 0 };
                  const remaining = counts.total - counts.completed;
                  return (
                    <div key={e.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
                      <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                        p === 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-primary/10 text-brand-primary'
                      }`}>
                        {p === 100 ? <CheckCircle2 size={18} /> : <Target size={18} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{e.courses?.title}</p>
                        <p className="text-xs text-slate-500 font-medium mt-1">
                          {p === 100
                            ? '🎉 Course completed!'
                            : remaining > 0
                            ? `${remaining} lesson${remaining !== 1 ? 's' : ''} remaining`
                            : 'No lessons added yet'}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4">
                  <p className="text-slate-400 text-sm font-medium">Enroll in a course to see your milestones</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}