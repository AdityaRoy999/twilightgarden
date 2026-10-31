import { describe, it, expect } from "vitest";
import { validateConfig } from "../src/auth";
describe("deployed configuration", () => {
  it("requires live HTTPS endpoints and a public client identifier", () => {
    expect(
      validateConfig({
        mode: "live",
        apiUrl: "https://api.example",
        authDomain: "https://login.example",
        clientId: "public-client",
      }).mode,
    ).toBe("live");
    expect(() => validateConfig({ mode: "demo" })).toThrow();
    expect(() =>
      validateConfig({
        mode: "live",
        apiUrl: "http://api.example",
        authDomain: "https://login.example",
        clientId: "id",
      }),
    ).toThrow();
    expect(() =>
      validateConfig({
        mode: "live",
        apiUrl: "https://api.example",
        authDomain: "https://login.example",
      }),
    ).toThrow();
  });
});
