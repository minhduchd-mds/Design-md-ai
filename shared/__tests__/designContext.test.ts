import { describe, expect, it } from "vitest";
import { createEmptyContext } from "../designContext";

describe("createEmptyContext", () => {
  it("returns a complete empty design context shape", () => {
    expect(createEmptyContext()).toEqual({
      components: [],
      variableCount: 0,
      pageCount: 0,
      docs: [],
      prompt: "",
      bootstrapSuggestions: [],
      templateMatches: [],
      selectedTemplateId: null,
      layoutPattern: null,
      validationReport: null,
    });
  });
});
