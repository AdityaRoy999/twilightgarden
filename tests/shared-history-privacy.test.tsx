// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ share: true, status: "active" }));
vi.mock("../contexts/CouplesContext", () => ({
  useCouples: () => ({
    couple: { status: fixture.status, share_enabled: fixture.share },
    partnerLogs: [{ date: "2026-10-26", notes: "Shared fixture" }],
  }),
}));
vi.mock("../hooks/useAppMotion", () => ({
  useAppMotion: () => ({ reduced: true }),
}));
import PartnerLogs from "../pages/partner/PartnerLogs";
afterEach(() => {
  cleanup();
  fixture.share = true;
  fixture.status = "active";
});
it("hides even retained shared rows when sharing is paused or the connection ends", () => {
  const view = render(<PartnerLogs />);
  expect(
    screen.getByRole("button", { name: "View check-in for October 26, 2026" }),
  ).toBeTruthy();
  fixture.share = false;
  view.rerender(<PartnerLogs />);
  expect(screen.queryByRole("button", { name: /View check-in/ })).toBeNull();
  expect(screen.getByText("History sharing is paused")).toBeTruthy();
  fixture.share = true;
  fixture.status = "ended";
  view.rerender(<PartnerLogs />);
  expect(screen.queryByRole("button", { name: /View check-in/ })).toBeNull();
});
