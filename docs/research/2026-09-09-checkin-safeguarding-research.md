# Wellbeing check-in & safeguarding detection — research report

**Date:** 2026-09-09
**Author:** research pass (no code changed, no existing files modified)
**Scope:** (1) does the check-in system actually catch students who are struggling, and (2) can the student experience be improved without damaging (1)?

> This is a research document. Nothing here has been implemented. Several findings are
> live defects in production code and should be triaged before any new feature work.

---

## 1. Executive summary

- **The `stress` item is the only reverse-worded question on the survey, but the app scores, colours, averages and flags it as if higher were better.** `lib/wellbeing/wellbeingUtils.ts:5` asks "How stressed are you feeling?" while `app/(student)/wellbeing/page.tsx:8` labels every scale identically `1 = Very Low … 5 = Great`, and `getRedFlags` fires on `score <= 2`. Depending on how a student reads it, the system either flags calm students or ignores stressed ones — and the composite average in `buildWellbeingTrend` mixes the item in either way, so the sparkline can move in the wrong direction. **This is the single highest-impact fix in this document and it is a one-line-of-thinking change, not a feature.**

- **The optional free-text note — the highest-signal field in the survey — is written to the database and never shown to any human.** It is collected (`app/(student)/wellbeing/page.tsx:141-148`), stored (`wellbeing_responses.note`, migration 023), and selected in the admin query (`app/(admin)/admin/wellbeing/page.tsx:23`) — but `note` appears in that file only inside a TypeScript type annotation (line 34) and in no JSX. `/admin/safeguarding` does not even select it. A student who types "my mum's in hospital and I'm not coping" is answering into a void.

- **The AI Coach chatbot has no safeguarding instruction at all, and is probably where the most honest disclosures in the app already are.** `app/api/ai/chat/route.ts:71` sets a system prompt about "training advice, nutrition, coursework, motivation" with no crisis handling, no signposting, no escalation. A repo-wide grep for `self-harm|suicid|crisis` returns nothing outside an unrelated test. Anonymised, low-stakes, always-available conversation is exactly the channel adolescents prefer for first disclosure (Kooth; MoodyTunes) — and this one answers with a motivational quip and tells nobody.

- **A wellbeing red flag creates no record and has no owner.** It fires a push to *every* admin, coach and teacher (`app/api/wellbeing/submit/route.ts:22-39`) saying "X's latest wellbeing survey needs attention", and paints a card red. No `safeguarding_concerns` row, no assignee, no acknowledgement, no closure, no audit trail. KCSIE requires the DSL to record concerns, actions **and decisions not to act, with reasoning**; inadequate record-keeping was the most common cited cause of safeguarding failure in Ofsted reports 2019-2022.

- **A wellbeing flag is silently suppressed for any student who already has an unrelated open case.** `components/admin/safeguarding/ConcernList.tsx:43-47` filters suggestions against *any* non-closed concern of *any* category — including the bulk `attendance` whereabouts cases the 15-minute cron raises (migration 060 records 33 students getting cases in a single day). The students with the most going on are the ones whose wellbeing flag gets hidden.

- **Fortnightly is too coarse to detect anything, and non-response — the strongest withdrawal signal — is invisible.** ~19 term-time data points per student per year. Nothing ever sets `status = 'expired'` (the CHECK constraint allows it; grep confirms no writer), nobody is alerted when a student stops answering, and there is no way for a student to check in between surveys: `/wellbeing` tells them "Your next check-in will arrive on a Monday."

- **`/admin/wellbeing` has no role check and reads via the service-role client**, so every coach and teacher can see every student's raw wellbeing scores — while `/admin/safeguarding` correctly enforces `role === 'admin'`. The push notification deep-links coaches and teachers straight into that page. The *more* sensitive special-category data is the *less* protected of the two.

- **The highest-value additions are trend-based flagging on an individual baseline, non-response detection, a free-text follow-up prompt, and a self-initiated check-in** — in that order. The highest-value *removals* are anything resembling a streak, a leaderboard, or a single composite "wellness score".

---

## 2. Current state — what the app already does

### 2.1 The wellbeing check-in

| Aspect | Reality | File |
|---|---|---|
| Cadence | Fortnightly, odd ISO weeks only, Monday 09:00 UTC | `vercel.json` (`"0 9 * * 1"`) + `isFortnightlyWeek` in `lib/wellbeing/wellbeingUtils.ts:21-29` |
| Items | 5: `mood`, `sleep`, `energy`, `stress`, `football_enjoyment` | `lib/wellbeing/wellbeingUtils.ts:1-7` |
| Scale | 1-5, labelled `Very Low / Low / Okay / Good / Great` for **every** item | `app/(student)/wellbeing/page.tsx:8` |
| Free text | One optional note per question | `app/(student)/wellbeing/page.tsx:141-148` |
| Validation | All 5 must be answered, no partial submit | `validateSurveyAnswers`, `wellbeingUtils.ts:57-62` |
| Storage | `wellbeing_surveys` + `wellbeing_responses` | `supabase/migrations/023_wellbeing.sql` |
| Delivery | Cron inserts a row per active student + web push | `app/api/cron/wellbeing-survey/route.ts` |
| Discovery | Dashboard card when a survey is open; `/wellbeing` buried in the BottomNav "More" sheet | `app/(student)/dashboard/page.tsx:385`, `components/layout/BottomNav.tsx:29` |

### 2.2 How a flag is computed and what happens next

```
getRedFlags()            → score <= 2 on 'mood' or 'stress' only   (wellbeingUtils.ts:17-18, 32-36)
  ↓
notifyStaffOfRedFlag()   → push to ALL admin + coach + teacher,
                           generic body, deep-links /admin/wellbeing
                           (app/api/wellbeing/submit/route.ts:12-43)
  ↓
/admin/wellbeing         → red card + "⚠ How stressed are you feeling?: scored 1/5"
                           (app/(admin)/admin/wellbeing/page.tsx:111-120)
  ↓
/admin/safeguarding      → "Suggested concerns from wellbeing flags" panel
                           with a "Raise concern" button (admin-only page)
                           (app/(admin)/admin/safeguarding/page.tsx:56-81)
```

