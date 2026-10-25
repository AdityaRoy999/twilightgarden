
CREATE OR REPLACE FUNCTION join_couple_love_lock(code_input text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_couple_id uuid;
  v_result json;
BEGIN
  -- Find couple with matching love_code
  SELECT id INTO v_couple_id
  FROM couples
  WHERE love_code = code_input
  AND status = 'active';

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'Invalid unlock code';
  END IF;

  -- Update the couple to set love_unlocked = true
  UPDATE couples
  SET love_unlocked = true
  WHERE id = v_couple_id;

  -- Return updated couple
  SELECT row_to_json(c) INTO v_result FROM couples c WHERE id = v_couple_id;
  return v_result;
END;
$$;
;
