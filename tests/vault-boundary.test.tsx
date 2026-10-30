// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const value = vi.hoisted(() => ({
  ready: false,
  loading: false,
  exists: false,
  error: "",
  refresh: vi.fn(),
  unlock: vi.fn(),
  create: vi.fn(),
}));
vi.mock("../contexts/VaultContext", () => ({ useVault: () => value }));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "owner" }, signOut: vi.fn() }),
}));
import { VaultBoundary } from "../components/VaultBoundary";
beforeEach(() => {
  value.ready = false;
  value.loading = false;
  value.exists = false;
  value.error = "";
  value.create.mockReset().mockResolvedValue(undefined);
  value.unlock.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);
it("keeps private screens unmounted until the vault is unlocked", () => {
  const view = render(
    <VaultBoundary>
      <div>Private history</div>
    </VaultBoundary>,
  );
  expect(screen.queryByText("Private history")).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Protect your private space" }),
  ).toBeTruthy();
  value.ready = true;
  view.rerender(
    <VaultBoundary>
      <div>Private history</div>
    </VaultBoundary>,
  );
  expect(screen.getByText("Private history")).toBeTruthy();
});
it("first setup confirms a saved matching recovery password before creating a vault", async () => {
  render(
    <VaultBoundary>
      <div>Private history</div>
    </VaultBoundary>,
  );
  fireEvent.change(screen.getByLabelText("Backup password"), {
    target: { value: "a long backup password" },
  });
  fireEvent.change(screen.getByLabelText("Confirm backup password"), {
    target: { value: "a different password" },
  });
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Create encrypted vault" })
      .closest("form")!,
  );
  expect(value.create).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Confirm backup password"), {
    target: { value: "a long backup password" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  await act(async () => {
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Create encrypted vault" })
        .closest("form")!,
    );
  });
  expect(value.create).toHaveBeenCalledWith("a long backup password", "");
});
it("an existing vault offers restore only and preserves a wrong-password error", async () => {
  value.exists = true;
  value.unlock.mockRejectedValue(new Error("Wrong backup password"));
  render(
    <VaultBoundary>
      <div>Private history</div>
    </VaultBoundary>,
  );
  expect(screen.queryByLabelText("Confirm backup password")).toBeNull();
  fireEvent.change(screen.getByLabelText("Backup password"), {
    target: { value: "wrong password" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Unlock" }).closest("form")!,
  );
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("Wrong backup password"),
  );
  expect(value.create).not.toHaveBeenCalled();
  expect(screen.queryByText("Private history")).toBeNull();
});
