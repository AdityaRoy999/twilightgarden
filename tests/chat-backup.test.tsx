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
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  locked: false,
  backup: false,
  ready: true,
  setup: vi.fn(),
  restore: vi.fn(),
  approve: vi.fn(),
  refresh: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  erase: vi.fn(),
  subscription: vi.fn(),
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "synthetic-user" } }),
}));
vi.mock("../contexts/CouplesContext", () => ({
  useCouples: () => ({
    isSyncRequired: mocks.locked,
    hasCloudBackup: mocks.backup,
    identityReady: mocks.ready,
    couple: { id: "synthetic-couple", status: "active" },
    setupCloudBackup: mocks.setup,
    restoreFromCloudBackup: mocks.restore,
    completeSyncHandshake: mocks.approve,
    refreshE2EE: mocks.refresh,
    notes: [],
  }),
}));
vi.mock("../lib/sync", () => ({ createSyncSession: mocks.create }));
vi.mock("../lib/supabase", () => ({
  supabase: {
    removeChannel: mocks.remove,
    channel: () => ({
      on() {
        return this;
      },
      subscribe(callback: (state: string) => void) {
        mocks.subscription(callback);
        callback("SUBSCRIBED");
        return this;
      },
    }),
    from: () => ({
      delete: () => ({ eq: mocks.erase }),
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { status: "pending" } }),
        }),
      }),
    }),
    rpc: vi.fn(),
  },
}));
import { SyncHistoryModal } from "../components/SyncHistoryModal";
import { IdentityLockdownPrompt } from "../components/IdentityLockdownPrompt";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locked = false;
  mocks.backup = false;
  mocks.ready = true;
  mocks.setup.mockResolvedValue(undefined);
  mocks.restore.mockResolvedValue(undefined);
  mocks.approve.mockResolvedValue(undefined);
  mocks.erase.mockResolvedValue({ error: null });
  mocks.create.mockResolvedValue({
    session: { id: "synthetic-session", token: "ABCDEFGH" },
    ephemeralPrivate: "synthetic-ephemeral",
  });
});
afterEach(() => cleanup());
describe("simple optional chat backup", () => {
  it("does not block an existing device with a backup setup popup", () => {
    mocks.backup = true;
    render(
      <MemoryRouter initialEntries={["/notes"]}>
        <IdentityLockdownPrompt />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("shows one password field at a time and saves only after confirmation", async () => {
    render(<SyncHistoryModal isOpen onClose={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Set backup password" })).toBeTruthy();
    expect(screen.queryByLabelText("Confirm password")).toBeNull();
    expect(screen.queryByLabelText("Device code")).toBeNull();
    fireEvent.change(screen.getByLabelText("Backup password"), {
      target: { value: "synthetic-backup-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(mocks.setup).not.toHaveBeenCalled();
    fireEvent.change(
      screen.getByLabelText("Confirm password", { selector: "input" }),
      { target: { value: "different-password" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save backup" }));
    await screen.findByRole("alert");
    expect(mocks.setup).not.toHaveBeenCalled();
    fireEvent.change(
      screen.getByLabelText("Confirm password", { selector: "input" }),
      { target: { value: "synthetic-backup-password" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save backup" }));
    await screen.findByRole("heading", { name: "All set" });
    expect(mocks.setup).toHaveBeenCalledWith("synthetic-backup-password");
  });
  it("lets the user skip optional backup without making a server request", () => {
    const close = vi.fn();
    render(<SyncHistoryModal isOpen onClose={close} />);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(mocks.setup).not.toHaveBeenCalled();
  });
  it("restores existing backups with one entry, including legacy PINs", async () => {
    mocks.locked = true;
    mocks.backup = true;
    render(<SyncHistoryModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Backup password"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock chats" }));
    await waitFor(() => expect(mocks.restore).toHaveBeenCalledWith("123456"));
    expect(mocks.setup).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Confirm password")).toBeNull();
  });
  it("keeps linking under More options on a trusted device", async () => {
    render(<SyncHistoryModal isOpen onClose={vi.fn()} />);
    expect(screen.queryByLabelText("Device code")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.change(screen.getByLabelText("Device code"), {
      target: { value: "abcdefgh" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Link device" }));
    await screen.findByRole("heading", { name: "All set" });
    expect(mocks.approve).toHaveBeenCalledWith("ABCDEFGH");
    expect(
      screen.getByText("The other device can now load your chats."),
    ).toBeTruthy();
  });
  it("offers device linking directly when no cloud backup exists", async () => {
    mocks.locked = true;
    render(<SyncHistoryModal isOpen onClose={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Link this device" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Backup password")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show link code" }));
    await screen.findByLabelText("Link code");
    expect(screen.getByLabelText("Link code").textContent).toBe("ABCDEFGH");
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it("still prompts a new device to restore its existing identity", async () => {
    mocks.locked = true;
    mocks.backup = true;
    render(
      <MemoryRouter initialEntries={["/notes"]}>
        <IdentityLockdownPrompt />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Unlock chats on this device" })).toBeTruthy();
  });
  it("removes a device-link request that finishes after the modal was closed", async () => {
    mocks.locked = true;
    let resolve!: (value: unknown) => void;
    mocks.create.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const view = render(<SyncHistoryModal isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Show link code" }));
    view.rerender(<SyncHistoryModal isOpen={false} onClose={vi.fn()} />);
    await act(async () => {
      resolve({
        session: { id: "late-session", token: "ABCDEFGH" },
        ephemeralPrivate: "synthetic",
      });
    });
    expect(mocks.erase).toHaveBeenCalledWith("id", "late-session");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
