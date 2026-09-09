# Chat "AI is typing" Realtime Fallback — Design

**Date:** 2026-09-09
**Status:** Approved by product owner (Paul).

## Background

Live-tested tonight while verifying the AI chat crisis-handling fix (see `docs/superpowers/specs/2026-09-09-ai-chat-crisis-handling-design.md`): a student sent a message to the AI Coach, `POST /api/ai/chat` returned 200, and the reply was genuinely saved to `chat_messages` (confirmed by a manual page refresh) — but the chat UI stayed stuck showing the "AI is typing…" dots indefinitely.

Root cause, in `app/chat/[roomId]/ChatThread.tsx`: `send()` sets `aiTyping = true` before POSTing, and the *only* thing that ever clears it back to `false` on success is a Supabase Realtime `postgres_changes` INSERT event arriving for that room with `sender_id === BOT_USER_ID`. A successful fetch response does nothing to `aiTyping` directly. There is no timeout and no fallback — if the Realtime WebSocket subscription has silently dropped (backgrounded tab, brief network blip, an idle reconnect that hasn't happened yet), the reply can be sitting in the database and the student still sees an indefinite spinner with no way to recover other than knowing to refresh the page.

This is a distinct bug from the router-internals/stale-service-worker crash also found tonight (tracked separately) — no crash occurs here, the page just quietly stops updating.

## Goal

A student sending a message to the AI Coach should never be stuck looking at typing dots with no feedback and no recovery path other than knowing to refresh.

## Non-goals (explicitly out of scope, per product owner decision)

- No general Realtime-reconnection robustness for the rest of the chat feature (e.g. reconnect-on-focus for human-to-human messages). That's a separate, larger piece of work; this fix is scoped to the AI-typing-forever symptom only.
- No server-side changes. The room-membership RLS that already lets a client read its own room's messages (used for the initial page load and by the existing Realtime subscription) covers the fallback query too — this is a client-only fix.
- No continuous polling loop. One bounded fallback check, not a retry loop.

## Architecture

In `app/chat/[roomId]/ChatThread.tsx`'s `send()`, in the `if (roomKind === 'bot' && body)` branch (where `aiTyping` is currently set):

1. Capture `sentAt = new Date().toISOString()` immediately before the `fetch('/api/ai/chat', ...)` call.
2. On a successful (`res.ok`) response, start a 20-second timer (`setTimeout`), stored in a ref so it can be cleared/replaced.
3. **If Realtime delivers the bot's reply first** (the existing `postgres_changes` handler fires with `sender_id === BOT_USER_ID`): clear the pending timer in addition to the existing `setAiTyping(false)` — no other change to that path.
4. **If the timer fires first** (20s elapsed, `aiTyping` still `true`): run one direct Supabase query — `chat_messages` in this room, `sender_id = BOT_USER_ID`, `created_at > sentAt`, ordered ascending, limit 1 — via the same client-side `supabase` instance already used elsewhere in this component.
   - **Found:** append it to `messages` using the same dedup-by-id guard already used by the Realtime handler and the optimistic-send path (`prev.find(p => p.id === m.id) ? prev : [...prev, m]`), and clear `aiTyping`. This also correctly no-ops if Realtime and the fallback both resolve around the same instant.
   - **Not found:** clear `aiTyping` anyway (stop the indefinite spinner) and set a new small piece of state (e.g. `aiTimedOut: boolean`) that renders a one-line message in place of the typing dots: "Taking longer than usual — try refreshing in a moment." This does not retry further; the honest signal is the point, not automatic recovery of an edge case rare enough not to warrant it.
5. Timer lifecycle: stored in a ref so a second message sent before the first one resolves replaces (clears) the previous pending timer rather than leaving two in flight — matches the existing simplification that `aiTyping` is already a single boolean, not per-message. Cleared on unmount (existing `useEffect` cleanup pattern in this file).

## Data flow

```
send() [bot room, has body]
  → sentAt = now
  → POST /api/ai/chat
      → res.ok? → setAiTyping(true), start 20s timer
      → !res.ok / throws → setAiTyping(false)  [existing behavior, unchanged]

Realtime INSERT (sender = bot)          20s timer fires (if still aiTyping)
  → append message (dedup)                → query chat_messages where
  → clear timer, setAiTyping(false)          room=this, sender=bot, created_at > sentAt
    [existing behavior, unchanged]           → found → append (dedup), setAiTyping(false)
                                              → not found → setAiTyping(false), setAiTimedOut(true)
```

## Error handling

- The fallback query itself can fail (network blip, RLS edge case) — wrap in try/catch; on error, treat the same as "not found" (clear typing, show the timeout message) rather than leaving the spinner up or throwing.
- No change to the existing `!res.ok` / thrown-fetch handling — that already clears `aiTyping` immediately, correctly, and is untouched by this fix.

## Testing

- `ChatThread.test.tsx` (new, or extend an existing render test for this component if one exists — check first): mock the Supabase client's `channel()`/realtime subscription and the fallback `select` query independently.
  - Realtime delivers the bot reply before the timer fires → message appears, no fallback query is made (or if made, its result is correctly ignored/deduped — test whichever the implementation actually does).
  - Timer fires with no Realtime event, fallback query finds the message → it appears, `aiTyping` clears, no duplicate render.
  - Timer fires, fallback query finds nothing → `aiTyping` clears, the "taking longer than usual" message renders instead of the typing dots.
  - A second message sent before the first's timer fires → only one timer/check ends up active (no double-fallback, no leaked timer asserted via fake timers).
  - Component unmounts before the timer fires → no error, no state update after unmount (use fake timers + unmount to verify no warnings).
