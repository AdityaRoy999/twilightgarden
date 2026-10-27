import React from "react";
import { useNavigate } from "react-router-dom";
import type { DailyLog } from "../types";
import { HistoryLogDetails } from "./history/LogHistoryView";
export default function LogDetailsModal({
  isOpen,
  onClose,
  log,
  date,
  readOnly = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  log: DailyLog | null;
  date: string;
  readOnly?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <HistoryLogDetails
      log={isOpen ? log || { date } : null}
      readOnly={readOnly}
      onClose={onClose}
      onEdit={(value) => {
        onClose();
        navigate(`/log/details?date=${value}`);
      }}
    />
  );
}
