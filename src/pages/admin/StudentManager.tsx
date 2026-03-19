import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Plus, Search, Mail, Phone, Calendar,
  X, Copy, Check, Loader2, Trash2, UserPlus,
  BookOpen, ChevronDown, AlertCircle
} from 'lucide-react';

export default function StudentManager() {
  const [students, setStudents] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', courseId: '' });
  const [courses, setCourses] = useState<any[]>([]);
  const [generatedCreds, setGeneratedCreds] = useState<{ email: string; pass: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [enrollModal, setEnrollModal] = useState<{ studentId: string; name: string } | null>(null);
  const [enrollCourseId, setEnrollCourseId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [studentsRes, coursesRes, enrollRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false }),
        supabase.from('courses').select('id, title, slug'),
        supabase.from('enrollments').select('user_id, course_id, status, enrolled_at, courses(title)')
      ]);
      setStudents(studentsRes.data || []);
      setCourses(coursesRes.data || []);
      setEnrollments(enrollRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStudentEnrollments = (studentId: string) =>
    enrollments.filter(e => e.user_id === studentId);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
      if (!webhookUrl) throw new Error('Webhook URL not configured in .env');

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          full_name: form.fullName,
          phone: form.phone,
          course_id: form.courseId
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Registration failed: ${errText}`);
      }

      const result = await response.json();
      const data = Array.isArray(result) ? result[0] : result;
      const pass = data.generatedPassword || data.generated_password || 'Check n8n logs';

      setGeneratedCreds({ email: form.email, pass });

      // Wait for Supabase trigger to create profile, then enroll
      if (form.courseId) {
        setTimeout(async () => {
          // Find the newly created user profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', form.email)
            .single();

          if (profile) {
            await supabase.from('enrollments').upsert({
              user_id: profile.id,
              course_id: form.courseId,
              status: 'active',
              current_week: 1,
              enrolled_at: new Date().toISOString()
            }, { onConflict: 'user_id,course_id' });
          }
          fetchData();
        }, 2500);
      } else {
        setTimeout(() => fetchData(), 2500);
      }

    } catch (err: any) {
      setError(err.message || 'Error registering student');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnrollStudent = async () => {
    if (!enrollModal || !enrollCourseId) return;
    setEnrolling(true);
    try {
      const { error } = await supabase.from('enrollments').upsert({
        user_id: enrollModal.studentId,
        course_id: enrollCourseId,
        status: 'active',
        current_week: 1,
        enrolled_at: new Date().toISOString()
      }, { onConflict: 'user_id,course_id' });

      if (error) throw error;
      setEnrollModal(null);
      setEnrollCourseId('');
      fetchData();
    } catch (err: any) {
      alert('Enrollment error: ' + err.message);
    } finally {
      setEnrolling(false);
    }
  };

  const deleteStudent = async (id: string) => {
    try {
      await supabase.from('lesson_progress').delete().eq('user_id', id);
      await supabase.from('enrollments').delete().eq('user_id', id);
      await supabase.from('profiles').delete().eq('id', id);
      setDeleteConfirm(null);
      fetchData();
    } catch (err: any) {
      alert('Error removing student: ' + err.message);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const filteredStudents = students.filter(s =>
    (s.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const unenrolledCourses = (studentId: string) => {
    const enrolled = enrollments.filter(e => e.user_id === studentId).map(e => e.course_id);
    return courses.filter(c => !enrolled.includes(c.id));
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-slate-900 mb-2">Student Directory</h1>
          <p className="text-slate-500 font-medium text-sm">Manage academy members, enrollments, and access.</p>
        </div>
        <button
          onClick={() => { setIsModalOpen(true); setGeneratedCreds(null); setError(null); setForm({ fullName: '', email: '', phone: '', courseId: '' }); }}
          className="btn-primary w-full md:w-auto"
        >
          <UserPlus size={20} /> Add New Student
        </button>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: students.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Enrollments', value: enrollments.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Active Courses', value: courses.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Completions', value: enrollments.filter(e => e.status === 'completed').length, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(stat => (
          <div key={stat.label} className="premium-card p-5">
            <p className={`text-2xl font-black font-display ${stat.color}`}>{stat.value}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Student Table */}
      <div className="premium-card overflow-hidden">
        <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-11 pr-5 text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
            />
          </div>
          <p className="text-sm font-bold text-slate-500">{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="text-brand-primary animate-spin" size={28} />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-16">
            <Users className="text-slate-200 mx-auto mb-4" size={40} />
            <p className="text-slate-500 font-medium">
              {searchTerm ? 'No students match your search' : 'No students yet. Add your first student!'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredStudents.map((student) => {
              const studentEnrollments = getStudentEnrollments(student.id);
              const available = unenrolledCourses(student.id);
              return (
                <div key={student.id} className="p-5 md:p-6 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="size-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm shrink-0">
                        {(student.full_name || student.email || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">{student.full_name || 'Unknown'}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                          <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                            <Mail size={11} /> {student.email}
                          </span>
                          {student.phone && (
                            <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                              <Phone size={11} /> {student.phone}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                            <Calendar size={11} /> {new Date(student.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Enrollments */}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {studentEnrollments.length === 0 ? (
                            <span className="text-xs font-bold text-amber-500 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                              Not enrolled
                            </span>
                          ) : (
                            studentEnrollments.map((e: any) => (
                              <span key={e.course_id} className={`text-xs font-bold px-3 py-1 rounded-full ${
                                e.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                  : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'
                              }`}>
                                {e.courses?.title || 'Course'} {e.status === 'completed' ? '✓' : ''}
                              </span>
                            ))
                          )}
                          {available.length > 0 && (
                            <button
                              onClick={() => { setEnrollModal({ studentId: student.id, name: student.full_name }); setEnrollCourseId(''); }}
                              className="text-xs font-bold text-slate-400 hover:text-brand-primary flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-slate-200 hover:border-brand-primary transition-all"
                            >
                              <Plus size={11} /> Enroll
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setDeleteConfirm(student.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="premium-card w-full max-w-lg p-8 relative max-h-[90vh] overflow-y-auto"
            >
              <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-all">
                <X size={20} />
              </button>

              {!generatedCreds ? (
                <>
                  <h2 className="text-2xl font-black font-display mb-1">Register Student</h2>
                  <p className="text-slate-500 text-sm font-medium mb-7">n8n will generate a secure password and create their account.</p>

                  {error && (
                    <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                      <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-red-600 text-sm font-medium">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleAddStudent} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Full Name *</label>
                        <input required type="text" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className="input-premium py-3 text-sm" placeholder="John Doe" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number</label>
                        <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-premium py-3 text-sm" placeholder="+234..." />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Email Address *</label>
                      <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-premium py-3 text-sm" placeholder="student@example.com" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Enroll in Course *</label>
                      <div className="relative">
                        <select
                          required
                          value={form.courseId}
                          onChange={e => setForm({ ...form, courseId: e.target.value })}
                          className="input-premium py-3 text-sm appearance-none pr-10"
                        >
                          <option value="">Select a course</option>
                          {courses.map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 ml-1">Student will be automatically enrolled after registration</p>
                    </div>
                    <button type="submit" disabled={submitting} className="btn-primary w-full py-4 mt-2">
                      {submitting ? <><Loader2 size={18} className="animate-spin" /> Registering...</> : 'Generate Access & Register'}
                    </button>
                  </form>
                </>
              ) : (
                /* Success Screen */
                <div className="text-center">
                  <div className="size-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Check size={36} className="text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-black font-display mb-2">Student Registered!</h2>
                  <p className="text-slate-500 text-sm font-medium mb-8">
                    Account created and enrolled. Copy these credentials to share via WhatsApp.
                  </p>

                  <div className="space-y-3 mb-8 text-left">
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Login Credentials</p>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-1.5">Email</p>
                          <div className="flex items-center justify-between bg-white border border-slate-100 rounded-xl p-3">
                            <code className="text-brand-secondary font-bold text-sm">{generatedCreds.email}</code>
                            <button onClick={() => copyToClipboard(generatedCreds.email, 'email')} className="text-slate-400 hover:text-brand-primary ml-2 shrink-0">
                              {copied === 'email' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-1.5">Password</p>
                          <div className="flex items-center justify-between bg-white border border-slate-100 rounded-xl p-3">
                            <code className="text-brand-primary font-bold text-sm">{generatedCreds.pass}</code>
                            <button onClick={() => copyToClipboard(generatedCreds.pass, 'pass')} className="text-slate-400 hover:text-brand-primary ml-2 shrink-0">
                              {copied === 'pass' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => copyToClipboard(`Email: ${generatedCreds.email}\nPassword: ${generatedCreds.pass}\nApp: ${window.location.origin}/login`, 'all')}
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm transition-all flex items-center justify-center gap-2"
                    >
                      {copied === 'all' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      Copy All for WhatsApp
                    </button>
                  </div>

                  <button onClick={() => setIsModalOpen(false)} className="btn-primary w-full">Done</button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Enroll Existing Student Modal */}
      <AnimatePresence>
        {enrollModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="premium-card w-full max-w-sm p-8 relative"
            >
              <button onClick={() => setEnrollModal(null)} className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-all">
                <X size={18} />
              </button>
              <div className="size-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-5">
                <BookOpen size={22} className="text-brand-primary" />
              </div>
              <h3 className="text-xl font-black font-display mb-1">Enroll Student</h3>
              <p className="text-slate-500 text-sm font-medium mb-6">Enrolling <strong>{enrollModal.name}</strong> in a new course</p>

              <div className="space-y-4">
                <div className="relative">
                  <select
                    value={enrollCourseId}
                    onChange={e => setEnrollCourseId(e.target.value)}
                    className="input-premium appearance-none pr-10 text-sm"
                  >
                    <option value="">Select a course</option>
                    {unenrolledCourses(enrollModal.studentId).map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setEnrollModal(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-all text-sm">
                    Cancel
                  </button>
                  <button
                    onClick={handleEnrollStudent}
                    disabled={!enrollCourseId || enrolling}
                    className="flex-1 btn-primary py-3 disabled:opacity-50"
                  >
                    {enrolling ? <Loader2 size={16} className="animate-spin" /> : 'Enroll'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
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
              <h3 className="text-xl font-black font-display mb-2">Remove Student?</h3>
              <p className="text-slate-500 text-sm font-medium mb-7">This will remove the student and all their progress data. Their login will stop working.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm">Cancel</button>
                <button onClick={() => deleteStudent(deleteConfirm)} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl text-sm">Remove</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}