Nothing between those steps is persisted. There is no acknowledgement, no assignment, and no state indicating a flag was seen or dismissed.

### 2.3 The safeguarding case module (works well, and is the model to copy)

`supabase/migrations/030_safeguarding.sql` gives `safeguarding_concerns` (student, raiser, category, severity, description, status open/monitoring/escalated/closed) plus an append-only `safeguarding_notes` timeline, admin-only RLS, and an `updated_at` trigger. `app/api/safeguarding/route.ts` gates every operation behind `requireAdmin()`. The attendance whereabouts cron (`app/api/cron/attendance-safeguarding-check/route.ts`) demonstrates the right pattern end-to-end: a two-stage grace period (nudge at +30 min to all staff, real case at +90 min to admins only), a DB-level race guard (`safeguarding_concerns_one_auto_per_day`, migration 060), and a case record that carries its own evidence in the description.

**The wellbeing pipeline has none of this.** The two subsystems were built at different times and only meet in a read-only suggestion panel.

### 2.4 Gaps found (all verified against the code)

**Detection correctness**

1. **Reverse-scored `stress` item.** Only negatively-framed item on the survey; shares the universal `1 = Very Low … 5 = Great` labels, the universal "≥4 green / ≤2 red" colouring (`app/(admin)/admin/wellbeing/page.tsx:130-134`), and the universal `score <= 2` flag rule. Either polarity reading produces wrong behaviour, and neither is safe to average with the other four.
2. **Composite average includes the reverse-coded item.** `buildWellbeingTrend` (`wellbeingUtils.ts:44-54`) means all five scores; the admin page repeats the same arithmetic inline (`page.tsx:65-67`). The sparkline and the big number are not interpretable.
3. **Single-point absolute threshold, no baseline.** No z-score, no rolling mean, no comparison to the student's own history, no consecutive-run rule. A stoic student who always answers 4 and drops to 3 is invisible; a student who always answers 2 generates an identical alert every fortnight forever.
4. **Only `mood` and `stress` can flag.** `sleep`, `energy` and `football_enjoyment` can be 1/5 across the board with no alert at all — despite sleep and (loss of) enjoyment being among the more reliable early indicators.
5. **Free-text note is never rendered** (see §1). Confirmed: `note` appears in `app/(admin)/admin/wellbeing/page.tsx` only at line 34, inside a type.

**Coverage**

6. **No non-response signal.** Nothing sets `status = 'expired'`. No cron sweeps stale open surveys. No alert on N consecutive non-completions. The admin page shows `open` as amber text but does not sort, count or rank by it.
7. **No self-initiated check-in.** `/wellbeing` with no open survey renders "No survey open right now — Your next check-in will arrive on a Monday" (`page.tsx:61-69`). A student in crisis in an even week has no in-app route through this feature.
8. **`/myconcern` is a dead-end external link.** The page (`app/(student)/myconcern/page.tsx`) links to `https://www.myconcern.co.uk` — the vendor's public homepage, not a college tenant URL — and lists three job titles ("Tutor", "Head of Year", "School Safeguarding Lead") with no names, faces or contact routes. It is reachable only from a tile on the student dashboard (`dashboard/page.tsx:559`), not from the BottomNav.
9. **AI Coach is unguarded and unmonitored** (see §1). `app/api/ai/chat/route.ts:71`.

**Workflow / alert quality**

10. **Fan-out to every staff member, no owner.** Same push text regardless of severity or number of flags; classic diffusion of responsibility.
11. **Cross-feature masking.** `ConcernList.tsx:43-47` — an open `attendance` case hides the wellbeing suggestion.
12. **Suggestions have no time bound and no dismissal.** Computed from the latest survey per student within the newest 200 rows, regardless of age; a flag from last term persists until that student submits a clean survey. No "actioned"/"reviewed" state.
13. **`.limit(200)` will silently truncate.** Both `/admin/wellbeing` and `/admin/safeguarding` cap survey reads at 200 rows. With ~66 active students that is barely three rounds; as the roster grows, students fall off the bottom with no warning.
14. **Student grouping keys on name.** `/admin/wellbeing` groups by `r.users?.name ?? r.id` (`page.tsx:43`) — two students with the same name merge into one card.

**Access control / data protection**

15. **`/admin/wellbeing` has no role check.** Only `getUser()` (`page.tsx:12-13`), then `createAdminClient()` (service role, bypasses RLS). The `(admin)` layout admits `admin | coach | teacher`. The page is not in the sidebar — it is reached *by the red-flag push*, which is sent to coaches and teachers. So the exposure is the designed flow, not an edge case.
16. **Code and RLS disagree.** Migration 023 grants `wellbeing_surveys`/`wellbeing_responses` to `role = 'admin'` only. The page works only because it uses the service role. If it were ever switched to the user-scoped client it would break for coaches — which is the correct behaviour, currently unenforced.
17. **Middleware fails open on role-lookup failure** (`middleware.ts:157-158`, "allow through — layouts will do their own checks"). The wellbeing page has no such check.
18. **Students can insert their own survey rows** (`023_wellbeing.sql:35-37`) — minor, but it means `wellbeing_surveys` is not a trustworthy record of what was actually issued.
19. **Privacy notice under-describes the audience.** `app/privacy/page.tsx:51-52` groups "fortnightly wellbeing survey answers" with safeguarding records described as "strictly access-controlled" and "visible to designated staff only". In practice the survey answers are visible to all staff. The notice is also written in adult register throughout — see §3.5 on the Children's Code transparency standard.
20. **Stale documentation.** `docs/SESSION-HANDOFF.md:10-12` still warns that `030_safeguarding.sql` is "committed but NOT yet run"; migration 060's notes prove it has been running in production since at least 2026-08-20. Low risk, but the handoff doc will mislead the next person.

