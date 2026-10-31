import type { Config, Snapshot, Metrics, Run, Page } from "../shared/types";
import type { AdminApi } from "./api";
import { icon, date, fmt, external } from "./format";
import { Status } from "./components";
import { BarChart, MetricChart, ActivityGrid } from "./Charts";
import { RunsTable } from "./RunsTable";

export function ReleasesPage({
  snapshot,
  busy,
  setDeployOpen,
  go,
  setReleaseOpen,
}: {
  snapshot: Snapshot | null;
  busy: boolean;
  setDeployOpen: (open: boolean) => void;
  go: (page: Page) => void;
  setReleaseOpen: (open: boolean) => void;
}) {
  return (
    <>
      <section className="panel release-automation">
        <div>
          <span className="eyebrow">SERVER-SIDE RELEASE AUTOMATION</span>
          <h2>Build it. Package it. Ship it.</h2>
          <p className="body-copy">
            Choose APK, IPA, or DMG. Add release notes. Every selected build
            must pass before the pipeline creates your GitHub release.
          </p>
        </div>
        <button
          className="primary"
          disabled={busy || snapshot?.paused}
          onClick={() => setReleaseOpen(true)}
        >
          {icon("Plus", 18)}New release
        </button>
      </section>
      <div className="two-column">
        <section className="panel release-panel">
          <div className="release-icon">{icon("ArrowUp", 26)}</div>
          <span className="eyebrow">PRODUCTION / VERCEL</span>
          <h2>Twilight Garden</h2>
          <p>
            Your existing production app remains on Vercel. This control
            requests a deployment of the latest configured main branch.
          </p>
          <a
            className="production-link"
            href={snapshot?.productionUrl}
            {...external}
          >
            {snapshot?.productionUrl}
            {icon("ArrowOut", 16)}
          </a>
          <div className="release-actions">
            <button
              className="primary"
              disabled={!snapshot?.deployEnabled || busy}
              onClick={() => setDeployOpen(true)}
            >
              {icon("ArrowUp", 17)}Deploy latest main
            </button>
            <a
              className="secondary"
              href="https://vercel.com/dashboard"
              {...external}
            >
              View deployment status {icon("ArrowOut", 16)}
            </a>
          </div>
          {!snapshot?.deployEnabled && (
            <small>
              Add a Vercel deploy hook to the backend secret to enable
              deployment requests.
            </small>
          )}
          <small>
            “Accepted” means the request was sent. Vercel reports final
            deployment status.
          </small>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Device releases</h2>
            {icon("Smartphone", 20)}
          </div>
          <p className="body-copy">
            Build your selected platforms from the same protected main branch.
            Select a completed build to download its artifact bundle.
          </p>
          <div className="check-row">
            {icon("CheckCircle", 18)}iOS: unsigned IPA, signed using Sideloadly
          </div>
          <div className="check-row">
            {icon("CheckCircle", 18)}Android: installable debug APK
          </div>
          <div className="check-row">
            {icon("CheckCircle", 18)}macOS: Apple Silicon DMG, ad-hoc signed
          </div>
          <div className="check-row">
            {icon("Shield", 18)}Artifacts expire according to GitHub retention
          </div>
          <p className="muted">
            Native app updates still require installation and valid signing. The
            console does not silently replace installed apps.
          </p>
          <button className="secondary" onClick={() => go("Builds")}>
            Browse artifacts {icon("ArrowRight", 17)}
          </button>
        </section>
      </div>
      <section className="panel runs-panel">
        <div className="panel-heading">
          <h2>Release history</h2>
          <a className="text-button" href={`https://github.com/${snapshot?.repository||'AdityaRoy999/twilightgarden'}/releases`} {...external}>Review drafts on GitHub {icon('ArrowOut',16)}</a>
        </div>
        <p className="muted">Latest 10 releases available to the integration. GitHub can hide drafts from read-only credentials; review drafts through your own GitHub account.</p>
        {snapshot?.releases?.length ? (
          snapshot.releases.map((r) => (
            <article className="native-release" key={r.id}>
              <div>
                <h3>
                  {r.name || r.tag}
                  <span className="release-tag">
                    {r.draft ? "Draft" : "Published"}
                  </span>
                </h3>
                <small>
                  {r.tag} · {date(r.at)} · {r.assets} downloadable assets
                </small>
                <pre>{r.notes}</pre>
              </div>
              <a className="secondary" href={r.url} {...external}>
                Open release {icon("ArrowOut", 16)}
              </a>
            </article>
          ))
        ) : (
          <p className="empty">
            No releases are visible to this integration yet. Start a release pipeline, or open GitHub to check draft releases.
          </p>
        )}
      </section>
    </>
  );
}
