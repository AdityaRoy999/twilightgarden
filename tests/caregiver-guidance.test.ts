import { expect, it } from "vitest";
import { caregiverGuidance } from "../lib/caregiverGuidance";
import {
  wellnessGuidePrompt,
  caregiverGuideHasRoleMismatch,
} from "../lib/wellnessGuide";
it("tells the caregiver what to offer based on current recorded energy", () => {
  const care = caregiverGuidance(
    [{ date: "2026-10-27", energyLevel: "low" }],
    "2026-10-27",
  );
  expect(care.body).toContain("They logged low energy today");
  expect(care.body).toContain("Offer to take over a task");
  expect(care.body).not.toContain("listen to what you need");
});
it("labels historical observations and never uses future, fictional or old logs as current evidence", () => {
  const care = caregiverGuidance(
    [
      { date: "2026-10-28", energyLevel: "low" },
      {
        date: "2026-10-27",
        notes: "[Sample history: twilight-demo-v1]",
        energyLevel: "low",
      },
      { date: "2026-10-26", moods: ["anxious"] },
    ],
    "2026-10-27",
  );
  expect(care.body).toContain("anxious on Oct 26");
  expect(care.body).not.toContain("low energy");
  expect(care.basis).toContain("may have changed");
  expect(
    caregiverGuidance(
      [{ date: "2026-09-01", energyLevel: "low" }],
      "2026-10-27",
    ).body,
  ).toContain("no recent personal check-in");
});
it("makes the role distinction explicit in every AI caregiver generation", () => {
  const prompt = wellnessGuidePrompt(
    { phase: "Menstrual", moods: [], symptoms: [] },
    true,
  );
  expect(prompt).toContain('"You" means the supporting partner');
  expect(prompt).toContain("Each card must tell the caregiver");
  expect(prompt).toContain("Distinguish historical check-ins from today");
  expect(wellnessGuidePrompt({}, false)).not.toContain("AUDIENCE:");
});
it("rejects AI tips that directly address the caregiver as the cycle tracker", () => {
  const card = {
    title: "A quiet moment",
    body: "Rest your body while your cramps ease.",
    illustrationId: "rest-recovery",
    actions: [],
  };
  expect(caregiverGuideHasRoleMismatch([card])).toBe(true);
  expect(
    caregiverGuideHasRoleMismatch([
      {
        ...card,
        body: "Ask whether your partner would like a quiet moment. Offer to take over a task.",
      },
    ]),
  ).toBe(false);
});
