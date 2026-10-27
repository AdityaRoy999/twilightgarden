import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  delayRender,
  continueRender,
  cancelRender,
  Sequence,
  staticFile,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { tutorialRegistry } from "./tutorialData";
import { wordFeedback } from "../../supabase/functions/_shared/gameEngine";

const theme = {
  light: {
    base: "#fff3f8",
    surface: "#fffafd",
    ink: "#18142e",
    muted: "#7b718c",
    pink: "#d86b98",
    wash: "#f8dbe8",
    lilac: "#c6b3e8",
    mint: "#b9e5d5",
  },
  dark: {
    base: "#170f20",
    surface: "#271c32",
    ink: "#fff8ff",
    muted: "#c1b1d4",
    pink: "#eb82ae",
    wash: "#4b2841",
    lilac: "#aa8bd8",
    mint: "#7bc4ae",
  },
  fonts: { display: "Twilight, Avenir, sans-serif" },
  spring: { damping: 18, stiffness: 160, mass: 0.8 },
  ease: Easing.bezier(0.22, 0.61, 0.36, 1),
};
export const secondsPerStep = 6;
export function filmDuration(gameId: string, fps: number) {
  return (tutorialRegistry[gameId]?.steps.length || 3) * secondsPerStep * fps;
}
export function TutorialFilm({
  gameId,
  dark = false,
  reduce = false,
}: {
  gameId: string;
  dark?: boolean;
  reduce?: boolean;
}) {
  const [fontHandle] = useState(() =>
    delayRender("Load the tutorial typeface"),
  );
  useEffect(() => {
    document.fonts
      .load("700 24px Twilight")
      .then(() => continueRender(fontHandle))
      .catch(cancelRender);
  }, [fontHandle]);
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  const config = tutorialRegistry[gameId] || tutorialRegistry.tictactoe;
  const step = Math.min(
    config.steps.length - 1,
    Math.floor(frame / (fps * secondsPerStep)),
  );
  const local = frame % (fps * secondsPerStep),
    t = theme[dark ? "dark" : "light"];
  const enter = reduce
    ? 1
    : spring({ frame: local, fps, config: theme.spring });
  const exit = reduce
    ? 1
    : interpolate(local, [fps * 5.55, fps * 6], [1, 0], {
        easing: theme.ease,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const style = {
    color: t.ink,
    fontFamily: theme.fonts.display,
    fontWeight: 600,
  };
  return (
    <AbsoluteFill style={style}>
      {!reduce &&
        config.steps.map((_, i) => (
          <Sequence
            key={i}
            from={i * secondsPerStep * fps}
            durationInFrames={Math.ceil(fps * 0.3)}
          >
            <Audio src={staticFile("tutorials/step-chime.wav")} volume={0.13} />
          </Sequence>
        ))}
      <style>{`@font-face{font-family:Twilight;src:url('${staticFile("fonts/PlusJakartaSans-Bold.ttf")}');font-weight:600 800} *{box-sizing:border-box}`}</style>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 15% 5%,${t.wash},transparent 60%),radial-gradient(ellipse at 95% 90%,${t.lilac}33,transparent 70%),${t.base}`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.3,
          transform: `translateY(${reduce ? 0 : Math.sin((frame / fps) * 0.6) * 6}px)`,
        }}
      >
        <svg viewBox="0 0 720 1080" width="100%" height="100%">
          <path
            d="M650 120q-150 140 70 300M0 670q120 180 50 410"
            fill="none"
            stroke={t.pink}
            strokeWidth="2"
          />
          {[0, 1, 2].map((i) => (
            <ellipse
              key={i}
              cx={660 - i * 26}
              cy={160 + i * 55}
              rx={22}
              ry={55}
              transform={`rotate(${-25 + i * 25} ${660 - i * 26} ${160 + i * 55})`}
              fill={t.wash}
            />
          ))}
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{ padding: "52px 48px", opacity: exit }}>
        <div
          style={{
            fontSize: 15,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: t.muted,
          }}
        >
          Twilight · Play together
        </div>
        <h1
          style={{
            fontSize: 35,
            lineHeight: 1.2,
            margin: "18px 0 14px",
            fontWeight: 750,
            letterSpacing: -1,
          }}
        >
          {config.title}
        </h1>
        <div style={{ fontSize: 17, color: t.muted }}>
          Step {step + 1} of {config.steps.length}
        </div>
        <div
          style={{
            transform: `translateY(${(1 - enter) * 28}px) scale(${0.96 + enter * 0.04})`,
            opacity: enter,
            marginTop: 44,
          }}
        >
          <Demo
            gameId={gameId}
            step={step}
            local={local}
            fps={fps}
            reduce={reduce}
            colors={t}
          />
        </div>
        <div
          style={{
            marginTop: 38,
            transform: `translateY(${(1 - enter) * 16}px)`,
            opacity: enter,
          }}
        >
          <h2
            style={{
              fontWeight: 750,
              fontSize: 31,
              lineHeight: 1.2,
              letterSpacing: -0.8,
            }}
          >
            {config.steps[step].title}
          </h2>
          <p
            style={{
              fontSize: 23,
              color: t.muted,
              lineHeight: 1.55,
              fontWeight: 500,
              maxWidth: 600,
            }}
          >
            {config.steps[step].description}
          </p>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 44,
            left: 48,
            right: 48,
            display: "flex",
            gap: 10,
          }}
        >
          {config.steps.map((_, i) => (
            <div
              key={i}
              style={{
                height: 6,
                borderRadius: 8,
                background: i <= step ? t.pink : t.wash,
                flex: 1,
              }}
            />
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(120deg,${t.pink}08,transparent 55%,${t.lilac}06)`,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.035,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='white' filter='url(%23n)' opacity='.5' d='M0 0h180v180H0z'/%3E%3C/svg%3E")`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
}
function Demo({
  gameId,
  step,
  local,
  fps,
  reduce,
  colors: t,
}: {
  gameId: string;
  step: number;
  local: number;
  fps: number;
  reduce: boolean;
  colors: typeof theme.light;
}) {
  const tile = (i: number) => {
    const a = reduce
      ? 1
      : spring({ frame: local - i * fps * 0.055, fps, config: theme.spring });
    return {
      opacity: a,
      transform: `translateY(${(1 - a) * 15}px) scale(${0.92 + 0.08 * a})`,
    };
  };
  const panel: React.CSSProperties = {
    background: t.surface,
    borderRadius: 36,
    padding: 26,
    minHeight: 380,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 14,
  };
  const grid = [
    "tictactoe",
    "connect-four",
    "memory",
    "wordle",
    "dots-boxes",
  ].includes(gameId);
  if (gameId === "dots-boxes")
    return (
      <div style={panel}>
        <svg viewBox="0 0 360 360" height="360" width="100%">
          {step === 2 && (
            <rect x="34" y="34" width="96" height="96" rx="16" fill={t.wash} />
          )}
          <path
            d="M34 34h96m0 0v96m0 0H34m0 0V34"
            fill="none"
            stroke={t.pink}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={
              step === 0 ? "96 1000" : step === 1 ? "288 1000" : undefined
            }
          />
          {[0, 1, 2, 3].flatMap((y) =>
            [0, 1, 2, 3].map((x) => (
              <circle
                key={`${y}-${x}`}
                cx={34 + x * 96}
                cy={34 + y * 96}
                r="6"
                fill={t.muted}
              />
            )),
          )}
        </svg>
      </div>
    );
  if (grid) {
    const count =
      gameId === "connect-four"
        ? 42
        : gameId === "memory"
          ? 16
          : gameId === "dots-boxes"
            ? 16
            : gameId === "wordle"
              ? 15
              : 9;
    const columns =
      gameId === "connect-four"
        ? 7
        : gameId === "wordle"
          ? 5
          : count === 16
            ? 4
            : 3;
    return (
      <div style={panel}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns},1fr)`,
            gap: 10,
            maxHeight: 480,
          }}
        >
          {Array.from({ length: count }, (_, i) => {
            const moves = [35, 36, 28, 29, 21, 22, 14];
            const moveIndex = moves
              .slice(0, step === 0 ? 1 : step === 1 ? 4 : 7)
              .indexOf(i);
            const show =
              gameId === "connect-four"
                ? moveIndex >= 0
                : gameId === "wordle"
                  ? i < (step === 0 ? 0 : step === 1 ? 5 : 10)
                  : step > 0 && i < Math.min(count, step * 3 + 1);
            const active =
              show &&
              (gameId === "connect-four" ? moveIndex % 2 === 0 : i % 2 === 0);
            const word = i < 5 ? "SHARE" : "HEART";
            const mark = wordFeedback(word, "HEART")[i % 5];
            return (
              <div
                key={i}
                style={{
                  ...tile(i % 7),
                  height:
                    gameId === "tictactoe"
                      ? 138
                      : gameId === "connect-four"
                        ? 65
                        : 100,
                  borderRadius: gameId === "connect-four" ? "50%" : 16,
                  display: "grid",
                  placeItems: "center",
                  background:
                    gameId === "wordle" && show
                      ? mark === "correct"
                        ? t.mint
                        : mark === "present"
                          ? t.lilac
                          : t.wash
                      : t.wash,
                  fontSize: gameId === "connect-four" ? 20 : 40,
                  color: active ? t.pink : t.lilac,
                }}
              >
                {gameId === "wordle"
                  ? show
                    ? word[i % 5]
                    : ""
                  : gameId === "memory"
                    ? show
                      ? ["♡", "☾", "✿", "☀"][Math.floor(i / 2) % 4]
                      : "?"
                    : gameId === "dots-boxes"
                      ? "•"
                      : gameId === "connect-four"
                        ? show
                          ? "●"
                          : ""
                        : show
                          ? active
                            ? "×"
                            : "○"
                          : ""}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  const content: Record<string, string[]> = {
    rps: [
      "Choose in secret",
      "Rock · Paper · Scissors",
      "Both choices reveal together",
    ],
    hangman: ["Set a secret word", "_ A _ _", "Choose a new letter"],
    "20-questions": [
      "Think of a secret",
      "Is it an animal?",
      "Yes · No · Sometimes",
    ],
    "two-truths": [
      "I learned to swim at six.",
      "I have visited the moon.",
      "I enjoy rainy walks.",
    ],
    "story-builder": [
      "One day, we found a tiny door…",
      "You add one sentence.",
      "Your partner continues the story.",
    ],
    "emoji-charades": [
      "☔ 🏠 ☕",
      "A rainy day at home?",
      "Answers reveal after both reply.",
    ],
    "truth-dare": [
      "Gentle · Playful · Bold",
      "Truth: What made you smile today?",
      "Dare: Invent a silly handshake.",
    ],
    "would-you-rather": [
      "A cabin in the hills?",
      "Or a picnic by the sea?",
      "Reveal your choices together.",
    ],
    "this-or-that": [
      "Tea or coffee?",
      "Choose your favorite.",
      "See whether you match.",
    ],
    trivia: [
      "What makes a good listener?",
      "Listening · Interrupting · Guessing",
      "Lock your choice, then reveal.",
    ],
    "riddle-me": [
      "I have keys but no locks…",
      "Write your guess.",
      "Answer: piano",
    ],
    "never-have-i-ever": [
      "Never have I ever…",
      "…made pancakes for dinner.",
      "I have · I haven’t",
    ],
    "rapid-fire": [
      "Your ideal Sunday?",
      "A walk, a movie, or something else?",
      "Go with your first thought.",
    ],
    "song-lyrics": [
      "Original verse: Our little boat floats bright…",
      "Finish the rhyme: …beneath the stars tonight.",
      "Choose a rhyming ending.",
    ],
  };
  const lines = content[gameId] || [
    "Choose a game",
    "Take turns together",
    "Enjoy the reveal",
  ];
  return (
    <div style={panel}>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            ...tile(i + 2),
            borderRadius: 24,
            padding: "24px 25px",
            background: i === step % 3 ? t.wash : `${t.wash}66`,
            color: i === step % 3 ? t.ink : t.muted,
            fontSize: 23,
            lineHeight: 1.4,
            marginLeft: i % 2 ? 34 : 0,
            marginRight: i % 2 ? 0 : 34,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}
