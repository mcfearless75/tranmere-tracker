# Google Sign-In — Setup Guide

Google OAuth login is **built** (button on the login page + `/auth/callback` route).
It is restricted to the academy Workspace domains for safeguarding:
`tranmere.academy` and `tranmererovers.co.uk` (see `lib/config/auth.ts`).

To turn it on you need to complete two dashboard steps that only you can do.

## 1. Google Cloud Console — create an OAuth client
1. https://console.cloud.google.com → create/select a project.
2. **APIs & Services → OAuth consent screen** → Internal (if the project is owned by
   your Google Workspace) → fill app name, support email, logo.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorised redirect URI:
     `https://avpdwutgtsurddvfxhmh.supabase.co/auth/v1/callback`
   - Save the **Client ID** and **Client secret**.

## 2. Supabase — enable the Google provider
1. Supabase dashboard → **Authentication → Providers → Google** → enable.
2. Paste the **Client ID** and **Client secret** from step 1.
3. **Authentication → URL Configuration → Redirect URLs** — add:
   - `https://app.thesolarcampus.com/auth/callback`
   - `https://tranmeretracker.vercel.app/auth/callback`
   - (and any preview URL you test on)

That's it — the "Sign in with Google" button then works end to end.

## How it behaves
- **Existing users** whose account email matches their Google email link automatically
  (verified email) and keep their role and data.
- **New academy users** get a `student` profile on first sign-in. Staff are promoted to
  coach/teacher by an admin in `/admin/users` after their first login.
- **Anyone outside the allowed domains** is rejected and their auto-created account is
  deleted in the callback — they cannot get in.

## ⚠️ Action needed for some existing students
11 students currently have **placeholder `@tranmeretracker.internal` emails** (not real
Google addresses). Google login will NOT match them — it would create new empty accounts
and orphan their GPS/attendance history. Before they use Google login, update their account
email to their real `@tranmere.academy` address (Supabase dashboard → Authentication →
Users → edit, or via `admin.auth.admin.updateUserById`). Until then they keep using
password / PIN login. The 23 students already on `@tranmere.academy` are fine.

## To change the allowed domains
Edit `ALLOWED_EMAIL_DOMAINS` in `lib/config/auth.ts` and redeploy.
