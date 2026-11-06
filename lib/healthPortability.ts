import {
  healthModules,
  validateHealthEntry,
  type HealthEntry,
  type HealthSettings,
} from "./reproductiveHealth";
import { localDateKey } from "./dates";
export function parseHealthImport(
  text: string,
  format: "json" | "csv",
  today = localDateKey(),
): HealthEntry[] {
  if (text.length > 2_000_000)
    throw new Error("Choose a file smaller than 2 MB.");
  let rows: unknown[];
  if (format === "json") {
    const data = JSON.parse(text);
    if (data.format !== "twilight-health-v1" || !Array.isArray(data.entries))
      throw new Error("Choose a Twilight health journal export.");
    rows = data.entries;
  } else {
    // Deliberately small, explicit CSV format; no spreadsheet formulas are evaluated.
    const lines = text
        .replace(/^\uFEFF/, "")
        .trim()
        .split(/\r?\n/),
      header =
        lines
          .shift()
          ?.split(",")
          .map((s) => s.trim()) || [];
    if (
      header[0] !== "date" ||
      header.some(
        (k) => !["date", "temperature", "mucus", "lh", "test"].includes(k),
      )
    )
      throw new Error(
        "CSV columns: date,temperature,mucus,lh,test. Use YYYY-MM-DD dates and temperatures in Celsius.",
      );
    rows = lines.filter(Boolean).map((line) => {
      const cells = line.split(",").map((s) => s.trim());
      if (cells.length !== header.length || cells.some((s) => s.includes('"')))
        throw new Error(
          "Use a simple comma-separated CSV without quotes or embedded commas.",
        );
      const row = Object.fromEntries(header.map((k, i) => [k, cells[i]]));
      const { date, ...values } = row;
      if (values.temperature)
        values.temperature = Number(values.temperature) as any;
      return {
        category: "fertility",
        date,
        title: "Imported observation",
        notes: "",
        values,
      };
    });
  }
  if (rows.length > 100) throw new Error("Import up to 100 entries at a time.");
  return rows.map((row) => {
    if (!row || typeof row !== "object")
      throw new Error("Invalid entry in import.");
    const r = row as HealthEntry;
    if (
      !healthModules[r.category] ||
      typeof r.date !== "string" ||
      typeof r.notes !== "string" ||
      typeof r.title !== "string" ||
      !r.values ||
      typeof r.values !== "object" ||
      Array.isArray(r.values)
    )
      throw new Error("Invalid health entry format.");
    const e: HealthEntry = {
      id: crypto.randomUUID(),
      category: r.category,
      date: r.date,
      title: r.title,
      notes: r.notes,
      values: r.values,
      shareWithPartner: false,
    };
    validateHealthEntry(e, today);
    return e;
  });
}
export async function downloadHealthFile(
  data: string | Blob,
  name: string,
  type: string,
) {
  const { Capacitor } = await import("@capacitor/core");
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("Export could not be prepared."));
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.readAsDataURL(blob);
    });
    const file = await Filesystem.writeFile({
      path: name,
      data: base64,
      directory: Directory.Cache,
    });
    try {
      await Share.share({
        title: "Your private health journal",
        url: file.uri,
        dialogTitle: "Save your private export",
      });
    } finally {
      await Filesystem.deleteFile({ path: name, directory: Directory.Cache });
    }
    return;
  }
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportReproductivePDF(
  settings: HealthSettings,
  entries: HealthEntry[],
) {
  const { jsPDF } = await import("jspdf"),
    doc = new jsPDF();
  let y = 24;
  const line = (text: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 13 : 10);
    const wrapped = doc.splitTextToSize(text, 170) as string[];
    for (const row of wrapped) {
      if (y > 275) {
        doc.addPage();
        y = 22;
      }
      doc.text(row, 20, y);
      y += 6;
    }
    y += 3;
  };
  line("Twilight Garden - Private health journal", true);
  line(
    `Exported ${localDateKey()} | User-recorded information, not a diagnosis.`,
  );
  line("This file is readable. Share only with people you choose.");
  line(`Selected journey: ${settings.mode}`);
  if (settings.pregnancy)
    line(
      `Pregnancy status: ${settings.pregnancy.status}; last period: ${settings.pregnancy.lmp}; adjusted due date: ${settings.pregnancy.dueDate || "not supplied"}`,
    );
  for (const e of [...entries].sort((a, b) => b.date.localeCompare(a.date))) {
    line(
      `${e.date} | ${healthModules[e.category].label}${e.title ? ` | ${e.title}` : ""}`,
      true,
    );
    for (const [key, value] of Object.entries(e.values)) {
      if (value === "" || value === "Not recorded") continue;
      line(
        `${healthModules[e.category].fields.find((f) => f.key === key)?.label || key}: ${value}`,
      );
    }
    if (e.notes) line(`Notes: ${e.notes}`);
  }
  await downloadHealthFile(
    doc.output("blob"),
    `twilight-health-${localDateKey()}.pdf`,
    "application/pdf",
  );
}
