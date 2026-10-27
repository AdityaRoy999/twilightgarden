import React from "react";
import { useCouples } from "../../contexts/CouplesContext";
import { LogHistoryView } from "../../components/history/LogHistoryView";
export default function PartnerLogs() {
  const { couple, partnerLogs } = useCouples();
  if (!couple?.share_enabled || couple.status !== "active")
    return (
      <div className="reference-page">
        <section className="reference-card">
          <h1 className="text-2xl font-bold">History sharing is paused</h1>
          <p className="reference-description mt-3">
            Your partner decides when to share their check-ins with you.
          </p>
        </section>
      </div>
    );
  return (
    <div className="reference-page">
      <LogHistoryView logs={partnerLogs} readOnly />
    </div>
  );
}
