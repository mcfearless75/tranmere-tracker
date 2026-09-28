-- 087: chat rooms never moved to the top of the list when a student messaged.
--
-- bump_chat_room() (migration 011) runs as the sender. Its UPDATE on
-- chat_rooms is gated by the "staff manage rooms" policy (is_staff() =
-- admin/coach), so for a student, teacher or parent sender RLS silently
-- matched zero rows: no error, no bump. Measured 2026-09-28: all 44 rooms
-- whose latest message was from a student had a stale last_message_at (worst
-- 17 days). The chat list sorts by that column, so a student's "I'm off
-- Friday" DM sat at the bottom until Monday.
--
-- SECURITY DEFINER is the standard shape for a trigger that must write
-- regardless of who fired it. It only ever sets the room's timestamp from the
-- row being inserted, so it grants the sender nothing else.

CREATE OR REPLACE FUNCTION public.bump_chat_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE chat_rooms
     SET last_message_at = NEW.created_at
   WHERE id = NEW.room_id
     AND (last_message_at IS NULL OR last_message_at < NEW.created_at);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_chat_room() FROM PUBLIC;

-- Backfill every room the bug left behind.
UPDATE chat_rooms r
   SET last_message_at = latest.created_at
  FROM (
    SELECT room_id, max(created_at) AS created_at
      FROM chat_messages
     GROUP BY room_id
  ) latest
 WHERE latest.room_id = r.id
   AND (r.last_message_at IS NULL OR r.last_message_at < latest.created_at);
