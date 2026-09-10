# Wellbeing Detection Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two confirmed-live, pre-existing gaps in the wellbeing detection pipeline before building any new flag-eligible question on top of it: a category-blind suggestion-masking bug, and a missing admin-only guard on the staff wellbeing view.

**Architecture:** Two small, independent, single-file fixes — a filter predicate and a page-level role guard, both mirroring patterns already proven elsewhere in this codebase. No schema, migration, or RLS change.

**Tech Stack:** React (Client Component for Task 1), Next.js Server Component (Task 2), Jest + Testing Library.

## Global Constraints

- No coach-facing replacement signal for the Task 2 visibility lock — explicitly deferred, product-owner decision. (design spec)
- No change to `getRedFlags`, `normalizedScore`, or any other already-shipped Tier 0 fix from earlier tonight. (design spec)
- No change to the chip-picker/connection-question work — that's a separate, later spec. (design spec)
- TypeScript strict — no `any` without justification.

---

## File Structure

| File | Change |
|---|---|
| `components/admin/safeguarding/ConcernList.tsx` (modified) | `openStudentIds` filter gains a `category === 'wellbeing'` condition alongside the existing `status !== 'closed'` check. |
| `__tests__/components/ConcernList.test.tsx` (modified — file already exists) | New test: a suggestion still shows when the student's only open concern is a different category. Existing tests unchanged and still pass (the existing "hides a suggestion..." test already uses a `wellbeing`-category concern by default). |
| `app/(admin)/admin/wellbeing/page.tsx` (modified) | Adds the same admin-only role guard `/admin/safeguarding/page.tsx` already uses. No new test file (no precedent for testing this kind of page in this repo; the change mirrors an existing, unmodified, already-correct guard exactly). |

---

## Task 1: Category-aware suggestion masking

**Files:**
- Modify: `components/admin/safeguarding/ConcernList.tsx`
- Test: `__tests__/components/ConcernList.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this test to `__tests__/components/ConcernList.test.tsx`, immediately after the existing `'hides a suggestion when the student already has an active concern'` test (around line 84):

```tsx
  it('still shows a suggestion when the student has an active concern of a different category', () => {
    const suggestions: SuggestedConcern[] = [
      { studentId: 'student-1', studentName: 'Alice Smith', reason: 'Low wellbeing: mood (1/5)' },
    ]
    render(
      <ConcernList
        concerns={[makeConcern({ status: 'open', student_id: 'student-1', category: 'attendance' })]}
        studentNames={studentNames}
        suggestions={suggestions}
      />,
    )
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText(/Low wellbeing/)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest ConcernList -v`
Expected: FAIL on the new test — the suggestion is currently suppressed because `openStudentIds` includes `student-1` regardless of the open concern's category (`attendance`, unrelated to the wellbeing suggestion).

- [ ] **Step 3: Fix the filter**

In `components/admin/safeguarding/ConcernList.tsx`, change:

```tsx
  const openStudentIds = useMemo(
    () => new Set(concerns.filter(c => c.status !== 'closed').map(c => c.student_id)),
    [concerns],
  )
```

to:

```tsx
  // Only an OPEN WELLBEING concern should suppress a wellbeing-flag suggestion — an
  // unrelated open concern (attendance, behaviour, etc.) must not hide it. Every
  // SuggestedConcern this component receives is already wellbeing-sourced (its one
  // caller, app/(admin)/admin/safeguarding/page.tsx, builds `suggestions` from
  // getRedFlags(wellbeing_responses)), so filtering concerns to the same category
  // here is a correct match, not a partial one.
  const openStudentIds = useMemo(
    () => new Set(
      concerns.filter(c => c.status !== 'closed' && c.category === 'wellbeing').map(c => c.student_id)
    ),
    [concerns],
  )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest ConcernList -v`
Expected: PASS (6 tests — 5 existing + 1 new)

- [ ] **Step 5: Commit**

```bash
git add components/admin/safeguarding/ConcernList.tsx __tests__/components/ConcernList.test.tsx
git commit -m "fix(safeguarding): stop unrelated open concerns from hiding wellbeing flags

openStudentIds suppressed a wellbeing-flag suggestion for any student
with an open concern of ANY category — a student with an old,
unrelated open attendance case had every future wellbeing red flag
silently hidden from staff, indefinitely. Every SuggestedConcern this
component receives is already wellbeing-sourced (its one caller builds
suggestions from getRedFlags), so filtering the masking check to the
same category is a correct fix, not a partial one.

Confirmed live before fixing, not just from the research report that
flagged it — directly restores wellbeing-flag detection for any
student who happens to have any other kind of open case.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Task 2: Lock the staff wellbeing view to admin (DSL) only

**Files:**
- Modify: `app/(admin)/admin/wellbeing/page.tsx`

- [ ] **Step 1: Apply the guard**

In `app/(admin)/admin/wellbeing/page.tsx`, change:

```tsx
export default async function AdminWellbeingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin-login')

  const admin = createAdminClient()
```

to:

```tsx
export default async function AdminWellbeingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin-login')

  const admin = createAdminClient()

  // Admin (DSL) only — coaches/teachers currently see the same raw scores and
  // free-text notes as the DSL, which the research ties directly to students
  // under-reporting when they know a coach can see it. Mirrors the exact guard
  // /admin/safeguarding/page.tsx already uses. Deliberately no replacement
  // signal for coaches/teachers here — a separate, later feature, not this fix.
  const { data: profile } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') redirect('/admin/dashboard')
```

(The rest of the file — the surveys query, the render — is unchanged.)

- [ ] **Step 2: Run the full suite and type-check**

Run: `npx jest --silent`
Expected: PASS, same total test count as before this task (no test added — see plan's File Structure table for why)

Run: `npx tsc --noEmit 2>&1 | grep -v __tests__`
Expected: no new errors outside `__tests__/`

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/wellbeing/page.tsx"
git commit -m "fix(wellbeing): lock the staff wellbeing view to admin (DSL) only

Previously checked only that a user was logged in — middleware already
blocks non-staff from all of /admin/*, but any of admin/coach/teacher
could see raw wellbeing scores and free-text notes on this page, unlike
/admin/safeguarding's existing admin-only guard. Research ties
coach-visible scores directly to students under-reporting.

Coaches/teachers lose access entirely with no replacement signal for
now — a real trade-off the research flags (coach engagement is cited
as the single biggest lever on honest completion), accepted here as a
deliberate, temporary state per product-owner decision, not solved in
this fix.

Co-Authored-By: claude-flow <ruv@ruv.net>"
```

---

## Self-Review

**Spec coverage:**
- Category-aware masking fix → Task 1. ✅
- Admin-only lock on `/admin/wellbeing` → Task 2. ✅
- No coach replacement signal → not present anywhere in this plan. ✅
- No change to already-shipped Tier 0 fixes or the chip-picker/connection work → neither touched. ✅

**Placeholder scan:** No TBD/TODO; both tasks have complete, copy-pasteable code.

**Type consistency:** Task 1's new test uses `category: 'attendance'`, a valid `ConcernCategory` member (verified against `lib/safeguarding/safeguardingUtils.ts`'s existing type). Task 2's guard is a verbatim match of `/admin/safeguarding/page.tsx`'s existing, unmodified pattern.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-10-wellbeing-detection-gaps.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — execute in this session with checkpoints for review.

Which approach?
