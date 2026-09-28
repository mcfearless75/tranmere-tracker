# Match shirt + GPS pod numbers — design

**Date:** 2026-09-28 · **Status:** approved in chat

## Problem

Catapult exports identify players only by pod ("Tranmere P13"). The import maps
that to a player through one permanent `users.catapult_code` per player
(P16–P30 from migration 074). Pods are actually handed out fresh each match —
on 23/09/26 v Stockport the Prem squad wore P1–P14, and Caleb McWilliam wore
P13 while his permanent code is P27. So that export matches nobody today, and
any pod that happens to equal someone's permanent code lands on the wrong
player silently.

## Decisions (from the user)

- Shirt numbers are allocated fresh every match (no carried-over squad number).
- The GPS pod usually equals the shirt number, but can differ.
- Numbers are entered on the match page, against each squad name.
- No printable sheet for now.

## Design

1. **Data** — `match_squads` gains `shirt_number` and `gps_number`
   (smallint, 1–99, nullable). Each is unique per match, as DEFERRABLE
   constraints so a swap (A↔B) saved in one statement is legal.
   `users.catapult_code` and the external app's `users.shirt_number` untouched.
2. **UI** — a "Shirt & GPS numbers" panel on `/admin/match-events/[id]`: one row
   per non-declined squad player — shirt, pod, name. Pod follows shirt until
   edited separately. Clashes show red and block save. "Auto-number" fills
   1…N. Saved through a staff-checked server action returning `{ok, error}`,
   as one upsert so the deferred constraints see the final state.
3. **Import** — for a Catapult CSV, per session date: use the match chosen on
   the form, else the single non-cancelled match that date, else the one whose
   opponent appears in the Session Title. If that match has any pods set, rows
   resolve **only** through its pods (any squad member, any role); pods with no
   player are reported, not saved. Two candidate matches → error asking the
   user to pick. No match / no pods → the existing permanent-code path.
4. **Tests** — pure resolver (`lib/gps/matchPods.ts`): pod parsing, match
   choice, clash detection; route test with the 23/09 CSV shape; panel test.
