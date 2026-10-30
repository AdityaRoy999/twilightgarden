-- Cache constant account/session checks once per statement, not once per row.
ALTER POLICY vault_read ON public.account_vaults USING((SELECT twilight_private.privacy_allowed((SELECT auth.uid()),'core')) AND user_id=(SELECT auth.uid()));
ALTER POLICY vault_create ON public.account_vaults WITH CHECK(user_id=(SELECT auth.uid()) AND (SELECT twilight_private.privacy_allowed((SELECT auth.uid()),'core')));
ALTER POLICY private_records_read ON public.private_records USING(
 (SELECT twilight_private.privacy_allowed((SELECT auth.uid()),'core')) AND (
  (owner_id=(SELECT auth.uid()) AND (kind NOT IN('daily_logs','health_settings') OR (SELECT twilight_private.privacy_allowed((SELECT auth.uid()),'health'))))
  OR (recipient_id=(SELECT auth.uid()) AND
    ((kind IN('daily_logs','health_settings') AND owner_id=(SELECT public.get_partner_id()))
     OR (kind='profile' AND twilight_private.privacy_allowed(owner_id,'core')))
    AND EXISTS(SELECT 1 FROM public.couples c WHERE c.id=private_records.couple_id AND c.status='active'
      AND (SELECT auth.uid()) IN(c.partner_1_id,c.partner_2_id) AND owner_id IN(c.partner_1_id,c.partner_2_id)))
 ));
ALTER POLICY encrypted_game_commands_read ON public.encrypted_game_commands USING(
 (SELECT twilight_private.privacy_allowed((SELECT auth.uid()),'core')) AND EXISTS(
 SELECT 1 FROM public.game_sessions g JOIN public.couples c ON c.id=g.couple_id
 WHERE g.id=session_id AND g.engine_version=3 AND c.status='active' AND (SELECT auth.uid()) IN(g.player_x,g.player_o)));
