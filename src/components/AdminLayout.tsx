import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard, Users, BookOpen, Settings,
  LogOut, Bell, Search, Menu, X, HelpCircle
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard, path: '/admin' },
    { label: 'Students', icon: Users, path: '/admin/students' },
    { label: 'Courses', icon: BookOpen, path: '/admin/courses' },
    { label: 'Quizzes', icon: HelpCircle, path: '/admin/quizzes' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-brand-bg">
      {/* Mobile Header */}
      <header className="md:hidden glass-nav h-20 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="size-8 bg-brand-primary rounded-lg flex items-center justify-center shadow-lg shadow-brand-primary/20">
            <span className="text-white font-black text-lg font-display">V</span>
          </div>
          <span className="font-black text-lg font-display tracking-tight">VOOLT Admin</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-600 hover:text-brand-primary transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[60] w-72 bg-white border-r border-slate-200/60 flex flex-col transition-transform duration-300 ease-in-out
        md:sticky md:translate-x-0 h-screen
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-8">
          <div className="hidden md:flex items-center gap-3 mb-10">
            <div className="size-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
              <span className="text-white font-black text-xl font-display">V</span>
            </div>
            <span className="font-black text-xl font-display tracking-tight">VOOLT Admin</span>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <item.icon size={20} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all w-full"
          >
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[55] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden md:flex glass-nav h-24 items-center justify-between px-10 sticky top-0 z-40">
          <div className="relative w-96">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search anything..."
              className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-14 pr-6 text-sm focus:ring-2 focus:ring-brand-primary/10 transition-all"
            />
          </div>

          <div className="flex items-center gap-6">
            <button className="size-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 hover:text-brand-primary transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-3 right-3 size-2 bg-brand-primary rounded-full border-2 border-white" />
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">{profile?.full_name}</p>
                <p className="text-xs font-medium text-slate-500">Administrator</p>
              </div>
              <div className="size-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                <img src={`https://ui-avatars.com/api/?name=${profile?.full_name}&background=6366F1&color=fff`} alt="Admin" />
              </div>
            </div>
          </div>
        </header>

        <main className="p-6 md:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
