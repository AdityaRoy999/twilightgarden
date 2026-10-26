import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

export default {
plugins: [forms, containerQueries],
content: ['./index.html', './App.tsx', './index.tsx', './{pages,components,contexts,hooks}/**/*.{ts,tsx}'],

        darkMode: "class",
        theme: {
          extend: {
            fontFamily: {
              display: ["Plus Jakarta Sans", "sans-serif"],
              epilogue: ["Epilogue", "sans-serif"],
            },
            colors: {
              /* Reference CSS variables from index.css */
              primary: "rgb(var(--primary-rgb) / <alpha-value>)",
              "primary-dim": "rgb(var(--primary-rgb) / <alpha-value>)",
              "primary-light": "rgb(var(--primary-light-rgb) / <alpha-value>)",
              "primary-glow": "rgb(var(--primary-rgb) / <alpha-value>)",
              "background-light": "rgb(var(--bg-light-rgb) / <alpha-value>)",
              "background-dark": "rgb(var(--bg-base-rgb) / <alpha-value>)",
              "surface-dark": "rgb(var(--bg-surface-rgb) / <alpha-value>)",
              "accent-teal": "rgb(var(--teal-rgb) / <alpha-value>)",
              "accent-purple": "rgb(var(--purple-rgb) / <alpha-value>)",
              "accent-amber": "rgb(var(--amber-rgb) / <alpha-value>)",
              fertile: "rgb(var(--teal-rgb) / <alpha-value>)",
              ovulation: "rgb(var(--yellow-rgb) / <alpha-value>)",
            },
            boxShadow: {
              soft: "var(--shadow-soft)",
              medium: "var(--shadow-medium)",
            },
            animation: {
              slideIn: "slideIn 0.4s ease-out",
            },
            keyframes: {
              slideIn: {
                "0%": { transform: "translateY(20px)", opacity: "0" },
                "100%": { transform: "translateY(0)", opacity: "1" },
              },
            },
          },
        },

};
