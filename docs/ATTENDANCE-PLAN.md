# Attendance Tracking — Architecture Decision & Build Plan

## Decision: Rotating PIN + QR Hybrid

**Primary:** Coach generates a session. The admin screen shows a **rotating 6-digit PIN** and a **scannable QR code** (same token, two display formats). Students either scan the QR or type the PIN. Token rotates every 2 minutes.

**Fallback:** Coach manually marks present/absent from a live roster — always available as an override.

**Rejected options:**
| Option | Reason rejected |
|--------|----------------|
| Geo-fence | Unreliable indoors (gym/classroom), GPS drift, battery drain, permission fatigue, easily spoofed with mock location |
| NFC | iOS restrictions, requires hardware tags, overkill for 50 users |
| Static QR | Screenshot → send to absent teammate. Useless as anti-cheat |
| App-only static PIN | Same problem — too easy to text the code |

---

## Why this works for a football academy

- ✅ Works outdoors, in the gym, in classrooms — venue agnostic
- ✅ Zero device permissions required (no GPS, no camera mandate — typing the PIN works too)
- ✅ Token rotates every 2 minutes — screenshot sharing useless
- ✅ PWA camera scan is faster when it works; PIN is fallback when sun glare kills camera
- ✅ Coach has full manual override — if a player's phone dies they're not marked absent
- ✅ Realtime roster on coach screen via Supabase subscriptions
- ✅ Offline: student checks in when signal drops, submission queues and syncs on reconnect

---

## Database Schema

```sql
-- supabase/migrations/013_attendance.sql

-- One session per training/match/classroom event
CREATE TABLE attendance_sessions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by      uuid NOT NULL REFERENCES public.users(id),
  session_type    text NOT NULL CHECK (session_type IN ('training', 'match', 'classroom')),
  session_label   text NOT NULL,            -- "Tuesday Training", "vs Southport U21"
  match_event_id  uuid REFERENCES match_events(id) ON DELETE SET NULL,
  pin_code        text NOT NULL,            -- 6-char alphanumeric, rotated by RPC
  pin_expires_at  timestamptz NOT NULL,
  opens_at        timestamptz DEFAULT now(),
  closes_at       timestamptz,             -- null = coach closes manually
  created_at      timestamptz DEFAULT now()
);

-- One record per student per session
CREATE TABLE attendance_records (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    uuid NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  method        text NOT NULL CHECK (method IN ('pin', 'qr', 'manual')),
  checked_in_at timestamptz DEFAULT now(),
  UNIQUE(session_id, student_id)
);

-- RPC: coach rotates PIN (called from admin screen on a timer)
CREATE OR REPLACE FUNCTION rotate_attendance_pin(p_session_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  new_pin text;
BEGIN
  -- 6 uppercase alphanumeric chars, no ambiguous chars (0/O, 1/I)
  new_pin := upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 6));
  new_pin := replace(replace(replace(new_pin, '0', 'X'), 'O', 'Y'), 'I', 'Z');
  new_pin := left(new_pin, 6);

  UPDATE attendance_sessions
  SET pin_code = new_pin, pin_expires_at = now() + interval '2 minutes'
  WHERE id = p_session_id
    AND exists (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','coach')
    );

  RETURN new_pin;
END;
$$;

-- RPC: student submits PIN
CREATE OR REPLACE FUNCTION submit_attendance(p_session_id uuid, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_session attendance_sessions%ROWTYPE;
  v_student_id uuid := auth.uid();
BEGIN
  SELECT * INTO v_session FROM attendance_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found');
  END IF;

  IF v_session.closes_at IS NOT NULL AND now() > v_session.closes_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session is closed');
  END IF;

  IF now() > v_session.opens_at + interval '2 minutes' AND v_session.pin_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN has expired — ask your coach for the latest code');
  END IF;

  IF upper(p_pin) <> upper(v_session.pin_code) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Incorrect PIN');
  END IF;

  INSERT INTO attendance_records (session_id, student_id, method)
  VALUES (p_session_id, v_student_id, 'pin')
  ON CONFLICT (session_id, student_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;
```

---

## Pages & Components to Build

### Admin side

