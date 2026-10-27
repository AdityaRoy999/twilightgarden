import React, { useRef, useState } from "react";
import { SpringModal } from "./ui/SpringModal";
import { AppIcon } from "./ui/Icons";
import { DailyLog, CycleSettings } from "../types";
import {
  localDateKey,
  parseDateKey,
  calendarDayDifference,
} from "../lib/dates";
import { Capacitor } from "@capacitor/core";

export default function TodayReportModal({
  isOpen,
  onClose,
  todayLog,
  cycleSettings,
  profile,
}: {
  isOpen: boolean;
  onClose: () => void;
  todayLog: DailyLog | null;
  cycleSettings: CycleSettings;
  profile: { full_name?: string };
}) {
  const card = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const dateKey = todayLog?.date || localDateKey();
  const date = parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const elapsed = calendarDayDifference(
    dateKey,
    cycleSettings.lastPeriodStart || "",
  );
  const day =
    Number.isFinite(elapsed) && elapsed >= 0 && cycleSettings.avgCycleLength > 0
      ? (elapsed % cycleSettings.avgCycleLength) + 1
      : null;
  const values = [
    ["Flow", todayLog?.flow || "Not logged"],
    ["Mood", todayLog?.moods?.join(", ") || "Not logged"],
    ["Symptoms", todayLog?.symptoms?.join(", ") || "Not logged"],
    ["Energy", todayLog?.energyLevel || "Not logged"],
    [
      "Sleep",
      todayLog?.sleepQuality
        ? `${todayLog.sleepQuality}${todayLog.sleepHours !== undefined ? ` · ${todayLog.sleepHours} hours` : ""}`
        : "Not logged",
    ],
  ];
  const exportFile = async (format: "png" | "pdf", share = false) => {
    if (busy || !card.current) return;
    setBusy(true);
    setNotice("");
    try {
      await document.fonts.ready;
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(card.current, {
        scale: 2,
        backgroundColor: "#fff5f9",
        useCORS: true,
      });
      let blob: Blob;
      if (format === "pdf") {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ unit: "mm", format: "a4" });
        const width = 180,
          height = Math.min(265, (canvas.height / canvas.width) * width);
        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          15,
          15,
          width,
          height,
        );
        blob = pdf.output("blob");
      } else
        blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value
                ? resolve(value)
                : reject(new Error("Image could not be generated")),
            "image/png",
          ),
        );
      const name = `Twilight_Report_${dateKey}.${format}`;
      const file = new File([blob], name, {
        type: format === "png" ? "image/png" : "application/pdf",
      });
      if (Capacitor.isNativePlatform()) {
        const [{ Filesystem, Directory }, { Share }] = await Promise.all([
          import("@capacitor/filesystem"),
          import("@capacitor/share"),
        ]);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = reject;
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.readAsDataURL(blob);
        });
        const saved = await Filesystem.writeFile({
          path: name,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: "My daily report",
          files: [saved.uri],
          dialogTitle: "Save or share your report",
        });
      } else if (share && navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], title: "My daily report" });
      else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        setNotice(
          "Report downloaded. You can attach it to a message or email.",
        );
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setNotice("Could not export your report. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <SpringModal
        open={isOpen}
        onClose={busy ? undefined : onClose}
        label="Export today’s report"
        sheet
        className="report-sheet"
      >
        <div className="report-handle" />
        <button
          className="report-close"
          aria-label="Close report"
          onClick={onClose}
          disabled={busy}
        >
          <AppIcon name="close" size={22} />
        </button>
        <ReportArt />
        <h2>Export today’s report</h2>
        <p>Keep a little picture of your day.</p>
        <div className="report-preview">
          <strong>{date}</strong>
          <p>
            {todayLog
              ? `${todayLog.moods?.join(", ") || "Mood not logged"} · ${todayLog.symptoms?.length || 0} symptoms logged`
              : "No check-in recorded for today."}
          </p>
        </div>
        <div className="report-actions">
          <button disabled={busy} onClick={() => void exportFile("png")}>
            <AppIcon name="image" size={24} />
            {busy ? "Preparing report…" : "PNG image"}
          </button>
          <button disabled={busy} onClick={() => void exportFile("pdf")}>
            <AppIcon name="description" size={24} />
            PDF document
          </button>
          <button disabled={busy} onClick={() => void exportFile("png", true)}>
            <AppIcon name="ios_share" size={24} />
            Share report
          </button>
        </div>
        <p role="status">
          {notice || "Only the details shown in your report are included."}
        </p>
      </SpringModal>
      {isOpen && (
        <div ref={card} className="report-export-canvas" aria-hidden="true">
          <h2>{profile.full_name || "My"} daily report</h2>
          <p>{date}</p>
          <h3>Cycle day</h3>
          <p>{day ?? "Not available"}</p>
          {values.map(([label, value]) => (
            <React.Fragment key={label}>
              <h3>{label}</h3>
              <p>{value}</p>
            </React.Fragment>
          ))}
          {todayLog?.notes && (
            <>
              <h3>Personal notes</h3>
              <p>{todayLog.notes}</p>
            </>
          )}
          <footer>
            Twilight Garden · Personal check-in, not a medical diagnosis.
          </footer>
        </div>
      )}
    </>
  );
}
function ReportArt() {
  return (
    <svg
      className="report-art"
      width="170"
      height="150"
      viewBox="0 0 170 150"
      aria-hidden="true"
    >
      <rect
        x="37"
        y="19"
        width="86"
        height="112"
        rx="20"
        fill="var(--bloom-tint)"
        transform="rotate(-9 80 75)"
      />
      <rect
        x="52"
        y="26"
        width="82"
        height="108"
        rx="17"
        fill="var(--selection-bg)"
      />
      <path
        d="M70 89l15-20 16 9 16-29"
        stroke="var(--color-primary)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M72 108h38M72 117h24"
        stroke="var(--bg-surface)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="128" cy="117" r="25" fill="var(--color-primary)" />
      <path
        d="M128 105v22m-8-9 8 9 8-9"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
