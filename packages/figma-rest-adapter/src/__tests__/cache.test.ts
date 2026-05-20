/**
 * LruCache — TTL + LRU eviction tests.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { LruCache } from "../cache.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("LruCache", () => {
  it("stores and retrieves a value", () => {
    const cache = new LruCache<number>(10, 300);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
  });

  it("returns undefined for missing key", () => {
    const cache = new LruCache<number>();
    expect(cache.get("missing")).toBeUndefined();
  });

  it("expires entries after TTL", () => {
    vi.useFakeTimers();
    const cache = new LruCache<number>(10, 1); // 1 second TTL
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    vi.advanceTimersByTime(1500);
    expect(cache.get("a")).toBeUndefined();
  });

  it("respects per-entry TTL override", () => {
    vi.useFakeTimers();
    const cache = new LruCache<number>(10, 300);
    cache.set("a", 1, 1); // override to 1s
    vi.advanceTimersByTime(1500);
    expect(cache.get("a")).toBeUndefined();
  });

  it("evicts least-recently-used when at capacity", () => {
    const cache = new LruCache<number>(2, 300);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a");           // bump 'a' to MRU
    cache.set("c", 3);        // should evict 'b'
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });

  it("clear() empties the cache", () => {
    const cache = new LruCache<number>();
    cache.set("a", 1);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("tracks size", () => {
    const cache = new LruCache<number>();
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.size).toBe(2);
  });

  it("updating existing key does not grow size", () => {
    const cache = new LruCache<number>(2, 300);
    cache.set("a", 1);
    cache.set("a", 2);
    expect(cache.size).toBe(1);
    expect(cache.get("a")).toBe(2);
  });
});
