import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aes,
  open,
  seal,
  sharingKey,
  type Sealed,
  type VaultBundle,
} from "./vaultCrypto";
import { unlockedVault } from "./vaultRuntime";
import {
  initialGame,
  play,
  needsPrompts,
  type GameType,
  type State,
  type Secret,
} from "../supabase/functions/_shared/gameEngine";
import type { GameRoomSession } from "../hooks/useGameRoom";
import { getPrivatePeer } from "./privateData";
type WireRoom = {
  id: string;
  couple_id: string;
  player_x: string;
  player_o: string | null;
  revision: number;
  game_type: GameType;
  status: string;
  encrypted_state: Sealed | null;
  host_secret: Sealed | null;
};
type Command = {
  id: string;
  session_id: string;
  actor_id: string;
  base_revision: number;
  ciphertext: Sealed;
  status: string;
};
export class EncryptedGameRoom {
  private disposed = false;
  private draining = false;
  private drainAgain = false;
  private channel: any;
  private timer: ReturnType<typeof setInterval> | undefined;
  private latest: WireRoom | null = null;
  private key: CryptoKey | null = null;
  private hostKey: Promise<CryptoKey> | null = null;
  private emitted = "";
  private reconciling: Promise<void> | null = null;
  private lastHint = 0;
  private listeners = new Set<(room: GameRoomSession) => void>();
  private commandWaiters = new Map<
    string,
    {
      resolve: () => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(
    private ownId: string,
    private coupleId: string,
    private otherId: string,
    private game: GameType,
    private onError: (message: string) => void,
    private transport: SupabaseClient<any>,
    private vault: VaultBundle,
  ) {}
  subscribe(callback: (room: GameRoomSession) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
  private async request(body: Record<string, unknown>) {
    const {
      data: { session },
    } = await this.transport.auth.getSession();
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
    if (!response.ok)
      throw new Error(result.error || "Game service unavailable. Retry.");
    return result;
  }
  private async stateKey() {
    if (this.key) return this.key;
    const other = await getPrivatePeer();
    if (other?.userId !== this.otherId || other.coupleId !== this.coupleId)
      throw new Error("Your partner must set up their private vault first.");
    this.key = await sharingKey(
      this.vault,
      other.publicKey,
      `game:${this.coupleId}`,
    );
    return this.key;
  }
  private masterKey() {
    return (this.hostKey ??= aes(this.vault.master));
  }
  private stateContext(room: WireRoom, revision = room.revision) {
    return `twilight:game:1:${room.couple_id}:${room.id}:${revision}:state`;
  }
  private secretContext(room: WireRoom, revision = room.revision) {
    return `twilight:game:1:${room.couple_id}:${room.id}:${revision}:host`;
  }
  private commandContext(
    command: Pick<Command, "id" | "session_id" | "actor_id" | "base_revision">,
  ) {
    return `twilight:game-command:1:${this.coupleId}:${command.session_id}:${command.actor_id}:${command.id}:${command.base_revision}`;
  }
  private async accept(room: WireRoom) {
    if (
      this.disposed ||
      room.couple_id !== this.coupleId ||
      (this.latest && room.revision < this.latest.revision)
    )
      return;
    // End notifications can race an older read at the same encrypted revision.
    if (
      this.latest &&
      ["ended", "finished", "completed"].includes(this.latest.status) &&
      !["ended", "finished", "completed"].includes(room.status) &&
      room.revision <= this.latest.revision
    )
      return;
    this.latest = room;
    if (!room.encrypted_state) return;
    const signature = `${room.revision}:${room.player_o}:${room.status}`;
    if (signature === this.emitted) return;
    const state = await open<State>(
      await this.stateKey(),
      room.encrypted_state,
      this.stateContext(room),
    );
    if (this.disposed || this.latest.revision !== room.revision) return;
    if (signature === this.emitted) return;
    this.emitted = signature;
    for (const listener of this.listeners)
      listener({
        id: room.id,
        revision: room.revision,
        player_x: room.player_x,
        player_o: room.player_o,
        game_type: room.game_type,
        status: room.status,
        board_state: state,
      });
  }
  private async read() {
    if (!this.latest) throw new Error("Game unavailable.");
    const { data, error } = await this.transport
      .from("game_sessions")
      .select("*")
      .eq("id", this.latest.id)
      .single();
    if (error) throw error;
    const room = data as unknown as WireRoom;
    await this.accept(room);
    return room;
  }
  async start() {
    const { data, error } = await (this.transport.rpc as any)(
      "open_private_game",
      { p_couple: this.coupleId, p_type: this.game },
    );
    if (error) throw error;
    const room = data as WireRoom;
    this.latest = room;
    await this.stateKey();
    if (this.disposed) return;
    if (room.player_x === this.ownId && !room.encrypted_state) {
      const initial = initialGame(this.game);
      try {
        await this.commit(room, initial.state, initial.secret);
      } catch (error: any) {
        if (error.code !== "40001") throw error;
      }
    }
    await this.read();
    if (this.disposed) return;
    this.channel = this.transport
      .channel(`game-secure:${this.coupleId}:${room.id}`, {
        config: { private: true, broadcast: { self: false, ack: true } },
      })
      .on("broadcast", { event: "changed" }, () => {
        // Hints never contain private state and are never authoritative. Even a
        // forged revision must pass the database's membership and CAS checks.
        if (Date.now() - this.lastHint < 75) return;
        this.lastHint = Date.now();
        void this.reconcile();
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${room.id}`,
        },
        (payload: any) => {
          void this.accept(payload.new as WireRoom).catch(() =>
            this.onError("The encrypted game could not be opened. Retry."),
          );
          void this.drain();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "encrypted_game_commands",
          filter: `session_id=eq.${room.id}`,
        },
        (payload: any) => {
          this.settle(payload.new as Command);
          void this.drain();
        },
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          void this.read()
            .then(() => this.drain())
            .catch(() => {});
        }
      });
    // Reconcile durable commands after a missed event or suspended app. This is
    // recovery, not a deliberate move delay; realtime wakes the processor first.
    this.timer = setInterval(() => {
      if (
        typeof document === "undefined" ||
        document.visibilityState === "visible"
      )
        void this.reconcile();
    }, 4000);
    await this.drain();
    if (room.player_x !== this.ownId) return { invited: false };
    try {
      return await this.request({ kind: "invite-private", id: room.id });
    } catch {
      return {
        invited: false,
        invitationError:
          "The game is ready. Tap Notify my partner to retry the invitation.",
      };
    }
  }
  private async commit(
    room: WireRoom,
    state: State,
    secret: Secret,
    command?: Command,
    status?: string,
  ) {
    if (this.disposed) throw new DOMException("Room closed", "AbortError");
    state.promptCount = secret.prompts.length;
    const [encrypted, hidden] = await Promise.all([
      seal(
        await this.stateKey(),
        state,
        this.stateContext(room, room.revision + 1),
      ),
      seal(
        await this.masterKey(),
        secret,
        this.secretContext(room, room.revision + 1),
      ),
    ]);
    const { data, error } = await (this.transport.rpc as any)(
      "commit_private_game",
      {
        p_id: room.id,
        p_revision: room.revision,
        p_state: encrypted,
        p_secret: hidden,
        p_command: command?.id || null,
        p_status:
          status ||
          (state.phase === "result"
            ? "finished"
            : room.player_o
              ? "active"
              : "waiting"),
      },
    );
    if (error) throw error;
    await this.accept(data as WireRoom);
    this.hint();
  }
  private hint() {
    if (!this.channel || this.disposed) return;
    void this.channel
      .send({ type: "broadcast", event: "changed", payload: {} })
      .catch(() => {});
  }
  private settle(command: Command) {
    const pending = this.commandWaiters.get(command?.id);
    if (!pending || command.status === "pending") return;
    clearTimeout(pending.timer);
    this.commandWaiters.delete(command.id);
    if (command.status === "applied") pending.resolve();
    else
      pending.reject(
        new Error(
          "The game changed or that move is unavailable. Retry your move.",
        ),
      );
  }
  private reconcile() {
    return (this.reconciling ??= this.reconcileOnce().finally(() => {
      this.reconciling = null;
    }));
  }
  private async reconcileOnce() {
    if (this.disposed) return;
    try {
      await this.read();
      if (this.commandWaiters.size) {
        const { data } = await this.transport
          .from("encrypted_game_commands" as any)
          .select("*")
          .in("id", [...this.commandWaiters.keys()]);
        for (const command of data || [])
          this.settle(command as unknown as Command);
      }
      await this.drain();
    } catch {
      if (!this.disposed)
        this.onError(
          "The game connection was interrupted. Reopen it to reconnect.",
        );
    }
  }
  private async drain() {
    if (this.disposed || this.latest?.player_x !== this.ownId) return;
    if (this.draining) {
      this.drainAgain = true;
      return;
    }
    this.draining = true;
    try {
      let more = true;
      while (more && !this.disposed) {
        const { data, error } = await this.transport
          .from("encrypted_game_commands" as any)
          .select("*")
          .eq("session_id", this.latest!.id)
          .eq("status", "pending")
          .order("created_at")
          .limit(30);
        if (error) throw error;
        const commands = (data || []) as unknown as Command[];
        more = commands.length === 30;
        for (const command of commands) {
          if (this.disposed) return;
          try {
            const room = await this.read();
            if (!room.encrypted_state || !room.host_secret)
              throw new Error("Host identity unavailable");
            const action = await open<Record<string, unknown>>(
              await this.stateKey(),
              command.ciphertext,
              this.commandContext(command),
            );
            const state = await open<State>(
              await this.stateKey(),
              room.encrypted_state,
              this.stateContext(room),
            );
            const basis = action._basis as any;
            const independent = ["ready", "next", "answer", "choose"].includes(
              String(action.kind),
            );
            if (
              room.revision !== command.base_revision &&
              !(
                independent &&
                basis &&
                basis.round === state.round &&
                basis.phase === state.phase &&
                basis.settings === (state.settingsRevision || 0)
              )
            )
              throw new Error("STALE_ROOM");
            const secret = await open<Secret>(
              await this.masterKey(),
              room.host_secret,
              this.secretContext(room),
            );
            if (![room.player_x, room.player_o].includes(command.actor_id))
              throw new Error("Invalid actor");
            const next =
              action.kind === "leave"
                ? { state, secret }
                : play(
                    this.game,
                    state,
                    secret,
                    command.actor_id === room.player_x ? "X" : "O",
                    action,
                  );
            await this.commit(
              room,
              next.state,
              next.secret,
              command,
              action.kind === "leave" ? "ended" : undefined,
            );
            this.settle({ ...command, status: "applied" });
          } catch (error: any) {
            if (this.disposed) return;
            if (error.code === "40001") {
              more = true;
              break;
            } // A different host window won the CAS.
            const { error: failure } = await (this.transport.rpc as any)(
              "reject_private_game_command",
              { p_id: command.id },
            );
            if (failure) throw failure;
            this.settle({ ...command, status: "rejected" });
          }
        }
      }
    } finally {
      this.draining = false;
      if (this.drainAgain && !this.disposed) {
        this.drainAgain = false;
        queueMicrotask(() => {
          void this.drain().catch(() =>
            this.onError("Game sync interrupted. Reopen this game."),
          );
        });
      }
    }
  }
  async action(action: Record<string, unknown>) {
    if (!this.latest || this.disposed) throw new Error("Open the game first.");
    if (action.kind === "leave") {
      const { data, error } = await (this.transport.rpc as any)(
        "end_private_game",
        { p_id: this.latest.id },
      );
      if (error) throw error;
      await this.accept(data as WireRoom);
      this.hint();
      return {};
    }
    if (action.kind === "configure" && action.level === "after_hours") {
      const { data, error } = await (this.transport.rpc as any)(
        "game_adult_pair_eligible",
        { p_id: this.latest.id },
      );
      if (error || data !== true)
        throw new Error(
          "After hours is available only when both players have declared they are 18 or older.",
        );
    }
    if (action.kind === "invite")
      return this.request({ kind: "invite-private", id: this.latest.id });
    if (action.kind === "prefetch") {
      if (this.latest.player_x !== this.ownId || !needsPrompts(this.game))
        return {};
      if (["ended", "finished", "completed"].includes(this.latest.status))
        return {};
      const before = await this.read();
      if (!before.encrypted_state || !before.host_secret) return {};
      const old = await open<State>(
        await this.stateKey(),
        before.encrypted_state,
        this.stateContext(before),
      );
      const result = await this.request({
        kind: "prompts",
        id: before.id,
        level: old.level,
      });
      for (let attempt = 0; attempt < 3; attempt++) {
        const room = await this.read();
        if (!room.encrypted_state || !room.host_secret) break;
        const state = await open<State>(
          await this.stateKey(),
          room.encrypted_state,
          this.stateContext(room),
        );
        const secret = await open<Secret>(
          await this.masterKey(),
          room.host_secret,
          this.secretContext(room),
        );
        if (
          state.level !== old.level ||
          state.phase === "result" ||
          secret.prompts.length >= 3
        )
          return {};
        try {
          await this.commit(room, state, {
            ...secret,
            prompts: [...secret.prompts, ...result.prompts],
          });
          return {};
        } catch (error: any) {
          if (error.code !== "40001") throw error;
        }
      }
      throw new Error("The game changed. Retry AI questions.");
    }
    // The host already owns the rule state. Its own moves can use one atomic
    // CAS commit; only a peer needs the durable encrypted command outbox.
    if (this.latest.player_x === this.ownId) {
      const room = this.latest;
      if (!room.encrypted_state || !room.host_secret)
        throw new Error("Game is still opening.");
      if (["ended", "finished"].includes(room.status))
        throw new Error("This game has ended. Start a new game.");
      const [state, secret] = await Promise.all([
        open<State>(
          await this.stateKey(),
          room.encrypted_state,
          this.stateContext(room),
        ),
        open<Secret>(
          await this.masterKey(),
          room.host_secret,
          this.secretContext(room),
        ),
      ]);
      const next =
        action.kind === "leave"
          ? { state, secret }
          : play(this.game, state, secret, "X", action);
      try {
        await this.commit(
          room,
          next.state,
          next.secret,
          undefined,
          action.kind === "leave" ? "ended" : undefined,
        );
      } catch (error: any) {
        if (error.code === "40001") {
          const fresh = await this.read();
          if (
            !action._retry &&
            fresh.encrypted_state &&
            ["ready", "next", "answer", "choose"].includes(
              String(action.kind),
            ) &&
            !["ended", "finished", "completed"].includes(fresh.status)
          ) {
            const updated = await open<State>(
              await this.stateKey(),
              fresh.encrypted_state,
              this.stateContext(fresh),
            );
            if (
              updated.round === state.round &&
              updated.phase === state.phase &&
              (updated.settingsRevision || 0) === (state.settingsRevision || 0)
            )
              return this.action({ ...action, _retry: 1 });
          }
          throw new Error(
            "The game changed on another device. Retry your move.",
          );
        }
        throw error;
      }
      return {};
    }
    const command: Command = {
      id: crypto.randomUUID(),
      session_id: this.latest.id,
      actor_id: this.ownId,
      base_revision: this.latest.revision,
      status: "pending",
      ciphertext: null as any,
    };
    const basis = await open<State>(
      await this.stateKey(),
      this.latest.encrypted_state!,
      this.stateContext(this.latest),
    );
    command.ciphertext = await seal(
      await this.stateKey(),
      {
        ...action,
        _basis: {
          round: basis.round,
          phase: basis.phase,
          settings: basis.settingsRevision || 0,
        },
      },
      this.commandContext(command),
    );
    const completed = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.commandWaiters.delete(command.id);
        reject(
          new Error(
            "Waiting for the host’s unlocked game screen. Ask your partner to reopen this game.",
          ),
        );
      }, 15000);
      this.commandWaiters.set(command.id, { resolve, reject, timer });
    });
    // Observe rejection immediately: a slow insert can outlive the ack deadline.
    // The caller still receives the rejection when it awaits completion below.
    void completed.catch(() => {});
    // Install the waiter before insertion so even a very fast commit is observed.
    const { error } = await (this.transport.rpc as any)(
      "queue_private_game_command",
      {
        p_id: command.id,
        p_session: command.session_id,
        p_revision: command.base_revision,
        p_ciphertext: command.ciphertext,
      },
    );
    if (error) {
      const pending = this.commandWaiters.get(command.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.commandWaiters.delete(command.id);
      }
      void completed.catch(() => {});
      throw error;
    }
    this.hint();
    void this.drain().catch(() =>
      this.onError("The host could not process the encrypted move. Retry."),
    );
    await completed;
    await this.read();
    return {};
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    if (this.channel) void this.transport.removeChannel(this.channel);
    this.key = null;
    this.hostKey = null;
    for (const pending of this.commandWaiters.values()) {
      clearTimeout(pending.timer);
      pending.reject(new DOMException("Game closed", "AbortError"));
    }
    this.commandWaiters.clear();
    this.listeners.clear();
  }
}
