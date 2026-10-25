CREATE OR REPLACE FUNCTION join_couple(code_input TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_couple_id UUID;
  result JSONB;
BEGIN
  -- Find the couple
  SELECT id INTO found_couple_id
  FROM public.couples
  WHERE pairing_code = code_input
  AND status = 'pending'
  LIMIT 1;

  IF found_couple_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired pairing code';
  END IF;

  -- Update the couple
  UPDATE public.couples
  SET
    partner_2_id = auth.uid(),
    status = 'active'
  WHERE id = found_couple_id
  RETURNING to_jsonb(couples.*) INTO result;

  RETURN result;
END;
$$;;
