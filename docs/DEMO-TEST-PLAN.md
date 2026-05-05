# Tranmere Tracker — Demo Test Plan

Run through each section before the demo. Two browser tabs minimum: one as **admin/coach**, one as **student**.

---

## 1. Authentication

| # | Action | Expected |
|---|--------|----------|
| 1.1 | Visit `/login` and sign in as a student | Redirect to `/dashboard` |
| 1.2 | Visit `/login` and sign in as admin/coach | Redirect to `/admin/dashboard` |
| 1.3 | Visit `/login` and sign in as teacher | Redirect to `/admin/dashboard` |
| 1.4 | As teacher, check sidebar/mobile nav | GPS Import, Match Squads, Formation **not visible** |
| 1.5 | Sign out from sidebar | Redirect to `/login` |

---

## 2. Student Dashboard

| # | Action | Expected |
|---|--------|----------|
| 2.1 | Log in as student, view `/dashboard` | Name, course, upcoming deadlines, calorie total visible |
| 2.2 | On mobile — tap Training, Nutrition, My GPS quick links | Navigates to correct page |
| 2.3 | Tap 🔔 Enable notifications button | Browser permission prompt appears → success banner shows |
| 2.4 | Tap again after enabling | Button replaced by "✅ Notifications enabled" |

---

## 3. Match Invitations (Student)

| # | Action | Expected |
|---|--------|----------|
| 3.1 | Admin: create a match event, invite the student | Squad invitation appears |
| 3.2 | Student: visit `/matches`, see pending invitation | Yellow invitation card visible |
| 3.3 | Student: tap **Accept** | Card immediately moves to accepted (no lag), green badge |
| 3.4 | Student: tap **Decline** on a second invite | Instant decline, red badge |
| 3.5 | Admin: view Match Squads page for that fixture | Accept/decline statuses reflected |

---

## 4. Coursework (Student)

| # | Action | Expected |
|---|--------|----------|
| 4.1 | Student: visit `/coursework` | Assignments list with due dates |
| 4.2 | Submit text response to an assignment | Submission saved, status updates |
| 4.3 | Admin: visit `/admin/grade-submissions` | Submission visible, can grade Pass/Merit/Distinction |
| 4.4 | Admin: use AI feedback helper | AI-generated feedback comment appears |

---

## 5. Training Log (Student)

| # | Action | Expected |
|---|--------|----------|
| 5.1 | Student: visit `/training` | Session history + log form visible |
| 5.2 | Log a new session (type, date, duration) | Appears in history immediately |

---

## 6. Nutrition Tracker (Student)

| # | Action | Expected |
|---|--------|----------|
| 6.1 | Student: visit `/nutrition` | Today's food log + meal form |
| 6.2 | Search for a food item and log it | Calories added to today's total |
| 6.3 | Use AI Meal Photo — describe/upload a meal | AI returns calorie estimate |

---

## 7. My GPS (Student)

| # | Action | Expected |
|---|--------|----------|
| 7.1 | Student: visit `/gps` | Personal GPS session history visible |
| 7.2 | Check distance, top speed, sprint count | Metrics display correctly |

---

## 8. Admin — Match Management

| # | Action | Expected |
|---|--------|----------|
| 8.1 | `/admin/match-events` — create a new fixture | Appears in Upcoming Fixtures section |
| 8.2 | Invite players to squad | Players receive invitation |
| 8.3 | Mark match as complete | Status changes, position/rating inputs appear |
| 8.4 | Enter player position + rating, save | Saved to squad record |
| 8.5 | Click AI Match Report | AI-generated match report renders |
| 8.6 | Click match title → detail page | Formation + squad list visible |

---

## 9. Formation Builder

| # | Action | Expected |
|---|--------|----------|
| 9.1 | `/admin/formation` — select a match event | Pitch renders with player slots |
| 9.2 | Assign players to positions | Positions saved |

---

## 10. GPS Dashboard (Admin)

| # | Action | Expected |
|---|--------|----------|
| 10.1 | `/admin/gps-dashboard` — view squad GPS data | Distance, speed, sprint metrics per player |
| 10.2 | Click AI GPS Analysis | Claude generates performance summary |

---

## 11. Communication

| # | Action | Expected |
|---|--------|----------|
| 11.1 | `/chat` — open a DM or squad room | Messages load, real-time works |
| 11.2 | Send a message | Appears instantly for other tab |
| 11.3 | Open AI Coach room, ask a question | Claude responds in chat |
| 11.4 | `/admin/broadcast` — use AI Drafter, enter a topic | Draft message generated |
| 11.5 | Send broadcast | Notification count increments |
| 11.6 | `/admin/notifications` — send push notification | Subscribed devices receive push |

---

## 12. User & Course Management

| # | Action | Expected |
|---|--------|----------|
| 12.1 | `/admin/users` — create a new student | User appears in list |
| 12.2 | Assign student to a course | Course shows on student profile |
| 12.3 | `/admin/courses` — view units | BTEC units listed per course |
| 12.4 | `/admin/students/[id]` — view student profile | AI Insights, GPS, match history, unit progress |

---

## 13. Reports

| # | Action | Expected |
|---|--------|----------|
| 13.1 | `/admin/reports` — open Squad GPS report | GPS metrics table for all players |
| 13.2 | Open Coursework report | Submissions and grades summary |
| 13.3 | Open Engagement report | Login / activity data |

---

## 14. LTI / Moodle

| # | Action | Expected |
|---|--------|----------|
| 14.1 | `/admin/lti` — view LTI configuration | Platform credentials visible |
| 14.2 | Confirm client_id and platform URL set | Ready for Moodle integration |

---

## Pre-Demo Checklist

- [ ] At least one student account with GPS data, a nutrition log, and a training session
- [ ] At least one upcoming match with player invitations
- [ ] At least one past (completed) match with ratings
- [ ] At least one assignment with a submission
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` set in Vercel → Production scope
- [ ] AI features working — test one broadcast draft before the room fills
- [ ] Open the app on a phone + desktop simultaneously for the live demo
