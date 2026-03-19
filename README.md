# VOOLT Academy

> **A proprietary, invitation-only learning management system built exclusively for VOOLT Group. Engineered around automation, engagement, and professionalism.**

[![Stack](https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Database](https://img.shields.io/badge/Database-Supabase-green?style=flat-square&logo=supabase)](https://supabase.com)
[![Automation](https://img.shields.io/badge/Automation-n8n-orange?style=flat-square)](https://n8n.io)
[![Access](https://img.shields.io/badge/Access-Invitation%20Only-red?style=flat-square)]()
[![Status](https://img.shields.io/badge/Status-Production-brightgreen?style=flat-square)]()

---

## Table of Contents

- [Overview](#overview)
- [Platform Architecture](#platform-architecture)
- [The Problems It Solves](#the-problems-it-solves)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
- [n8n Automation Workflow](#n8n-automation-workflow)
- [Admin Experience](#admin-experience)
- [Student Experience](#student-experience)
- [Row Level Security](#row-level-security)
- [Getting Started](#getting-started)

---

## Overview

VOOLT Academy is a full-stack, closed-access learning management system built for **VOOLT Group** — a Nigerian digital education and business growth company. The platform is not publicly accessible. Students gain entry only after completing payment through VOOLT's marketing website and being registered by an admin.

The system exists in two distinct parts:

1. **The Marketing Website** — A static HTML/CSS/JS multi-page site that presents VOOLT Group's services, courses, and pricing to the public.
2. **The Academy Platform** — A private React SPA (Single Page Application) that serves as the complete learning environment for paying students and administrators.


## Screenshots

![Dashboard](assets/Screenshot%202026-03-19%20223548.png)
![Leads Table](assets/Screenshot%202026-03-19%20223557.png)
![Mobile View](assets/Screenshot%202026-03-19%20223609.png)

---

## Platform Architecture

```
PUBLIC LAYER
┌───────────────────────────────────────────┐
│          Marketing Website (Static)        │
│  index.html · services · pricing · about  │
│  ai-automation-mastery.html (sales page)  │
└────────────────────────┬──────────────────┘
                         │ Payment → WhatsApp
                         │ Admin registers student
                         ▼
PRIVATE LAYER
┌───────────────────────────────────────────┐
│         Academy Platform (React SPA)      │
│                                           │
│  ┌─────────────────┐  ┌────────────────┐  │
│  │  Admin Panel    │  │ Student Portal │  │
│  │  /admin/*       │  │ /student/*     │  │
│  └────────┬────────┘  └───────┬────────┘  │
│           │                   │           │
│           └─────────┬─────────┘           │
│                     │                     │
│              Supabase Backend             │
│       (Auth · Database · Storage)         │
└───────────────────────────────────────────┘
                     │
              n8n Automation
         (Student Registration Flow)
```

---

## The Problems It Solves

**Problem 1 — Manual Student Onboarding**  
Without the platform, admins manually created Supabase accounts, noted passwords, and sent credentials via WhatsApp — error-prone and unscalable. Now, one button triggers an n8n workflow that generates a password, creates the account, and returns credentials to the admin's screen instantly.

**Problem 2 — Passive Learning**  
Students could watch videos without retaining content. The platform enforces **mandatory weekly MCQ quizzes**. Students cannot advance to the next week until they complete the current week's assessment.

**Problem 3 — Content Management Complexity**  
Rather than building a video hosting system, all course content lives on Google Drive. The platform stores Drive file IDs and embeds them directly — keeping storage costs at zero while giving admins full control over content access.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 19 with Vite |
| Styling | Tailwind CSS 4.0 |
| Animation | Motion (Framer Motion) |
| Backend / Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Automation | n8n (self-hosted) |
| Hosting | Vercel |
| Icons | Lucide React |
| Fonts | Outfit (display) + Inter (body) |

---

## Database Schema

### `profiles`
Extends Supabase Auth. Stores `full_name`, `email`, `phone`, `role` (`student` or `admin`). Auto-populated via database trigger on user creation.

### `courses`
Stores each course: `title`, `slug`, `description`, `thumbnail_url`, `duration_weeks`, `is_active`.

### `lessons`
Each lesson belongs to a course and a `week_number`. Stores `title`, `description`, `video_url` (Google Drive file ID), `order_index`.

### `enrollments`
Join table linking students to courses. Stores `user_id`, `course_id`, `status` (`active` / `completed`), `current_week`, `enrolled_at`.

### `lesson_progress`
Tracks lesson completion per student. Stores `user_id`, `course_id`, `lesson_id`, `completed_at`, `watch_percentage`.

### `quizzes`
One quiz per week per course. Stores `course_id`, `week_number`, `title`, `pass_score` (minimum % to pass, default 70%).

### `quiz_questions`
Each question belongs to a quiz. Stores `question_text`, `order_index`.

### `quiz_options`
Four options per question. Stores `option_text`, `is_correct` (boolean), `order_index`.

### `quiz_attempts`
Records quiz results per student. Stores `user_id`, `quiz_id`, `score`, `total`, `percentage`, `passed`, and a `answers` JSONB field. Unique constraint on `(user_id, quiz_id)` — one attempt per student per quiz.

---

## n8n Automation Workflow

The student registration workflow runs on a self-hosted n8n instance. It is triggered when an admin submits the "Register Student" form.

### Node Sequence

| Node | Type | Purpose |
|---|---|---|
| Webhook1 | Webhook | Listens for POST at `/voolt-payment-webhook`. Response mode: "Using Respond to Webhook Node" |
| Generate Password1 | JavaScript Function | Generates a secure alphanumeric password: `Math.random().toString(36).slice(-10) + 'V!'` |
| Supabase Register1 | HTTP Request | POST to Supabase Auth `/auth/v1/signup` with email, generated password, and `{ full_name, role: 'student' }` metadata |
| Edit Fields | Set Node | Extracts only `generatedPassword` for clean response |
| Respond to Webhook1 | Webhook Response | Returns `{ generatedPassword }` to the admin's browser |

**Frontend behaviour:** After receiving the response, the admin's screen displays the email and generated password with copy buttons and a "Copy All for WhatsApp" button. The app then waits 2.5 seconds for Supabase's `handle_new_user` trigger to create the profile row, then creates the enrollment record directly.

---

## Admin Experience

All admin routes (`/admin/*`) are wrapped in `AdminLayout` with a fixed sidebar (desktop) and hamburger menu (mobile).

### `/admin` — Overview Dashboard
Four live stat cards: Total Students, Total Enrollments, Active Courses, Completions. All data fetched live from Supabase.

### `/admin/students` — Student Directory
- Searchable, paginated list of all students
- **Register Student:** Opens modal → triggers n8n → displays credentials with copy-to-WhatsApp button
- **Enroll Student:** Add an existing student to an additional course
- **Delete Student:** Removes profile, all enrollments, and all lesson progress with confirmation

### `/admin/courses` — Course Architect
- Course card grid with hover-to-reveal delete
- **Create Course:** Title, description, thumbnail URL (auto-assigns Unsplash image if blank), duration in weeks
- **Curriculum Editor:** Week-by-week lesson management. Inline editors for lesson title, video URL (YouTube, Vimeo, or Google Drive file ID), and description
- **Course Settings Sidebar:** Editable metadata + live stats (total weeks, lessons with/without video)

### `/admin/quizzes` — Quiz Designer
- Two-panel interface: course/week selector (left) + question builder (right)
- **Manual entry:** Add questions one by one with four options, mark correct answer
- **CSV Import:** Drag-and-drop import with validation. Format: `question, option_a, option_b, option_c, option_d, correct_answer (A/B/C/D)`. Template download available
- 15-slot progress bar shows quiz completion visually
- Results panel shows per-student scores after attempts exist

---

## Student Experience

All student routes (`/student/*`) are wrapped in `StudentLayout` with a top navigation bar.

### `/student` — Dashboard
- Personalised hero banner: greeting, enrollment count, study streak, overall progress bar
- Stats row: Courses Enrolled, Lessons Completed, Days Streak, Completion Rate
- "Continue Learning" section: each enrolled course shown as a card with progress bar and dynamic CTA button
- Sidebar panels: Academy Insight (motivational), Course Progress mini-bars, Your Journey (lessons remaining)

### `/student/courses/:slug` — Course Player
- Week-by-week lesson navigation
- Embedded Google Drive video player
- Progress tracking: marks lesson complete when watch percentage threshold is reached
- **Weekly Quiz Gate:** After the last lesson of each week, the student is automatically redirected to the week's MCQ quiz. They cannot proceed to the next week until engaging with the assessment
- Quiz result screen shows score, percentage, pass/fail status

### `/student/profile` — Profile Management
- Edit name, phone number
- View enrollment history

---

## Row Level Security

RLS is enabled on every table. An `is_admin()` helper function (created with `SECURITY DEFINER`) prevents infinite recursion in profile policies.

| Rule | Scope |
|---|---|
| Students | Can only read their own profile, enrollments, and lesson progress |
| Admins | Can read and write everything |
| Quiz questions and options | Readable by any authenticated user |
| Quiz attempts | Can only be inserted by the student themselves; readable by admins |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase project with schema configured
- n8n instance (self-hosted or cloud)

### Installation

```bash
git clone https://github.com/temiloluwa-adebayo/voolt-academy.git
cd voolt-academy
npm install
cp .env.example .env.local
# Fill in your environment variables
npm run dev
```

### Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_N8N_WEBHOOK_URL=https://your-n8n.cloud/webhook/voolt-payment-webhook
```

---

## Author

**Temiloluwa Adebayo** — AI Software Engineer  
[GitHub](https://github.com/temiloluwa-adebayo) · [LinkedIn](www.linkedin.com/in/temiloluwa-adebayo-4843ba377)
