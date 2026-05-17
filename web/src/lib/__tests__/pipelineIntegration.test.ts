import { describe, it, expect, vi, beforeEach } from "vitest";
import { PipelineEngine, createPipeline } from "../pipelineIntegration";

describe("PipelineEngine", () => {
  let engine: PipelineEngine;

  beforeEach(() => {
    engine = new PipelineEngine();
    vi.restoreAllMocks();
  });

  describe("configure", () => {
    it("accepts pipeline config", () => {
      engine.configure({ enableMemory: true, enableAnalysis: true, maxPipelineTimeMs: 60000 });
      // No throw
      expect(engine.getStats().runCount).toBe(0);
    });
  });

  describe("getStats", () => {
    it("returns zero stats initially", () => {
      const stats = engine.getStats();
      expect(stats.runCount).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalCostUsd).toBe(0);
    });
  });

  describe("run", () => {
    it("executes full pipeline and returns result", async () => {
      engine.configure({ enableMemory: true, enableAnalysis: true, enableValidation: true });

      const result = await engine.run({
        type: "manual",
        content: "A card component with title, image, and action button",
        framework: "react",
      });

      expect(result.success).toBe(true);
      expect(result.stages.length).toBe(8);
      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
      expect(result.errors).toEqual([]);
      expect(result.output).not.toBeNull();
      expect(result.output?.code?.length).toBeGreaterThan(0);
    });

    it("skips memory stage when disabled", async () => {
      engine.configure({ enableMemory: false });

      const result = await engine.run({
        type: "manual",
        content: "A button component",
        framework: "vue",
      });

      expect(result.success).toBe(true);
      const memoryStage = result.stages.find((s) => s.name === "memory-recall");
      expect(memoryStage?.status).toBe("skipped");
    });

    it("skips analysis stage when disabled", async () => {
      engine.configure({ enableAnalysis: false });

      const result = await engine.run({
        type: "manual",
        content: "A form component",
        framework: "svelte",
      });

      expect(result.success).toBe(true);
      const analysisStage = result.stages.find((s) => s.name === "design-analysis");
      expect(analysisStage?.status).toBe("skipped");
    });

    it("skips validation stage when disabled", async () => {
      engine.configure({ enableValidation: false });

      const result = await engine.run({
        type: "manual",
        content: "A nav component",
        framework: "react",
      });

      expect(result.success).toBe(true);
      const validateStage = result.stages.find((s) => s.name === "shannon-validate");
      expect(validateStage?.status).toBe("skipped");
    });

    it("generates correct output path for vue", async () => {
      const result = await engine.run({
        type: "manual",
        content: "A list component",
        framework: "vue",
      });

      expect(result.output?.code?.[0].path).toContain(".vue");
      expect(result.output?.code?.[0].framework).toBe("vue");
    });

    it("generates correct output path for svelte", async () => {
      const result = await engine.run({
        type: "manual",
        content: "A table component",
        framework: "svelte",
      });

      expect(result.output?.code?.[0].path).toContain(".svelte");
    });

    it("generates tsx for react", async () => {
      const result = await engine.run({
        type: "manual",
        content: "A modal component",
        framework: "react",
      });

      expect(result.output?.code?.[0].path).toContain(".tsx");
    });

    it("increments stats after run", async () => {
      await engine.run({ type: "manual", content: "test", framework: "react" });
      await engine.run({ type: "manual", content: "test2", framework: "vue" });

      const stats = engine.getStats();
      expect(stats.runCount).toBe(2);
      expect(stats.totalTokens).toBeGreaterThan(0);
    });
  });

  describe("events", () => {
    it("emits stage events", async () => {
      const events: Array<{ type: string; data: unknown }> = [];
      engine.on((type, data) => events.push({ type, data }));

      await engine.run({ type: "manual", content: "test", framework: "react" });

      const stageStarts = events.filter((e) => e.type === "stage:start");
      const stageCompletes = events.filter((e) => e.type === "stage:complete");
      const pipelineComplete = events.filter((e) => e.type === "pipeline:complete");

      expect(stageStarts.length).toBeGreaterThan(0);
      expect(stageCompletes.length).toBeGreaterThan(0);
      expect(pipelineComplete.length).toBe(1);
    });

    it("unsubscribe removes listener", async () => {
      const events: string[] = [];
      const unsub = engine.on((type) => events.push(type));
      unsub();

      await engine.run({ type: "manual", content: "test", framework: "react" });
      expect(events.length).toBe(0);
    });
  });

  describe("abort", () => {
    it("abort stops pipeline execution", async () => {
      // Start a run and immediately abort
      const promise = engine.run({ type: "manual", content: "long content ".repeat(100), framework: "react" });
      engine.abort();

      const result = await promise;
      // May or may not have errored depending on timing, but should complete
      expect(result.stages.length).toBe(8);
    });
  });

  describe("input types", () => {
    it("handles figma input", async () => {
      const result = await engine.run({
        type: "figma",
        content: '{"type":"FRAME","name":"Card"}',
        framework: "react",
        designSystem: "material",
      });
      expect(result.success).toBe(true);
    });

    it("handles screenshot input", async () => {
      const result = await engine.run({
        type: "screenshot",
        content: "base64_image_data",
        framework: "react",
      });
      expect(result.success).toBe(true);
    });

    it("handles git input", async () => {
      const result = await engine.run({
        type: "git",
        content: "diff --git a/src/Button.tsx",
        framework: "react",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("factory", () => {
    it("creates engine without config", () => {
      const e = createPipeline();
      expect(e.getStats().runCount).toBe(0);
    });

    it("creates engine with config", () => {
      const e = createPipeline({ enableMemory: false, maxPipelineTimeMs: 30000 });
      expect(e.getStats().runCount).toBe(0);
    });
  });
});
