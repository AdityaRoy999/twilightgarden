import React from "react";
/** Original rabbit and panda avatars, drawn as content rather than system emoji. */
export function GameMascot({
  panda = false,
  celebrate = false,
}: {
  panda?: boolean;
  celebrate?: boolean;
}) {
  return (
    <svg viewBox="0 0 100 110" aria-hidden="true" className="game-mascot">
      <circle cx="50" cy="59" r="43" fill="var(--bloom-tint)" />
      {panda ? (
        <>
          <circle cx="27" cy="31" r="15" fill="var(--game-mascot-ink)" />
          <circle cx="73" cy="31" r="15" fill="var(--game-mascot-ink)" />
        </>
      ) : (
        <>
          <ellipse
            cx="37"
            cy="26"
            rx="12"
            ry="24"
            fill="var(--game-mascot-paper)"
          />
          <ellipse
            cx="63"
            cy="26"
            rx="12"
            ry="24"
            fill="var(--game-mascot-paper)"
          />
          <path
            d="M37 12v23m26-23v23"
            stroke="var(--color-primary)"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </>
      )}
      <ellipse
        cx="50"
        cy="63"
        rx="34"
        ry="31"
        fill="var(--game-mascot-paper)"
      />
      {panda && (
        <>
          <ellipse
            cx="36"
            cy="60"
            rx="10"
            ry="12"
            fill="var(--game-mascot-ink)"
            transform="rotate(20 36 60)"
          />
          <ellipse
            cx="64"
            cy="60"
            rx="10"
            ry="12"
            fill="var(--game-mascot-ink)"
            transform="rotate(-20 64 60)"
          />
        </>
      )}
      <circle
        cx="37"
        cy="59"
        r="3"
        fill={panda ? "var(--game-mascot-paper)" : "var(--game-mascot-ink)"}
      />
      <circle
        cx="63"
        cy="59"
        r="3"
        fill={panda ? "var(--game-mascot-paper)" : "var(--game-mascot-ink)"}
      />
      <ellipse cx="28" cy="71" rx="6" ry="4" fill="var(--icon-secondary)" />
      <ellipse cx="72" cy="71" rx="6" ry="4" fill="var(--icon-secondary)" />
      <path d="M46 69q4-5 8 0l-4 4z" fill="var(--color-primary)" />
      <path
        d="M42 77q8 8 16 0"
        fill="none"
        stroke="var(--game-mascot-ink)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {celebrate && (
        <path
          d="m10 5 2 5 5 2-5 2-2 5-2-5-5-2 5-2m78-8 2 5 5 2-5 2-2 5-2-5-5-2 5-2"
          fill="var(--color-primary)"
        />
      )}
    </svg>
  );
}
