import { calendarDayDifference, localDateKey, parseDateKey } from "./dates";

export const healthModes = [
  "cycle",
  "contraception",
  "conceive",
  "pregnancy",
  "postpartum",
  "perimenopause",
] as const;
export type HealthMode = (typeof healthModes)[number];
export const modeLabels: Record<HealthMode, string> = {
  cycle: "Understand my cycle",
  contraception: "Manage contraception",
  conceive: "Trying to conceive",
  pregnancy: "Track a pregnancy",
  postpartum: "After pregnancy",
  perimenopause: "Perimenopause",
};
export type HealthCategory =
  | "intimacy"
  | "fertility"
  | "pregnancy"
  | "postpartum"
  | "medication"
  | "condition"
  | "vaginal"
  | "appointment"
  | "reminder";
export interface HealthSettings {
  id: "reproductive_settings";
  mode: HealthMode;
  pregnancy?: {
    lmp: string;
    dueDate?: string;
    status: "active" | "birth" | "loss" | "ended" | "paused";
    outcomeDate?: string;
  };
  contraception?: { method: string; started?: string; review?: string };
}
export interface HealthEntry {
  id: string;
  category: HealthCategory;
  date: string;
  title: string;
  values: Record<string, string | number | boolean>;
  notes: string;
  shareWithPartner: boolean;
  deleted?: boolean;
  shareCoupleId?: string;
}
export const defaultHealthSettings: HealthSettings = {
  id: "reproductive_settings",
  mode: "cycle",
};
export function addCalendarDays(date: string, days: number) {
  const d = parseDateKey(date);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}
export function validDate(date: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(parseDateKey(date).getTime())
  );
}
export function pregnancyProgress(
  pregnancy: HealthSettings["pregnancy"],
  today = localDateKey(),
) {
  if (!pregnancy || pregnancy.status !== "active") return null;
  const due =
    pregnancy.dueDate ||
    (validDate(pregnancy.lmp) ? addCalendarDays(pregnancy.lmp, 280) : "");
  if (!validDate(due)) return null;
  const days = 280 - calendarDayDifference(due, today);
  if (!Number.isFinite(days) || days < 0 || days > 308) return null;
  return {
    days,
    weeks: Math.floor(days / 7),
    day: days % 7,
    dueDate: due,
    trimester: days < 91 ? 1 : days < 196 ? 2 : 3,
    progress: Math.min(1, days / 280),
    daysToDue: calendarDayDifference(due, today),
  };
}
// Original stage copy. Gestational dating starts before conception; artwork is illustrative, never a scan.
export const pregnancyStages = [
  {
    week: 0,
    name: "The beginning",
    detail:
      "Pregnancy weeks are counted from the last period. Conception has usually not happened in the first two weeks.",
    size: "A timeline, not a measurement",
  },
  {
    week: 4,
    name: "A tiny beginning",
    detail:
      "Early development is underway. Arrange pregnancy care after a positive test.",
    size: "Early embryo",
  },
  {
    week: 6,
    name: "Growing foundations",
    detail:
      "The early body and limb buds are developing. Every pregnancy follows its own course.",
    size: "Early embryo",
  },
  {
    week: 8,
    name: "Little changes",
    detail:
      "The head and emerging limbs become more distinct as early development continues.",
    size: "Embryonic stage",
  },
  {
    week: 10,
    name: "A new chapter",
    detail: "The fetal stage begins around this point in gestational dating.",
    size: "Early fetal stage",
  },
  {
    week: 12,
    name: "Small and growing",
    detail:
      "Your pregnancy care team can explain screening choices and your dating scan.",
    size: "First trimester",
  },
  {
    week: 16,
    name: "Room to grow",
    detail:
      "Limbs continue to grow. When movement is first felt varies between pregnancies.",
    size: "Second trimester",
  },
  {
    week: 20,
    name: "Halfway along",
    detail:
      "Discuss the mid-pregnancy scan and any questions with your pregnancy care team.",
    size: "Second trimester",
  },
  {
    week: 24,
    name: "Getting to know a rhythm",
    detail:
      "Notice the pattern of movement as it becomes familiar. Speak to your care team about concerns.",
    size: "Second trimester",
  },
  {
    week: 28,
    name: "The next chapter",
    detail:
      "The third trimester begins. Keep attending the appointments arranged for you.",
    size: "Third trimester",
  },
  {
    week: 32,
    name: "Growing together",
    detail:
      "Your baby continues to develop. Your own comfort, rest and support matter too.",
    size: "Third trimester",
  },
  {
    week: 36,
    name: "Preparing gently",
    detail:
      "Talk about birth plans, feeding choices and the support you would like after birth.",
    size: "Later pregnancy",
  },
  {
    week: 40,
    name: "Around your due date",
    detail:
      "A due date is an estimate. Your care team will discuss the plan if pregnancy continues beyond it.",
    size: "Around term",
  },
];
export function pregnancyStage(week: number) {
  return (
    pregnancyStages.filter((stage) => stage.week <= week).at(-1) ||
    pregnancyStages[0]
  );
}

