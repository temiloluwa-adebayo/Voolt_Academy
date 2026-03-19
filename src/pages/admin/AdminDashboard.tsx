import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { motion } from 'motion/react';
import { 
  Users, 
  BookOpen, 
  TrendingUp, 
  Clock,
  Plus,
  ArrowUpRight,
  MoreHorizontal
} from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeCourses: 0,
    enrollments: 0,
    completionRate: 85
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [students, courses, enrollments] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'student'),
      supabase.from('courses').select('id', { count: 'exact' }),
      supabase.from('enrollments').select('id', { count: 'exact' })
    ]);

    setStats({
      totalStudents: students.count || 0,
      activeCourses: courses.count || 0,
      enrollments: enrollments.count || 0,
      completionRate: 85 // Mock for now
    });
  };

  const statCards = [
    { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Courses', value: stats.activeCourses, icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Enrollments', value: stats.enrollments, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Completion Rate', value: `${stats.completionRate}%`, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-10">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black font-display tracking-tight text-slate-900 mb-2">Academy Overview</h1>
          <p className="text-slate-500 font-medium">Welcome back, Commander. Here's what's happening today.</p>
        </div>
        <Link to="/admin/courses" className="btn-primary">
          <Plus size={20} /> Create New Course
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="premium-card p-8 group hover:border-brand-primary/30"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`size-14 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                <stat.icon size={28} />
              </div>
              <button className="text-slate-300 hover:text-slate-600 transition-colors">
                <ArrowUpRight size={20} />
              </button>
            </div>
            <p className="text-slate-500 font-bold text-sm mb-1 uppercase tracking-wider">{stat.label}</p>
            <p className="text-4xl font-black font-display text-slate-900">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="premium-card p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black font-display">Recent Students</h3>
            <button className="text-brand-primary font-bold text-sm hover:underline">View All</button>
          </div>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                    JD
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">John Doe</p>
                    <p className="text-xs font-medium text-slate-500">john@example.com</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">Active</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="premium-card p-8">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black font-display">Course Performance</h3>
            <button className="text-brand-primary font-bold text-sm hover:underline">Analytics</button>
          </div>
          <div className="space-y-8">
            {[
              { name: 'AI Automation Mastery', progress: 75, color: 'bg-emerald-500' },
              { name: 'Digital Marketing Pro', progress: 45, color: 'bg-indigo-500' },
              { name: 'Business Scaling', progress: 90, color: 'bg-orange-500' },
            ].map((course) => (
              <div key={course.name}>
                <div className="flex justify-between items-center mb-3">
                  <p className="font-bold text-slate-800">{course.name}</p>
                  <p className="text-sm font-black text-slate-900">{course.progress}%</p>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${course.progress}%` }}
                    className={`h-full ${course.color} rounded-full`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
