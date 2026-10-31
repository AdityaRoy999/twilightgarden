import { useState } from "react";
import type { Platform } from "../shared/types";
import type { AdminApi } from "./api";
import { Modal } from "./components";
import { icon } from "./format";
export function ReleaseComposer({
  api,
  busy,
  paused,
  error,
  reduced,
  close,
  action,
  done,
}: {
  api: AdminApi;
  busy: boolean;
  paused: boolean;
  error: string;
  reduced: boolean;
  close: () => void;
  action: (fn: () => Promise<unknown>, message: string) => Promise<boolean>;
  done: () => void;
}) {
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["android"]);
  const [publish, setPublish] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const valid =
    /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.test(version) &&
    version !== "0.0.0" &&
    notes.trim().length >= 5 &&
    platforms.length > 0 &&
    (!publish || confirmed);
  return (
    <Modal
      title="Build & ship a release"
      close={() => {
        if (!busy) close();
      }}
      reduced={reduced}
    >
      <p className="body-copy">
        One source commit. Server builds. Release notes and checksums, packaged
        together.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !busy && !paused)
            void action(
              () =>
                api.release({
                  version,
                  notes,
                  platforms,
                  publish,
                  requestId: crypto.randomUUID(),
                }),
              "Release pipeline requested. Follow its progress in Builds.",
            ).then((ok) => {
              if (ok) done();
            });
        }}
      >
        <label className="field-label">
          Version
          <input
            className="form-input"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="0.1.0"
            maxLength={11}
            required
            pattern="(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})"
          />
        </label>
        <span className="field-label">Build platforms</span>
        <div className="release-platforms">
          {(["android", "ios", "dmg"] as const).map((p) => (
            <label
              key={p}
              className={
                platforms.includes(p)
                  ? "release-platform selected"
                  : "release-platform"
              }
            >
              <input
                type="checkbox"
                checked={platforms.includes(p)}
                onChange={(e) =>
                  setPlatforms((old) =>
                    e.target.checked ? [...old, p] : old.filter((v) => v !== p),
                  )
                }
              />
              {icon(p === "ios" ? "Smartphone" : "Monitor", 19)}
              {p === "ios" ? "IPA" : p === "dmg" ? "DMG" : "APK"}
            </label>
          ))}
        </div>
        <label className="field-label">
          Release notes
          <textarea
            className="form-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            minLength={5}
            maxLength={10000}
            rows={5}
            placeholder="What changed in this version? Markdown is supported."
            required
          />
        </label>
        <label className="toggle-row release-publish">
          <div>
            <strong>Publish when all builds succeed</strong>
            <small>Off creates a GitHub draft for review.</small>
          </div>
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => {
              setPublish(e.target.checked);
              setConfirmed(false);
            }}
          />
        </label>
        {publish && (
          <label className="publish-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I approve publishing these notes and downloads. They will be public
            if the GitHub repository is public.
          </label>
        )}
        <div className="info-box">
          {icon("Shield", 18)}Test distribution: APK debug signing, IPA
          unsigned, DMG Apple Silicon ad-hoc signing without notarization. No
          silent native app installation.
        </div>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary full"
          disabled={!valid || busy || paused}
          type="submit"
        >
          {icon("Play", 18)}
          {busy
            ? "Starting pipeline…"
            : publish
              ? "Build and publish release"
              : "Build and create draft"}
        </button>
      </form>
    </Modal>
  );
}