---

## 3. External evidence

### 3.1 Subjective self-report beats objective measures — and the design details matter

**Saw, Main & Gastin (2016), BJSM 50:281-291, "Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures — a systematic review"** ([PubMed](https://pubmed.ncbi.nlm.nih.gov/26423706/), [full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC4789708/)). 56 studies. Where sensitivity differed between subjective and objective measures, subjective won in ~85% of cases. Two findings bear directly on this codebase:

- **Recommended cadence is daily brief items, weekly comprehensive tools, monthly objective measures.** Fortnightly is off the bottom of the scale the literature works in.
- **Consolidating subscales into a single total score typically *reduced* sensitivity** — in one of five studies, meaningful change appeared only in the subscales and not in the total. The average score and sparkline on `/admin/wellbeing` are the exact pattern this warns against.

**Hooper & Mackinnon index** — 4 items (sleep, stress, fatigue, muscle soreness), 1-7, where **1 = very good and 7 = very bad for every item**. That consistent negative polarity is precisely what the current 5-item set lacks. Applied prospectively in a 50-week Para-athlete study, high stress predicted greater odds of gradual-onset injury the following week ([PubMed](https://pubmed.ncbi.nlm.nih.gov/42093762/); [Hooper + HRV in soccer](https://pmc.ncbi.nlm.nih.gov/articles/PMC6390199/)).

**Session-RPE (Foster et al. 2001, [PubMed](https://pubmed.ncbi.nlm.nih.gov/11708692/); validity review Haddad et al. 2017, [Frontiers](https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2017.00612/full))** — 36 validity studies, explicitly confirmed in children and adolescents. Relevant because the app already has training and GPS data: wellness deltas are far more interpretable against known load.

### 3.2 Thresholds: individualise, smooth, and require persistence

- **Individual rolling baselines beat fixed thresholds.** Common practitioner formula: 60-day baseline with a 7-day rolling comparator; flag threshold = **Smallest Worthwhile Change = 0.5-1.0 × the athlete's own within-subject coefficient of variation**, not a flat cut-off ([Global Performance Insights](https://www.globalperformanceinsights.com/post/smallest-worthwhile-change-interpreting-meaningful-change-in-athlete-monitoring); [rolling 28-day z-scores](https://adam-sullivan.com/2017/05/30/formatting-raw-wellness-data-based-on-rolling-28-day-z-scores/)). Standard banding: low `< -1 SD`, normal `-1 to +1 SD`, high `> +1 SD`.
- **Measurement error can exceed the daily signal.** A 2026 field study of a 7-item, 5-point wellness questionnaire (Frontiers in Sports and Active Living, [PMC13529514](https://pmc.ncbi.nlm.nih.gov/articles/PMC13529514/)) reported **SEM 0.59-0.61 and MDC95 1.64-1.69 on a 5-point scale**, concluding that "small day-to-day score changes should be interpreted cautiously at the individual level" and the tool "should not be used as a stand-alone tool". A single 2/5 is inside the noise floor.
- **Require persistence before acting.** DALDA's long-standing practitioner rule is **"worse than normal" on a stressor for 3 consecutive days** before changing load ([overview](https://dusportpsych.wordpress.com/2012/01/11/overreaching-daily-analyses-of-life-demands-for-athletes-dalda/)).
- **Two-tier response, not automatic action.** Practitioner "flag list" design: one flagged domain → a human check-in conversation before training; two or more → protocol change ([SimpliFaster](https://simplifaster.com/articles/athlete-wellness-questionnaires-dos-donts/), practitioner source).
- **Minimum data for a usable baseline: 2-4 weeks and at least 3-4 entries per week.** Below that, normal variation cannot be separated from signal.

### 3.3 Adolescents, honesty, and the selection incentive

- **Half the athletes interviewed admitted withholding the truth.** Saw, Main & Gastin, "Monitoring Athletes Through Self-Report: Factors Influencing Implementation" ([PMC4306765](https://pmc.ncbi.nlm.nih.gov/articles/PMC4306765/)) — 30 interviewees, 681 coded meaning units. Athletes withheld specifically to avoid appearing "unprofessional" or "lacking motivation". Two named patterns: **"faking good"** (protect selection) and **"faking bad"** (get load reduced). Punitive compliance cultures produced careless completion, not honesty. Coach engagement was the biggest single lever: "if it doesn't have a reinforcement from the coaches, [compliance] tends to fall away."
- **Compliance decays, and unsupported athletes fall away fastest.** Same programme of work: of 131 athletes given a self-report tool, 70 attempted use; coach-supported team-sport athletes averaged **84% compliance**, self-directed athletes markedly lower, with adherence declining over the intervention ([context/support study](https://pubmed.ncbi.nlm.nih.gov/26664269/)).
- **"Invisible monitoring" reduces honesty.** Athletes report discomfort when they do not know who reads their answers or what happens to them; visible, explained use improves trust. Neupert, Cotterill & Jobson, IJSPP 2019;14(1):99-104 ([PubMed](https://pubmed.ncbi.nlm.nih.gov/29952658/)) find athletes need frequent two-way feedback and to see the programme actually change in response to their data.
- **Poor athlete education about *why* accuracy matters is a commonly reported cause of dishonest responding**; recommend individual rather than peer-group administration to avoid social comparison. Coyne et al., Sports Medicine – Open ([PMC6301906](https://pmc.ncbi.nlm.nih.gov/articles/PMC6301906/), [follow-up](https://link.springer.com/article/10.1186/s40798-022-00433-y)).
- **Differential treatment sabotages credibility** — visibly playing an athlete who never completes the form tells everyone else the tool is decorative ([Mobile ASRM implementation study, PMC6683625](https://pmc.ncbi.nlm.nih.gov/articles/PMC6683625/)).
- **Adult-validated scales degrade with young people.** ARSS/SRSS in adolescent and child athletes ([PMC6882283](https://pmc.ncbi.nlm.nih.gov/articles/PMC6882283/)): the short 8-item SRSS reached α = 0.72-0.80 while the full ARSS's Emotional Balance subscale fell to **α = 0.50 in children vs 0.76 in adults**; **more than 6 response options decreased reliability for ages 8-16**; 21.8-22.6% of 10-11 year olds could not understand key items. A 16-19 college cohort sits at the reliable end of this, but it argues firmly for short, concrete, plainly-worded items and a ≤6-point scale — which the current 1-5 scale satisfies.
- **Help-seeking barriers skew male and skew sport.** Rickwood's process model names self-reliance, low emotional literacy and stigma as core barriers; "the notion of 'seeking help' connotes diminished self-reliance... particularly for males" ([PMC11147454](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11147454/)). Only 18-34% of young people with high symptoms seek professional help; they prefer parents and friends over services ([BMC Psychiatry systematic review](https://link.springer.com/article/10.1186/1471-244X-10-113)). For young elite athletes, stigma is "the most important perceived barrier", compounded by "cultures that equate emotional struggle with weakness" — and the strongest facilitator is **encouragement from the coach** ([BMC Psychiatry](https://link.springer.com/article/10.1186/1471-244X-12-157)).

### 3.4 Streaks, alert fatigue, and what teens actually asked for

- **Teens explicitly rejected streaks and badges on mood check-ins.** MoodyTunes qualitative study, 24 participants aged 13-25, Frontiers in Digital Health ([full text](https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2022.1045765/full)). The majority opposed streaks/badges/achievement rewards tied to mood outcomes, several citing Snapchat streak anxiety. Verbatim: *"I can't even get out of my bed and you want me to achieve badges."* They also preferred **passive framing** ("do you want to chat to someone today?") over **directive prompts** ("you need help"), which could actively worsen wellbeing; and wanted anonymity/guest mode, non-buried privacy information, and control over notification frequency.
- **Alert fatigue is quantified and compounding.** Clinical decision-support literature ([PMC5387195](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5387195/)): override rates of 49-96%; alert acceptance drops roughly 30% per additional reminder per encounter and ~10% per 5-point rise in the proportion of repeated reminders. On NEWS early-warning scores, sensitivity at NEWS≥5 was 82-88% for ICU admission/28-day mortality, but with low event prevalence all early-warning scores carry high false-positive rates, and one systematic review states NEWS "may lead to alarm fatigue" ([Frontiers in Medicine](https://www.frontiersin.org/journals/medicine/articles/10.3389/fmed.2021.704358/full)). **Tightening a threshold to cut false positives directly costs sensitivity** — which is why the answer is triage design, not threshold tuning alone.
- **Anonymity increases disclosure but degrades follow-up.** Anonymous methods reliably increase disclosure of stigmatised information ([PMC4112969](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4112969/)), but anonymous reports "receive lower investigative priority because agencies can't verify credibility, ask follow-up questions, or gather additional documentation". Recommended resolution is a **hybrid**: anonymity at first disclosure, identification introduced during follow-up ([arXiv 2506.07041](https://arxiv.org/pdf/2506.07041)). Kooth reports **97% of its community value their anonymity** ([Kooth insights](https://connect.kooth.com/insights/from-anonymity-to-autonomy-how-young-people-feel-about-kooth)).
- **Young people expect a human to respond, and trust collapses if nothing visibly happens.** Kooth's model is continuous human moderation scanning for self-harm, suicide, abuse, eating disorders and exploitation on a "better safe than sorry" basis, escalating to counsellors or emergency services ([PMC9522450](https://pmc.ncbi.nlm.nih.gov/articles/PMC9522450/)) — with 10-100 submissions per moderator shift and explicit difficulty interpreting indirect disclosure (metaphor, poetry, minimal text). Edinburgh research found youth distrust of mental-health apps driven partly by unclear data handling and unclear follow-through ([University of Edinburgh](https://www.ed.ac.uk/news/2022/young-people-want-trustworthy-mental-health-apps)).
- **Mood-tracking app users value flexibility of input format over any one format** — free text, colour, emoji, audio and numeric scales all appear across apps; personalisation matters more than the choice ([PMC7585773](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7585773/)).
- **MHST evaluation** found not all eligible young people accessed support, with barriers including low awareness, stigma, preference for other sources, and past negative experience ([Journal of Mental Health](https://www.tandfonline.com/doi/full/10.1080/09638237.2023.2278101)). **#beeWell** (~100,000 young people, Greater Manchester) demonstrates the value of pairing a wellbeing score with concrete need indicators — its 2025 findings surfaced 1 in 10 reporting food insecurity at home alongside the headline wellbeing numbers ([beeWell](https://beewellprogramme.org/beewell-publishes-headline-findings/)).

### 3.5 UK statutory and regulatory context

- **KCSIE 2026** (published 7 July 2026, in force 1 September 2026, [PDF](https://assets.publishing.service.gov.uk/media/6a9081309a177a1decf97b00/Keeping_children_safe_in_education_2026.pdf); [NSPCC summary of changes](https://learning.nspcc.org.uk/research-resources/schools/keeping-children-safe-in-education-caspar-briefing) — note the 2026 edition adds explicit generative-AI content). The DSL must keep "detailed, accurate and secure written records" of concerns, discussions and decisions **including reasoning**, and a decision *not* to refer is itself a recordable safeguarding decision. Practice guidance: record the same day, especially where risk is escalating.
- **Ofsted, framework in force from 10 November 2025** ([EIF](https://www.gov.uk/government/publications/education-inspection-framework-eif/education-inspection-framework-for-use-from-november-2025)): safeguarding is judged standalone on a binary **met / not met** basis. **Inadequate record-keeping was the single most common reason cited for safeguarding failures in Ofsted reports 2019-2022**; inspectors check audit trails, timely follow-up and evidence of action taken.
- **NSPCC low-level concerns guidance** ([NSPCC Learning](https://learning.nspcc.org.uk/safeguarding-child-protection/low-level-concerns)): a good record contains the concern, the context it arose in, the action taken and the reporter's name; records should be **reviewed for patterns**, since repeat low-level concerns should trigger a wider cultural response rather than a one-off.
- **CPSU / FA**: the [CPSU Framework of National Standards](https://thecpsu.org.uk/resource-library/tools/standards-for-safeguarding-and-protecting-children-in-sport/) (10 standards, progress against them a Sport England funding condition) and [The FA's safeguarding requirements](https://www.thefa.com/football-rules-governance/safeguarding) (every academy needs a Designated Safeguarding Officer with enhanced checks and FA training, annual Safeguarding Declaration).
- **Safeguarding software patterns worth copying**: CPOMS auto-timestamps every entry for the audit trail and supports linked sibling records; MyConcern **automatically notifies the DSL on every new concern and auto-starts a chronology**, with task assignment and tracking; Tootoot and SWGfL Whisper implement the anonymous-first pupil "worry box" where the pupil can reveal identity at any point and staff can reply while anonymity holds ([CPOMS](https://www.cpoms.co.uk/), [Whisper](https://swgfl.org.uk/products/whisper/), [Tootoot](https://tootoot.co.uk/)). Note: no vendor documentation found describes a literal per-alert read receipt; accountability is achieved through the audit trail, not confirmed-read.
- **UK GDPR / ICO.** Wellbeing and mood data is **special category data** under Art.9 — requires an Art.9 condition *in addition to* an Art.6 basis, plus (usually) an appropriate policy document under Sch.1 DPA 2018 ([ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/)). ICO is explicit: "if you can achieve your aim without special category data, don't collect it."
- **ICO Age Appropriate Design Code (Children's Code)**, applies up to 18 ([code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/)). Four standards bind this feature directly: **best interests of the child** as the overarching principle (design for wellbeing, not engagement metrics); **Standard 8 data minimisation**; **Standard 13 nudge techniques**, which explicitly prohibits design that "leads or encourages children to give unnecessary personal data" — this is the regulatory argument against streaks, not just the UX one; and **Standard 14 profiling**, which must default to **off** absent a compelling best-interests justification. Transparency must be pitched to the reading age of the relevant band (16-17 here) — a generic adult privacy page does not satisfy it.

---

## 4. Prioritised feature ideas

Effort: **S** ≈ under a day, **M** ≈ 1-3 days, **L** ≈ a week or more.
"Improves" is explicit: **[D]** = detection accuracy, **[X]** = student experience.

### Tier 0 — Correctness. Do these before anything new.

**1. Fix the `stress` item's polarity (and audit every item's polarity).**
Either reword to positive framing ("How calm have you felt?") so all five share a direction, or add an explicit `polarity: 'positive' | 'negative'` field to `SURVEY_QUESTIONS` and honour it in `getRedFlags`, the colour bands, and any composite. Per-item labels must replace the shared `SCORE_LABELS` array.
**[D]** — currently the flag rule is either inverted (never catching stressed students) or backwards (alerting on calm ones); both are wrong. **[X]** — students are currently asked an ambiguous question and get an incoherent scale under it.
**Risk if done wrong:** changing polarity without migrating historical rows makes all existing `stress` data uninterpretable and any trend line silently wrong. Add a `scale_version` and treat pre-fix data as a separate series rather than back-filling a guess.
**Effort:** S. **Needs:** UI + lib, plus a small migration if versioning the scale.

**2. Render the free-text note to staff.**
Show `wellbeing_responses.note` on `/admin/wellbeing`, include it in the `/admin/safeguarding` suggestion, and treat *any* non-empty note as a flag condition in its own right regardless of scores.
**[D]** — the highest-signal field in the survey is currently write-only. **[X]** — students who write something get a response instead of silence.
**Risk if done wrong:** free text about a third party (a parent, another student) becomes a disclosure the moment it's displayed; it needs the same admin-only visibility as a concern record, not the current all-staff wellbeing page.
**Effort:** S. **Needs:** UI only (plus the access fix in item 4).

**3. Give the AI Coach a safeguarding system prompt, a signposting response, and an escalation path.**
Add explicit instructions for distress, self-harm, abuse and crisis: respond warmly and non-directively, never diagnose, always name a real human and the 999/Childline/Shout routes, and never close the conversation with only a motivational line. Separately, flag the conversation for DSL review — either by prompting Claude to emit a structured `needs_human: true` signal, or by a lightweight server-side check on the student's message before the reply is generated. Tell students up front, in the chat UI, that this is what happens.
**[D]** — this is very likely the channel with the most honest disclosure in the app, and it currently detects nothing. **[X]** — an always-available, low-stakes conversation is exactly what the help-seeking literature says male adolescents prefer.
**Risk if done wrong:** covert monitoring of a chat students believe is private is a trust catastrophe and an ICO transparency failure — the disclosure notice is not optional. Equally, an over-eager keyword flag on football banter ("I'm dying out there") floods the DSL. And the AI must never *be* the response: it signposts to a named human, it does not counsel.
**Effort:** M. **Needs:** prompt + route change; a migration if flagged conversations get their own review queue.

**4. Lock `/admin/wellbeing` to the DSL, and align RLS with it.**
Add the same `profile.role !== 'admin'` guard `/admin/safeguarding` already uses (`page.tsx:26-32`). Decide deliberately what coaches and teachers should see — the defensible answer is "this student needs a conversation", not raw mood scores.
**[D]** — indirectly but strongly: athletes report that visibility to coaches is a primary driver of "faking good" (§3.3). Restricting the audience is a detection intervention. **[X]** — students can be told truthfully who sees what.
**Risk if done wrong:** locking it down without giving coaches *any* signal removes the coach from the loop entirely, and coach engagement is the single biggest lever on honest completion. Give coaches a non-scoring signal ("check in with Josh this week") instead of nothing.
**Effort:** S. **Needs:** UI/route guard; optionally a migration to widen RLS coherently rather than relying on the service role.

**5. Stop unrelated open cases masking wellbeing flags.**
`ConcernList.tsx:47` should filter on open concerns of a *relevant* category (or on an explicit "this flag has been actioned" record), not on any open concern of any category.
**[D]** — directly restores detection for the highest-risk cohort. **[X]** — none.
**Risk if done wrong:** removing the filter entirely re-floods the panel with students already under active casework. The fix is category-aware suppression plus a real dismissal state (item 7).
**Effort:** S. **Needs:** UI only (S) or UI + migration if adding a dismissal record (M).

### Tier 1 — Detection accuracy

**6. Move to weekly, and flag on the student's own baseline rather than an absolute score.**
Weekly (not fortnightly, not daily to start) gets to a usable baseline in 4-6 weeks. Flag when a student is **below their own rolling mean by more than their own variability** — the standard banding is `< -1 SD`, with SWC = 0.5-1.0 × the student's within-subject CV. Require a **consecutive-run rule** (2 consecutive weeks, mirroring DALDA's 3-consecutive-days logic) before a soft flag escalates.
**[D]** — this is the core accuracy change. It catches the stoic student who drops from 4s to 3s, and stops alerting every fortnight on the student who always answers 2. **[X]** — fewer pointless conversations triggered by a single bad Monday.
**Risk if done wrong:** baselining a student who was already struggling when they joined normalises their distress — a low but *stable* baseline must still surface, as a separate "persistently low" band, never suppressed by the trend logic. Also: with MDC95 ≈ 1.6 on a 5-point scale, do not promise precision the instrument does not have.
**Effort:** L. **Needs:** cron change + migration (stored baselines/z-scores, or a materialised view) + admin UI.

**7. Turn a flag into a real case record with an owner, an acknowledgement and an outcome.**
On flag, insert a `safeguarding_concerns` row with `category = 'wellbeing'`, `raised_by = null`, a `raised_date`, and a description carrying the actual evidence (which items, which scores, the note verbatim) — exactly as the attendance cron already does. Reuse the `safeguarding_concerns_one_auto_per_day` pattern as the race guard. Require the DSL to record an outcome including "reviewed, no action needed, because…".
**[D]** — makes it possible to know whether detection is working at all; you currently cannot answer "how many flags were acted on?" **[X]** — indirectly: students learn that answering honestly leads somewhere.
**Risk if done wrong:** every 2/5 becoming a formal safeguarding case is both alert fatigue and a proportionality problem — a mood dip is not automatically a child-protection concern, and over-recording is its own harm. Use the attendance cron's two-stage pattern: soft flag → conversation prompt; only a persistent or severe pattern → a formal case. Consider a separate lighter `wellbeing_flags` table for stage one so `safeguarding_concerns` stays meaningful.
**Effort:** M. **Needs:** migration + route change + admin UI.

**8. Treat non-response as a signal, and expire stale surveys.**
Add an expiry cron (with a `vercel.json` entry) that closes surveys older than the cadence, and raise a soft flag after N consecutive non-completions. Surface a compliance column on the admin view. Never use it punitively.
**[D]** — withdrawal and disengagement are among the clearest observable signals, and are currently invisible. The `'expired'` status already exists in the schema and has no writer. **[X]** — none directly; do *not* let this become nagging.
**Risk if done wrong:** if non-completion carries a consequence, students complete it carelessly — the literature is explicit that punitive compliance cultures produce inaccurate data, not honest data. This must reach a tutor as "have a word", never a sanction.
**Effort:** M. **Needs:** new cron + `vercel.json` entry + migration (a `wellbeing_expiry_log` with a unique date constraint, following migrations 042/064) + admin UI.

**9. Add a free-text follow-up prompt whenever any score is low, plus "what would help right now?"**
On a low score, ask one open, non-directive question — "Anything you want to say about that?" — and offer a short chooser of concrete supports (talk to my tutor / talk to the safeguarding lead / just wanted to log it / nothing right now).
**[D]** — converts an uninterpretable "2" into an actionable statement, and captures the "what would help" signal that #beeWell shows sits alongside the wellbeing score rather than inside it. **[X]** — gives students agency over what happens next instead of triggering an opaque staff alert.
**Risk if done wrong:** directive phrasing ("you need help") measurably worsens wellbeing in the teen research; keep it passive. And an offer of "talk to my tutor" that produces no contact within a day is worse than not offering it.
**Effort:** M. **Needs:** UI + migration (a follow-up/support-request field).

**10. Separate the items; retire the composite average.**
Show five item trends, not one number. If a headline is needed, use "number of items below baseline", never a mean — and never include a reverse-coded item in any mean.
**[D]** — the systematic review found consolidating subscales reduced sensitivity, with meaningful change visible only at subscale level in one of five studies. **[X]** — none.
**Risk if done wrong:** five sparklines per student across ~66 students is unreadable; the list view needs sorting by flag state, not five charts per row.
**Effort:** M. **Needs:** UI + lib.

**11. Add soreness/fatigue and a load anchor.**
Align items with the Hooper index (sleep, stress, fatigue, muscle soreness) and add a single session-RPE item on training days. Keep the total to 5-6 items and keep the ≤6-point scale.
**[D]** — soreness and fatigue are validated leading indicators; RPE gives the load context that makes a wellness dip interpretable, and the app already holds training/GPS data to compare against. **[X]** — a football-relevant question is one an academy student sees the point of, which the buy-in literature says drives honest completion.
**Risk if done wrong:** item creep. The implementation literature's most consistent complaint is that tools were "too extensive"; 7 items is near the practical ceiling. Adding items means removing items.
**Effort:** M. **Needs:** migration (question keys) + UI + lib.

**12. Two-tier flag routing: soft flag to the tutor, hard flag to the DSL.**
Soft = one item below baseline → a named tutor gets "have a word with X this week", no case, no fan-out. Hard = persistent, multi-item, or any non-empty concerning note → DSL only, formal case, admin-only visibility. Replace the current all-staff push entirely.
**[D]** — directly targets alert fatigue, where acceptance drops ~30% per additional alert. A single named recipient beats a broadcast to twenty people. **[X]** — the person who follows up is someone the student knows.
**Risk if done wrong:** routing to a tutor who is off sick or has left produces a silently dropped concern. Needs a fallback owner and an unacknowledged-after-N-hours escalation to the DSL.
**Effort:** L. **Needs:** migration (tutor assignment, acknowledgement state) + routing logic + UI.

### Tier 2 — Student experience, without weakening detection

**13. Let students check in whenever they want.**
Replace "No survey open right now — your next check-in will arrive on a Monday" with an always-available "I want to check in" that creates an ad-hoc survey. Distinguish scheduled from self-initiated in the data.
**[D]** — a self-initiated check-in is a *stronger* signal than a scheduled one, because the student chose to send it. Currently that signal cannot exist. **[X]** — removes the single most obviously frustrating dead end in the feature.
**Risk if done wrong:** it must not become an alternative to a real disclosure route for something urgent — pair it with a visible "need to talk to someone now?" path (item 15).
**Effort:** M. **Needs:** migration (`source` column, relax the one-open-survey assumption in the cron) + route + UI.

**14. Tell students exactly who sees this and what happens next, in their own register.**
A short, plain panel on `/wellbeing`: who reads it, what a low score triggers, what it will never affect (selection, playing time), and how to get something removed or corrected. Same for the AI Coach.
**[D]** — "invisible monitoring" measurably reduces honesty; being told a flag will not bench you removes the main incentive to fake good. **[X]** — and it is a Children's Code transparency requirement, which the current adult-register `/privacy` page does not meet for a 16-17 band.
**Risk if done wrong:** promising confidentiality you cannot keep. The honest wording is "usually just your tutor — but if we think you're at risk we have to tell the safeguarding lead, and here's why." Overpromising and then escalating destroys trust permanently.
**Effort:** S. **Needs:** UI only.

**15. Make `/myconcern` a real route to a real human.**
Name the DSL, tutor and head of year with photos and an in-app contact route. Keep the external MyConcern link but verify it points at the college's tenant, not the vendor homepage. Add a "request a quiet word" button that creates a low-visibility request seen only by the named adult, with the student choosing who. Put it in the BottomNav, not only on a dashboard tile.
**[D]** — self-disclosure is the highest-precision detection channel there is, and it is currently a dead-end external link with three job titles and no names. **[X]** — "an existing trusting relationship" is the named facilitator in the athlete help-seeking evidence.
**Risk if done wrong:** a request with no SLA is worse than no button. Also: a student-facing route must not be *anonymous-only*, or the DSL cannot follow up — use the hybrid pattern (anonymous at first disclosure, identification during follow-up) that Whisper and Tootoot implement.
**Effort:** M. **Needs:** migration (quiet-word requests) + UI + routing.

**16. Close the loop: show the student that a human saw it.**
When a flag is actioned, the student sees a neutral "someone from the team has seen this and will check in with you" — not the case detail, just proof of life.
**[D]** — the strongest predictor of continued honest reporting is seeing the system respond; trust collapses when disclosure is met with silence. **[X]** — obvious.
**Risk if done wrong:** an automated "we've seen this" that nobody follows up on is worse than silence, because it converts uncertainty into a broken promise. Only send it when a named human has acknowledged.
**Effort:** M. **Needs:** migration (acknowledgement state) + UI.

**17. Give students control of check-in reminders and let them snooze.**
Choice of day and time, and a snooze — with snoozing itself recorded as neutral data, never as non-compliance.
**[D]** — consistent time-of-day administration reduces circadian confounding of mood and vigour scores. **[X]** — teen users specifically asked for notification-frequency control.
**Risk if done wrong:** if snooze silently removes a student from the cohort, the highest-risk students opt themselves out invisibly. Snooze must defer, never cancel, and repeated snoozing is itself a soft signal.
**Effort:** M. **Needs:** migration (per-student preferences) + cron change + UI.

**18. Give the DSL a chronology per student.**
A single timeline merging wellbeing responses, notes, flags, attendance cases, excusals and safeguarding notes — the pattern every UK safeguarding product converges on (CPOMS, MyConcern), and what the NSPCC low-level-concerns guidance means by reviewing for patterns.
**[D]** — pattern recognition across sources is where the real signal is; three unremarkable things in one week is the picture no single alert shows. **[X]** — none directly.
**Risk if done wrong:** aggregating everything about a child in one screen is a serious data-protection surface. Admin/DSL only, access-logged, with a retention rule.
**Effort:** L. **Needs:** UI + query work; likely a view migration for performance.

**19. Housekeeping worth folding into whichever change touches these files.**
Drop `.limit(200)` in favour of a proper per-student latest-N query on both `/admin/wellbeing` and `/admin/safeguarding` (silently truncates as the roster grows); group by `student_id` not `users.name` (`/admin/wellbeing` page.tsx:43 merges same-named students); time-bound the safeguarding suggestions so a flag from last term stops presenting as current; update the stale migration warning in `docs/SESSION-HANDOFF.md:10-12`. **Effort:** S each. **Needs:** UI only.

---

## 5. Anti-patterns to avoid

1. **Streaks, badges, points or leaderboards on the check-in.** Teens in the MoodyTunes study explicitly rejected them for mood tracking, several citing Snapchat streak anxiety; the mechanism is loss aversion, and it converts an honest report into a score to protect. It is also arguably a Children's Code Standard 13 breach ("nudge techniques… encourage children to give unnecessary personal data"). A streak on a wellbeing check-in *manufactures* the exact failure mode this project is trying to avoid.
2. **A single composite "wellness score".** The systematic review found consolidation reduced sensitivity, with change visible only at subscale level in one of five studies. The current average is worse than that, because it includes a reverse-coded item.
3. **Making coaches the audience for individual raw scores.** Half of athletes in the implementation study admitted withholding truth to avoid appearing unprofessional; visibility to the selector is the main driver. Coaches need "check in with Josh", not Josh's mood number.
4. **Any link, real or perceived, between check-in answers and selection, playing time or attendance sanction.** Practitioners are advised to state explicitly and up front that a flagged score will not bench you. Absent that statement, students assume the opposite and answer accordingly.
5. **Directive crisis copy.** "You need help" / "We're worried about you" measurably worsened wellbeing in the teen research. Passive, autonomy-respecting framing ("Do you want to chat to someone today?") is what young people asked for.
6. **Lowering thresholds to "catch everything".** The early-warning-score literature is unambiguous: with low event prevalence, loosening the threshold buys sensitivity at a false-positive cost that destroys the responder's attention. Alert acceptance drops ~30% per extra alert. The answer is better routing and triage, not a lower bar.
7. **Anonymous-only reporting.** It raises disclosure but blocks follow-up — anonymous reports get lower priority precisely because nobody can ask a second question. Use the hybrid: anonymous to open, identified to resolve.
8. **Broadcasting a wellbeing alert to all staff.** Currently done. It is simultaneously an alert-fatigue generator, a diffusion-of-responsibility machine, and an over-disclosure of special-category data to people with no need to know.
9. **Auto-notifying parents on a low mood score.** For a 16-19 cohort, the fear that disclosure goes home is one of the main help-seeking barriers. Parent contact is a DSL judgement, not a threshold rule.
10. **Letting the AI Coach be the response.** It can listen, normalise and signpost. It must never be the thing that "handled" a disclosure, and students must be told that clearly.
11. **Asking for anything you will not look at.** The free-text note has been collected for months and never displayed. Either read it or stop asking for it — collecting special-category data you do not use also fails ICO data minimisation.
12. **Daily check-ins as the first move.** Tempting, but compliance decays even among initially engaged athletes, and daily repetition of identical items invites straight-lining. Get weekly working with a real response loop first.

---

## 6. Open questions for Paul

1. **Stress item polarity — which way did you intend it, and how do students actually read it today?** This determines whether the current system has been generating false positives on calm students or missing stressed ones, and whether existing `stress` data is salvageable. Worth asking two or three students directly before changing anything.
2. **Who is the DSL, and is there a named deputy?** Every routing decision in Tier 1 depends on there being one accountable person and a fallback. Right now "the DSL" is the whole `role = 'admin'` set.
3. **Should coaches see anything about individual wellbeing at all?** The evidence pulls both ways: coach engagement drives honest completion, coach visibility drives dishonest answers. The likely answer is "coaches get an action, never a score" — but it is your call and it changes the access model.
4. **Do students each have a named tutor in the system?** Tier 1 item 12 (soft flags to a named human) is unbuildable without it, and I did not find a tutor/keyworker relationship in the schema.
5. **Weekly or fortnightly?** Weekly is what makes baselining viable, but it triples the response burden and doubles the flag volume. If staff capacity to *respond* is the binding constraint, more data makes things worse, not better.
6. **What is the response SLA?** Every experience recommendation here is conditional on something happening within a day or two of a disclosure. If nobody can commit to that, several Tier 2 items should be dropped rather than built — an unanswered disclosure is worse than an unasked question.
7. **Should AI Coach chats be reviewable for safeguarding — and are you willing to tell students that plainly?** If the answer to the second half is no, the answer to the first half must also be no.
8. **What is the retention rule for wellbeing responses?** None is defined. ICO expects a schedule; safeguarding retention rules do not automatically transfer to routine wellbeing data.
9. **Does the college already run a wellbeing instrument (Anna Freud toolkit, #beeWell-style survey) that this should align with or feed rather than duplicate?**
10. **Is the `/myconcern` external link pointing at the college's actual MyConcern tenant?** It currently points at the vendor's public homepage, which is not a working disclosure route.
11. **Age band and DPIA.** Most students are 16-19, but the youth section covers U9-U18. If anyone under ~13 is ever in scope for a self-report instrument, the reliability evidence says do not — and a DPIA is required either way for special-category data on children.

---

## Appendix — files referenced

```
lib/wellbeing/wellbeingUtils.ts                          survey definition, flag rule, trend maths
app/(student)/wellbeing/page.tsx                         student check-in UI, SCORE_LABELS
app/api/wellbeing/submit/route.ts                        submission + red-flag staff push
app/api/cron/wellbeing-survey/route.ts                   fortnightly issuance
app/(admin)/admin/wellbeing/page.tsx                     staff monitor (no role check; note never rendered)
app/(admin)/admin/safeguarding/page.tsx                  admin-only; wellbeing → suggestion bridge
components/admin/safeguarding/ConcernList.tsx            suggestion suppression logic (lines 43-47)
components/wellbeing/WellbeingPromptCard.tsx             dashboard prompt
app/(student)/myconcern/page.tsx                         external-link disclosure page
app/api/ai/chat/route.ts                                 AI Coach system prompt (no safeguarding)
app/api/cron/attendance-safeguarding-check/route.ts      the two-stage pattern worth copying
app/api/safeguarding/route.ts                            requireAdmin() gate
lib/safeguarding/safeguardingUtils.ts                    case categories, statuses, triage sort
middleware.ts                                            role routing; fails open on lookup failure
supabase/migrations/023_wellbeing.sql                    survey schema + RLS (admin-only)
supabase/migrations/030_safeguarding.sql                 case + notes schema
supabase/migrations/060_...unique_constraint.sql         race-guard pattern for auto-raised cases
supabase/migrations/064_safeguarding_nudge_log.sql       once-per-day nudge dedup pattern
vercel.json                                              all cron schedules (UTC)
app/privacy/page.tsx                                     privacy notice (adult register)
```
