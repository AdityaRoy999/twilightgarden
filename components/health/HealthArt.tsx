import React from "react";
import type { HealthCategory } from "../../lib/reproductiveHealth";
export function HealthArt({
  kind,
}: {
  kind: HealthCategory | "goal" | "learn";
}) {
  return (
    <svg className="health-module-art" aria-hidden="true" viewBox="0 0 180 140">
      <ellipse cx="90" cy="75" rx="72" ry="58" fill="var(--selection-bg)" />
      {kind === "fertility" ? (
        <g>
          <path
            d="M70 30v58a19 19 0 1 0 22 0V30a11 11 0 0 0-22 0"
            fill="#fff0f5"
          />
          <path
            d="M81 50v52"
            stroke="#e785a5"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <circle cx="81" cy="105" r="11" fill="#de729a" />
          <path d="M116 49q-20 30 0 34q20-4 0-34" fill="#83cdb9" />
        </g>
      ) : kind === "medication" ? (
        <g transform="rotate(-30 90 70)">
          <rect x="42" y="52" width="96" height="39" rx="19" fill="#d19bc9" />
          <path d="M90 52h29a19.5 19.5 0 0 1 0 39H90Z" fill="#fae1e6" />
          <path d="M90 53v37" stroke="#fff5f6" strokeWidth="3" />
        </g>
      ) : kind === "intimacy" ? (
        <g>
          <path
            d="M90 104L48 69Q30 36 57 32Q80 28 90 48Q103 24 126 34Q149 45 130 72Z"
            fill="#e589aa"
          />
          <path
            d="M54 48q10-12 22-1"
            fill="none"
            stroke="#ffd9e6"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>
      ) : kind === "vaginal" ? (
        <g>
          <path
            d="M90 22Q41 77 65 103Q90 131 116 103Q140 77 90 22"
            fill="#9fb7e2"
          />
          <path
            d="M70 79q-8 18 10 23"
            fill="none"
            stroke="#eef3ff"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>
      ) : kind === "postpartum" ? (
        <g>
          <path d="M49 93Q39 37 90 31Q142 36 134 95" fill="#c8a4d8" />
          <path d="M48 87q24-35 43 1q22-33 44 0l-8 26H57Z" fill="#edb4c7" />
          <circle cx="91" cy="68" r="22" fill="#f4c6af" />
          <path
            d="M80 67q4 4 8 0m7 0q4 4 8 0"
            stroke="#986f76"
            strokeWidth="2"
            fill="none"
          />
        </g>
      ) : kind === "condition" ? (
        <g>
          <rect x="51" y="32" width="80" height="83" rx="18" fill="#a5d3c6" />
          <path
            d="M90 52v42M69 73h42"
            stroke="#f6fff9"
            strokeWidth="13"
            strokeLinecap="round"
          />
        </g>
      ) : kind === "pregnancy" ? (
        <g>
          <circle cx="82" cy="48" r="20" fill="#f5c2ae" />
          <path
            d="M69 66Q40 113 96 115Q146 105 112 75Q94 64 86 75"
            fill="#e9a0ba"
          />
          <path
            d="M71 81q12 20 31 13"
            fill="none"
            stroke="#f6c8b6"
            strokeWidth="10"
            strokeLinecap="round"
          />
        </g>
      ) : kind === "reminder" ? (
        <g>
          <path
            d="M55 94q10-12 10-37a25 25 0 0 1 50 0q0 25 10 37Z"
            fill="#d1b7e5"
          />
          <path
            d="M52 95h76"
            stroke="#ae8cc9"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path d="M79 106q11 16 22 0" fill="#e8a0bd" />
          <circle cx="90" cy="27" r="7" fill="#b598d0" />
          <path
            d="m49 43-8-6m88 6 8-6"
            stroke="#e9b3c9"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>
      ) : kind === "learn" ? (
        <g>
          <path
            d="M90 43Q64 23 37 38v71q26-12 53 3 27-15 53-3V38q-27-15-53 5"
            fill="#c4b1e0"
          />
          <path
            d="M90 45v66M49 53q13-4 29 2M49 70q13-4 29 2M49 87q13-4 29 2"
            fill="none"
            stroke="#fff6fb"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M112 92V59m0 18q-18-4-12-20 16 0 12 20m0 8q20-2 19-19-19-1-19 19"
            fill="#91bea9"
          />
        </g>
      ) : kind === "goal" ? (
        <g>
          <path
            d="M90 116V66M90 99Q59 98 59 72q29 1 31 27m0-10q28 1 33-27-30 0-33 27"
            fill="#96c5b1"
          />
          <path
            d="M90 116V66"
            fill="none"
            stroke="#6d9e8b"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <g fill="#eba2bd">
            <ellipse cx="90" cy="37" rx="13" ry="20" />
            <ellipse
              cx="72"
              cy="52"
              rx="20"
              ry="13"
              transform="rotate(30 72 52)"
            />
            <ellipse
              cx="108"
              cy="52"
              rx="20"
              ry="13"
              transform="rotate(-30 108 52)"
            />
            <ellipse
              cx="80"
              cy="67"
              rx="13"
              ry="19"
              transform="rotate(35 80 67)"
            />
            <ellipse
              cx="101"
              cy="67"
              rx="13"
              ry="19"
              transform="rotate(-35 101 67)"
            />
          </g>
          <circle cx="90" cy="53" r="13" fill="#f8d5a0" />
        </g>
      ) : (
        <g>
          <rect x="45" y="34" width="90" height="83" rx="17" fill="#f1a7c0" />
          <path d="M46 55h88" stroke="#fff2f6" strokeWidth="4" />
          <path
            d="M68 27v17m43-17v17"
            stroke="#99bba9"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect
                x={61 + i * 20}
                y="69"
                width="12"
                height="10"
                rx="3"
                fill="#fff1f7"
              />
              <rect
                x={61 + i * 20}
                y="89"
                width="12"
                height="10"
                rx="3"
                fill="#fce0eb"
              />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
