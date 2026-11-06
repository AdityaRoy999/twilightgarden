import React from "react";
import { useTheme, type HealthSymbolStyle } from "../../contexts/ThemeContext";
import { FilledChoiceArt } from "./FilledChoiceArt";
import { LogSymbol } from "./LogSymbol";

type Shape =
  | "clots"
  | "blank"
  | "heart"
  | "shield"
  | "drop"
  | "test"
  | "wave"
  | "face"
  | "pill"
  | "calendar"
  | "moon"
  | "leaf"
  | "care"
  | "body"
  | "flame"
  | "clock"
  | "milk"
  | "chat"
  | "uterus"
  | "scan"
  | "spark"
  | "wind"
  | "head"
  | "stomach"
  | "joint"
  | "bell";
export type ChoiceSpec = { shape: Shape; detail?: number };
const registry: Record<string, ChoiceSpec> = {};
const add = (shape: Shape, words: string[], detail = 0) =>
  words.forEach((word) => (registry[word.toLowerCase()] = { shape, detail }));
add("blank", [
  "",
  "Not recorded",
  "Not recording",
  "Prefer not to specify",
  "Not applicable",
  "None",
  "No activity",
]);
add("blank", ["None", "No activity"], 2);
add("heart", ["Sexual activity", "Sexual health", "Frisky"], 1);
add("heart", ["Solo activity"], 2);
add("shield", ["Condom or barrier", "Condoms / barriers", "Contraception"], 1);
add("shield", ["Other contraception"], 2);
add("shield", ["Both"], 3);
add("face", ["Comfortable", "Helped", "Supported", "Happy"], 1);
add(
  "face",
  ["Some discomfort", "Some interference", "Mixed", "Some impact"],
  2,
);
add(
  "face",
  [
    "Painful",
    "Felt worse",
    "Daily activities affected",
    "Could not do usual activities",
    "Overwhelmed",
  ],
  3,
);
add("face", ["Low", "Anxious", "Sad"], 4);
add("face", ["Usual", "No change", "No interference", "Little impact"], 0);
add("heart", ["High"], 3);
add("test", ["Positive"], 1);
add("test", ["Negative"], 2);
add("test", ["Unclear", "Not sure"], 3);
add("drop", ["Yes", "Bleeding", "Discharge change"], 1);
add("blank", ["No"], 1);
add("wave", ["Dry", "Vaginal Dryness"], 0);
add("wave", ["Sticky"], 1);
add("wave", ["Creamy"], 2);
add("wave", ["Watery"], 3);
add("wave", ["Slippery / stretchy"], 4);
add("spark", ["Mild", "Small"], 1);
add("spark", ["Moderate", "Medium"], 2);
add("spark", ["Severe", "Large or frequent"], 3);
add("drop", ["Light"], 1);
add("drop", ["Heavy"], 3);
add("care", ["General check-in", "Check-in", "General care"], 0);
add("stomach", ["Nausea"], 1);
add("stomach", ["Vomiting"], 2);
add("stomach", ["Bloating"], 3);
add("stomach", ["Cramps"], 4);
add("stomach", ["Cravings"], 5);
add("stomach", ["Diarrhea"], 6);
add("stomach", ["Constipation"], 7);
add("stomach", ["Indigestion"], 8);
add("stomach", ["Loss of Appetite"], 9);
add("moon", ["Fatigue"], 1);
add("moon", ["Insomnia"], 5);
add("moon", ["Good", "Rest", "Calm"], 0);
add("moon", ["Fair"], 2);
add("moon", ["Poor"], 3);
add("body", ["Back discomfort", "Backache"], 1);
add("head", ["Headache"], 0);
add("head", ["Dizziness"], 1);
add("head", ["Memory Changes"], 2);
add("head", ["Sensory Sensitivity"], 3);
add("drop", ["Swelling"], 4);
add("wave", ["Usual pattern"], 5);
add("wave", ["Less than usual", "Movement concern"], 6);
add("milk", ["Breastfeeding"], 1);
add("milk", ["Expressing"], 2);
add("milk", ["Formula"], 3);
add("milk", ["Combination"], 4);
add("pill", ["Taken", "Medication"], 1);
add("pill", ["Skipped"], 2);
add("pill", ["Side effect"], 3);
add("pill", ["Started"], 4);
add("pill", ["Stopped"], 5);
add("pill", ["Combined pill"], 6);
add("pill", ["Progestogen-only pill"], 7);
add("uterus", ["IUD / IUS"], 4);
add("pill", ["Implant"], 8);
add("pill", ["Injection"], 9);
add("shield", ["Patch"], 4);
add("shield", ["Vaginal ring"], 5);
add("chat", ["Symptoms to discuss"], 0);
add("uterus", ["PCOS"], 1);
add("uterus", ["Endometriosis"], 2);
add("uterus", ["Fibroids"], 3);
add("leaf", ["Perimenopause"], 1);
add("care", ["Other clinician-diagnosed condition"], 2);
add("body", ["Itching"], 2);
add("wind", ["Odour change", "Gas"], 1);
add("flame", ["Burning when urinating", "Heartburn"], 1);
add("drop", ["Frequent urination"], 5);
add("body", ["Pelvic discomfort", "Pelvic Pain"], 3);
add("test", ["STI screening"], 4);
add("calendar", ["Booked", "Appointment"], 1);
add("calendar", ["Completed"], 2);
add("calendar", ["Follow-up needed"], 3);
add("uterus", ["Gynaecology"], 0);
add("care", ["Pregnancy care"], 1);
add("scan", ["Scan / screening"], 0);
add("care", ["Postpartum care"], 3);
add("test", ["Pregnancy test"], 5);
add("clock", ["Once"], 1);
add("clock", ["Daily"], 2);
add("chat", ["Other"], 1);
add("body", ["Tender Breasts"], 4);
add("face", ["Acne"], 5);
add("joint", ["Joint Pain"], 0);
add("flame", ["Hot Flashes"], 2);
add("moon", ["Night Sweats"], 4);
add("wave", ["Chills", "Swings"], 7);

