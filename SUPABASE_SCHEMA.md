#-- ============================================================
--  VOOLT ACADEMY — Supabase Database Schema (FIXED)
--  Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text,
  full_name   text,
  phone       text,
  bio         text,
  role        text not null default 'student' check (role in ('student','admin')),
  avatar_url  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. COURSES TABLE
create table if not exists public.courses (
  id              uuid default gen_random_uuid() primary key,
  title           text not null,
  slug            text not null unique,
  description     text,
  thumbnail_url   text,
  total_weeks     int default 6,
  total_lessons   int default 0,
  is_published    boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- 3. WEEKS TABLE
create table if not exists public.weeks (
  id          uuid default gen_random_uuid() primary key,
  course_id   uuid references public.courses(id) on delete cascade not null,
  week_number int not null,
  title       text not null default '',
  unlock_day  int default 0,
  is_unlocked boolean default false,
  created_at  timestamptz default now(),
  unique(course_id, week_number)
);

-- 4. LESSONS TABLE
create table if not exists public.lessons (
  id                uuid default gen_random_uuid() primary key,
  week_id           uuid references public.weeks(id) on delete cascade not null,
  title             text not null,
  description       text,
  video_url         text,
  google_drive_id   text,
  duration_minutes  int,
  order_index       int default 1,
  is_preview        boolean default false,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- 5. ENROLLMENTS TABLE
create table if not exists public.enrollments (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  course_id   uuid references public.courses(id) on delete cascade not null,
  status      text default 'active' check (status in ('active','completed','suspended','paused')),
  enrolled_at timestamptz default now(),
  start_date  date default current_date,
  unique(user_id, course_id)
);

-- 6. LESSON PROGRESS TABLE
create table if not exists public.lesson_progress (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references public.profiles(id) on delete cascade not null,
  course_id         uuid references public.courses(id) on delete cascade not null,
  lesson_id         uuid references public.lessons(id) on delete cascade not null,
  completed_at      timestamptz,
  watch_percentage  int default 0,
  created_at        timestamptz default now(),
  unique(user_id, lesson_id)
);

-- HELPER FUNCTIONS (CRITICAL TO FIX RECURSION) --
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.weeks enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;

-- Profiles: users see their own, admins see all
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_admin_all" on public.profiles for all using (public.is_admin());

-- Courses: published visible to enrolled; admins see all
drop policy if exists "courses_read_published" on public.courses;
drop policy if exists "courses_admin_write" on public.courses;

create policy "courses_read_published" on public.courses for select using (
  is_published = true or public.is_admin()
);
create policy "courses_admin_write" on public.courses for all using (public.is_admin());

-- Weeks: enrolled students see unlocked; admins see all
drop policy if exists "weeks_read" on public.weeks;
drop policy if exists "weeks_admin_write" on public.weeks;

create policy "weeks_read" on public.weeks for select using (
  exists (select 1 from public.enrollments where user_id = auth.uid() and course_id = weeks.course_id) or
  public.is_admin()
);
create policy "weeks_admin_write" on public.weeks for all using (public.is_admin());

-- Lessons: enrolled can see
drop policy if exists "lessons_read" on public.lessons;
drop policy if exists "lessons_admin_write" on public.lessons;

create policy "lessons_read" on public.lessons for select using (
  exists (
    select 1 from public.weeks w
    join public.enrollments e on e.course_id = w.course_id
    where w.id = lessons.week_id and e.user_id = auth.uid()
  ) or
  public.is_admin() or
  is_preview = true
);
create policy "lessons_admin_write" on public.lessons for all using (public.is_admin());

-- Enrollments: own
drop policy if exists "enrollments_select_own" on public.enrollments;
drop policy if exists "enrollments_admin_write" on public.enrollments;
drop policy if exists "enrollments_insert" on public.enrollments;

create policy "enrollments_select_own" on public.enrollments for select using (user_id = auth.uid() or public.is_admin());
create policy "enrollments_admin_write" on public.enrollments for all using (public.is_admin());
create policy "enrollments_insert" on public.enrollments for insert with check (user_id = auth.uid() or public.is_admin());

-- Lesson progress: own
drop policy if exists "progress_own" on public.lesson_progress;
create policy "progress_own" on public.lesson_progress for all using (user_id = auth.uid() or public.is_admin());
```
