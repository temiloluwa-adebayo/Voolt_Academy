import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  HelpCircle, Plus, Trash2, Save, X, Check,
  ChevronDown, ChevronRight, Loader2, AlertCircle,
  BookOpen, BarChart2, Upload, Download, FileText,
  CheckCircle2, XCircle
} from 'lucide-react';

interface Course { id: string; title: string; duration_weeks: number; }
interface Quiz { id: string; course_id: string; week_number: number; title: string; pass_score: number; }
interface Question { id: string; quiz_id: string; question_text: string; order_index: number; options: Option[]; }
interface Option { id: string; question_id: string; option_text: string; is_correct: boolean; order_index: number; }

const CSV_TEMPLATE = `question,option_a,option_b,option_c,option_d,correct_answer
What is the capital of Nigeria?,Lagos,Abuja,Kano,Ibadan,B
Which of these is a programming language?,Excel,PowerPoint,Python,Word,C
What does AI stand for?,Automated Intelligence,Artificial Intelligence,Advanced Interface,Applied Invention,B
What is 2 + 2?,3,4,5,6,B
Which planet is closest to the sun?,Earth,Mars,Mercury,Venus,C`;

export default function QuizDesigner() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [showStats, setShowStats] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('courses').select('id, title, duration_weeks').then(({ data }) => setCourses(data || []));
  }, []);

  const loadQuiz = async (course: Course, week: number) => {
    setLoading(true);
    setSelectedCourse(course);
    setSelectedWeek(week);
    setQuestions([]);
    setQuiz(null);
    setShowStats(false);
    setImportResult(null);

    try {
      const { data: existingQuiz, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('course_id', course.id)
        .eq('week_number', week)
        .maybeSingle();

      if (error) throw error;

      if (existingQuiz) {
        setQuiz(existingQuiz);
        await loadQuestions(existingQuiz.id);
        const { data: attemptsData } = await supabase
          .from('quiz_attempts')
          .select('score, total, percentage, passed, attempted_at, profiles(full_name, email)')
          .eq('quiz_id', existingQuiz.id)
          .order('attempted_at', { ascending: false });
        setAttempts(attemptsData || []);
      }
    } catch (err: any) {
      console.error('Error loading quiz:', err);
      alert('Error loading quiz: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async (quizId: string) => {
    const { data, error } = await supabase
      .from('quiz_questions')
      .select('*, quiz_options(*)')
      .eq('quiz_id', quizId)
      .order('order_index');
    
    if (error) {
      console.error('Error loading questions:', error);
      return;
    }

    const qs = (data || []).map((q: any) => ({
      ...q,
      options: (q.quiz_options || []).sort((a: Option, b: Option) => a.order_index - b.order_index)
    }));
    setQuestions(qs);
    if (qs.length > 0) setExpandedQ(qs[0].id);
  };

  const createQuiz = async () => {
    if (!selectedCourse || !selectedWeek) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('quizzes').insert({
        course_id: selectedCourse.id,
        week_number: selectedWeek,
        title: `Week ${selectedWeek} Quiz`,
        pass_score: 70
      }).select().single();
      
      if (error) throw error;
      if (data) setQuiz(data);
    } catch (err: any) {
      console.error('Error creating quiz:', err);
      alert('Error creating quiz: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addQuestion = async (quizId?: string) => {
    const qid = quizId || quiz?.id;
    if (!qid) return;
    setSaving(true);
    try {
      const nextOrder = questions.length + 1;
      const { data: q, error } = await supabase.from('quiz_questions').insert({
        quiz_id: qid,
        question_text: `Question ${nextOrder}`,
        order_index: nextOrder
      }).select().single();

      if (error) throw error;

      if (q) {
        const optionsToInsert = [1, 2, 3, 4].map(i => ({
          question_id: q.id, 
          option_text: `Option ${i}`,
          is_correct: i === 1, 
          order_index: i
        }));
        const { data: opts, error: optsError } = await supabase.from('quiz_options').insert(optionsToInsert).select();
        if (optsError) throw optsError;
        
        setQuestions(prev => [...prev, { ...q, options: opts || [] }]);
        setExpandedQ(q.id);
      }
    } catch (err: any) {
      console.error('Error adding question:', err);
      alert('Error adding question: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateQuestion = (qId: string, text: string) =>
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, question_text: text } : q));

  const updateOption = (qId: string, optId: string, text: string) =>
    setQuestions(prev => prev.map(q =>
      q.id === qId ? { ...q, options: q.options.map(o => o.id === optId ? { ...o, option_text: text } : o) } : q));

  const setCorrectOption = (qId: string, optId: string) =>
    setQuestions(prev => prev.map(q =>
      q.id === qId ? { ...q, options: q.options.map(o => ({ ...o, is_correct: o.id === optId })) } : q));

  const saveQuestion = async (question: Question) => {
    setSaving(true);
    try {
      await supabase.from('quiz_questions').update({ question_text: question.question_text }).eq('id', question.id);
      await Promise.all(question.options.map(opt =>
        supabase.from('quiz_options').update({ option_text: opt.option_text, is_correct: opt.is_correct }).eq('id', opt.id)));
      alert('Question saved!');
    } catch (err: any) {
      console.error('Error saving question:', err);
      alert('Error saving question: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (qId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      // Delete options first (though Supabase might handle this with cascade)
      await supabase.from('quiz_options').delete().eq('question_id', qId);
      await supabase.from('quiz_questions').delete().eq('id', qId);
      setQuestions(prev => prev.filter(q => q.id !== qId));
      if (expandedQ === qId) setExpandedQ(null);
    } catch (err: any) {
      console.error('Error deleting question:', err);
      alert('Error deleting question: ' + err.message);
    }
  };

  const saveQuizSettings = async () => {
    if (!quiz) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('quizzes').update({ title: quiz.title, pass_score: quiz.pass_score }).eq('id', quiz.id);
      if (error) throw error;
      alert('Settings saved!');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      alert('Error saving settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── CSV TEMPLATE DOWNLOAD ─────────────────────────────────────────────────
  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voolt_quiz_template_week${selectedWeek || 'X'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── CSV PARSING & IMPORT ──────────────────────────────────────────────────
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; }
      else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += line[i]; }
    }
    result.push(current.trim());
    return result;
  };

  const processCSVFile = async (file: File) => {
    if (!quiz) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportResult({ success: 0, errors: ['Please upload a .csv file'] });
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const lines = text.trim().split('\n').filter(l => l.trim());

      if (lines.length < 2) {
        setImportResult({ success: 0, errors: ['CSV must have a header row and at least one question row.'] });
        setImporting(false);
        return;
      }

      const rows = lines.slice(1); // skip header
      const availableSlots = 15 - questions.length;
      const rowsToProcess = rows.slice(0, availableSlots);
      const errors: string[] = [];
      let success = 0;
      const newQuestions: Question[] = [];

      if (rows.length > availableSlots) {
        errors.push(`Only ${availableSlots} slot(s) remaining — ${rows.length - availableSlots} row(s) were skipped.`);
      }

      for (let i = 0; i < rowsToProcess.length; i++) {
        const cols = parseCSVLine(rowsToProcess[i]);
        const [question, optA, optB, optC, optD, correctAnswer] = cols;

        if (!question?.trim() || !optA?.trim() || !optB?.trim() || !optC?.trim() || !optD?.trim() || !correctAnswer?.trim()) {
          errors.push(`Row ${i + 2}: Missing required fields — skipped.`);
          continue;
        }

        const correctLetter = correctAnswer.trim().toUpperCase();
        if (!['A', 'B', 'C', 'D'].includes(correctLetter)) {
          errors.push(`Row ${i + 2}: correct_answer must be A, B, C, or D — got "${correctAnswer.trim()}" — skipped.`);
          continue;
        }

        const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correctLetter);

        const { data: q, error: qErr } = await supabase.from('quiz_questions').insert({
          quiz_id: quiz.id,
          question_text: question.trim(),
          order_index: questions.length + success + 1
        }).select().single();

        if (qErr || !q) {
          errors.push(`Row ${i + 2}: Database error saving question — ${qErr?.message || 'unknown'}`);
          continue;
        }

        const { data: opts } = await supabase.from('quiz_options').insert(
          [optA, optB, optC, optD].map((text, idx) => ({
            question_id: q.id,
            option_text: text.trim(),
            is_correct: idx === correctIndex,
            order_index: idx + 1
          }))
        ).select();

        newQuestions.push({ ...q, options: opts || [] });
        success++;
      }

      if (newQuestions.length > 0) {
        setQuestions(prev => {
          const updated = [...prev, ...newQuestions];
          if (prev.length === 0 && updated.length > 0) setExpandedQ(updated[0].id);
          return updated;
        });
      }

      setImportResult({ success, errors });
    } catch (err: any) {
      console.error('Import error:', err);
      setImportResult({ success: 0, errors: ['An unexpected error occurred during import: ' + err.message] });
    } finally {
      setImporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processCSVFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processCSVFile(file);
  };

  const weeks = selectedCourse ? Array.from({ length: selectedCourse.duration_weeks }, (_, i) => i + 1) : [];
  const getPassRemark = (pct: number) => {
    if (pct >= 90) return { text: 'Excellent!', color: 'text-emerald-600' };
    if (pct >= 70) return { text: 'Good Pass', color: 'text-blue-600' };
    if (pct >= 50) return { text: 'Below Pass', color: 'text-amber-600' };
    return { text: 'Failed', color: 'text-red-600' };
  };

  return (
    <div className="space-y-8 px-4 sm:px-0 pb-10">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="max-w-xl">
          <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-slate-900 mb-2">Quiz Designer</h1>
          <p className="text-slate-500 font-medium text-sm">Create weekly MCQ quizzes — type manually or import from CSV.</p>
        </div>
        {quiz && questions.length < 15 && (
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={downloadTemplate}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:text-slate-900 font-bold text-sm transition-all shadow-sm"
            >
              <Download size={16} /> <span className="sm:hidden lg:inline">Template</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-indigo-700 hover:bg-indigo-100 font-bold text-sm transition-all"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Import CSV
            </button>
            <button onClick={() => addQuestion()} disabled={saving} className="btn-primary justify-center">
              <Plus size={18} /> Add Question ({questions.length}/15)
            </button>
          </div>
        )}
      </header>

      {/* Import Result Banner */}
      <AnimatePresence>
        {importResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`premium-card p-5 border-l-4 ${importResult.success > 0 ? 'border-emerald-400' : 'border-red-400'}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {importResult.success > 0
                  ? <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                  : <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />}
                <div>
                  <p className="font-bold text-slate-900 text-sm">
                    {importResult.success > 0
                      ? `✅ Imported ${importResult.success} question${importResult.success !== 1 ? 's' : ''} successfully!`
                      : 'Import failed — no questions were added.'}
                  </p>
                  {importResult.errors.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {importResult.errors.map((e, i) => (
                        <li key={i} className="text-xs text-amber-600 font-medium">⚠ {e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <button onClick={() => setImportResult(null)} className="text-slate-400 hover:text-slate-600 shrink-0">
                <XCircle size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Left Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="premium-card p-6">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Select Course</p>
            <div className="space-y-2">
              {courses.map(course => (
                <button
                  key={course.id}
                  onClick={() => { setSelectedCourse(course); setSelectedWeek(null); setQuiz(null); setQuestions([]); setImportResult(null); }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    selectedCourse?.id === course.id ? 'bg-brand-primary text-white shadow-md' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {course.title}
                </button>
              ))}
            </div>
          </div>

          {selectedCourse && (
            <div className="premium-card p-6">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Select Week</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-4 gap-2">
                {weeks.map(week => (
                  <button
                    key={week}
                    onClick={() => loadQuiz(selectedCourse, week)}
                    className={`aspect-square rounded-xl text-sm font-black transition-all flex items-center justify-center ${
                      selectedWeek === week
                        ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                    }`}
                  >
                    {week}
                  </button>
                ))}
              </div>
            </div>
          )}

          {quiz && (
            <div className="premium-card p-6 space-y-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Quiz Settings</p>
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Quiz Title</label>
                <input type="text" value={quiz.title} onChange={e => setQuiz({ ...quiz, title: e.target.value })} className="input-premium py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Pass Score (%)</label>
                <input type="number" value={quiz.pass_score} onChange={e => setQuiz({ ...quiz, pass_score: parseInt(e.target.value) || 70 })} className="input-premium py-2.5 text-sm" min={0} max={100} />
              </div>
              <button onClick={saveQuizSettings} disabled={saving} className="btn-primary w-full py-3 text-sm justify-center">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} /> Save Settings</>}
              </button>
            </div>
          )}

          {/* CSV Guide */}
          {quiz && (
            <div className="premium-card p-6 border-l-4 border-indigo-400">
              <div className="flex items-start gap-3">
                <FileText size={18} className="text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900 text-sm mb-2">CSV Column Format</p>
                  <div className="bg-slate-900 rounded-xl p-3 text-[10px] font-mono text-emerald-400 leading-relaxed mb-3 overflow-x-auto whitespace-nowrap">
                    question, option_a, option_b, option_c, option_d, correct_answer
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    <strong>correct_answer</strong> = A, B, C, or D
                  </p>
                  <button onClick={downloadTemplate} className="mt-3 flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:underline">
                    <Download size={12} /> Download template
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          {quiz && attempts.length > 0 && (
            <div className="premium-card p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Attempt Stats</p>
                <button onClick={() => setShowStats(!showStats)} className="text-brand-primary hover:bg-brand-primary/5 p-1 rounded-lg transition-all"><BarChart2 size={16} /></button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-slate-500 font-medium">Attempts</span><span className="font-bold">{attempts.length}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500 font-medium">Pass Rate</span><span className="font-bold text-emerald-600">{Math.round((attempts.filter(a => a.passed).length / attempts.length) * 100)}%</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500 font-medium">Avg Score</span><span className="font-bold">{Math.round(attempts.reduce((s: number, a: any) => s + a.percentage, 0) / attempts.length)}%</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Questions */}
        <div className="lg:col-span-3 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="text-brand-primary animate-spin" size={40} />
              <p className="text-slate-400 font-bold text-sm">Loading quiz content...</p>
            </div>
          ) : !selectedCourse ? (
            <div className="premium-card p-12 md:p-20 text-center">
              <div className="size-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <BookOpen className="text-slate-200" size={40} />
              </div>
              <h3 className="text-xl font-black font-display mb-2">Select a Course</h3>
              <p className="text-slate-400 text-sm max-w-xs mx-auto">Choose a course from the left panel to manage its weekly assessments.</p>
            </div>
          ) : !selectedWeek ? (
            <div className="premium-card p-12 md:p-20 text-center">
              <div className="size-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <HelpCircle className="text-slate-200" size={40} />
              </div>
              <h3 className="text-xl font-black font-display mb-2">Select a Week</h3>
              <p className="text-slate-400 text-sm max-w-xs mx-auto">Pick which week's quiz you want to create or edit.</p>
            </div>
          ) : !quiz ? (
            <div className="premium-card p-12 md:p-20 text-center">
              <div className="size-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8">
                <HelpCircle size={48} className="text-slate-300" />
              </div>
              <h3 className="text-2xl font-black font-display mb-3">No Quiz Yet</h3>
              <p className="text-slate-500 text-sm mb-10 max-w-sm mx-auto">No quiz for Week {selectedWeek} of {selectedCourse.title}. Create one to start adding questions.</p>
              <button onClick={createQuiz} disabled={saving} className="btn-primary mx-auto px-10 py-4">
                {saving ? <Loader2 size={20} className="animate-spin" /> : <><Plus size={20} /> Create Week {selectedWeek} Quiz</>}
              </button>
            </div>
          ) : questions.length === 0 ? (
            /* Empty state — choose method */
            <div
              className={`premium-card p-8 md:p-12 border-2 border-dashed transition-all ${dragOver ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-200'}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="text-center mb-10">
                {importing ? (
                  <><Loader2 size={48} className="text-brand-primary animate-spin mx-auto mb-4" /><p className="font-bold text-slate-700">Importing questions...</p></>
                ) : (
                  <><Upload size={48} className="text-slate-300 mx-auto mb-4" /><p className="text-lg font-bold text-slate-700 mb-1">Drop your CSV here or choose a method</p><p className="text-slate-400 text-sm">You can mix manual entry and CSV imports</p></>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <button onClick={() => addQuestion()} className="p-8 border-2 border-slate-100 hover:border-brand-primary rounded-3xl text-left transition-all group bg-white">
                  <div className="size-14 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-brand-primary/20 transition-all">
                    <Plus size={24} className="text-brand-primary" />
                  </div>
                  <p className="font-bold text-slate-900 mb-2">Add Manually</p>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">Type each question and answer one by one using the editor.</p>
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-8 border-2 border-slate-100 hover:border-indigo-400 rounded-3xl text-left transition-all group bg-white">
                  <div className="size-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-100 transition-all">
                    <Upload size={24} className="text-indigo-600" />
                  </div>
                  <p className="font-bold text-slate-900 mb-2">Import from CSV</p>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">Upload up to 15 questions at once using our template.</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                    className="text-xs text-indigo-600 font-bold mt-4 flex items-center gap-1.5 hover:underline"
                  >
                    <Download size={12} /> Download template
                  </button>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
                <p className="text-sm font-bold text-slate-600">{questions.length} of 15 questions</p>
                <div className="flex gap-1.5">
                  {Array.from({ length: 15 }, (_, i) => (
                    <div key={i} className={`h-2.5 w-4 sm:w-6 rounded-full transition-all ${i < questions.length ? 'bg-brand-primary' : 'bg-slate-100'}`} />
                  ))}
                </div>
              </div>

              {/* Drop zone strip when questions exist */}
              {questions.length < 15 && (
                <div
                  className={`border-2 border-dashed rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${dragOver ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                      {importing
                        ? <Loader2 size={20} className="animate-spin" />
                        : <Upload size={20} />}
                    </div>
                    <p className="text-sm font-bold text-slate-500 truncate">
                      {importing ? 'Importing...' : dragOver ? '🎉 Drop to import!' : `Drag & drop CSV to add more (${15 - questions.length} left)`}
                    </p>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors shrink-0">
                    Browse Files
                  </button>
                </div>
              )}

              {/* Question cards */}
              <div className="space-y-4">
                {questions.map((question, qIdx) => (
                  <div key={question.id} className="premium-card overflow-hidden border-slate-100">
                    <div
                      className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedQ(expandedQ === question.id ? null : question.id)}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="size-10 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-black text-sm shrink-0">{qIdx + 1}</div>
                        <p className="font-bold text-slate-900 truncate text-sm sm:text-base">{question.question_text || 'Untitled question'}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        {question.options.some(o => o.is_correct && o.option_text)
                          ? <span className="hidden sm:inline-flex text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">Ready</span>
                          : <span className="hidden sm:inline-flex text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-50 px-3 py-1.5 rounded-full">Incomplete</span>}
                        <button onClick={(e) => { e.stopPropagation(); deleteQuestion(question.id); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                          <Trash2 size={16} />
                        </button>
                        <div className={`transition-transform duration-300 ${expandedQ === question.id ? 'rotate-180' : ''}`}>
                          <ChevronDown size={20} className="text-slate-400" />
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedQ === question.id && (
                        <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                          <div className="p-6 pt-2 space-y-6 border-t border-slate-50">
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Question Text</label>
                              <textarea value={question.question_text} onChange={e => updateQuestion(question.id, e.target.value)} className="input-premium text-sm sm:text-base py-4 resize-none font-bold" rows={3} placeholder="Type your question here..." />
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">Answer Options — Select the correct one</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {question.options.map((opt, oIdx) => (
                                  <div key={opt.id} className={`flex items-center gap-4 p-4 rounded-3xl border-2 transition-all ${opt.is_correct ? 'border-emerald-400 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                                    <button onClick={() => setCorrectOption(question.id, opt.id)} className={`size-8 rounded-2xl border-2 flex items-center justify-center shrink-0 transition-all ${opt.is_correct ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200' : 'border-slate-300 bg-white hover:border-brand-primary'}`}>
                                      {opt.is_correct ? <Check size={16} /> : <span className="text-[10px] font-black text-slate-300">{String.fromCharCode(65 + oIdx)}</span>}
                                    </button>
                                    <input type="text" value={opt.option_text} onChange={e => updateOption(question.id, opt.id, e.target.value)} className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400" placeholder={`Option ${String.fromCharCode(65 + oIdx)}...`} />
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex justify-end pt-2">
                              <button onClick={() => saveQuestion(question)} disabled={saving} className="btn-primary py-3 px-8 text-sm">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Save Question</>}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>

              {questions.length < 15 && (
                <button onClick={() => addQuestion()} disabled={saving} className="w-full py-10 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-slate-400 font-bold hover:border-brand-primary hover:text-brand-primary transition-all flex flex-col items-center justify-center gap-3 bg-white group">
                  <div className="size-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-brand-primary/10 transition-all">
                    <Plus size={28} />
                  </div>
                  <span className="text-sm">Add Question Manually ({questions.length}/15)</span>
                </button>
              )}

              {questions.length === 15 && (
                <div className="premium-card p-6 border-emerald-200 bg-emerald-50 flex items-center gap-5">
                  <div className="size-14 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-200">
                    <Check size={28} className="text-white" />
                  </div>
                  <div>
                    <p className="font-black text-emerald-800 text-lg">Quiz Complete!</p>
                    <p className="text-sm text-emerald-600 font-medium">All 15 questions have been added. Students can now take this assessment.</p>
                  </div>
                </div>
              )}

              {showStats && attempts.length > 0 && (
                <div className="premium-card overflow-hidden border-slate-100">
                  <div className="p-6 border-b border-slate-50 bg-slate-50/50"><h4 className="font-black font-display text-lg">Student Performance</h4></div>
                  <div className="divide-y divide-slate-50">
                    {attempts.map((attempt: any, i: number) => {
                      const remark = getPassRemark(attempt.percentage);
                      return (
                        <div key={i} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/30 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs">
                              {(attempt.profiles?.full_name || 'U').charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-slate-900">{attempt.profiles?.full_name || 'Unknown Student'}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(attempt.attempted_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                            <div className="text-right">
                              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-0.5">Score</p>
                              <p className="font-bold text-sm">{attempt.score}/{attempt.total}</p>
                            </div>
                            <div className={`px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest ${attempt.passed ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                              {attempt.percentage}% · {remark.text}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