type Field = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "time";
  options?: readonly string[];
  min?: number;
  max?: number;
  step?: number;
};
export const healthModules: Record<
  HealthCategory,
  { label: string; icon: string; description: string; fields: Field[] }
> = {
  intimacy: {
    label: "Sexual health",
    icon: "favorite",
    description: "Your experience, kept private unless you choose to share.",
    fields: [
      {
        key: "activity",
        label: "Activity",
        type: "select",
        options: [
          "Prefer not to specify",
          "Sexual activity",
          "Solo activity",
          "No activity",
        ],
      },
      {
        key: "protection",
        label: "Protection used",
        type: "select",
        options: [
          "Not recorded",
          "Condom or barrier",
          "Other contraception",
          "Both",
          "None",
          "Not applicable",
        ],
      },
      {
        key: "comfort",
        label: "Comfort",
        type: "select",
        options: ["Not recorded", "Comfortable", "Some discomfort", "Painful"],
      },
      {
        key: "libido",
        label: "Desire",
        type: "select",
        options: ["Not recorded", "Low", "Usual", "High"],
      },
      {
        key: "bleeding",
        label: "Bleeding after activity",
        type: "select",
        options: ["Not recorded", "No", "Yes"],
      },
    ],
  },
  fertility: {
    label: "Fertility observations",
    icon: "eco",
    description:
      "Record observations without treating a calendar estimate as confirmed ovulation.",
    fields: [
      {
        key: "temperature",
        label: "Basal temperature (°C)",
        type: "number",
        min: 34,
        max: 42,
        step: 0.01,
      },
      {
        key: "mucus",
        label: "Cervical mucus",
        type: "select",
        options: [
          "Not recorded",
          "Dry",
          "Sticky",
          "Creamy",
          "Watery",
          "Slippery / stretchy",
        ],
      },
      {
        key: "lh",
        label: "LH test",
        type: "select",
        options: ["Not recorded", "Negative", "Positive", "Unclear"],
      },
      {
        key: "test",
        label: "Pregnancy test",
        type: "select",
        options: ["Not recorded", "Negative", "Positive", "Unclear"],
      },
    ],
  },
  pregnancy: {
    label: "Pregnancy journal",
    icon: "person",
    description:
      "Symptoms and observations for conversations with your care team.",
    fields: [
      {
        key: "symptom",
        label: "Main observation",
        type: "select",
        options: [
          "General check-in",
          "Nausea",
          "Vomiting",
          "Fatigue",
          "Back discomfort",
          "Headache",
          "Swelling",
          "Bleeding",
          "Movement concern",
        ],
      },
      {
        key: "severity",
        label: "Impact",
        type: "select",
        options: ["Not recorded", "Mild", "Moderate", "Severe"],
      },
      {
        key: "movement",
        label: "Movement observation",
        type: "select",
        options: [
          "Not recording",
          "Usual pattern",
          "Less than usual",
          "Not sure",
        ],
      },
      {
        key: "weight",
        label: "Weight (kg), optional",
        type: "number",
        min: 20,
        max: 350,
        step: 0.1,
      },
    ],
  },
  postpartum: {
    label: "Recovery after pregnancy",
    icon: "spa",
    description:
      "Recovery is personal. Log what matters without a deadline to feel better.",
    fields: [
      {
        key: "bleeding",
        label: "Bleeding",
        type: "select",
        options: ["Not recorded", "None", "Light", "Moderate", "Heavy"],
      },
      {
        key: "comfort",
        label: "Recovery comfort",
        type: "select",
        options: ["Not recorded", "Comfortable", "Some discomfort", "Painful"],
      },
      {
        key: "mood",
        label: "Emotional wellbeing",
        type: "select",
        options: [
          "Not recorded",
          "Supported",
          "Mixed",
          "Low",
          "Anxious",
          "Overwhelmed",
        ],
      },
      {
        key: "feeding",
        label: "Feeding context, optional",
        type: "select",
        options: [
          "Not recorded",
          "Breastfeeding",
          "Expressing",
          "Formula",
          "Combination",
          "Not applicable",
        ],
      },
    ],
  },
  medication: {
    label: "Medicines & supplements",
    icon: "medical_services",
    description:
      "Track your existing care plan. The app does not recommend doses or change treatment.",
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "dose", label: "Dose as prescribed, optional", type: "text" },
      {
        key: "taken",
        label: "Record",
        type: "select",
        options: ["Taken", "Skipped", "Side effect", "Started", "Stopped"],
      },
      {
        key: "effect",
        label: "How did it help?",
        type: "select",
        options: [
          "Not recorded",
          "Helped",
          "No change",
          "Felt worse",
          "Not sure",
        ],
      },
    ],
  },
  condition: {
    label: "Conditions & treatments",
    icon: "medical_information",
    description:
      "Record a diagnosis made by your clinician, or symptoms you want to discuss.",
    fields: [
      {
        key: "condition",
        label: "Context",
        type: "select",
        options: [
          "Symptoms to discuss",
          "PCOS",
          "Endometriosis",
          "Fibroids",
          "Perimenopause",
          "Other clinician-diagnosed condition",
        ],
      },
      {
        key: "impact",
        label: "Impact today",
        type: "select",
        options: [
          "Not recorded",
          "Little impact",
          "Some impact",
          "Daily activities affected",
        ],
      },
      {
        key: "treatment",
        label: "Current care / treatment, optional",
        type: "text",
      },
    ],
  },
  vaginal: {
    label: "Vaginal & urinary health",
    icon: "water_drop",
    description:
      "Observations to help describe changes to a qualified healthcare professional.",
    fields: [
      {
        key: "symptom",
        label: "Observation",
        type: "select",
        options: [
          "Discharge change",
          "Itching",
          "Odour change",
          "Burning when urinating",
          "Frequent urination",
          "Pelvic discomfort",
          "STI screening",
          "Other",
        ],
      },
      {
        key: "screening",
        label: "Test / screening status",
        type: "select",
        options: ["Not recorded", "Booked", "Completed", "Follow-up needed"],
      },
      { key: "result", label: "Result, optional", type: "text" },
      {
        key: "severity",
        label: "Impact",
        type: "select",
        options: ["Not recorded", "Mild", "Moderate", "Severe"],
      },
    ],
  },
  appointment: {
    label: "Appointments",
    icon: "calendar_today",
    description: "Keep a private record of care, questions and follow-ups.",
    fields: [
      { key: "date", label: "Appointment date", type: "date" },
      { key: "time", label: "Local time", type: "time" },
      {
        key: "kind",
        label: "Visit type",
        type: "select",
        options: [
          "General care",
          "Gynaecology",
          "Pregnancy care",
          "Scan / screening",
          "Postpartum care",
          "Sexual health",
          "Other",
        ],
      },
      { key: "questions", label: "Questions to ask", type: "text" },
    ],
  },
  reminder: {
    label: "Private reminders",
    icon: "notifications",
    description:
      "Device reminders use a generic message, without health details on the lock screen.",
    fields: [
      { key: "date", label: "Next date", type: "date" },
      { key: "time", label: "Local time", type: "time" },
      {
        key: "repeat",
        label: "Repeat",
        type: "select",
        options: ["Once", "Daily"],
      },
      {
        key: "purpose",
        label: "Purpose",
        type: "select",
        options: [
          "Medication",
          "Contraception",
          "Pregnancy test",
          "Appointment",
          "Check-in",
          "Other",
        ],
      },
    ],
  },
};
export function validateHealthSettings(
  s: HealthSettings,
  today = localDateKey(),
) {
  if (s.id !== "reproductive_settings")
    throw new Error("Invalid journey settings.");
  if (!healthModes.includes(s.mode)) throw new Error("Choose a health goal.");
  if (
    s.mode === "pregnancy" &&
    (!s.pregnancy || !["active", "paused"].includes(s.pregnancy.status))
  )
    throw new Error("Enter pregnancy dates before enabling pregnancy mode.");
  if (s.pregnancy) {
    const p = s.pregnancy;
    if (!["active", "birth", "loss", "ended", "paused"].includes(p.status))
      throw new Error("Choose a pregnancy status.");
    if (!validDate(p.lmp) || p.lmp > today)
      throw new Error("Choose a valid last-period date, up to today.");
    if (
      p.dueDate &&
      (!validDate(p.dueDate) ||
        calendarDayDifference(p.dueDate, p.lmp) < 140 ||
        calendarDayDifference(p.dueDate, p.lmp) > 330)
    )
      throw new Error("Check your clinician-adjusted due date.");
    if (p.status === "active" && !pregnancyProgress(p, today))
      throw new Error(
        "Check your pregnancy dates. The timeline supports up to 44 weeks.",
      );
    if (
      p.outcomeDate &&
      (!validDate(p.outcomeDate) ||
        p.outcomeDate > today ||
        p.outcomeDate < p.lmp)
    )
      throw new Error("Check the date this pregnancy ended.");
  }
  if (s.contraception) {
    if (s.contraception.method.length > 100)
      throw new Error("Keep the method name under 100 characters.");
    for (const d of [s.contraception.started, s.contraception.review])
      if (d && !validDate(d))
        throw new Error("Check your contraception dates.");
  }
}
export function validateHealthEntry(e: HealthEntry, today = localDateKey()) {
  if (
    !e.id ||
    !healthModules[e.category] ||
    !validDate(e.date) ||
    e.date > today
  )
    throw new Error("Choose a valid journal date, up to today.");
  if (e.shareWithPartner && !e.shareCoupleId)
    throw new Error("Choose sharing again for your current connection.");
  if (e.title.length > 120 || e.notes.length > 2000)
    throw new Error(
      "Keep the title under 120 and notes under 2,000 characters.",
    );
  if (
    typeof e.title !== "string" ||
    typeof e.notes !== "string" ||
    !e.values ||
    typeof e.values !== "object" ||
    Array.isArray(e.values)
  )
    throw new Error("Invalid health entry.");
  const fields = healthModules[e.category].fields;
  for (const [key, value] of Object.entries(e.values)) {
    const f = fields.find((field) => field.key === key);
    if (!f) throw new Error("Unknown health field.");
    if (value === "") continue;
    if (f.type !== "number" && typeof value !== "string")
      throw new Error(`Check ${f.label.toLowerCase()}.`);
    if (
      f.type === "number" &&
      (typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < (f.min ?? -Infinity) ||
        value > (f.max ?? Infinity))
    )
      throw new Error(`Check ${f.label.toLowerCase()}.`);
    if (f.type === "select" && !f.options?.includes(String(value)))
      throw new Error(`Choose ${f.label.toLowerCase()}.`);
    if (f.type === "date" && !validDate(String(value)))
      throw new Error("Choose a valid date.");
    if (f.type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value)))
      throw new Error("Choose a valid time.");
    if (typeof value === "string" && value.length > 500)
      throw new Error("Keep each field under 500 characters.");
  }
  if (e.category === "medication" && !String(e.values.name || "").trim())
    throw new Error("Enter the medicine or supplement name.");
  if (
    ["reminder", "appointment"].includes(e.category) &&
    !validDate(String(e.values.date || ""))
  )
    throw new Error("Choose a scheduled date.");
  if (e.category === "reminder" && !e.values.time)
    throw new Error("Choose a reminder time.");
}
export function healthEntryAlerts(
  e: HealthEntry,
): { level: "urgent" | "care"; text: string; source: string }[] {
  const v = e.values;
  if (
    e.category === "pregnancy" &&
    (v.movement === "Less than usual" ||
      v.movement === "Not sure" ||
      v.symptom === "Movement concern")
  )
    return [
      {
        level: "urgent",
        text: "If movements are reduced, stopped or different from the usual pattern, contact your maternity care team immediately. Do not wait for a timer or use this app to check wellbeing.",
        source:
          "https://www.nhs.uk/pregnancy/keeping-well/your-babys-movements/",
      },
    ];
  if (
    (e.category === "pregnancy" && v.symptom === "Bleeding") ||
    v.severity === "Severe" ||
    (e.category === "postpartum" && v.bleeding === "Heavy")
  )
    return [
      {
        level: "urgent",
        text: "Contact a healthcare professional promptly. Severe pain, heavy bleeding, fainting, difficulty breathing or feeling very unwell needs urgent medical attention.",
        source:
          "https://www.nhs.uk/pregnancy/related-conditions/common-symptoms/vaginal-bleeding/",
      },
    ];
  if (
    e.category === "intimacy" &&
    (v.bleeding === "Yes" || v.comfort === "Painful")
  )
    return [
      {
        level: "care",
        text: "Pain or bleeding after sex is worth discussing with a healthcare professional. Seek urgent care for severe pain, heavy bleeding or fainting.",
        source:
          "https://www.nhs.uk/symptoms/vaginal-bleeding-between-periods-or-after-sex/",
      },
    ];
  return [];
}
export function fertilitySeries(entries: HealthEntry[]) {
  return entries
    .filter((e) => !e.deleted && e.category === "fertility")
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({
      date: e.date,
      temperature:
        typeof e.values.temperature === "number" ? e.values.temperature : null,
      lh: e.values.lh,
      mucus: e.values.mucus,
      test: e.values.test,
    }));
}
export function testReminderDate(activityDate: string) {
  return addCalendarDays(activityDate, 21);
}
