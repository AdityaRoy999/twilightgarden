import React, { useId } from "react";
import { motion } from "framer-motion";
import { useAppMotion } from "../../hooks/useAppMotion";
import { motionTransition, springs } from "../../lib/motion";
/** Original stylised educational art. No simulated heartbeat or medical measurements. */
export function PregnancyIllustration({
  week,
  preview = false,
}: {
  week: number;
  preview?: boolean;
}) {
  const id = useId().replace(/:/g, ""),
    { reduced } = useAppMotion();
  const w = Math.max(0, Math.min(42, week)),
    early = w < 10,
    scale = w < 4 ? 0.2 + w * 0.03 : 0.32 + Math.min(1, (w - 4) / 36) * 0.68;
  return (
    <svg
      className="pregnancy-art"
      role="img"
      aria-label={
        w < 3
          ? "Illustration of the early pregnancy timeline, before conception"
          : `Cartoon illustration of development around ${Math.floor(w)} weeks${preview ? ", timeline preview" : ""}; not a medical scan`
      }
      viewBox="0 0 420 360"
    >
      <defs>
        <radialGradient id={`${id}nest`}>
          <stop stopColor="var(--pregnancy-nest)" />
          <stop offset="1" stopColor="var(--pregnancy-nest-edge)" />
        </radialGradient>
        <linearGradient id={`${id}skin`} x2=".9" y2="1">
          <stop stopColor="#ffdbbc" />
          <stop offset="1" stopColor="#eaa58f" />
        </linearGradient>
        <linearGradient id={`${id}petal`} x2="1" y2="1">
          <stop stopColor="#f6a5bf" />
          <stop offset="1" stopColor="#d16a96" />
        </linearGradient>
      </defs>
      <ellipse cx="210" cy="174" rx="165" ry="155" fill={`url(#${id}nest)`} />
      <path
        d="M54 287Q42 237 77 197M52 258Q23 244 30 221Q55 225 52 258M60 235Q53 206 80 190Q92 219 60 235M367 300Q352 259 367 214M361 272Q335 264 337 241Q362 243 361 272M364 247Q365 218 389 214Q389 238 364 247"
        fill={`url(#${id}petal)`}
      />
      <path
        d="M54 287Q42 237 77 197M367 300Q352 259 367 214"
        fill="none"
        stroke="#db89a8"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <g fill="#f2adbe">
        <circle cx="74" cy="88" r="4" />
        <circle cx="343" cy="100" r="5" />
        <circle cx="331" cy="283" r="3" />
        <path d="M326 56l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" />
      </g>
      {w < 3 ? (
        <g>
          <circle cx="210" cy="172" r="37" fill="#fff1f5" />
          <path
            d="M192 170Q190 152 202 152Q210 152 210 161Q212 150 224 153Q238 158 227 173L210 189Z"
            fill="#e786a6"
          />
        </g>
      ) : (
        <motion.g
          style={{ transformOrigin: "210px 180px" }}
          initial={reduced ? false : { scale: scale * 0.9, opacity: 0 }}
          animate={{ scale, opacity: 1 }}
          transition={motionTransition(springs.onboarding, reduced)}
        >
          <path
            d="M248 209C290 239 282 286 245 285"
            fill="none"
            stroke="#e58caa"
            strokeWidth="9"
            strokeLinecap="round"
          />
          {early ? (
            <g>
              <path
                d="M239 117C169 98 141 157 164 218C174 246 214 255 234 231C247 216 234 201 216 204C189 207 183 168 204 155"
                fill="none"
                stroke={`url(#${id}skin)`}
                strokeWidth="55"
                strokeLinecap="round"
              />
              <ellipse
                cx="229"
                cy="115"
                rx="44"
                ry="40"
                fill={`url(#${id}skin)`}
              />
              {w >= 6 && (
                <path
                  d="M171 182l-15 12M212 224l14 10"
                  stroke="#edb199"
                  strokeWidth={w >= 8 ? 16 : 10}
                  strokeLinecap="round"
                />
              )}
              <path
                d="M235 116q7 5 13 0"
                fill="none"
                stroke="#a26665"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
          ) : (
            <g>
              <ellipse
                cx="208"
                cy="209"
                rx="59"
                ry="68"
                transform="rotate(-20 208 209)"
                fill={`url(#${id}skin)`}
              />
              <circle cx="213" cy="123" r="53" fill={`url(#${id}skin)`} />
              <ellipse cx="162" cy="132" rx="10" ry="14" fill="#efb79e" />
              <path
                d="M184 115q8 7 16 0M223 115q8 7 16 0M208 139q8 8 15 0"
                fill="none"
                stroke="#9b6262"
                strokeWidth="3.8"
                strokeLinecap="round"
              />
              <ellipse
                cx="187"
                cy="132"
                rx="9"
                ry="5"
                fill="#e59f9f"
                opacity=".6"
              />
              <ellipse
                cx="238"
                cy="132"
                rx="9"
                ry="5"
                fill="#e59f9f"
                opacity=".6"
              />
              <path
                d="M203 82q9-18 21-6q-14-3-13 10"
                fill="none"
                stroke="#aa7875"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M166 179Q142 216 181 228L200 205M249 178Q270 211 237 222L220 207"
                fill="none"
                stroke={`url(#${id}skin)`}
                strokeWidth="22"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M184 251Q141 246 157 212L181 202M230 254Q256 243 235 215L213 210"
                fill="none"
                stroke={`url(#${id}skin)`}
                strokeWidth="25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M174 198l4 10M166 203l4 10M212 205l-2 10M222 207l-2 10"
                stroke="#d89483"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          )}
        </motion.g>
      )}
    </svg>
  );
}
