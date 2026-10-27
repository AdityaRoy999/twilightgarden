import React, { useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { TutorialFilm, filmDuration, secondsPerStep } from "./TutorialFilm";
import { tutorialRegistry } from "./tutorialData";
export default function TutorialPlayer({
  gameId,
  dark,
  reduce,
}: {
  gameId: string;
  dark: boolean;
  reduce: boolean;
}) {
  const player = useRef<PlayerRef>(null),
    [muted, setMuted] = useState(true);
  const config = tutorialRegistry[gameId];
  return (
    <>
      <Player
        ref={player}
        component={TutorialFilm}
        inputProps={{ gameId, dark, reduce }}
        durationInFrames={filmDuration(gameId, 30)}
        fps={30}
        compositionWidth={720}
        compositionHeight={1080}
        style={{ width: "100%", aspectRatio: "2/3", borderRadius: 22 }}
        controls
        autoPlay={!reduce}
        loop={false}
        initiallyMuted={true}
        clickToPlay
        doubleClickToFullscreen={false}
        showVolumeControls={false}
      />
      <div className="tutorial-chapters" aria-label="Tutorial chapters">
        {config.steps.map((step, i) => (
          <button
            key={step.id}
            onClick={() => {
              player.current?.seekTo(i * secondsPerStep * 30);
              if (!reduce) player.current?.play();
            }}
          >
            {i + 1}. {step.title}
          </button>
        ))}
      </div>
      <div className="tutorial-controls">
        <button
          onClick={() => {
            player.current?.seekTo(0);
            player.current?.play();
          }}
        >
          Replay
        </button>
        <button
          aria-pressed={!muted}
          onClick={() => {
            if (muted) player.current?.unmute();
            else player.current?.mute();
            setMuted(!muted);
          }}
        >
          {muted ? "Sound off" : "Sound on"}
        </button>
      </div>
      <p className="tutorial-transcript">
        {reduce
          ? "Animations are reduced. Use the chapters to move between steps."
          : "Pause, replay or jump to any step."}{" "}
        You can close this guide at any time.
      </p>
    </>
  );
}
