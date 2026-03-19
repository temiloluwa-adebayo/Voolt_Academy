export type Role = 'admin' | 'student';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  phone?: string;
  created_at: string;
  last_login?: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail_url: string;
  duration_weeks: number;
  is_active: boolean;
  created_at: string;
}

export interface Lesson {
  id: string;
  course_id: string;
  week_number: number;
  title: string;
  description: string;
  video_url: string; // Google Drive Embed Link or similar
  order_index: number;
  is_unlocked: boolean; // Managed by drip logic
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  status: 'active' | 'completed';
  current_week: number;
}
