import React, { lazy, Suspense } from "react";
import { useTutorial } from "../../contexts/TutorialContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAppMotion } from "../../hooks/useAppMotion";
import { SpringModal } from "../ui/SpringModal";
import { AppIcon } from "../ui/Icons";
import { tutorialRegistry } from "./tutorialData";
const TutorialPlayer = lazy(() => import("./TutorialPlayer"));
export function GlobalGameTutorial() {
  const { isOpen, activeGameId, closeTutorial } = useTutorial();
  const { theme } = useTheme();
  const { reduced } = useAppMotion();
  const config = activeGameId ? tutorialRegistry[activeGameId] : null;
  return (
    <SpringModal
      open={isOpen && !!config}
      onClose={closeTutorial}
      label={config ? `How to play ${config.title}` : "Game tutorial"}
      className="tutorial-sheet"
    >
      <header>
        <h2>{config?.title}</h2>
        <button aria-label="Close tutorial" onClick={closeTutorial}>
          <AppIcon name="close" size={22} />
        </button>
      </header>
      {isOpen && config && (
        <Suspense fallback={<p role="status">Opening your walkthrough…</p>}>
          <TutorialPlayer
            key={`${activeGameId}-${theme}`}
            gameId={activeGameId!}
            dark={theme === "dark"}
            reduce={reduced}
          />
        </Suspense>
      )}
    </SpringModal>
  );
}
