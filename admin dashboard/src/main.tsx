import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import type { Config } from "../shared/types";
import { finishSignIn, validateConfig } from "./auth";
import "./styles/bloom.css";
import "./styles/dark.css";
async function start() {
  const root = createRoot(document.getElementById("root")!);
  root.render(<div className="boot">Opening Twilight Control…</div>);
  try {
    // Demo is permitted only on loopback. A missing production config fails closed.
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(
      location.hostname,
    );
    const response = await fetch("/config.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    let config: Config;
    if (
      response.ok &&
      response.headers.get("content-type")?.includes("application/json")
    )
      config = validateConfig(await response.json());
    else if (local) config = { mode: "demo" };
    else
      throw new Error(
        "Deployment configuration is missing. Run npm run site:publish after deploying the AWS stack.",
      );
    await finishSignIn(config);
    root.render(
      <React.StrictMode>
        <App config={config} />
      </React.StrictMode>,
    );
  } catch (error) {
    root.render(
      <div className="boot">
        <h1>Unable to open the console</h1>
        <p>{error instanceof Error ? error.message : "Please retry."}</p>
        <button onClick={() => location.reload()}>Try again</button>
      </div>,
    );
  }
}
void start();
