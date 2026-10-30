-- Legacy trigger erased the room before either client could read its terminal
-- status, leaving peers on a stale game screen. Unlink still cascades all rooms.
DROP TRIGGER IF EXISTS trigger_delete_ended_game_session ON public.game_sessions;
