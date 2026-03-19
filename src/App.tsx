import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Layouts
import AdminLayout from './components/AdminLayout';
import StudentLayout from './components/StudentLayout';

// Pages
import Login from './pages/Login';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentManager from './pages/admin/StudentManager';
import CourseDesigner from './pages/admin/CourseDesigner';
import QuizDesigner from './pages/admin/QuizDesigner';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import CoursePlayer from './pages/student/CoursePlayer';
import QuizPage from './pages/student/QuizPage';

const PrivateRoute = ({ children, role }: { children: React.ReactNode; role: 'admin' | 'student' }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (profile?.role !== role) {
    return <Navigate to={profile?.role === 'admin' ? '/admin' : '/student'} />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Admin Routes */}
          <Route path="/admin/*" element={
            <PrivateRoute role="admin">
              <AdminLayout>
                <Routes>
                  <Route index element={<AdminDashboard />} />
                  <Route path="students" element={<StudentManager />} />
                  <Route path="courses" element={<CourseDesigner />} />
                  <Route path="quizzes" element={<QuizDesigner />} />
                  <Route path="*" element={<Navigate to="/admin" />} />
                </Routes>
              </AdminLayout>
            </PrivateRoute>
          } />

          {/* Student Routes */}
          <Route path="/student/*" element={
            <PrivateRoute role="student">
              <StudentLayout>
                <Routes>
                  <Route index element={<StudentDashboard />} />
                  <Route path="*" element={<Navigate to="/student" />} />
                </Routes>
              </StudentLayout>
            </PrivateRoute>
          } />

          {/* Immersive Routes (No Layout Shell) */}
          <Route path="/student/course/:courseId" element={
            <PrivateRoute role="student">
              <CoursePlayer />
            </PrivateRoute>
          } />

          <Route path="/student/quiz/:courseId/:weekNumber" element={
            <PrivateRoute role="student">
              <QuizPage />
            </PrivateRoute>
          } />

          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
