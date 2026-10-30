import { describe, it, expect } from "vitest";
import { CiphertextCache } from "../lib/ciphertextCache";
describe("ciphertext memory cache", () => {
  it("expires entries without extending their authorization lifetime on a read", () => {
    let now = 10;
    const c = new CiphertextCache(50, 1024, () => now);
    c.set("owner:profile", { data: "opaque" });
    now = 49;
    expect(c.get("owner:profile")).toEqual({ data: "opaque" });
    now = 61;
    expect(c.get("owner:profile")).toBeUndefined();
  });
  it("bounds memory and evicts complete ciphertext entries", () => {
    const c = new CiphertextCache(5000, 100);
    c.set("a", "x".repeat(20));
    c.set("b", "y".repeat(20));
    c.set("c", "z".repeat(20));
    expect(c.get("a")).toBeUndefined();
    expect(c.get("c")).toBe("z".repeat(20));
    c.set("huge", "n".repeat(100));
    expect(c.get("huge")).toBeUndefined();
  });
  it("supports explicit realtime/write invalidation and clears on vault switches", () => {
    const c = new CiphertextCache();
    c.set("account-a", { data: "cipher" });
    c.delete("account-a");
    expect(c.get("account-a")).toBeUndefined();
    c.set("account-b", { data: "other" });
    c.clear();
    expect(c.get("account-b")).toBeUndefined();
  });
});
