import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useCouples } from "../contexts/CouplesContext";
import type { GameType, State } from "../supabase/functions/_shared/gameEngine";
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
    [error, setError] = useState("");
  const current = useRef(room),
    alive = useRef(true),
    lock = useRef(false),
    generation = useRef(0);
  current.current = room;
  const accept = useCallback((next: GameRoomSession) => {
    if (alive.current)
      setRoom((prev) =>
        !prev || prev.id !== next.id || next.revision >= prev.revision
          ? next
          : prev,
      );
  }, []);
  const request = useCallback(
    async (body: object) => {
      const version = generation.current;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in again to play.");
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/game-action`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(23000),
        },
      );
      const result = await response.json();
      if (!alive.current || version !== generation.current)
        throw new DOMException("Room changed", "AbortError");
      if (result.session) accept(result.session);
      if (!response.ok)
        throw new Error(result.error || "Game is unavailable. Please retry.");
      return result;
    },
    [accept],
  );
  const open = useCallback(async () => {
    const version = ++generation.current;
    lock.current = false;
    setBusy(false);
    setRoom(null);
    if (!user || !couple) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await request({ kind: "open", game, couple: couple.id });
    } catch (e) {
      if (alive.current && version === generation.current)
        setError(e instanceof Error ? e.message : "Could not open the game.");
    } finally {
      if (alive.current && version === generation.current) setLoading(false);
    }
  }, [user?.id, couple?.id, game, request]);
  useEffect(() => {
    alive.current = true;
    void open();
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, [open]);
  useEffect(() => {
    if (!room?.id) return;
    const id = room.id;
    const refresh = async () => {
      const { data, error: failure } = await (
        supabase.from("game_sessions") as any
      )
        .select("*")
        .eq("id", id)
        .single();
      if (data && alive.current && current.current?.id === id) accept(data);
      else if (failure && alive.current)
        setError("This game is no longer shared. Return to Games.");
    };
    const channel = supabase
      .channel(`room-v2-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          if (payload.new && alive.current && current.current?.id === id)
            accept(payload.new as GameRoomSession);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void refresh();
      });
    const resume = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", resume);
    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [room?.id, accept]);
  const action = useCallback(
    async (action: Record<string, unknown>) => {
      const session = current.current;
      if (!session || lock.current) return false;
      const version = generation.current;
      lock.current = true;
      setBusy(true);
      setError("");
      try {
        await request({ id: session.id, revision: session.revision, action });
        return true;
      } catch (e) {
        if (alive.current && version === generation.current)
          setError(e instanceof Error ? e.message : "Move could not be saved.");
        return false;
      } finally {
        if (version === generation.current) {
          lock.current = false;
          if (alive.current) setBusy(false);
        }
      }
    },
    [request],
  );
  return {
    room,
    loading,
    busy,
    error,
    setError,
    action,
    reopen: open,
    player: room?.player_x === user?.id ? ("X" as const) : ("O" as const),
    couple,
  };
}
