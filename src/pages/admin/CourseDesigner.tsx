import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, Plus, Settings, Video, Calendar,
  ChevronRight, Trash2, Save, X, Clock, Layout,
  Edit2, Check, AlertCircle, Loader2, Link
} from 'lucide-react';

// Smart thumbnail system - pairs of 2 weeks get matching images
const WEEK_THUMBNAILS: Record<number, string> = {
  1: 'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=800',
  2: 'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=800',
  3: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',
  4: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',
  5: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
  6: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
  7: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800',
  8: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800',
};

const COURSE_THUMBNAILS: Record<string, string> = {
  'digital-marketing-mastery': 'https://images.unsplash.com/photo-1557838923-2985c318be48?w=800',
  'ai-automation-mastery': 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800',
};

const DEFAULT_THUMBNAILS = [
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',
  'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=800',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
  'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
  'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800',
];

const getCourseThumbnail = (course: any) => {
  if (course.thumbnail_url && course.thumbnail_url.includes('unsplash.com')) {
    return course.thumbnail_url;
  }
  if (COURSE_THUMBNAILS[course.slug]) return COURSE_THUMBNAILS[course.slug];
  // Pick a default based on course id hash
  const idx = course.id ? (course.id as string).charCodeAt(0) % DEFAULT_THUMBNAILS.length : 0;
  return DEFAULT_THUMBNAILS[idx];
};

interface Lesson {
  id: string;
  title: string;
  description: string;
  video_url: string;
  week_number: number;
  order_index: number;
  course_id: string;
}

interface EditingLesson {
  id: string;
  title: string;
  description: string;
  video_url: string;
}

