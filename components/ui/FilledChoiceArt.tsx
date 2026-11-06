import React from "react";
import type { ChoiceSpec } from "./ChoiceSymbol";

/** Original two-tone silhouettes. Open line paths are never blindly flood-filled. */
export function FilledChoiceArt({ shape, detail: d = 0 }: ChoiceSpec) {
  const solid = (path: string, opacity = 1) => (
    <path d={path} fill="currentColor" fillOpacity={opacity} stroke="none" />
  );
  const line = (path: string) => (
    <path
      d={path}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
  const dot = (x: number, y: number, r = 1.2) => (
    <circle cx={x} cy={y} r={r} fill="currentColor" stroke="none" />
  );
  const heart = "M18 30 6 18C-1 7 12 2 18 11 24 2 37 7 30 18Z";
  switch (shape) {
    case "blank":
      return (
        <g stroke="none">
          <circle cx="18" cy="18" r="13" fill="currentColor" opacity=".14" />
          {line(d === 2 ? "m10 26 16-16" : d ? "M11 18h14" : "M15 18h6")}
          {!d && (
            <circle
              cx="18"
              cy="18"
              r="9"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeDasharray="2 4"
              fill="none"
            />
          )}
        </g>
      );
    case "face":
      return (
        <g stroke="none">
          <circle cx="18" cy="18" r="14" fill="currentColor" opacity=".25" />
          {d === 1 ? (
            line("M10 15q2 3 4 0m8 0q2 3 4 0")
          ) : (
            <>
              {dot(12, 15)}
              {dot(24, 15)}
            </>
          )}
          {line(
            d === 1
              ? "M11 22q7 9 14 0"
              : d === 2
                ? "M10 24q4-6 8-1t8 0"
                : d === 3
                  ? "M11 26q7-12 14 0"
                  : d === 4
                    ? "M12 25q6-7 12 0"
                    : "M12 24h12",
          )}
          {d === 1 && (
            <>
              <ellipse
                cx="9"
                cy="20"
                rx="3"
                ry="1.7"
                fill="currentColor"
                opacity=".22"
              />
              <ellipse
                cx="27"
                cy="20"
                rx="3"
                ry="1.7"
                fill="currentColor"
                opacity=".22"
              />
            </>
          )}
          {d === 4 && line("m9 10 5-2m8 0 5 2")}
          {d === 5 && (
            <>
              {dot(8, 22)}
              {dot(25, 21)}
              {dot(19, 9)}
            </>
          )}
        </g>
      );
    case "heart":
      return (
        <g stroke="none">
          {solid(heart, d === 0 ? 0.35 : 1)}
          {d === 2 && (
            <path
              d="m18 10-4 8 7 3-3 8"
              fill="none"
              stroke="var(--bg-surface)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
          {d === 3 && (
            <path
              d="m28 3 1.5 4.5L34 9l-4.5 1.5L28 15l-1.5-4.5L22 9l4.5-1.5Z"
              fill="var(--bg-surface)"
            />
          )}
        </g>
      );
    case "spark":
      return (
        <g stroke="none">
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={5 + i * 9}
              y={27 - (i + 1) * 7}
              width="7"
              height={(i + 1) * 7}
              rx="3.5"
              fill="currentColor"
              opacity={i < d ? 0.9 : 0.16}
            />
          ))}
          {d === 3 && dot(8, 5, 2)}
        </g>
      );
    case "clots":
      return (
        <g stroke="none">
          {solid(
            d === 1
              ? "M13 12q8-5 11 3 5 7-3 10-8 6-12-2-4-6 4-11Z"
              : "M11 6q10-6 15 6 10 8 2 15-7 9-17 2-11-4-7-14 0-6 7-9Z",
            0.55,
          )}
          {line(d === 1 ? "M14 17q3-3 6 0" : "M10 15q5-6 10-2m-6 8q4 4 9 0")}
        </g>
      );
    case "drop":
      return (
        <g stroke="none">
          {solid("M18 2C15 9 6 16 6 23a12 12 0 0 0 24 0c0-7-9-14-12-21Z", 0.3)}
          {d <= 3
            ? solid(
                d === 1
                  ? "M10 26q8 3 16 0a8 8 0 0 1-16 0Z"
                  : d === 2
                    ? "M8 21q10 4 20 0v3a10 10 0 0 1-20 0Z"
                    : "M8 16q10 4 20 0v8a10 10 0 0 1-20 0Z",
                0.85,
              )
            : line(d === 4 ? "m12 23 6-6 6 6M18 17v12" : "M12 22h12m-12 5h12")}
          <path
            d="M11 21q-2 5 2 7"
            fill="none"
            stroke="var(--bg-surface)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      );
    case "moon":
      return (
        <g stroke="none">
          {solid("M23 3A15 15 0 1 0 33 24 12 12 0 0 1 23 3Z", 0.75)}
          {d === 1 ? (
            line("M24 7h7l-7 7h7")
          ) : d === 2 ? (
            <>
              {dot(27, 9, 3)}
              {solid("M20 28q-2-5 4-5 3-5 6-1 6-1 5 6Z", 0.4)}
            </>
          ) : d === 3 ? (
            <>
              {line("M24 7q3-3 6 0M25 12h4")}
              {solid("M18 29q0-6 6-5 4-5 7 0 5 0 4 5Z", 0.45)}
            </>
          ) : d === 4 ? (
            solid("M28 4q-8 9 0 12 8-3 0-12Z", 0.7)
          ) : d === 5 ? (
            <>
              {line("M23 9q4-5 9 0q-5 5-9 0Z")}
              {dot(28, 9)}
            </>
          ) : (
            solid(
              "m29 4 1.5 4.5L35 10l-4.5 1.5L29 16l-1.5-4.5L23 10l4.5-1.5Z",
              0.5,
            )
          )}
        </g>
      );
    case "wave":
      return (
        <g stroke="none">
          {d === 0 ? (
            <>
              {solid("M6 12q6-5 12 0t12 0v5q-6 5-12 0T6 17Z", 0.5)}
              {line("m8 29 21-21")}
            </>
          ) : (
            [0, 1, 2].map((i) => (
              <path
                key={i}
                d={`M5 ${9 + i * 9}q6 ${d === 7 ? -5 : -2 - d / 2} 13 0t13 0`}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                opacity={i === 1 ? 1 : 0.45}
              />
            ))
          )}
          {d === 6 && dot(29, 2, 2)}
        </g>
      );
    case "body":
      return (
        <g stroke="none">
          <circle cx="18" cy="6" r="4" fill="currentColor" opacity=".5" />
          {solid(
            "M12 12q6-3 12 0l5 10q1 4-3 3l-3-7 2 12q0 4-4 3l-3-10-3 10q-4 1-4-3l2-12-3 7q-4 1-3-3Z",
            0.3,
          )}
          <circle
            cx={d === 1 ? 20 : d === 2 ? 9 : d === 4 ? 17 : 18}
            cy={d === 1 ? 19 : d === 2 ? 21 : d === 4 ? 15 : 24}
            r="4.3"
            fill="currentColor"
          />
          {d === 2 && line("m4 12 3 2m-4 3h3")}
          {d === 4 && (
            <path
              d="m17 18-3-3q-2-3 1-3l2 1q3-3 4 0 1 2-4 5Z"
              fill="var(--bg-surface)"
            />
          )}
        </g>
      );
    case "head":
      return (
        <g stroke="none">
          {solid("M24 33v-8q11-9 2-19Q13-4 8 8L4 19h7v9h6v5Z", 0.3)}
          {d === 0 ? (
            solid("m22 5-9 11h7l-1 8 9-13h-7Z", 0.9)
          ) : d === 1 ? (
            line("M16 11q5-6 8 0t-8 0")
          ) : d === 2 ? (
            <>
              <rect
                x="15"
                y="6"
                width="11"
                height="12"
                rx="3"
                fill="currentColor"
                opacity=".7"
              />
              {line("M17 25h7")}
            </>
          ) : (
            <>
              {line("m16 7 9 9m0-9-9 9")}
              {dot(21, 24, 2)}
            </>
          )}
        </g>
      );
    case "stomach":
      return (
        <g stroke="none">
          {solid(
            "M16 3v9q2 6 7 1 10-5 10 6 0 15-17 13Q4 31 5 20q1-7 8-4-5-4-3-13Z",
            0.3,
          )}
          {d === 1 ? (
            line("M14 22q5-5 10 0")
          ) : d === 2 ? (
            line("m14 21 4 3 6-6")
          ) : d === 3 ? (
            <circle cx="20" cy="24" r="5" fill="currentColor" opacity=".6" />
          ) : d === 4 ? (
            solid("m21 15-9 12h7l-2 7 10-12h-8Z", 0.9)
          ) : d === 5 ? (
            solid("m20 17 2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z", 0.9)
          ) : d === 6 ? (
            line("M17 18v12m-4-4 4 4 4-4")
          ) : d === 7 ? (
            line("M14 25h12m-8-5v10")
          ) : d === 8 ? (
            line("M15 20q9-3 9 4t-9 0")
          ) : (
            line("m14 18 12 12m0-12L14 30")
          )}
        </g>
      );
    case "pill":
      return (
        <g stroke="none">
          <g transform={d === 8 ? "rotate(90 18 18)" : "rotate(-35 18 18)"}>
            <rect
              x="7"
              y="3"
              width="22"
              height="30"
              rx={d === 9 ? 4 : 11}
              fill="currentColor"
              opacity=".25"
            />
            {solid("M7 18h22v4a11 11 0 0 1-22 0Z", 0.55)}
          </g>
          {d === 2 || d === 5 ? (
            line("m12 12 12 12m0-12L12 24")
          ) : d === 3 ? (
            line("M18 11v9m0 4h.01")
          ) : d === 4 ? (
            line("M11 18h14m-7-7v14")
          ) : d === 6 || d === 7 ? (
            <>
              {dot(14, 13, 2)}
              {d === 6 && dot(22, 23, 2)}
            </>
          ) : d === 9 ? (
            line("M18 2v30")
          ) : d === 8 ? (
            line("M9 18h18")
          ) : (
            line("m12 18 4 4 8-9")
          )}
        </g>
      );
    case "shield":
      return (
        <g stroke="none">
          {d === 5 ? (
            <ellipse
              cx="18"
              cy="18"
              rx="9"
              ry="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
            />
          ) : (
            solid("M18 3 31 8v10q-1 10-13 16Q6 28 5 18V8Z", 0.4)
          )}
          {d === 1 ? (
            line("m11 18 5 5 9-11")
          ) : d === 3 ? (
            line("M12 15h12m-6-5v16")
          ) : d === 4 ? (
            <rect
              x="12"
              y="10"
              width="12"
              height="16"
              rx="4"
              fill="currentColor"
            />
          ) : d === 2 ? (
            <rect
              x="13"
              y="11"
              width="10"
              height="15"
              rx="4"
              fill="currentColor"
            />
          ) : null}
        </g>
      );
    case "flame":
      return (
        <g stroke="none">
          {solid(
            "M19 2Q6 13 8 25q4 14 18 6 11-8-2-21 1 9-5 10 4-11 0-18Z",
            0.7,
          )}
          {solid("M18 19q-9 12 1 13 9-2-1-13Z", 0.3)}
          {d === 2 && line("M3 9v10m29-12v10")}
        </g>
      );
    case "wind":
      return (
        <g stroke="none">
          {[
            "M4 12h21q10-1 5-7-4-4-7 1",
            "M4 21h17q10 1 5 7-4 4-7-1",
            "M4 30h8",
          ].map((p, i) => (
            <path
              key={p}
              d={p}
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              opacity={i === 1 ? 1 : 0.5}
            />
          ))}
          {d === 1 && dot(7, 5, 2)}
        </g>
      );
    case "joint":
      return (
        <g stroke="none">
          {solid("m5 2 14 12-6 8L1 8q-2-6 4-6Z", 0.35)}
          {solid("m23 15 12 14q4 6-2 7L17 23Z", 0.5)}
          <circle cx="18" cy="18" r="7" fill="currentColor" />
          {line("m8 27 3 1m15-19 2 2")}
        </g>
      );
    case "calendar":
      return (
        <g stroke="none">
          <rect
            x="4"
            y="6"
            width="28"
            height="27"
            rx="7"
            fill="currentColor"
            opacity=".24"
          />
          {solid("M4 13V12q0-6 6-6h16q6 0 6 6v1Z", 0.75)}
          {line("M11 3v6m14-6v6")}
          {d === 2 ? (
            line("m11 23 5 5 9-10")
          ) : d === 3 ? (
            line("M18 19v5m0 4h.01")
          ) : (
            <>
              {dot(13, 23, 2)}
              {dot(23, 23, 2)}
            </>
          )}
        </g>
      );
    case "test":
      return (
        <g stroke="none">
          <rect
            x="7"
            y="2"
            width="22"
            height="32"
            rx="8"
            fill="currentColor"
            opacity=".28"
          />
          <rect
            x="11"
            y="7"
            width="14"
            height="13"
            rx="4"
            fill="var(--bg-surface)"
          />
          {d === 1 || d === 5
            ? line("M18 10v7m-3.5-3.5h7")
            : d === 2
              ? line("M14 14h8")
              : d === 4
                ? line("m14 13 3 3 5-6")
                : line("M16 11q4-3 4 1l-2 2m0 3h.01")}
          {d === 5 ? (
            line("M12 27h12")
          ) : (
            <rect
              x="14"
              y="25"
              width="8"
              height="4"
              rx="2"
              fill="currentColor"
            />
          )}
        </g>
      );
    case "leaf":
      return (
        <g stroke="none">
          {solid("M7 27Q-1 6 30 3q4 30-23 24Z", 0.6)}
          <path
            d="M7 31 25 10"
            stroke="var(--bg-surface)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {d === 1 && solid("M22 19q12-1 10 13-12 0-10-13Z", 0.85)}
        </g>
      );
    case "care":
      return (
        <g stroke="none">
          {solid("M3 23q8-4 15 1h10q7 1 0 6l-11 4L3 29Z", 0.4)}
          {solid(
            d === 1
              ? "M14 18q-7-5-5-11 3-7 9-3 10 6 4 14Z"
              : d === 3
                ? "M10 13a8 8 0 0 1 16 0v5H10Z"
                : "M18 20 10 12q-5-7 2-9 4-1 6 4 4-7 9-2 4 5-9 15Z",
            0.8,
          )}
          {d === 2 && (
            <path
              d="M18 7v8m-4-4h8"
              stroke="var(--bg-surface)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </g>
      );
    case "clock":
      return (
        <g stroke="none">
          <circle cx="18" cy="18" r="14" fill="currentColor" opacity=".25" />
          {line("M18 8v11l7 3")}
          {d === 2 && line("m4 6 4 1-1-4m25 27-4-1 1 4")}
        </g>
      );
    case "milk":
      return (
        <g stroke="none">
          {solid(
            d === 1
              ? "M17 5q-15 12-10 24 10 7 16-3 4-12-6-21Z"
              : d === 2
                ? "M8 7h20v6h-4v20H12V13H8Z"
                : "M13 3h10v7l5 5v17H8V15l5-5Z",
            0.4,
          )}
          {line("M13 22h10m-10 5h7")}
          {d === 4 && line("M4 4h6m-3-3v6")}
        </g>
      );
    case "chat":
      return (
        <g stroke="none">
          {solid(
            "M10 4h17q7 0 7 7v12q0 6-7 6H16l-9 5v-6q-5-1-5-6V11q0-7 8-7Z",
            0.35,
          )}
          {d === 1 ? (
            <>
              {dot(11, 16, 1.8)}
              {dot(18, 16, 1.8)}
              {dot(25, 16, 1.8)}
            </>
          ) : (
            line("M10 12h16m-16 8h10")
          )}
        </g>
      );
    case "uterus":
      return (
        <g stroke="none">
          {solid(
            "M14 31q2-14-3-17Q-2 16 3 7q5-8 12 1h6q7-9 12-1 5 9-8 7-5 3-3 17Z",
            0.4,
          )}
          {d === 1 ? (
            <>
              {dot(7, 9, 3)}
              {dot(29, 9, 3)}
            </>
          ) : d === 2 ? (
            line("M12 16h12m-10 5h8")
          ) : d === 3 ? (
            dot(18, 17, 4)
          ) : d === 4 ? (
            line("M11 9h14m-7 0v17")
          ) : null}
        </g>
      );
    case "scan":
      return (
        <g stroke="none">
          <rect
            x="2"
            y="3"
            width="32"
            height="26"
            rx="6"
            fill="currentColor"
            opacity=".3"
          />
          {solid("M8 22q9-22 20-4l-8 6Z", 0.7)}
          {line("M14 29v4m8-4v4M10 33h16")}
        </g>
      );
    default:
      return (
        <g stroke="none">
          {solid("M7 27h22l-4-8V12a7 7 0 0 0-14 0v7Z", 0.65)}
          <circle cx="18" cy="31" r="3" fill="currentColor" opacity=".5" />
        </g>
      );
  }
}
