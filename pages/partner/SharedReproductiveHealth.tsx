import React, { useState, useEffect } from "react";
import { useCouples } from "../../contexts/CouplesContext";
import { useAuth } from "../../contexts/AuthContext";
import { useVault } from "../../contexts/VaultContext";
import { rawSupabase } from "../../lib/supabase";
import {
  readPrivateRows,
  invalidatePrivateRecords,
} from "../../lib/privateData";
import { healthModules, type HealthEntry } from "../../lib/reproductiveHealth";
import { parseDateKey } from "../../lib/dates";
import { ReferenceHeading } from "../../components/ui/ReferenceArt";
import { AppIcon } from "../../components/ui/Icons";
import { Link } from "react-router-dom";
export default function SharedReproductiveHealth() {
  const { couple } = useCouples(),
    { user } = useAuth(),
    vault = useVault();
  const [entries, setEntries] = useState<HealthEntry[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const owner =
    couple?.partner_1_id === user?.id
      ? couple?.partner_2_id
      : couple?.partner_1_id;
  useEffect(() => {
    let active = true;
    let revision = 0;
    setEntries([]);
    setLoading(true);
    const load = async () => {
      const r = ++revision;
      if (
        !owner ||
        couple?.status !== "active" ||
        !couple.share_enabled ||
        !vault.ready
      ) {
        setLoading(false);
        return;
      }
      try {
        invalidatePrivateRecords(owner, "reproductive_entries");
        const rows = await readPrivateRows(owner, "reproductive_entries");
        if (active && r === revision) {
          setEntries(
            rows
              .filter(
                (e) =>
                  e.shareWithPartner &&
                  e.shareCoupleId === couple.id &&
                  !e.deleted,
              )
              .sort((a, b) => b.date.localeCompare(a.date)),
          );
          setError("");
        }
      } catch {
        if (active && r === revision) {
          setEntries([]);
          setError(
            "Shared entries could not be loaded. Access may have changed.",
          );
        }
      } finally {
        if (active && r === revision) setLoading(false);
      }
    };
    void load();
    const resume = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", resume);
    const c = owner
      ? rawSupabase
          .channel(`shared-reproductive:${owner}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "private_records",
              filter: `owner_id=eq.${owner}`,
            },
            () => void load(),
          )
          .subscribe()
      : null;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => {
      active = false;
      revision++;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      if (c) void rawSupabase.removeChannel(c);
    };
  }, [
    owner,
    couple?.id,
    couple?.status,
    couple?.share_enabled,
    vault.ready,
    vault.epoch,
  ]);
  return (
    <div className="reference-page reproductive-page">
      <ReferenceHeading
        title="Shared health journal"
        description="Only the entries your partner has chosen to share."
      />
      <Link className="health-secondary" to="/partner/insights">
        <AppIcon name="arrow_back" size={20} />
        Back to Insights
      </Link>
      {loading ? (
        <p role="status">Opening shared entries…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : entries.length === 0 ? (
        <section className="reference-card health-empty">
          <AppIcon name="lock" size={40} />
          <h2>A private choice</h2>
          <p>
            No additional entries are shared with you. Linking does not give
            automatic access to sexual health, pregnancy or other private
            records.
          </p>
        </section>
      ) : (
        <div className="health-entry-grid">
          {entries.map((e) => (
            <article className="reference-card health-entry" key={e.id}>
              <span className="bloom-eyebrow">
                {healthModules[e.category]?.label || "Shared entry"}
              </span>
              <h2>{e.title || parseDateKey(e.date).toLocaleDateString()}</h2>
              <p>
                {parseDateKey(e.date).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <dl>
                {Object.entries(e.values)
                  .filter(([, v]) => v !== "" && v !== "Not recorded")
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>
                        {healthModules[e.category]?.fields.find(
                          (f) => f.key === key,
                        )?.label || key}
                      </dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
              </dl>
              {e.notes && <p className="health-entry-note">{e.notes}</p>}
              <footer>
                <span>
                  <AppIcon name="verified_user" size={18} />
                  Shared by choice · read only
                </span>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