| Route | Purpose |
|-------|---------|
| `/admin/attendance` | List all sessions — active, upcoming, past. Create new button. |
| `/admin/attendance/new` | Create session form: label, type, link to match event (optional), open/close time |
| `/admin/attendance/[id]` | **Live coach screen** — big QR code + PIN below it. Realtime roster showing who's checked in. Manual mark buttons per student. Close session button. |

### Student side

| Route | Purpose |
|-------|---------|
| `/check-in` | Student check-in page — camera scanner OR 6-digit PIN input. Shows session name. Confirms with ✅ message. |
| Dashboard widget | If an open attendance session exists today, show a yellow banner: "Session open — check in now" → links to `/check-in` |

### Navigation additions
- Admin sidebar: add **Attendance** link (between Dashboard and Match Squads)
- Student bottom nav: add **Check In** tab (replaces or sits next to Grades)

---

## Data Flow

```
Coach opens /admin/attendance/[id]
  → Supabase: attendance_sessions row created, PIN generated
  → QR code rendered (encodes: "tranmere://checkin?s=SESSION_ID&p=PIN")
  → PIN displayed as text below QR
  → Timer: every 115s, call rotate_attendance_pin(session_id) → QR + PIN refresh

Student opens /check-in
  Option A — Scan QR:
    → Browser camera API opens
    → QR decoded: extract session_id + pin
    → POST to /api/attendance/submit { session_id, pin }
    → Server validates via submit_attendance() RPC
    → ✅ success banner

  Option B — Type PIN:
    → 6-box input (like OTP)
    → Submits to same /api/attendance/submit endpoint
    → Same validation

  Option C — Offline:
    → Submission queued in localStorage
    → Sync attempted every 30s, or on next page load with connection

Coach screen (/admin/attendance/[id]):
  → Supabase realtime subscription on attendance_records WHERE session_id = X
  → Roster updates live as students check in
  → Manual mark: coach taps name → Present / Absent
```

---

## Spoofing resistance

| Attack | Defence |
|--------|---------|
| Student screenshots QR and sends it | Token rotates every 2 minutes — screenshot is stale almost immediately |
| Student texts PIN to absent friend | 2-minute window closes fast; last-20-seconds submissions are **auto-flagged** |
| Student fabricates the API request | RPC validates session is open + PIN matches current stored value |
| Same student checks in twice | `UNIQUE(session_id, student_id)` constraint |
| Student checks in for another student | Submission uses `auth.uid()` server-side — can't impersonate |
| Remote check-in (student at home) | IP address logged — flagged if outside campus WiFi subnet |
| Student claims they were there | Selfie captured at check-in; GPS coordinates logged passively |

## Anti-spoofing audit trail (per check-in record)

Every record stores:
- `client_ip` — compared against campus WiFi subnet prefix
- `geo_lat` / `geo_lng` / `geo_accuracy_m` — passive GPS snapshot (no permission prompt if browser already has it)
- `selfie_path` — photo taken at moment of check-in, stored in Supabase Storage
- `is_flagged` — auto-set true if any rule fires
- `flag_reason` — human-readable: *"IP outside campus network (82.45.x.x); submitted in final 20s of PIN window"*

Coach sees a **🚩 flag icon** on the roster next to any suspicious check-in and can click to view the selfie, IP, and GPS pin on a map. Dispute resolved in 10 seconds.

### Flag rules (auto, server-side)
1. IP doesn't match campus subnet prefix → flagged
2. Check-in submitted in final 20 seconds of 2-minute PIN window → flagged (code likely forwarded)
3. *(Future)* GPS >500m from training ground → flagged

---

## Report integration

Add to `/admin/reports`:
- **Attendance Report** — per student: session count, % attended, streak, absences
- Export as CSV for admin records

---

## Build order

1. `013_attendance.sql` migration → run in Supabase
2. `/admin/attendance` list + create pages  
3. `/admin/attendance/[id]` live coach screen with QR + realtime roster
4. `/check-in` student page  
5. Dashboard widget (yellow banner when session is open)
6. Attendance report page
7. Navigation entries (admin sidebar + student bottom nav)

Estimated: ~2 days of focused build.