/** A distinct semantic drawing for every health choice; never a network icon request. */
export function choiceSymbolSpec(value: string, context = ""): ChoiceSpec {
  if (context === "clots" && ["Small", "Large or frequent"].includes(value))
    return { shape: "clots", detail: value === "Small" ? 1 : 2 };
  if (
    context === "libido" &&
    ["low", "usual", "high"].includes(value.toLowerCase())
  )
    return {
      shape: "heart",
      detail:
        value.toLowerCase() === "low"
          ? 0
          : value.toLowerCase() === "high"
            ? 3
            : 1,
    };
  if (
    context === "bleeding" &&
    ["none", "light", "moderate", "heavy"].includes(value.toLowerCase())
  )
    return {
      shape: value.toLowerCase() === "none" ? "blank" : "drop",
      detail: { light: 1, moderate: 2, heavy: 3 }[value.toLowerCase()] || 0,
    };
  return (
    registry[value.toLowerCase()] || {
      shape: context === "purpose" ? "bell" : "care",
      detail: 0,
    }
  );
}
export function ChoiceSymbol({
  value,
  context = "",
  variant,
}: {
  value: string;
  context?: string;
  variant?: HealthSymbolStyle;
}) {
  const { healthSymbolStyle = "filled" } = useTheme();
  const symbolStyle = variant || healthSymbolStyle;
  const existing = [
    "calm",
    "happy",
    "frisky",
    "swings",
    "anxious",
    "sad",
    "irritated",
    "energetic",
  ];
  if (existing.includes(value.toLowerCase()))
    return <LogSymbol kind={value.toLowerCase()} variant={symbolStyle} />;
  const { shape, detail: d = 0 } = choiceSymbolSpec(value, context);
  const path = (s: string) => <path d={s} />;
  let art: React.ReactNode;
  if (symbolStyle === "line") {
    switch (shape) {
      case "blank":
        art = (
          <>
            <circle cx="18" cy="18" r="11" strokeDasharray={d ? "" : "3 4"} />
            {path(d === 2 ? "m10 26 16-16" : d ? "M12 18h12" : "M15 18h6")}
          </>
        );
        break;
      case "heart":
        art = (
          <>
            <path
              d="M18 29 6 17C-1 6 13 1 18 11 24 1 37 7 30 18Z"
              fill="currentColor"
              stroke="none"
            />
            {d === 2 && path("m18 10-4 8 7 3-3 8")}
            {d === 3 && (
              <circle cx="28" cy="7" r="4" fill="var(--bg-surface)" />
            )}
          </>
        );
        break;
      case "shield":
        art = (
          <>
            {path(
              d === 5
                ? "M10 18a8 11 0 1 0 16 0 8 11 0 1 0-16 0"
                : "M18 3 30 8v10q-1 9-12 15Q7 27 6 18V8Z",
            )}
            {d === 1 ? (
              path("m13 18 4 4 7-9")
            ) : d === 3 ? (
              path("M13 15h10m-5-5v16")
            ) : d === 4 ? (
              <rect x="12" y="11" width="12" height="14" rx="3" />
            ) : (
              path("M14 13h8v11h-8z")
            )}
          </>
        );
        break;
      case "clots":
        art = (
          <>
            <path
              d={
                d === 1
                  ? "M13 12q8-5 11 3 5 7-3 10-8 6-12-2-4-6 4-11Z"
                  : "M11 6q10-6 15 6 10 8 2 15-7 9-17 2-11-4-7-14 0-6 7-9Z"
              }
              fill="currentColor"
              fillOpacity=".18"
            />
            <path
              d={d === 1 ? "M14 17q3-3 6 0" : "M10 15q5-6 10-2m-6 8q4 4 9 0"}
            />
          </>
        );
        break;
      case "drop":
        art = (
          <>
            <path
              d="M18 3C14 10 7 16 7 23a11 11 0 0 0 22 0c0-7-7-13-11-20Z"
              fill="currentColor"
              fillOpacity=".14"
            />
            {d <= 3 ? (
              <path
                d={`M9 ${29 - d * 4}h18v3a9 9 0 0 1-18 0Z`}
                fill="currentColor"
                stroke="none"
              />
            ) : d === 4 ? (
              path("m13 23 5-5 5 5M18 18v11")
            ) : (
              path("M13 22h10m-10 5h10")
            )}
          </>
        );
        break;
      case "test":
        art = (
          <>
            <rect
              x="7"
              y="3"
              width="22"
              height="30"
              rx="7"
              fill="currentColor"
              fillOpacity=".1"
            />
            <rect x="12" y="9" width="12" height="10" rx="3" />
            {d === 1 || d === 5
              ? path("M18 11v6m-3-3h6")
              : d === 2
                ? path("M15 14h6")
                : d === 4
                  ? path("m15 13 2 2 4-4")
                  : path("M16 12q4-3 4 1l-2 2m0 2h.01")}
            {path(d === 5 ? "M12 26h12" : "M15 26h6")}
          </>
        );
        break;
      case "wave":
        art = (
          <>
            {[0, 1, 2].slice(0, d === 0 ? 1 : 3).map((i) => (
              <path
                key={i}
                d={`M5 ${11 + i * 8}q6 ${d === 7 ? -7 : -3 - d} 13 0t13 0`}
              />
            ))}
            {d === 6 ? <path d="M28 3v4m0 4h.01" /> : null}
            {d === 0 ? <path d="m6 26 24-17" /> : null}
          </>
        );
        break;
      case "face":
        art = (
          <>
            <circle
              cx="18"
              cy="18"
              r="13"
              fill="currentColor"
              fillOpacity=".1"
            />
            {path("M12 14h.01m12 0h.01")}
            {path(
              d === 1
                ? "M11 22q7 9 14 0"
                : d === 2
                  ? "M11 24q4-5 8 0t6 0"
                  : d === 3
                    ? "M11 26q7-12 14 0"
                    : d === 4
                      ? "M12 25q6-7 12 0"
                      : "M12 24h12",
            )}
            {d === 5 ? (
              <g fill="currentColor">
                <circle cx="9" cy="21" r="1" />
                <circle cx="25" cy="20" r="1" />
                <circle cx="19" cy="10" r="1" />
              </g>
            ) : null}
          </>
        );
        break;
      case "spark":
        art = (
          <>
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                x={6 + i * 9}
                y={26 - (i + 1) * 6}
                width="5"
                height={(i + 1) * 6}
                rx="2"
                fill="currentColor"
                opacity={i < d ? 1 : 0.18}
                stroke="none"
              />
            ))}
            {d === 3 && path("M8 6h.01m0 4V3")}
          </>
        );
        break;
      case "pill":
        art = (
          <>
            <g transform={d === 8 ? "rotate(90 18 18)" : "rotate(-35 18 18)"}>
              <rect
                x="6"
                y="3"
                width="24"
                height="30"
                rx={d === 9 ? 3 : 12}
                fill="currentColor"
                fillOpacity=".12"
              />
              {path("M7 18h22")}
            </g>
            {d === 2 || d === 5 ? (
              path("m12 12 12 12m0-12L12 24")
            ) : d === 3 ? (
              path("M18 11v9m0 4h.01")
            ) : d === 4 ? (
              path("M11 18h14m-7-7v14")
            ) : d === 6 || d === 7 ? (
              <g fill="currentColor">
                <circle cx="14" cy="13" r="2" />
                {d === 6 && <circle cx="22" cy="23" r="2" />}
              </g>
            ) : d === 9 ? (
              path("M18 2v30")
            ) : d === 8 ? (
              path("M9 18h18")
            ) : (
              path("m12 18 4 4 8-9")
            )}
          </>
        );
        break;
      case "calendar":
        art = (
          <>
            <rect x="4" y="7" width="28" height="25" rx="7" />
            {path("M11 3v8m14-8v8M5 15h26")}
            {d === 2 ? (
              path("m12 23 4 4 8-9")
            ) : d === 3 ? (
              path("M18 19v5m0 3h.01")
            ) : (
              <>
                <circle cx="13" cy="23" r="2" fill="currentColor" />
                <path d="M21 23h3" />
              </>
            )}
          </>
        );
        break;
      case "moon":
        art = (
          <>
            <path
              d="M24 4a14 14 0 1 0 8 21A12 12 0 0 1 24 4Z"
              fill="currentColor"
              fillOpacity=".18"
            />
            {d === 1 ? (
              path("M24 8h7l-7 7h7")
            ) : d === 2 ? (
              <circle cx="27" cy="11" r="2" />
            ) : d === 3 ? (
              path("m25 7 6 7m0-7-6 7")
            ) : d === 4 ? (
              <path d="M28 7q-7 8 0 10 7-2 0-10Z" />
            ) : d === 5 ? (
              <>
                {path("M23 9q4-5 9 0q-5 5-9 0Z")}
                <circle cx="28" cy="9" r="1" />
              </>
            ) : (
              path("m29 7 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z")
            )}
          </>
        );
        break;
      case "leaf":
        art = (
          <>
            {path("M7 31 27 8M8 25Q-1 5 29 4q4 28-21 21")}
            {d === 1 && path("M22 18q11 0 9 12-11 0-9-12")}
          </>
        );
        break;
      case "care":
        art = (
          <>
            <path d="M4 23q8-4 14 1h11q5 1-1 5l-10 4L4 29" />
            <path
              d={
                d === 1
                  ? "M15 18q-7-5-5-11 3-7 9-3 10 6 4 14Z"
                  : d === 3
                    ? "M10 13a8 8 0 0 1 16 0v4H10Zm8-5v9"
                    : "M18 19 10 12q-5-7 2-9 4-1 6 4 4-7 9-2 4 5-9 14Z"
              }
              fill="currentColor"
              fillOpacity=".16"
            />
            {d === 2 && path("M18 7v8m-4-4h8")}
          </>
        );
        break;
      case "body":
        art = (
          <>
            <circle cx="18" cy="6" r="3" />
            <path d="M12 13q6-3 12 0l4 10m-16-10L8 23m7-10-2 18m8-18 2 18M13 24h10" />
            <circle
              cx={d === 1 ? 21 : d === 2 ? 9 : d === 4 ? 15 : 18}
              cy={d === 1 ? 21 : d === 2 ? 20 : d === 4 ? 16 : 25}
              r="5"
              fill="currentColor"
              fillOpacity=".28"
              strokeDasharray="2 3"
            />
          </>
        );
        break;
      case "flame":
        art = (
          <>
            <path
              d="M19 2Q6 13 8 25q4 14 18 6 11-8-2-21 1 9-5 10 4-11 0-18Z"
              fill="currentColor"
              fillOpacity=".2"
            />
            {d === 2 && path("M3 10v9m29-12v10")}
          </>
        );
        break;
      case "clock":
        art = (
          <>
            <circle cx="18" cy="18" r="13" />
            {path("M18 9v10l6 3")}
            {d === 2 && path("m4 6 4 1-1-4m25 27-4-1 1 4")}
          </>
        );
        break;
      case "milk":
        art = (
          <>
            <path
              d={
                d === 1
                  ? "M17 6q-15 12-10 23 10 7 16-3 4-12-6-20Z"
                  : d === 2
                    ? "M8 7h20v5H8Zm4 5h12v20H12Z"
                    : "M13 3h10v7l5 5v16H8V15l5-5Z"
              }
              fill="currentColor"
              fillOpacity=".1"
            />
            {path("M13 22h10m-10 5h7")}
            {d === 4 && path("M4 4h6m-3-3v6")}
          </>
        );
        break;
      case "chat":
        art = (
          <>
            <path
              d="M5 5h26v21H16l-9 6v-6H5Z"
              fill="currentColor"
              fillOpacity=".1"
            />
            {d === 1 ? (
              <path d="M12 14h.01m6 0h.01m6 0h.01" />
            ) : (
              path("M11 12h14m-14 7h9")
            )}
          </>
        );
        break;
      case "uterus":
        art = (
          <>
            <path
              d="M14 29q2-13-3-16Q-1 15 4 7q5-6 11 2h6q6-8 11-2 5 8-7 6-5 3-3 16M14 29h8"
              fill="currentColor"
              fillOpacity=".1"
            />
            {d === 1 ? (
              <g fill="currentColor">
                <circle cx="7" cy="9" r="2" />
                <circle cx="29" cy="9" r="2" />
              </g>
            ) : d === 2 ? (
              path("M12 16h12m-10 4h8")
            ) : d === 3 ? (
              <circle cx="18" cy="16" r="3" fill="currentColor" />
            ) : d === 4 ? (
              path("M11 9h14m-7 0v17")
            ) : null}
          </>
        );
        break;
      case "scan":
        art = (
          <>
            <rect x="3" y="4" width="30" height="24" rx="5" />
            <path
              d="M14 28v5m8-5v5M10 33h16M11 20q6-17 15-3l-6 5Z"
              fill="currentColor"
              fillOpacity=".18"
            />
          </>
        );
        break;
      case "wind":
        art = (
          <>
            {path("M4 12h21q10-1 5-7-4-4-7 1M4 19h17q10 1 5 7-4 4-7-1M4 26h8")}
            {d === 1 && path("M6 5h7")}
          </>
        );
        break;
      case "head":
        art = (
          <>
            <path d="M24 32v-7q11-9 2-19Q13-4 8 8L4 19h7v9h6v4" />
            <circle
              cx="20"
              cy="11"
              r="6"
              fill="currentColor"
              fillOpacity=".14"
            />
            {d === 0
              ? path("m20 6-3 6h6l-3 5")
              : d === 1
                ? path("M16 11q5-6 8 0t-8 0")
                : d === 2
                  ? path("M17 8h6v6h-6Z")
                  : path("m17 8 6 6m0-6-6 6")}
          </>
        );
        break;
      case "stomach":
        art = (
          <>
            <path
              d="M16 3v9q2 6 7 1 10-5 10 6 0 15-17 13Q4 31 5 20q1-7 8-4-5-4-3-13"
              fill="currentColor"
              fillOpacity=".1"
            />
            {d === 1 ? (
              path("M15 22q4-5 8 0")
            ) : d === 2 ? (
              path("m14 21 4 3 6-6")
            ) : d === 3 ? (
              <circle cx="20" cy="24" r="5" />
            ) : d === 4 ? (
              path("m21 17-6 8h6l-3 6")
            ) : d === 5 ? (
              <path d="m20 17 2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" />
            ) : d === 6 ? (
              path("M17 18v12m-4-4 4 4 4-4")
            ) : d === 7 ? (
              path("M14 25h12m-8-5v10")
            ) : d === 8 ? (
              path("M15 20q9-3 9 4t-9 0")
            ) : (
              path("m14 18 12 12m0-12L14 30")
            )}
          </>
        );
        break;
      case "joint":
        art = (
          <>
            <path d="m7 4 10 10m5 7 10 10M4 8l10 10m7 5 8 9" />
            <circle
              cx="18"
              cy="18"
              r="7"
              fill="currentColor"
              fillOpacity=".15"
            />
          </>
        );
        break;
      default:
        art = (
          <>
            <path d="M8 26h20l-3-7V12a7 7 0 0 0-14 0v7Z" />
            {path("M15 30q3 4 6 0")}
          </>
        );
    }
  }
  return (
    <svg
      className={`choice-symbol choice-symbol-${shape}`}
      viewBox="0 0 36 36"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-choice-symbol={`${shape}:${d}`}
      data-symbol-style={symbolStyle}
    >
      {symbolStyle === "filled" ? (
        <FilledChoiceArt shape={shape} detail={d} />
      ) : (
        art
      )}
    </svg>
  );
}
