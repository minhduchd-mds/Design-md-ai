/**
 * di — unit tests
 *
 * Covers: Container.register, registerInstance, get, has, reset,
 * singleton pattern, lazy instantiation, unknown-token error.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Container } from "../di/Container";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Simple stub service used across tests */
class StubService {
  readonly id = Math.random();
  greet() {
    return "hello";
  }
}

const TOKEN_A = Symbol("StubA");
const TOKEN_B = Symbol("StubB");
const TOKEN_STR = "string-token";

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Each test gets a clean container by resetting the singleton reference
  // and clearing any leftover state from the previous test.
  Container.resetSingleton();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Container", () => {

  describe("register + get (factory)", () => {
    it("resolves a registered factory to the correct instance", () => {
      const container = Container.getInstance();
      container.register(TOKEN_A, () => new StubService());

      const svc = container.get<StubService>(TOKEN_A);
      expect(svc).toBeInstanceOf(StubService);
      expect(svc.greet()).toBe("hello");
    });

    it("works with string tokens as well as Symbol tokens", () => {
      const container = Container.getInstance();
      container.register(TOKEN_STR, () => ({ value: 42 }));

      const result = container.get<{ value: number }>(TOKEN_STR);
      expect(result.value).toBe(42);
    });
  });

  describe("lazy instantiation", () => {
    it("calls the factory only on the first get(), not at registration time", () => {
      const factory = vi.fn(() => new StubService());
      const container = Container.getInstance();
      container.register(TOKEN_A, factory);

      // Factory must NOT have been called yet
      expect(factory).not.toHaveBeenCalled();

      container.get(TOKEN_A);
      expect(factory).toHaveBeenCalledTimes(1);

      // Second get() must reuse the cached instance
      container.get(TOKEN_A);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("returns the same cached instance on repeated get() calls", () => {
      const container = Container.getInstance();
      container.register(TOKEN_A, () => new StubService());

      const first = container.get<StubService>(TOKEN_A);
      const second = container.get<StubService>(TOKEN_A);
      expect(first).toBe(second);
    });
  });

  describe("registerInstance (pre-created)", () => {
    it("resolves a pre-created instance without calling a factory", () => {
      const container = Container.getInstance();
      const instance = new StubService();
      container.registerInstance(TOKEN_B, instance);

      const resolved = container.get<StubService>(TOKEN_B);
      expect(resolved).toBe(instance);
    });

    it("every get() returns exactly the same pre-created object", () => {
      const container = Container.getInstance();
      const instance = { label: "singleton-value" };
      container.registerInstance(TOKEN_STR, instance);

      expect(container.get(TOKEN_STR)).toBe(instance);
      expect(container.get(TOKEN_STR)).toBe(instance);
    });
  });

  describe("has()", () => {
    it("returns false for unregistered tokens", () => {
      const container = Container.getInstance();
      expect(container.has(TOKEN_A)).toBe(false);
    });

    it("returns true after register()", () => {
      const container = Container.getInstance();
      container.register(TOKEN_A, () => new StubService());
      expect(container.has(TOKEN_A)).toBe(true);
    });

    it("returns true after registerInstance()", () => {
      const container = Container.getInstance();
      container.registerInstance(TOKEN_B, new StubService());
      expect(container.has(TOKEN_B)).toBe(true);
    });
  });

  describe("get() error handling", () => {
    it("throws a descriptive error when token is not registered", () => {
      const container = Container.getInstance();
      expect(() => container.get(TOKEN_A)).toThrowError(
        /No registration found for token/,
      );
    });

    it("error message includes the token description for Symbols", () => {
      const namedToken = Symbol("MyNamedService");
      const container = Container.getInstance();
      expect(() => container.get(namedToken)).toThrowError(/MyNamedService/);
    });
  });

  describe("reset()", () => {
    it("clears all registrations — get() throws after reset", () => {
      const container = Container.getInstance();
      container.register(TOKEN_A, () => new StubService());
      expect(container.has(TOKEN_A)).toBe(true);

      container.reset();
      expect(container.has(TOKEN_A)).toBe(false);
      expect(() => container.get(TOKEN_A)).toThrow();
    });

    it("discards cached factory instances — new factory runs after reset + re-register", () => {
      const factory = vi.fn(() => new StubService());
      const container = Container.getInstance();
      container.register(TOKEN_A, factory);

      const first = container.get<StubService>(TOKEN_A);
      expect(factory).toHaveBeenCalledTimes(1);

      container.reset();
      container.register(TOKEN_A, factory);

      const second = container.get<StubService>(TOKEN_A);
      expect(factory).toHaveBeenCalledTimes(2);
      // After reset and re-register, a brand-new instance is created
      expect(first).not.toBe(second);
    });
  });

  describe("singleton pattern", () => {
    it("Container.getInstance() always returns the same object", () => {
      const a = Container.getInstance();
      const b = Container.getInstance();
      expect(a).toBe(b);
    });

    it("registrations on one reference are visible on another", () => {
      const c1 = Container.getInstance();
      c1.register(TOKEN_A, () => new StubService());

      const c2 = Container.getInstance();
      expect(c2.has(TOKEN_A)).toBe(true);
    });

    it("Container.resetSingleton() causes the next getInstance() to return a fresh container", () => {
      const before = Container.getInstance();
      before.register(TOKEN_A, () => new StubService());

      Container.resetSingleton();
      const after = Container.getInstance();

      expect(after).not.toBe(before);
      expect(after.has(TOKEN_A)).toBe(false);
    });
  });
});
