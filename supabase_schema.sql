-- ============================================================
--  VOOLT ACADEMY — Premium Schema (Light Theme Edition)
--  Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. PROFILES TABLE (Extends Auth.Users)
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text,
  full_name   text,
  phone       text,
  role        text not null default 'student' check (role in ('student','admin')),
  created_at  timestamptz default now(),
  last_login  timestamptz
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- 2. COURSES TABLE
create table if not exists public.courses (
  id              uuid default gen_random_uuid() primary key,
  title           text not null,
  slug            text not null unique,
  description     text,
  thumbnail_url   text,
  duration_weeks  int default 8,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

alter table public.courses enable row level security;

create policy "Courses are viewable by everyone." on public.courses
  for select using (true);

create policy "Only admins can insert/update courses." on public.courses
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 3. LESSONS TABLE (Google Drive Integration Ready)
create table if not exists public.lessons (
  id            uuid default gen_random_uuid() primary key,
  course_id     uuid references public.courses(id) on delete cascade,
  week_number   int not null,
  title         text not null,
  description   text,
  video_url     text, -- This stores the Google Drive File ID
  order_index   int default 1,
  created_at    timestamptz default now()
);

alter table public.lessons enable row level security;

create policy "Lessons are viewable by enrolled students." on public.lessons
  for select using (
    exists (select 1 from public.enrollments where user_id = auth.uid() and course_id = lessons.course_id)
    or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 4. ENROLLMENTS TABLE
create table if not exists public.enrollments (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users(id) on delete cascade,
  course_id     uuid references public.courses(id) on delete cascade,
  status        text default 'active' check (status in ('active', 'completed')),
  current_week  int default 1,
  enrolled_at   timestamptz default now(),
  unique(user_id, course_id)
);

alter table public.enrollments enable row level security;

create policy "Users can view own enrollments." on public.enrollments
  for select using (auth.uid() = user_id);

create policy "Admins can manage all enrollments." on public.enrollments
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- 5. TRIGGER FOR NEW USERS
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', coalesce(new.raw_user_meta_data->>'role', 'student'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
