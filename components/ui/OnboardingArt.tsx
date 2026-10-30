import React, { useId } from "react";

/** Original vector artwork; every leaf starts on its stem. */
export function OnboardingArt({
  variant = "welcome",
}: {
  variant?: "welcome" | "cycle" | "period" | "privacy" | "vault";
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="onboarding-art" viewBox="0 0 300 260" aria-hidden="true">
      <defs>
        <linearGradient id={id} x2=".8" y2="1">
          <stop stopColor="#ffb5c6" />
          <stop offset="1" stopColor="#cf3b70" />
        </linearGradient>
      </defs>
      <path
        fill="var(--bloom-tint)"
        d="M48 181C-4 128 63 50 105 47c38-60 130-35 151 24 52 49 21 148-48 151-61 33-136 17-160-41Z"
      />
      <circle cx="150" cy="132" r="93" fill="var(--bg-surface)" />
      <g stroke="#8aa596" strokeWidth="3" fill="#abc2b0" strokeLinecap="round">
        <path fill="none" d="M76 199Q96 168 92 132M228 199Q203 172 208 131" />
        <path d="M92 162Q69 158 71 139Q88 142 92 162ZM94 177Q112 169 109 151Q93 160 94 177ZM208 157Q227 147 224 130Q206 137 208 157ZM213 178Q194 175 190 159Q210 160 213 178Z" />
      </g>
      {variant === "welcome" ? (
        <>
          <path
            fill="#f3b4a8"
            d="m70 193 49-39q8-6 18-2l28 9 31-6q12-1 7 9l-42 21-30-3-39 28Z"
          />
          <path
            fill={`url(#${id})`}
            d="M151 132c-66-37-35-81-5-56l5 7 6-7c33-25 61 21-6 56Z"
          />
          <g stroke="#e77b98" strokeWidth="4" strokeLinecap="round">
            <path d="M150 47v-10M105 61l-7-8M195 60l7-8M101 100l-10-1M201 99l10-1" />
          </g>
        </>
      ) : variant === "cycle" ? (
        <>
          <g fill="none" stroke="#87a494" strokeWidth="9" strokeLinecap="round">
            <path d="M97 129a54 54 0 0 1 89-42m-1-16 4 17-17 2M202 129a54 54 0 0 1-89 42m1 16-5-17 18-1" />
          </g>
          <path
            fill={`url(#${id})`}
            d="M150 156c-42-25-23-56-4-40l4 5 4-5c20-17 40 15-4 40Z"
          />
        </>
      ) : variant === "period" ? (
        <path
          fill={`url(#${id})`}
          d="M150 68c-11 21-42 50-42 79a42 42 0 0 0 84 0c0-29-31-58-42-79Z"
        />
      ) : (
        <>
          <rect
            x="110"
            y="112"
            width="80"
            height="70"
            rx="22"
            fill={`url(#${id})`}
          />
          <path
            d="M125 113V96a25 25 0 0 1 50 0v17"
            fill="none"
            stroke="#da5a85"
            strokeWidth="12"
          />
          <path
            d="m138 146 9 9 18-21"
            fill="none"
            stroke="white"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}
export function OnboardingBotanicals() {
  return (
    <svg
      className="onboarding-botanicals"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="#eab4c7" strokeWidth="1.4">
        <path d="M-90 575C280 185 450 425 679 71S1030-34 1100 19M-69 910c303-172 454 287 740 92s374-263 431-67" />
      </g>
      <g stroke="#88a093" strokeWidth="3" fill="#abc0af">
        <path
          d="M-10 300Q57 188 160 91M1040 1051Q916 851 835 788"
          fill="none"
        />
        <path d="M57 204Q47 151 69 119Q85 170 57 204ZM95 160Q100 102 137 78Q143 124 95 160ZM36 238Q-9 208-10 178Q28 184 36 238ZM127 128Q166 114 190 82Q150 72 127 128ZM948 904Q955 847 925 815Q914 865 948 904ZM910 859Q872 849 859 815Q905 811 910 859ZM980 951Q1009 905 1000 871Q962 913 980 951Z" />
      </g>
      <g fill="#f7b4bf">
        <path d="M160 91q-21-5-15-28 10 2 13 11 8-21 20-13 13 14-18 30ZM835 788q-29-12-17-39 15 4 17 17 10-20 24-13 15 21-24 35Z" />
        <circle cx="210" cy="190" r="4" />
        <circle cx="777" cy="840" r="4" />
        <circle cx="250" cy="212" r="3" />
      </g>
    </svg>
  );
}
