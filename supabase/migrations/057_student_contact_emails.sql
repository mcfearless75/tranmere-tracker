-- ============================================================================
-- 057_student_contact_emails.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- Loads each active student's real college email (@accessport.ac.uk, from
-- the roster spreadsheet Paul shared 2026-09-07) into public.users.contact_email.
-- This is NOT the login identity — students still sign in via username+PIN
-- against the synthetic @tranmeretracker.internal address (see
-- student-pin-login-rollout). contact_email is purely for official
-- correspondence.
--
-- Matched by username (the part of the internal login email before the @),
-- which is a 1:1 join key already confirmed against the live roster
-- reconciliation done the same day — every one of these 33+17 usernames is
-- an exact match to an existing active student row. Javan Mousa is excluded
-- (no account yet) and the 16 hidden non-roster accounts are untouched.
--
-- Idempotent: safe to re-run.
-- ============================================================================

WITH real_emails(username, contact_email) AS (VALUES
  -- 1st Years
  ('kaelino',   'kaelin.barry-owen.852@accessport.ac.uk'),
  ('liamb',     'liam.blake.342@accessport.ac.uk'),
  ('lewisb',    'lewis.boden.853@accessport.ac.uk'),
  ('alexb',     'alex.bolton.343@accessport.ac.uk'),
  ('jackb',     'jackneilbrindley.brindley.343@accessport.ac.uk'),
  ('dylanb',    'dylan.bullock.350@accessport.ac.uk'),
  ('olliec',    'ollie.carson.854@accessport.ac.uk'),
  ('kennethc',  'kennethjunior.chimhuva.341@accessport.ac.uk'),
  ('prestonc',  'preston.cleator.274@accessport.ac.uk'),
  ('beaue',     'beau.edwards.856@accessport.ac.uk'),
  ('zachc',     'zach.craze.850@accessport.ac.uk'),
  ('lewisd',    'lewis.dooley.506@accessport.ac.uk'),
  ('marcusd',   'marcus.dossantos.855@accessport.ac.uk'),
  ('ewand',     'robertewan.duncan.857@accessport.ac.uk'),
  ('liamg',     'liam.gray.659@accessport.ac.uk'),
  ('osianh',    'osian.hamnett.766@accessport.ac.uk'),
  ('jonahj',    'jonah.jones.531@accessport.ac.uk'),
  ('isaack',    'isaac.kennedy.860@accessport.ac.uk'),
  ('charliel',  'charlie.lawler.810@accessport.ac.uk'),
  ('jamesl',    'jamessteven.lowther.344@accessport.ac.uk'),
  ('laminm',    'lamin.manjang.848@accessport.ac.uk'),
  ('jaydenm',   'jayden.mcauley.861@accessport.ac.uk'),
  ('calebm',    'caleb.mcwilliam.378@accessport.ac.uk'),
  ('kieronm',   'kieron.murphy.862@accessport.ac.uk'),
  ('samueln',   'samuel.nash.344@accessport.ac.uk'),
  ('marko',     'mark.omolade.217@accessport.ac.uk'),
  ('jeffo',     'jeff.osazuwa.918@accessport.ac.uk'),
  ('lukep',     'luke.proudlove.849@accessport.ac.uk'),
  ('casparq',   'caspar.quilty.863@accessport.ac.uk'),
  ('jamess',    'james.sheen.353@accessport.ac.uk'),
  ('masons',    'mason.smith.767@accessport.ac.uk'),
  ('joshuau',   'joshua.upton.864@accessport.ac.uk'),
  ('joshuaw',   'joshua.williams.829@accessport.ac.uk'),
  -- 2nd Years
  ('alfiec',      'alfie.casey.801@accessport.ac.uk'),
  ('lewisc',      'lewis.cubbins.787@accessport.ac.uk'),
  ('jamiec',      'jamie.cunningham.444@accessport.ac.uk'),
  ('khalide',     'khalid.eletu.328@accessport.ac.uk'),
  ('jacobg',      'jacob.garnett.327@accessport.ac.uk'),
  ('leightonk',   'leighton.kelly.481@accessport.ac.uk'),
  ('troyl',       'troy.lockyer.792@accessport.ac.uk'),
  ('sebastianm',  'sebastian.macaulay.793@accessport.ac.uk'),
  ('mohammedm',   'mohammed.mahamoud.707@accessport.ac.uk'),
  ('tinashem',    'tinashe.makoni.794@accessport.ac.uk'),
  ('harrism',     'harris.mcintosh.320@accessport.ac.uk'),
  ('aidano',      'aidan.obrien.797@accessport.ac.uk'),
  ('oliverp',     'oliver.piercy.799@accessport.ac.uk'),
  ('maxr',        'max.roberts.325@accessport.ac.uk'),
  ('jackr',       'jack.roddick.329@accessport.ac.uk'),
  ('naodt',       'naod.tewolde.324@accessport.ac.uk'),
  ('oliverw',     'oliver.wilson.625@accessport.ac.uk')
)
UPDATE public.users u
SET contact_email = re.contact_email
FROM real_emails re
WHERE u.email = re.username || '@tranmeretracker.internal'
  AND u.role = 'student'
  AND u.is_active = true;

-- ── Verification (run after applying) ───────────────────────────────────────
-- SELECT count(*) FROM public.users WHERE contact_email IS NOT NULL;
-- Expect 50 (33 1st-years + 17 2nd-years). Javan Mousa and the 16 hidden
-- accounts should still have contact_email IS NULL.
