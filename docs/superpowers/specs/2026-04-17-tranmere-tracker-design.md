# Tranmere Tracker — Design Spec
**Date:** 2026-04-17
**Status:** Approved

---

## Overview

A Progressive Web App (PWA) for Tranmere Rovers FC academy students. Students are enrolled in one of three BTEC qualifications and need a single place to track coursework deadlines, nutrition, training sessions, and match performance. Coaches and admins manage content, set targets, and send notifications.

**Logo:** Tranmere Rovers FC crest — https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui |
| Backend / DB | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Hosting | Vercel (frontend) + Supabase free tier |
| Nutrition API | Open Food Facts API (free, no key required) |
| Barcode Scanning | html5-qrcode (phone camera, browser-native) |
| Push Notifications | Web Push API via Supabase Edge Functions |
| PWA | next-pwa (service worker, installable, offline shell) |

---

## User Roles

| Role | Description |
|------|-------------|
| `student` | Views and logs their own data only |
| `coach` | Reads all student data, sets nutrition targets, adds assignment feedback, sends notifications |
| `admin` | Full access: manages users, courses, assignments, sends notifications |

---

## BTEC Courses

Students select one course on registration:
- Level 2 Public Services / Fitness
- Level 3 Sports Science
- Level 3 Sports Coaching

Each course has multiple BTEC units. Assignments are linked to units, so students only see work relevant to their course.

---

## Pages & Routes

### Student-facing

| Route | Description |
|-------|-------------|
| `/dashboard` | Overview: upcoming deadlines, today's training, daily nutrition summary, recent match |
| `/coursework` | Assignments filtered to enrolled course — status, grade target, due date, feedback |
| `/nutrition` | Daily macro log with food search + barcode scanner; progress vs. coach-set targets |
| `/training` | Log and view training sessions (type, duration, intensity, notes) |
| `/matches` | Log and view match stats (goals, assists, minutes, position, self-rating, notes) |
| `/profile` | Name, email, course, avatar, notification preferences |

### Admin / Coach

| Route | Description |
|-------|-------------|
| `/admin/users` | Create, edit, deactivate student and staff accounts; assign roles and courses |
| `/admin/courses` | Manage courses and BTEC units |
| `/admin/assignments` | Create assignments per unit; set due dates, grade targets; add feedback per student |
| `/admin/notifications` | Compose and send push notifications to all students, a course group, or an individual |
| `/admin/reports` | View all students' coursework completion, nutrition compliance, training volume, match stats |

---

## Data Model

```sql
-- Users
users (
  id uuid PK,
  email text UNIQUE,
  name text,
  role text CHECK (role IN ('student', 'coach', 'admin')),
  course_id uuid FK -> courses,
  avatar_url text,
  created_at timestamptz
)

-- BTEC Structure
courses (
  id uuid PK,
  name text  -- e.g. "Level 3 Sports Science"
)

btec_units (
  id uuid PK,
  course_id uuid FK -> courses,
  unit_number text,
  unit_name text
)

-- Coursework
assignments (
  id uuid PK,
  unit_id uuid FK -> btec_units,
  title text,
  description text,
  due_date date,
  grade_target text CHECK (grade_target IN ('Pass', 'Merit', 'Distinction'))
)

submissions (
  id uuid PK,
  assignment_id uuid FK -> assignments,
  student_id uuid FK -> users,
  status text CHECK (status IN ('not_started', 'in_progress', 'submitted', 'graded')),
  grade text,
  feedback text,
  submitted_at timestamptz
)

-- Nutrition
nutrition_goals (
  id uuid PK,
  student_id uuid FK -> users UNIQUE,
  calories int,
  protein_g int,
  carbs_g int,
  fat_g int,
  set_by uuid FK -> users  -- coach who set the target
)

nutrition_logs (
  id uuid PK,
  student_id uuid FK -> users,
  logged_date date,
  meal_type text CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text,
  barcode text,
  calories int,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  created_at timestamptz
)

-- Training
training_logs (
  id uuid PK,
  student_id uuid FK -> users,
  session_date date,
  session_type text,  -- e.g. "Gym", "Pitch", "Recovery", "Cardio"
  duration_mins int,
  intensity text CHECK (intensity IN ('low', 'medium', 'high')),
  notes text,
  created_at timestamptz
)

-- Matches
match_logs (
  id uuid PK,
  student_id uuid FK -> users,
  match_date date,
  opponent text,
  goals int DEFAULT 0,
  assists int DEFAULT 0,
  minutes_played int,
  position text,
  self_rating int CHECK (self_rating BETWEEN 1 AND 10),
  notes text,
  created_at timestamptz
)
```

---

## Key Features Detail

### Coursework Tracker
- Students see assignments for their enrolled course only
- Each assignment shows: title, unit, due date, grade target, current status, teacher feedback
- Status badge: Not Started / In Progress / Submitted / Graded
- Push notification sent automatically when a deadline is within 7 days and 1 day

### Nutrition Tracker
- Food search via Open Food Facts API (name search)
- Barcode scanner via phone camera (html5-qrcode) — scans barcode, auto-fills food data
- Log per meal: breakfast, lunch, dinner, snack
- Daily summary shows totals vs. coach-set macro targets with progress bars
- If no coach target is set, a sensible default (2500 kcal, 150g protein, 300g carbs, 80g fat) is used

### Training Tracker
- Log session: type, date, duration, intensity, notes
- View history as a list or simple calendar heatmap

### Match Tracker
- Manual entry: opponent, date, goals, assists, minutes played, position, self-rating (1–10), notes
- GPS tracking is out of scope for v1 — architecture supports adding it later as a separate data source

### Admin Notifications
- Admin composes a push notification with title + body
- Can target: All Students, specific course group, or individual student
- Delivered via Web Push API (service worker handles receipt)
- Supabase Edge Function triggers the push send

---

## Authentication

- Email + password via Supabase Auth
- Admin creates accounts and sends invite emails (Supabase invite flow)
- Students set their own password on first login
- Row Level Security (RLS) on all tables: students can only read/write their own rows

---

## PWA Configuration

- Installable on Android and iOS (Add to Home Screen)
- Service worker caches app shell for offline access
- Push notification permission requested on first dashboard visit
- Tranmere Rovers FC crest as app icon

---

## Out of Scope (v1)

- GPS / wearable integration (match tracker)
- File upload for assignment submission
- In-app messaging between students and coaches
- Leaderboards or social features
- Native iOS/Android app
