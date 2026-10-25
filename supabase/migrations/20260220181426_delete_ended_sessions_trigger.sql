-- Function to delete the session
CREATE OR REPLACE FUNCTION public.delete_ended_game_session()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ended' THEN
    DELETE FROM public.game_sessions WHERE id = NEW.id;
    RETURN NULL; -- Row is deleted, cancel the update operation
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it already exists to avoid duplication
DROP TRIGGER IF EXISTS trigger_delete_ended_game_session ON public.game_sessions;

-- Trigger to execute the function on update
CREATE TRIGGER trigger_delete_ended_game_session
BEFORE UPDATE ON public.game_sessions
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ended')
EXECUTE FUNCTION public.delete_ended_game_session();
;
