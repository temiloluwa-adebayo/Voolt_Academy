import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Trophy, 
  MessageSquare, 
  User,
  LogOut,
  Bell,
  Menu,
  X
} from 'lucide-react';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { label: 'My Learning', icon: BookOpen, path: '/student' },
    { label: 'Achievements', icon: Trophy, path: '/student/achievements' },
    { label: 'Community', icon: MessageSquare, path: '/student/community' },
    { label: 'Profile', icon: User, path: '/student/profile' },
  ];

  return (
    <div className="min-h-screen bg-brand-bg">
      <nav className="glass-nav h-20 md:h-24 px-6 md:px-10 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4 md:gap-12">
          <Link to="/student" className="flex items-center gap-3">
            <div className="size-8 md:size-10 bg-brand-primary rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
              <span className="text-white font-black text-lg md:text-xl font-display">V</span>
            </div>
            <span className="font-black text-lg md:text-xl font-display tracking-tight">VOOLT Academy</span>
          </Link>

          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
                    isActive 
                      ? 'bg-brand-primary/10 text-brand-primary' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors hidden sm:block">
            <Bell size={22} />
          </button>
          <div className="h-8 w-px bg-slate-200 hidden sm:block" />
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden lg:block">
              <p className="text-sm font-bold text-slate-900">{profile?.full_name}</p>
              <p className="text-xs font-medium text-slate-500">Student</p>
            </div>
            
            <div className="relative group hidden md:block">
              <button className="size-10 md:size-12 rounded-xl md:rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden hover:border-brand-primary transition-colors">
                <img src={`https://ui-avatars.com/api/?name=${profile?.full_name}&background=10B981&color=fff`} alt="Profile" />
              </button>
              
              <div className="absolute right-0 mt-3 w-56 bg-white border border-slate-100 rounded-3xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all shadow-2xl z-50">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all"
                >
                  <LogOut size={18} /> Sign Out
                </button>
              </div>
            </div>

            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-brand-primary transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[55] md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="fixed inset-x-0 top-20 bg-white border-b border-slate-100 z-[60] md:hidden p-6 space-y-4 shadow-2xl">
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
              <div className="pt-4 border-t border-slate-100">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all"
                >
                  <LogOut size={20} /> Sign Out
                </button>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      <main className="p-6 md:p-10 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
