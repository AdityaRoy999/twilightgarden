import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useCouples } from "../contexts/CouplesContext";
import type { GameType, State } from "../supabase/functions/_shared/gameEngine";
import { EncryptedGameRoom } from "../lib/encryptedGames";
import { rawSupabase } from "../lib/supabase";
import { unlockedVault } from "../lib/vaultRuntime";
import { previewGameMove } from "../lib/gamePreview";
export interface GameRoomSession {
  id: string;
  revision: number;
  game_type: GameType;
  board_state: State;
  player_x: string;
  player_o: string | null;
  status: string;
}
export function useGameRoom(game: GameType) {
  const { user } = useAuth(),
    { couple } = useCouples();
  const [room, setRoom] = useState<GameRoomSession | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [invitationSent, setInvitationSent] = useState(false),
    [restart, setRestart] = useState(0);
  const [adultAllowed, setAdultAllowed] = useState(false);
  const [preview, setPreview] = useState<{
    revision: number;
    state: State;
  } | null>(null);
  const engine = useRef<EncryptedGameRoom | null>(null),
    current = useRef(room),
    lock = useRef(false);
  current.current = room;
  useEffect(() => {
    let active = true;
    let eligibilityFor = "";
    setRoom(null);
    setLoading(true);
    setError("");
    setBusy(false);
    setPreview(null);
    setAdultAllowed(false);
    lock.current = false;
    if (!user || !couple || couple.status !== "active") {
      setLoading(false);
      return;
    }
    const other =
      couple.partner_1_id === user.id
        ? couple.partner_2_id
        : couple.partner_1_id;
    if (!other) {
      setLoading(false);
      return;
    }
    const client = new EncryptedGameRoom(
      user.id,
      couple.id,
      other,
      game,
      (message) => {
        if (active) setError(message);
      },
      rawSupabase,
      unlockedVault(),
    );
    engine.current = client;
    client.subscribe((next) => {
      if (active && next.player_o && eligibilityFor !== next.id) {
        eligibilityFor = next.id;
        void (rawSupabase.rpc as any)("game_adult_pair_eligible", {
          p_id: next.id,
        }).then(({ data, error }: any) => {
          if (active) setAdultAllowed(!error && data === true);
        });
      }
      if (active)
        setRoom((old) =>
          !old ||
          next.revision > old.revision ||
          next.player_o !== old.player_o ||
          next.status !== old.status
            ? next
            : old,
        );
    });
    void client
      .start()
      .then((result) => {
        if (active) {
          setInvitationSent(result?.invited === true);
          if (result?.invitationError) setError(result.invitationError);
        }
      })
      .catch((e) => {
        if (active) setError(e.message || "Could not open the encrypted game.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      client.dispose();
      if (engine.current === client) engine.current = null;
    };
  }, [user?.id, couple?.id, couple?.status, game, restart]);
  const action = useCallback(
    async (action: Record<string, unknown>) => {
      const client = engine.current,
        session = current.current;
      if (client && session && action.kind === "prefetch") {
        try {
          await client.action(action);
          return true;
        } catch (e) {
          if (engine.current === client)
            setError(
              e instanceof Error
                ? e.message
                : "Questions could not be prepared.",
            );
          return false;
        }
      }
      if (!client || !session || lock.current) return false;
      lock.current = true;
      setBusy(true);
      setError("");
      const predicted = previewGameMove(
        game,
        session.board_state,
        session.player_x === user?.id ? "X" : "O",
        action,
      );
      if (predicted)
        setPreview({ revision: session.revision, state: predicted });
      try {
        await client.action(action);
        if (engine.current === client && action.kind === "invite")
          setInvitationSent(true);
        return true;
      } catch (e) {
        if (engine.current === client)
          setError(e instanceof Error ? e.message : "Move could not be saved.");
        return false;
      } finally {
        if (engine.current === client) {
          lock.current = false;
          setBusy(false);
          setPreview(null);
        }
      }
    },
    [game, user?.id],
  );
  const optimistic = !!preview && preview.revision === room?.revision;
  return {
    room: room && optimistic ? { ...room, board_state: preview!.state } : room,
    optimistic,
    adultAllowed,
    loading,
    busy,
    error,
    setError,
    action,
    invitationSent,
    reopen: () => setRestart((x) => x + 1),
    player: room?.player_x === user?.id ? ("X" as const) : ("O" as const),
    couple,
  };
}
