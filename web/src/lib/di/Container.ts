/**
 * di/Container.ts — Lightweight Dependency Injection container.
 *
 * No decorators, no reflect-metadata, no experimentalDecorators required.
 * Factories are registered by token (string or Symbol) and instantiated
 * lazily on first `get()`. Pre-built instances can be registered directly
 * via `registerInstance()`.
 *
 * Usage:
 *   const container = Container.getInstance();
 *   container.register(TOKENS.AuditRepository, () => new AuditRepository());
 *   const repo = container.get<AuditRepository>(TOKENS.AuditRepository);
 */

// ── Internal entry shape ──────────────────────────────────────────────────────

type FactoryEntry<T> = {
  kind: "factory";
  factory: () => T;
  instance: T | undefined;
};

type InstanceEntry<T> = {
  kind: "instance";
  instance: T;
};

type Entry<T> = FactoryEntry<T> | InstanceEntry<T>;

// ── Container ─────────────────────────────────────────────────────────────────

/**
 * Simple service container with lazy instantiation.
 *
 * - `register`          — store a factory; instance created on first `get()`
 * - `registerInstance`  — store an already-created object
 * - `get`               — resolve (and cache) a service by token
 * - `has`               — check whether a token is registered
 * - `reset`             — remove all registrations (useful in tests)
 */
export class Container {
  // Singleton holder
  private static _instance: Container | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _entries: Map<string | symbol, Entry<any>> = new Map();

  // Private constructor enforces singleton usage via getInstance()
  private constructor() {}

  /**
   * Returns the global singleton container.
   * Creates it on first call; subsequent calls return the same instance.
   */
  static getInstance(): Container {
    if (!Container._instance) {
      Container._instance = new Container();
    }
    return Container._instance;
  }

  // ── Registration ────────────────────────────────────────────────────────────

  /**
   * Register a factory function for a token.
   * The factory is called at most once — on the first `get()` for that token.
   *
   * @param token   Unique identifier (string or Symbol)
   * @param factory Zero-argument function that produces the service
   */
  register<T>(token: string | symbol, factory: () => T): void {
    this._entries.set(token, {
      kind: "factory",
      factory,
      instance: undefined,
    } satisfies FactoryEntry<T>);
  }

  /**
   * Register an already-created instance directly.
   * Useful when the service has been constructed outside the container
   * (e.g. in tests or when the constructor requires async initialisation
   * that has already completed).
   *
   * @param token    Unique identifier (string or Symbol)
   * @param instance The pre-created service object
   */
  registerInstance<T>(token: string | symbol, instance: T): void {
    this._entries.set(token, {
      kind: "instance",
      instance,
    } satisfies InstanceEntry<T>);
  }

  // ── Resolution ──────────────────────────────────────────────────────────────

  /**
   * Resolve a service by token.
   *
   * - For factory entries: the factory is called on the first `get()`;
   *   the result is cached and returned on all subsequent calls.
   * - For instance entries: the stored instance is returned directly.
   *
   * @throws {Error} if the token has not been registered
   */
  get<T>(token: string | symbol): T {
    const entry = this._entries.get(token) as Entry<T> | undefined;

    if (!entry) {
      const name = typeof token === "symbol" ? token.toString() : token;
      throw new Error(`[Container] No registration found for token: ${name}`);
    }

    if (entry.kind === "instance") {
      return entry.instance;
    }

    // Lazy factory: create and cache on first access
    if (entry.instance === undefined) {
      entry.instance = entry.factory();
    }
    return entry.instance;
  }

  // ── Introspection ───────────────────────────────────────────────────────────

  /**
   * Returns `true` when the token has been registered (factory or instance).
   */
  has(token: string | symbol): boolean {
    return this._entries.has(token);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Remove all registrations and cached instances from this container.
   * Intended for use in unit tests so each test suite starts clean.
   *
   * Note: this does NOT destroy the singleton reference — subsequent calls
   * to `Container.getInstance()` still return the same (now empty) container.
   * To get a truly fresh singleton you can also call `Container.resetSingleton()`
   * which is exposed for test environments only.
   */
  reset(): void {
    this._entries.clear();
  }

  /**
   * Destroy the singleton instance entirely.
   * The next call to `Container.getInstance()` will create a brand-new container.
   *
   * @internal — Test-only helper. Do not use in production code.
   */
  static resetSingleton(): void {
    Container._instance = undefined;
  }
}
