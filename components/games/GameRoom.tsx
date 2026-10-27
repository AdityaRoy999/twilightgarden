import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useGameRoom } from "../../hooks/useGameRoom";
import { useTutorial } from "../../contexts/TutorialContext";
import { useAuth } from "../../contexts/AuthContext";
import { useAppMotion } from "../../hooks/useAppMotion";
import { springs, motionTransition } from "../../lib/motion";
import {
  games,
  needsPrompts,
  type GameType,
  type State,
  type Player,
} from "../../supabase/functions/_shared/gameEngine";
import { GameMascot } from "./GameMascot";
import { AppIcon } from "../ui/Icons";

const symbols: Record<string, string> = {
  heart: "favorite",
  moon: "bedtime",
  leaf: "eco",
  sun: "light_mode",
  flower: "spa",
  star: "star",
  cloud: "cloud",
  gift: "redeem",
  rock: "Rock",
  paper: "Paper",
  scissors: "Scissors",
};
export default function GameRoom({ game }: { game: GameType }) {
  const {
    room,
    player,
    busy,
    loading,
    error,
    action,
    reopen,
    setError,
    couple,
  } = useGameRoom(game);
  const { user } = useAuth();
  const { openTutorial } = useTutorial();
  const navigate = useNavigate();
  const { reduced } = useAppMotion();
  const [text, setText] = useState(""),
    [statements, setStatements] = useState(["", "", ""]),
    [lie, setLie] = useState(0),
    [copied, setCopied] = useState(false),
    [inviting, setInviting] = useState(false),
    [inviteSent, setInviteSent] = useState(false);
  useEffect(() => {
    setText("");
    setStatements(["", "", ""]);
    setLie(0);
  }, [room?.id, room?.board_state.round]);
  useEffect(() => {
    setInviteSent(false);
    setCopied(false);
  }, [room?.id]);
  const requested = useRef("");
  const state = room?.board_state;
  const title = games[game][0];
  const route = games[game][1];
  const base =
    user?.role === "partner"
      ? "/partner"
      : user?.role === "admin"
        ? "/admin"
        : "";
  const generating =
    needsPrompts(game) &&
    (!state?.promptCount || state.promptCount < 1) &&
    state?.phase === "setup";
  useEffect(() => {
    if (
      !room?.player_o ||
      !state ||
      player !== "X" ||
      busy ||
      !needsPrompts(game) ||
      state.phase === "result" ||
      (state.promptCount ?? 0) >= 3
    )
      return;
    const key = `${room.id}:${state.level}:${state.round}`;
    if (requested.current === key) return;
    requested.current = key;
    void action({ kind: "prefetch" });
  }, [
    room?.id,
    room?.player_o,
    state?.level,
    state?.round,
    state?.promptCount,
    state?.phase,
    player,
    busy,
    action,
  ]);
  const submit = async (kind = "answer") => {
    if (await action({ kind, text })) setText("");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/#${base}/games/${route}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(
        "Copy is unavailable. Share this game’s address from your browser.",
      );
    }
  };
  const invite = async () => {
    if (!couple || !user || inviting || inviteSent) return;
    setInviting(true);
    try {
      const sent = await action({ kind: "invite" });
      if (sent) setInviteSent(true);
      else setError("The invitation could not be saved. Please retry.");
    } finally {
      setInviting(false);
    }
  };
  const back = () => navigate(`${base}/games`);
  if (loading)
    return (
      <div className="game-room game-placeholder" role="status">
        <GameMascot />
        <h1>Making room for two…</h1>
      </div>
    );
  if (!room || !state)
    return (
      <div className="game-room game-placeholder">
        <GameMascot />
        <h1>{title}</h1>
        <p role="alert">
          {error || "Connect with your partner to play together."}
        </p>
        <button className="reference-button" onClick={() => void reopen()}>
          Retry
        </button>
        <button onClick={back}>Back to Games</button>
      </div>
    );
  const ended = room.status === "ended" || state.phase === "result";
  const mine = state.turn === player;
  return (
    <main className="game-room" data-game={game}>
      <header className="game-header">
        <button aria-label="Back to games" onClick={back}>
          <AppIcon name="arrow_back" size={24} />
        </button>
        <h1>{title}</h1>
        <button
          aria-label={`How to play ${title}`}
          onClick={() => openTutorial(route)}
        >
          <AppIcon name="help" size={24} />
        </button>
      </header>
      <div className="game-players">
        {(["X", "O"] as Player[]).map((p) => (
          <div key={p} className={state.turn === p && !ended ? "is-turn" : ""}>
            <GameMascot
              panda={p === "O"}
              celebrate={ended && state.winner === p}
            />
            <strong>{p === player ? "You" : "Partner"}</strong>
            <small>
              {p === "O" && !room.player_o
                ? "Not joined yet"
                : `${state.scores[p]} ${state.scores[p] === 1 ? "point" : "points"}`}
            </small>
          </div>
        ))}
        <span className="game-vs">vs</span>
      </div>
      {error && (
        <div className="game-error" role="alert">
          <p>{error}</p>
          {needsPrompts(game) && (
            <button
              onClick={() => void action({ kind: "prefetch" })}
              disabled={busy}
            >
              Retry AI questions
            </button>
          )}
        </div>
      )}
      {ended ? (
        <motion.section
          className="game-result"
          initial={reduced ? false : { y: 20, scale: 0.94 }}
          animate={{ y: 0, scale: 1 }}
          transition={motionTransition(springs.modal, reduced)}
        >
          <GameMascot celebrate panda={state.winner === "O"} />
          <h2>
            {room.status === "ended"
              ? "Game closed"
              : state.winner === "together"
                ? "Made together"
                : state.winner === "draw"
                  ? "A lovely match"
                  : state.winner === player
                    ? "You won!"
                    : "Your partner won!"}
          </h2>
          <p>
            {room.status === "ended"
              ? "You can start a fresh game whenever you’re both ready."
              : state.result
                  ?.replace(/\bX\b/g, player === "X" ? "You" : "Partner")
                  .replace(/\bO\b/g, player === "O" ? "You" : "Partner")}
          </p>
          {state.winner !== "together" && (
            <div className="game-result-score">
              {state.scores.X} <span>—</span> {state.scores.O}
            </div>
          )}
          {game === "story_builder" && (
            <div className="game-story">
              {state.feed.map((line, i) => (
                <p key={i}>{line.text}</p>
              ))}
            </div>
          )}
          <button className="reference-button" onClick={() => void reopen()}>
            Play again
          </button>
          <button onClick={back}>Back to Games</button>
        </motion.section>
      ) : !room.player_o ? (
        <section className="game-waiting">
          <div className="generation-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <h2>Waiting for your partner to join</h2>
          <p>
            Ask them to open Games → {title}. Your shared room will be waiting.
          </p>
          <Board
            game={game}
            state={state}
            player={player}
            disabled
            action={action}
            reduced={reduced}
          />
          <button className="reference-button" onClick={() => void copy()}>
            <AppIcon name="link" size={22} />
            {copied ? "Link copied" : "Copy game link"}
          </button>
          <button
            className="game-text-action"
            disabled={inviting || inviteSent}
            onClick={() => void invite()}
          >
            {inviteSent
              ? "Invitation sent"
              : inviting
                ? "Sending invitation…"
                : "Notify my partner"}
          </button>
        </section>
      ) : state.phase === "setup" ? (
        <section className="game-setup">
          <h2>A moment for the two of you</h2>
          <p>
            {needsPrompts(game)
              ? "Fresh AI prompts, made ahead while you get comfortable."
              : "Take turns, keep it playful, and enjoy your time together."}
          </p>
          {needsPrompts(game) && (
            <>
              <label>Choose the mood</label>
              <div className="game-levels">
                {(["gentle", "playful", "bold"] as const).map((level) => (
                  <button
                    key={level}
                    disabled={busy || player !== "X"}
                    aria-pressed={state.level === level}
                    onClick={() =>
                      void action({
                        kind: "configure",
                        level,
                        total: state.total,
                      })
                    }
                  >
                    {level}
                  </button>
                ))}
              </div>
              <small>
                Bold means more adventurous and candid. Skip any prompt, for any
                reason.
              </small>
            </>
          )}
          {![
            "tictactoe",
            "connect_four",
            "dots_boxes",
            "memory_match",
          ].includes(game) && (
            <>
              <label>Rounds</label>
              <div className="game-levels">
                {[3, 5, 10].map((total) => (
                  <button
                    key={total}
                    disabled={busy || player !== "X"}
                    aria-pressed={state.total === total}
                    onClick={() =>
                      void action({
                        kind: "configure",
                        level: state.level,
                        total,
                      })
                    }
                  >
                    {total}
                  </button>
                ))}
              </div>
            </>
          )}
          <p role="status">
            {busy && generating
              ? "Preparing fresh AI questions…"
              : state.ready.includes(player)
                ? "You’re ready. Waiting for your partner."
                : player === "O"
                  ? "Your partner chooses the settings."
                  : "Both players tap Ready to begin."}
          </p>
          <button
            className="reference-button"
            disabled={busy || generating || state.ready.includes(player)}
            onClick={() => void action({ kind: "ready" })}
          >
            {state.ready.includes(player) ? "Ready!" : "I’m ready"}
          </button>
        </section>
      ) : (
        <>
          <div className="game-round-heading">
            <span>
              Round {state.round} of {state.total}
            </span>
            <strong>
              {state.phase === "reveal"
                ? "The reveal"
                : [
                      "rps",
                      "love_trivia",
                      "this_or_that",
                      "would_you_rather",
                      "never_have_i_ever",
                      "rapid_fire",
                      "riddle_me",
                      "emoji_charades",
                      "song_lyrics",
                    ].includes(game)
                  ? "Choose at your own pace"
                  : mine
                    ? "Your turn"
                    : "Partner’s turn"}
            </strong>
          </div>
          {state.phase === "reveal" ? (
            <section className="game-reveal">
              <h2>
                {state.result
                  ?.replace(/\bX\b/g, player === "X" ? "You" : "Partner")
                  .replace(/\bO\b/g, player === "O" ? "You" : "Partner")}
              </h2>
              {(["X", "O"] as Player[]).map(
                (p) =>
                  state.replies[p] && (
                    <div key={p}>
                      <GameMascot panda={p === "O"} />
                      <p>
                        <strong>{p === player ? "You" : "Partner"}</strong>
                        <span>{state.replies[p]}</span>
                      </p>
                    </div>
                  ),
              )}
              {state.answer && (
                <p className="game-answer">
                  Answer: <strong>{state.answer}</strong>
                </p>
              )}
              <button
                className="reference-button"
                disabled={busy}
                onClick={() => void action({ kind: "next" })}
              >
                {state.round >= state.total ? "See results" : "Next round"}
              </button>
            </section>
          ) : (
            <section className="game-play-area">
              <Board
                game={game}
                state={state}
                player={player}
                disabled={busy}
                action={action}
                reduced={reduced}
              />
              {state.prompt && (
                <div className="game-prompt">
                  <small>{state.prompt.type || "A little connection"}</small>
                  <h2>{state.prompt.question}</h2>
                </div>
              )}
              {[
                "hangman",
                "wordguess",
                "twenty_questions",
                "two_truths",
              ].includes(game) &&
                state.remaining === undefined &&
                !state.prompt?.options?.length && (
                  <div className="game-secret">
                    {mine ? (
                      <>
                        <p>
                          Set a secret for your partner. It stays hidden until
                          the reveal.
                        </p>
                        {game === "two_truths" ? (
                          <>
                            <div className="game-statements">
                              {statements.map((value, i) => (
                                <label key={i}>
                                  <input
                                    type="radio"
                                    name="lie"
                                    checked={lie === i}
                                    onChange={() => setLie(i)}
                                  />
                                  <span>Lie</span>
                                  <input
                                    value={value}
                                    onChange={(e) =>
                                      setStatements((prev) =>
                                        prev.map((v, j) =>
                                          j === i ? e.target.value : v,
                                        ),
                                      )
                                    }
                                    placeholder={`Statement ${i + 1}`}
                                    maxLength={180}
                                  />
                                </label>
                              ))}
                            </div>
                            <button
                              className="reference-button"
                              disabled={busy}
                              onClick={() =>
                                void action({ kind: "secret", statements, lie })
                              }
                            >
                              Lock my statements
                            </button>
                          </>
                        ) : (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              void submit("secret");
                            }}
                          >
                            <input
                              aria-label="Secret word or subject"
                              value={text}
                              onChange={(e) => setText(e.target.value)}
                              maxLength={
                                game === "wordguess"
                                  ? 5
                                  : game === "hangman"
                                    ? 16
                                    : 80
                              }
                              placeholder={
                                game === "wordguess"
                                  ? "A five-letter word"
                                  : "Your secret"
                              }
                            />
                            <button
                              disabled={busy || !text.trim()}
                              className="reference-button"
                            >
                              Keep it secret
                            </button>
                          </form>
                        )}
                      </>
                    ) : (
                      <p>Your partner is choosing a secret…</p>
                    )}
                  </div>
                )}
              {game === "hangman" && state.remaining !== undefined && (
                <>
                  <p className="game-remaining">
                    {state.remaining} guesses remaining
                  </p>
                  <div className="game-keyboard">
                    {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => (
                      <button
                        key={letter}
                        disabled={
                          busy || mine || state.guesses.includes(letter)
                        }
                        onClick={() =>
                          void action({ kind: "guess", text: letter })
                        }
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {game === "wordguess" && state.remaining !== undefined && (
                <>
                  <div className="game-word-rows">
                    {state.guesses.map((word, i) => (
                      <div key={i}>
                        {word.split("").map((letter, j) => (
                          <span
                            key={j}
                            data-mark={state.feed[i]?.text.split(",")[j]}
                            aria-label={`${letter}, ${state.feed[i]?.text.split(",")[j]}`}
                          >
                            {letter}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                  <p>{state.remaining} guesses remaining</p>
                  {!mine && (
                    <TextAnswer
                      text={text}
                      setText={setText}
                      busy={busy}
                      onSubmit={() => void submit("guess")}
                      placeholder="Five-letter guess"
                    />
                  )}
                </>
              )}
              {game === "twenty_questions" && state.remaining !== undefined && (
                <>
                  <div className="game-story">
                    {state.feed.map((line, i) => (
                      <p key={i}>
                        <strong>
                          {line.player === player ? "You" : "Partner"}:{" "}
                        </strong>
                        {line.text}
                      </p>
                    ))}
                  </div>
                  <p>{state.remaining} questions left</p>
                  {mine ? (
                    <div className="game-choices">
                      {["Yes", "No", "Sometimes"].map((text) => (
                        <button
                          key={text}
                          disabled={
                            busy ||
                            state.feed.at(-1)?.player === player ||
                            !state.feed.length
                          }
                          onClick={() => void action({ kind: "answer", text })}
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <TextAnswer
                        text={text}
                        setText={setText}
                        busy={busy}
                        onSubmit={() => void submit("question")}
                        placeholder="Ask a yes/no question"
                      />
                      <button
                        className="game-text-action"
                        disabled={busy || !text.trim()}
                        onClick={() => void submit("guess")}
                      >
                        Use this as my guess
                      </button>
                    </>
                  )}
                </>
              )}
              {game === "two_truths" && state.prompt?.options && (
                <div className="game-choices">
                  {state.prompt.options.map((text, index) => (
                    <button
                      key={index}
                      disabled={busy || mine}
                      onClick={() => void action({ kind: "guess", index })}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
              {game === "story_builder" && (
                <>
                  <div className="game-story">
                    {state.feed.map((line, i) => (
                      <p key={i}>{line.text}</p>
                    ))}
                  </div>
                  <TextAnswer
                    text={text}
                    setText={setText}
                    busy={busy || !mine}
                    onSubmit={() => void submit("sentence")}
                    placeholder="Add one sentence…"
                  />
                </>
              )}
              {game === "rps" && (
                <div className="game-choices game-rps">
                  {["rock", "paper", "scissors"].map((text) => (
                    <button
                      key={text}
                      disabled={busy || !!state.replies[player]}
                      onClick={() => void action({ kind: "choose", text })}
                    >
                      <AppIcon name={symbols[text]} size={34} />
                      {text}
                    </button>
                  ))}
                </div>
              )}
              {needsPrompts(game) &&
                game !== "story_builder" &&
                (state.prompt?.options?.length ? (
                  <div className="game-choices">
                    {state.prompt.options.map((text) => (
                      <button
                        key={text}
                        disabled={busy || !!state.replies[player]}
                        onClick={() => void action({ kind: "answer", text })}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                ) : (
                  <TextAnswer
                    text={text}
                    setText={setText}
                    busy={busy || !!state.replies[player]}
                    onSubmit={() => void submit()}
                    placeholder={
                      game === "truth_dare"
                        ? "Your answer, or “Done” for a dare"
                        : "Your answer…"
                    }
                  />
                ))}
              {state.replies[player] === "Locked" && (
                <p className="game-locked" role="status">
                  <AppIcon name="lock" size={18} />
                  Your answer is locked. Waiting for your partner…
                </p>
              )}
            </section>
          )}
          {![
            "tictactoe",
            "connect_four",
            "dots_boxes",
            "memory_match",
          ].includes(game) &&
            state.phase === "play" && (
              <button
                className="game-text-action"
                disabled={busy}
                onClick={() => void action({ kind: "skip" })}
              >
                Skip this round
              </button>
            )}
        </>
      )}
      {!ended && (
        <footer className="game-footer">
          <button onClick={() => void copy()}>
            <AppIcon name="link" size={18} />
            {copied ? "Copied" : "Share game"}
          </button>
          <button
            disabled={busy}
            onClick={() => void action({ kind: "leave" })}
          >
            End game for both
          </button>
        </footer>
      )}
    </main>
  );
}
function TextAnswer({
  text,
  setText,
  busy,
  onSubmit,
  placeholder,
}: {
  text: string;
  setText: (value: string) => void;
  busy: boolean;
  onSubmit: () => void;
  placeholder: string;
}) {
  return (
    <form
      className="game-input"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <input
        aria-label={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={240}
        placeholder={placeholder}
        disabled={busy}
      />
      <button
        className="reference-button"
        disabled={busy || !text.trim()}
        aria-label="Submit answer"
      >
        <AppIcon name="arrow_upward" size={24} />
      </button>
    </form>
  );
}
function Board({
  game,
  state,
  player,
  disabled,
  action,
  reduced,
}: {
  game: GameType;
  state: State;
  player: Player;
  disabled: boolean;
  action: (a: Record<string, unknown>) => Promise<boolean>;
  reduced: boolean;
}) {
  if (game === "dots_boxes")
    return (
      <div className="game-dots">
        <svg
          viewBox="0 0 360 360"
          role="group"
          aria-label="Dots and boxes board"
        >
          {Object.entries(state.boxes).map(([id, p]) => {
            const [y, x] = id.split("-").map(Number);
            return (
              <rect
                key={id}
                x={35 + x * 96}
                y={35 + y * 96}
                width={90}
                height={90}
                rx={18}
                fill={p === "X" ? "var(--selection-bg)" : "var(--game-lilac)"}
              />
            );
          })}
          {[0, 1, 2, 3].flatMap((y) =>
            [0, 1, 2, 3].flatMap((x) =>
              ["h", "v"]
                .filter((o) => (o === "h" ? x < 3 : y < 3))
                .map((o) => {
                  const id = `${o}-${y}-${x}`,
                    x1 = 32 + x * 96,
                    y1 = 32 + y * 96,
                    x2 = x1 + (o === "h" ? 96 : 0),
                    y2 = y1 + (o === "v" ? 96 : 0);
                  return (
                    <g key={id}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={
                          state.edges[id]
                            ? state.edges[id] === "X"
                              ? "var(--color-primary)"
                              : "var(--game-lilac-ink)"
                            : "var(--bloom-tint)"
                        }
                        strokeWidth={8}
                        strokeLinecap="round"
                      />
                      <foreignObject
                        x={Math.min(x1, x2) - 14}
                        y={Math.min(y1, y2) - 14}
                        width={o === "h" ? 124 : 28}
                        height={o === "v" ? 124 : 28}
                      >
                        <button
                          className="game-edge-button"
                          disabled={
                            disabled ||
                            !!state.edges[id] ||
                            state.turn !== player
                          }
                          aria-label={`Draw ${o === "h" ? "horizontal" : "vertical"} line ${y + 1}, ${x + 1}`}
                          onClick={() =>
                            void action({ kind: "edge", edge: id })
                          }
                        />
                      </foreignObject>
                    </g>
                  );
                }),
            ),
          )}
          {[0, 1, 2, 3].flatMap((y) =>
            [0, 1, 2, 3].map((x) => (
              <circle
                key={`${y}-${x}`}
                cx={32 + x * 96}
                cy={32 + y * 96}
                r={7}
                fill="var(--text-secondary)"
              />
            )),
          )}
        </svg>
      </div>
    );
  if (!["tictactoe", "connect_four", "memory_match"].includes(game))
    return null;
  return (
    <div className={`game-board is-${game}`}>
      {state.board.map((value, index) => {
        const memory = game === "memory_match";
        const column = index % 7;
        return (
          <motion.button
            key={index}
            whileTap={reduced ? undefined : { scale: 0.94 }}
            transition={motionTransition(springs.selection, reduced)}
            disabled={
              disabled ||
              state.phase !== "play" ||
              state.turn !== player ||
              (!memory && game !== "connect_four" && !!value) ||
              (memory && state.matched.includes(index))
            }
            onClick={() =>
              void action({
                kind: memory ? "flip" : "move",
                index: game === "connect_four" ? column : index,
              })
            }
            aria-label={
              memory
                ? `Card ${index + 1}${value ? `, ${value}` : ", face down"}`
                : game === "connect_four"
                  ? `Drop in column ${column + 1}`
                  : `Cell ${index + 1}${value ? `, ${value}` : ", empty"}`
            }
            data-player={value}
            data-matched={state.matched.includes(index)}
          >
            {value ? (
              <motion.span
                key={value}
                initial={reduced ? false : { scale: 0.5, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={motionTransition(springs.message, reduced)}
              >
                {memory ? (
                  <AppIcon name={symbols[value] || "favorite"} size={32} />
                ) : game === "connect_four" ? (
                  <i />
                ) : value === "X" ? (
                  <svg viewBox="0 0 60 60" aria-hidden="true">
                    <path d="m16 16 28 28m0-28L16 44" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 60 60" aria-hidden="true">
                    <circle cx="30" cy="30" r="19" />
                  </svg>
                )}
              </motion.span>
            ) : memory ? (
              <AppIcon name="favorite" size={28} />
            ) : null}
          </motion.button>
        );
      })}
    </div>
  );
}