export default function CourseDesigner() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Editing state
  const [editingLesson, setEditingLesson] = useState<EditingLesson | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    thumbnail_url: '',
    duration_weeks: 8
  });

  useEffect(() => { fetchCourses(); }, []);

  const fetchCourses = async () => {
    const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
    setCourses(data || []);
    setLoading(false);
  };

  const fetchLessons = async (course: any) => {
    setSelectedCourse(course);
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .eq('course_id', course.id)
      .order('week_number')
      .order('order_index');
    setLessons(data || []);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const slug = courseForm.title.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

      // Use a proper Unsplash thumbnail if none given or if not a direct image
      let thumbnail = courseForm.thumbnail_url;
      if (!thumbnail || !thumbnail.includes('unsplash.com')) {
        const idx = courses.length % DEFAULT_THUMBNAILS.length;
        thumbnail = DEFAULT_THUMBNAILS[idx];
      }

      const { error } = await supabase.from('courses').insert([{
        title: courseForm.title,
        description: courseForm.description || `Master ${courseForm.title} in ${courseForm.duration_weeks} weeks.`,
        slug,
        thumbnail_url: thumbnail,
        duration_weeks: courseForm.duration_weeks,
        is_active: true
      }]);

      if (error) throw error;
      await fetchCourses();
      setIsModalOpen(false);
      setCourseForm({ title: '', description: '', thumbnail_url: '', duration_weeks: 8 });
    } catch (err: any) {
      alert(err.message || 'Error creating course');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      // Delete lessons first, then enrollments, then course
      await supabase.from('lesson_progress').delete().eq('course_id', courseId);
      await supabase.from('lessons').delete().eq('course_id', courseId);
      await supabase.from('enrollments').delete().eq('course_id', courseId);
      const { error } = await supabase.from('courses').delete().eq('id', courseId);
      if (error) throw error;
      setDeleteConfirm(null);
      fetchCourses();
    } catch (err: any) {
      alert('Error deleting course: ' + err.message);
    }
  };

  const handleAddWeek = async () => {
    if (!selectedCourse) return;
    const existingWeeks = [...new Set(lessons.map(l => l.week_number))];
    const nextWeek = existingWeeks.length > 0 ? Math.max(...existingWeeks) + 1 : 1;
    const { data, error } = await supabase.from('lessons').insert({
      course_id: selectedCourse.id,
      week_number: nextWeek,
      title: `Week ${nextWeek} Introduction`,
      description: '',
      video_url: '',
      order_index: 1
    }).select().single();
    if (!error && data) {
      setLessons(prev => [...prev, data]);
    }
  };

  const handleAddLesson = async (weekNum: number) => {
    const weekLessons = lessons.filter(l => l.week_number === weekNum);
    const { data, error } = await supabase.from('lessons').insert({
      course_id: selectedCourse.id,
      week_number: weekNum,
      title: 'New Lesson',
      description: '',
      video_url: '',
      order_index: weekLessons.length + 1
    }).select().single();
    if (!error && data) {
      setLessons(prev => [...prev, data]);
      // Auto-open edit mode for new lesson
      setEditingLessonId(data.id);
      setEditingLesson({ id: data.id, title: data.title, description: data.description, video_url: data.video_url });
    }
  };

  const startEditLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setEditingLesson({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description || '',
      video_url: lesson.video_url || ''
    });
  };

  const cancelEditLesson = () => {
    setEditingLessonId(null);
    setEditingLesson(null);
  };

  const saveLesson = async () => {
    if (!editingLesson) return;
    setSaving(true);
    const { error } = await supabase.from('lessons').update({
      title: editingLesson.title,
      description: editingLesson.description,
      video_url: editingLesson.video_url
    }).eq('id', editingLesson.id);

    if (!error) {
      setLessons(prev => prev.map(l =>
        l.id === editingLesson.id
          ? { ...l, title: editingLesson.title, description: editingLesson.description, video_url: editingLesson.video_url }
          : l
      ));
      setEditingLessonId(null);
      setEditingLesson(null);
    } else {
      alert('Error saving lesson: ' + error.message);
    }
    setSaving(false);
  };

  const deleteLesson = async (id: string) => {
    await supabase.from('lesson_progress').delete().eq('lesson_id', id);
    const { error } = await supabase.from('lessons').delete().eq('id', id);
    if (!error) {
      setLessons(prev => prev.filter(l => l.id !== id));
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedCourse) return;
    setSaving(true);
    const { error } = await supabase.from('courses').update({
      duration_weeks: selectedCourse.duration_weeks,
      title: selectedCourse.title,
      description: selectedCourse.description
    }).eq('id', selectedCourse.id);

    if (!error) {
      await fetchCourses();
      alert('Course configuration saved!');
    } else {
      alert('Error: ' + error.message);
    }
    setSaving(false);
  };

  // Group lessons by week
  const weekGroups: Record<number, Lesson[]> = lessons.reduce((acc: Record<number, Lesson[]>, l: Lesson) => {
    if (!acc[l.week_number]) acc[l.week_number] = [];
    acc[l.week_number].push(l);
    return acc;
  }, {});

  const getVideoLabel = (url: string) => {
    if (!url) return 'No video set — click Edit to add';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return '▶ YouTube Video';
    if (url.includes('vimeo.com')) return '▶ Vimeo Video';
    if (url.includes('drive.google.com')) return '▶ Google Drive Video';
    if (url.length > 10 && !url.includes('.')) return `▶ Google Drive ID: ${url.slice(0, 20)}...`;
    return `▶ ${url.slice(0, 40)}...`;
  };

  return (
    <div className="space-y-8 px-0">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-slate-900 mb-2">
            {selectedCourse ? selectedCourse.title : 'Course Architect'}
          </h1>
          <p className="text-slate-500 font-medium text-sm">
            {selectedCourse ? 'Managing Curriculum — click any lesson to edit it' : 'Design curriculum, set timelines, and manage content.'}
          </p>
        </div>
        {!selectedCourse && (
          <button onClick={() => setIsModalOpen(true)} className="btn-primary w-full md:w-auto">
            <Plus size={20} /> Design New Course
          </button>
        )}
        {selectedCourse && (
          <button
            onClick={() => { setSelectedCourse(null); setLessons([]); setEditingLessonId(null); }}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:text-slate-900 font-bold text-sm transition-all shadow-sm"
          >
            <ChevronRight className="rotate-180" size={18} /> All Courses
          </button>
        )}
      </header>

      {/* Course Grid */}
      {!selectedCourse && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-3 flex justify-center py-20">
              <Loader2 className="text-brand-primary animate-spin" size={32} />
            </div>
          ) : courses.length === 0 ? (
            <div className="col-span-3 premium-card p-16 text-center">
              <BookOpen className="text-slate-300 mx-auto mb-4" size={48} />
              <h3 className="text-xl font-black font-display mb-2">No courses yet</h3>
              <p className="text-slate-500 mb-6">Create your first course to get started.</p>
              <button onClick={() => setIsModalOpen(true)} className="btn-primary mx-auto">
                <Plus size={18} /> Create Course
              </button>
            </div>
          ) : (
            courses.map((course) => (
              <motion.div
                key={course.id}
                whileHover={{ y: -6 }}
                className="premium-card overflow-hidden group cursor-pointer relative"
              >
                {/* Delete button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(course.id); }}
                  className="absolute top-4 right-4 z-20 size-9 bg-white/90 backdrop-blur rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={15} />
                </button>

                <div
                  className="h-48 relative overflow-hidden bg-slate-100"
                  onClick={() => fetchLessons(course)}
                >
                  <img
                    src={getCourseThumbnail(course)}
                    alt={course.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-xl text-xs font-black uppercase tracking-widest text-slate-900 shadow">
                    {course.duration_weeks} Weeks
                  </div>
                  <div className="absolute bottom-4 left-4 right-12">
                    <p className="text-white font-black font-display text-lg leading-tight">{course.title}</p>
                  </div>
                </div>

                <div className="p-6" onClick={() => fetchLessons(course)}>
                  <p className="text-slate-500 text-sm font-medium line-clamp-2 mb-4">{course.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wide">
                      <Layout size={13} />
                      {lessons.filter(l => l.course_id === course.id).length} lessons
                    </div>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Curriculum Editor */}
      {selectedCourse && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Weeks & Lessons */}
          <div className="lg:col-span-2 space-y-4">
            {Object.keys(weekGroups).length === 0 ? (
              <div className="premium-card p-12 text-center">
                <Video className="text-slate-300 mx-auto mb-4" size={40} />
                <h3 className="text-lg font-black font-display mb-2">No content yet</h3>
                <p className="text-slate-500 text-sm mb-6">Click "Add Week" below to start building your curriculum.</p>
              </div>
            ) : (
              Object.entries(weekGroups).map(([weekNum, weekLessons]: [string, Lesson[]]) => {
                const week = Number(weekNum);
                const thumb = WEEK_THUMBNAILS[week] || DEFAULT_THUMBNAILS[week % DEFAULT_THUMBNAILS.length];
                return (
                  <div key={week} className="premium-card overflow-hidden">
                    {/* Week Header */}
                    <div className="relative h-24 overflow-hidden">
                      <img src={thumb} alt="" className="w-full h-full object-cover opacity-40" />
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 to-slate-700/40 flex items-center justify-between px-6">
                        <div>
                          <p className="text-xs font-black text-slate-300 uppercase tracking-widest mb-1">Week {week}</p>
                          <p className="text-white font-black font-display text-lg">{weekLessons.length} Lesson{weekLessons.length !== 1 ? 's' : ''}</p>
                        </div>
                        <button
                          onClick={() => handleAddLesson(week)}
                          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2 rounded-xl border border-white/20 transition-all"
                        >
                          <Plus size={14} /> Add Lesson
                        </button>
                      </div>
                    </div>

                    {/* Lessons */}
                    <div className="p-4 space-y-3">
                      {weekLessons.map((lesson, idx) => (
                        <div key={lesson.id}>
                          {editingLessonId === lesson.id ? (
                            /* Edit Mode */
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="border-2 border-brand-primary/30 rounded-2xl p-5 bg-brand-primary/3 space-y-4"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-black text-brand-primary uppercase tracking-widest">Editing Lesson {idx + 1}</p>
                                <button onClick={cancelEditLesson} className="p-1 text-slate-400 hover:text-slate-600">
                                  <X size={16} />
                                </button>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Lesson Title *</label>
                                <input
                                  type="text"
                                  value={editingLesson?.title || ''}
                                  onChange={e => setEditingLesson(prev => prev ? { ...prev, title: e.target.value } : null)}
                                  className="input-premium py-3 text-sm"
                                  placeholder="e.g. Introduction to AI Tools"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                                  <Link size={12} /> Video URL or Google Drive ID
                                </label>
                                <input
                                  type="text"
                                  value={editingLesson?.video_url || ''}
                                  onChange={e => setEditingLesson(prev => prev ? { ...prev, video_url: e.target.value } : null)}
                                  className="input-premium py-3 text-sm font-mono"
                                  placeholder="YouTube URL, Vimeo URL, or Google Drive File ID"
                                />
                                <p className="text-xs text-slate-400 mt-1.5 ml-1">
                                  Paste a YouTube link, Vimeo link, or the File ID from a Google Drive video (e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs)
                                </p>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Description (Optional)</label>
                                <textarea
                                  value={editingLesson?.description || ''}
                                  onChange={e => setEditingLesson(prev => prev ? { ...prev, description: e.target.value } : null)}
                                  className="input-premium py-3 text-sm resize-none"
                                  rows={2}
                                  placeholder="What will students learn in this lesson?"
                                />
                              </div>

                              <div className="flex gap-3 pt-1">
                                <button
                                  onClick={saveLesson}
                                  disabled={saving || !editingLesson?.title}
                                  className="btn-primary py-2.5 px-5 text-sm flex-1"
                                >
                                  {saving ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Save Lesson</>}
                                </button>
                                <button onClick={cancelEditLesson} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-all">
                                  Cancel
                                </button>
                              </div>
                            </motion.div>
                          ) : (
                            /* View Mode */
                            <div className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl group transition-all">
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="size-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-brand-primary transition-colors shrink-0">
                                  <Video size={18} />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 text-sm truncate">{lesson.title}</p>
                                  <p className={`text-xs font-medium mt-0.5 truncate ${lesson.video_url ? 'text-brand-primary' : 'text-amber-500'}`}>
                                    {lesson.video_url ? getVideoLabel(lesson.video_url) : '⚠ No video — click Edit to add'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                <button
                                  onClick={() => startEditLesson(lesson)}
                                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 rounded-xl transition-all"
                                >
                                  <Edit2 size={13} /> Edit
                                </button>
                                <button
                                  onClick={() => deleteLesson(lesson.id)}
                                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}

            {/* Add Week */}
            <button
              onClick={handleAddWeek}
              className="w-full py-5 border-2 border-dashed border-slate-200 rounded-[2rem] text-slate-400 font-bold hover:border-brand-primary hover:text-brand-primary transition-all flex items-center justify-center gap-3 text-sm"
            >
              <Plus size={20} /> Add New Week to Curriculum
            </button>
          </div>

          {/* Course Settings */}
          <div className="space-y-6">
            <div className="premium-card p-6 md:p-8 sticky top-6">
              <h4 className="text-lg font-black font-display mb-6 flex items-center gap-2">
                <Settings size={18} className="text-brand-primary" /> Course Settings
              </h4>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Course Title</label>
                  <input
                    type="text"
                    value={selectedCourse.title}
                    onChange={e => setSelectedCourse({ ...selectedCourse, title: e.target.value })}
                    className="input-premium text-sm py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                  <textarea
                    value={selectedCourse.description || ''}
                    onChange={e => setSelectedCourse({ ...selectedCourse, description: e.target.value })}
                    className="input-premium text-sm py-3 resize-none"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Clock size={14} /> Duration (Weeks)
                  </label>
                  <input
                    type="number"
                    value={selectedCourse.duration_weeks || 8}
                    onChange={e => setSelectedCourse({ ...selectedCourse, duration_weeks: parseInt(e.target.value) || 8 })}
                    className="input-premium text-sm py-3"
                    min={1} max={52}
                  />
                </div>

                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                  <div className="size-3 bg-emerald-500 rounded-full animate-pulse" />
                  <div>
                    <p className="text-xs font-black text-emerald-700 uppercase tracking-widest">Content Mode</p>
                    <p className="text-xs text-emerald-600 font-medium mt-0.5">Weekly lesson release</p>
                  </div>
                </div>

                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="btn-primary w-full"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Save Configuration</>}
                </button>

                {/* Stats */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Course Stats</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-medium">Total Weeks</span>
                    <span className="font-bold text-slate-900">{Object.keys(weekGroups).length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-medium">Total Lessons</span>
                    <span className="font-bold text-slate-900">{lessons.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-medium">With Video</span>
                    <span className="font-bold text-emerald-600">{lessons.filter(l => l.video_url).length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-medium">Missing Video</span>
                    <span className={`font-bold ${lessons.filter(l => !l.video_url).length > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                      {lessons.filter(l => !l.video_url).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Google Drive Help */}
            <div className="premium-card p-6 border-l-4 border-amber-400">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900 text-sm mb-2">How to get a Google Drive Video ID</p>
                  <ol className="text-xs text-slate-500 space-y-1.5 font-medium list-decimal list-inside">
                    <li>Upload your video to Google Drive</li>
                    <li>Right-click → "Get link" → "Anyone with the link"</li>
                    <li>Copy the link — it looks like: drive.google.com/file/d/<strong className="text-slate-700">THIS_PART</strong>/view</li>
                    <li>Paste just that ID (or the full link) in the lesson editor</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Course Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="premium-card w-full max-w-lg p-8 relative"
            >
              <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-all">
                <X size={20} />
              </button>
              <h2 className="text-2xl font-black font-display mb-1">Design New Course</h2>
              <p className="text-slate-500 text-sm font-medium mb-7">Set up your course structure. You can add lessons after.</p>

              <form onSubmit={handleCreateCourse} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Course Title *</label>
                  <input
                    required
                    type="text"
                    value={courseForm.title}
                    onChange={e => setCourseForm({ ...courseForm, title: e.target.value })}
                    className="input-premium"
                    placeholder="e.g. AI Automation Mastery"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                  <textarea
                    value={courseForm.description}
                    onChange={e => setCourseForm({ ...courseForm, description: e.target.value })}
                    className="input-premium resize-none"
                    rows={2}
                    placeholder="What will students learn?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Thumbnail Image URL (Optional)</label>
                  <input
                    type="url"
                    value={courseForm.thumbnail_url}
                    onChange={e => setCourseForm({ ...courseForm, thumbnail_url: e.target.value })}
                    className="input-premium"
                    placeholder="https://images.unsplash.com/... (leave blank for auto)"
                  />
                  <p className="text-xs text-slate-400 mt-1 ml-1">Leave blank to auto-assign a professional image</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Duration (Weeks)</label>
                  <input
                    required
                    type="number"
                    value={courseForm.duration_weeks}
                    onChange={e => setCourseForm({ ...courseForm, duration_weeks: parseInt(e.target.value) || 8 })}
                    className="input-premium"
                    min={1} max={52}
                  />
                </div>
                <button type="submit" disabled={saving} className="btn-primary w-full py-4">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : 'Launch Course Architecture'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="premium-card w-full max-w-sm p-8 text-center"
            >
              <div className="size-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-xl font-black font-display mb-2">Delete Course?</h3>
              <p className="text-slate-500 text-sm font-medium mb-7">
                This will permanently delete the course, all its lessons, and all student enrollments. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all text-sm">
                  Cancel
                </button>
                <button onClick={() => handleDeleteCourse(deleteConfirm)} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-all text-sm">
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
