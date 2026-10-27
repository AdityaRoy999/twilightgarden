import React from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../contexts/DataContext";
import { LogHistoryView } from "../components/history/LogHistoryView";
export default function LogHistory() {
  const { logs } = useData();
  const navigate = useNavigate();
  return (
    <div className="reference-page">
      <LogHistoryView
        logs={logs}
        readOnly={false}
        onBack={() => navigate(-1)}
        onEdit={(date) => navigate(`/log/details?date=${date}`)}
      />
    </div>
  );
}
