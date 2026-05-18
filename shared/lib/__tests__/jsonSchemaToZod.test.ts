/**
 * Tests for jsonSchemaToZod — JSON Schema → Zod v4 runtime converter.
 *
 * Zod v4 keeps the same z.string() / z.object() / z.number() / etc. surface
 * API as v3, so test assertions use `.parse()` / `.safeParse()` directly.
 */

import { describe, it, expect } from "vitest";
import { jsonSchemaToZod } from "../jsonSchemaToZod";
import type { JSONSchema } from "../jsonSchemaToZod";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function passes(schema: ReturnType<typeof jsonSchemaToZod>, value: unknown) {
  return schema.safeParse(value).success;
}

function fails(schema: ReturnType<typeof jsonSchemaToZod>, value: unknown) {
  return !schema.safeParse(value).success;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

describe("jsonSchemaToZod", () => {
  describe("string type", () => {
    it("accepts a plain string", () => {
      const schema = jsonSchemaToZod({ type: "string" });
      expect(passes(schema, "hello")).toBe(true);
      expect(fails(schema, 42)).toBe(true);
    });

    it("enforces minLength", () => {
      const schema = jsonSchemaToZod({ type: "string", minLength: 3 });
      expect(passes(schema, "abc")).toBe(true);
      expect(fails(schema, "ab")).toBe(true);
    });

    it("enforces maxLength", () => {
      const schema = jsonSchemaToZod({ type: "string", maxLength: 5 });
      expect(passes(schema, "hello")).toBe(true);
      expect(fails(schema, "toolong")).toBe(true);
    });

    it("enforces pattern", () => {
      const schema = jsonSchemaToZod({ type: "string", pattern: "^[a-z]+$" });
      expect(passes(schema, "abc")).toBe(true);
      expect(fails(schema, "ABC")).toBe(true);
      expect(fails(schema, "abc1")).toBe(true);
    });

    it("enforces format: email", () => {
      const schema = jsonSchemaToZod({ type: "string", format: "email" });
      expect(passes(schema, "user@example.com")).toBe(true);
      expect(fails(schema, "not-an-email")).toBe(true);
    });

    it("enforces format: uuid", () => {
      const schema = jsonSchemaToZod({ type: "string", format: "uuid" });
      expect(passes(schema, "550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(fails(schema, "not-a-uuid")).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Number / Integer
  // ---------------------------------------------------------------------------

  describe("number type", () => {
    it("accepts a plain number", () => {
      const schema = jsonSchemaToZod({ type: "number" });
      expect(passes(schema, 3.14)).toBe(true);
      expect(fails(schema, "3.14")).toBe(true);
    });

    it("enforces minimum", () => {
      const schema = jsonSchemaToZod({ type: "number", minimum: 0 });
      expect(passes(schema, 0)).toBe(true);
      expect(fails(schema, -1)).toBe(true);
    });

    it("enforces maximum", () => {
      const schema = jsonSchemaToZod({ type: "number", maximum: 100 });
      expect(passes(schema, 100)).toBe(true);
      expect(fails(schema, 101)).toBe(true);
    });

    it("enforces exclusiveMinimum (numeric)", () => {
      const schema = jsonSchemaToZod({ type: "number", exclusiveMinimum: 0 });
      expect(passes(schema, 0.1)).toBe(true);
      expect(fails(schema, 0)).toBe(true);
    });

    it("enforces exclusiveMaximum (numeric)", () => {
      const schema = jsonSchemaToZod({ type: "number", exclusiveMaximum: 10 });
      expect(passes(schema, 9.9)).toBe(true);
      expect(fails(schema, 10)).toBe(true);
    });

    it("enforces multipleOf", () => {
      const schema = jsonSchemaToZod({ type: "number", multipleOf: 5 });
      expect(passes(schema, 10)).toBe(true);
      expect(fails(schema, 7)).toBe(true);
    });
  });

  describe("integer type", () => {
    it("rejects floats", () => {
      const schema = jsonSchemaToZod({ type: "integer" });
      expect(passes(schema, 42)).toBe(true);
      expect(fails(schema, 42.5)).toBe(true);
    });

    it("applies min/max to integers", () => {
      const schema = jsonSchemaToZod({ type: "integer", minimum: 1, maximum: 10 });
      expect(passes(schema, 5)).toBe(true);
      expect(fails(schema, 0)).toBe(true);
      expect(fails(schema, 11)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Boolean
  // ---------------------------------------------------------------------------

  describe("boolean type", () => {
    it("accepts booleans only", () => {
      const schema = jsonSchemaToZod({ type: "boolean" });
      expect(passes(schema, true)).toBe(true);
      expect(passes(schema, false)).toBe(true);
      expect(fails(schema, 1)).toBe(true);
      expect(fails(schema, "true")).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Enum
  // ---------------------------------------------------------------------------

  describe("enum", () => {
    it("accepts values in a string enum", () => {
      const schema = jsonSchemaToZod({ enum: ["red", "green", "blue"] });
      expect(passes(schema, "red")).toBe(true);
      expect(fails(schema, "yellow")).toBe(true);
    });

    it("accepts values in a mixed enum", () => {
      const schema = jsonSchemaToZod({ enum: [1, "two", true] });
      expect(passes(schema, 1)).toBe(true);
      expect(passes(schema, "two")).toBe(true);
      expect(fails(schema, 2)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Array
  // ---------------------------------------------------------------------------

  describe("array type", () => {
    it("validates items schema", () => {
      const schema = jsonSchemaToZod({
        type: "array",
        items: { type: "string" },
      });
      expect(passes(schema, ["a", "b"])).toBe(true);
      expect(fails(schema, ["a", 1])).toBe(true);
    });

    it("enforces minItems", () => {
      const schema = jsonSchemaToZod({ type: "array", items: { type: "number" }, minItems: 2 });
      expect(passes(schema, [1, 2])).toBe(true);
      expect(fails(schema, [1])).toBe(true);
    });

    it("enforces maxItems", () => {
      const schema = jsonSchemaToZod({ type: "array", items: { type: "number" }, maxItems: 3 });
      expect(passes(schema, [1, 2, 3])).toBe(true);
      expect(fails(schema, [1, 2, 3, 4])).toBe(true);
    });

    it("enforces uniqueItems", () => {
      const schema = jsonSchemaToZod({ type: "array", items: { type: "number" }, uniqueItems: true });
      expect(passes(schema, [1, 2, 3])).toBe(true);
      expect(fails(schema, [1, 2, 2])).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Object
  // ---------------------------------------------------------------------------

  describe("object type", () => {
    it("validates a nested object with required fields", () => {
      const schema = jsonSchemaToZod({
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
        },
        required: ["name", "age"],
      });
      expect(passes(schema, { name: "Alice", age: 30 })).toBe(true);
      expect(fails(schema, { name: "Alice" })).toBe(true);
      expect(fails(schema, { age: 30 })).toBe(true);
    });

    it("makes non-required fields optional", () => {
      const schema = jsonSchemaToZod({
        type: "object",
        properties: {
          required: { type: "string" },
          optional: { type: "number" },
        },
        required: ["required"],
      });
      expect(passes(schema, { required: "yes" })).toBe(true);
      expect(passes(schema, { required: "yes", optional: 42 })).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // $ref resolution
  // ---------------------------------------------------------------------------

  describe("$ref resolution", () => {
    it("resolves $ref from definitions", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          address: { $ref: "#/definitions/Address" },
        },
        required: ["address"],
        definitions: {
          Address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
            },
            required: ["street", "city"],
          },
        },
      };
      const zodSchema = jsonSchemaToZod(schema);
      expect(passes(zodSchema, { address: { street: "Main St", city: "Berlin" } })).toBe(true);
      expect(fails(zodSchema, { address: { street: "Main St" } })).toBe(true);
    });

    it("resolves $ref from $defs", () => {
      const schema: JSONSchema = {
        type: "object",
        properties: {
          tag: { $ref: "#/$defs/Tag" },
        },
        required: ["tag"],
        $defs: {
          Tag: { type: "string", minLength: 1 },
        },
      };
      const zodSchema = jsonSchemaToZod(schema);
      expect(passes(zodSchema, { tag: "urgent" })).toBe(true);
      expect(fails(zodSchema, { tag: "" })).toBe(true);
    });

    it("resolves $ref from externally supplied definitions", () => {
      const schema: JSONSchema = {
        $ref: "#/definitions/Score",
      };
      const zodSchema = jsonSchemaToZod(schema, {
        Score: { type: "integer", minimum: 0, maximum: 100 },
      });
      expect(passes(zodSchema, 50)).toBe(true);
      expect(fails(zodSchema, 101)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Nullable types
  // ---------------------------------------------------------------------------

  describe("nullable types", () => {
    it("accepts null when type is ['string','null']", () => {
      const schema = jsonSchemaToZod({ type: ["string", "null"] });
      expect(passes(schema, "hello")).toBe(true);
      expect(passes(schema, null)).toBe(true);
      expect(fails(schema, 42)).toBe(true);
    });

    it("accepts null when type is ['integer','null']", () => {
      const schema = jsonSchemaToZod({ type: ["integer", "null"] });
      expect(passes(schema, 5)).toBe(true);
      expect(passes(schema, null)).toBe(true);
      expect(fails(schema, 5.5)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Composition: oneOf / anyOf / allOf
  // ---------------------------------------------------------------------------

  describe("oneOf / anyOf unions", () => {
    it("converts oneOf to a Zod union", () => {
      const schema = jsonSchemaToZod({
        oneOf: [{ type: "string" }, { type: "number" }],
      });
      expect(passes(schema, "hello")).toBe(true);
      expect(passes(schema, 42)).toBe(true);
      expect(fails(schema, true)).toBe(true);
    });

    it("converts anyOf to a Zod union", () => {
      const schema = jsonSchemaToZod({
        anyOf: [
          { type: "string", minLength: 1 },
          { type: "integer", minimum: 0 },
        ],
      });
      expect(passes(schema, "x")).toBe(true);
      expect(passes(schema, 0)).toBe(true);
      // -1 fails the integer branch (minimum: 0) and is not a string → fails all branches
      expect(fails(schema, -1)).toBe(true);
      expect(fails(schema, true)).toBe(true);
    });
  });

  describe("allOf intersection", () => {
    it("converts allOf to a Zod intersection", () => {
      const schema = jsonSchemaToZod({
        allOf: [
          { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
          { type: "object", properties: { b: { type: "number" } }, required: ["b"] },
        ],
      });
      expect(passes(schema, { a: "hello", b: 42 })).toBe(true);
      expect(fails(schema, { a: "hello" })).toBe(true);
      expect(fails(schema, { b: 42 })).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Default values
  // ---------------------------------------------------------------------------

  describe("default values", () => {
    it("applies a default value", () => {
      const schema = jsonSchemaToZod({ type: "string", default: "world" });
      const result = schema.parse(undefined);
      expect(result).toBe("world");
    });

    it("does not apply default when value is provided", () => {
      const schema = jsonSchemaToZod({ type: "string", default: "world" });
      expect(schema.parse("hello")).toBe("hello");
    });
  });

  // ---------------------------------------------------------------------------
  // Description preservation
  // ---------------------------------------------------------------------------

  describe("description", () => {
    it("preserves description metadata", () => {
      const schema = jsonSchemaToZod({
        type: "string",
        description: "The user's name",
      });
      // In Zod v4, .description is exposed on the schema
      expect((schema as { description?: string }).description).toBe(
        "The user's name"
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Complex nested schema
  // ---------------------------------------------------------------------------

  describe("complex nested schema", () => {
    it("validates an object containing an array of objects", () => {
      const schema = jsonSchemaToZod({
        type: "object",
        properties: {
          title: { type: "string", minLength: 1 },
          tags: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
          meta: {
            type: "object",
            properties: {
              version: { type: "integer", minimum: 1 },
              enabled: { type: "boolean", default: true },
            },
            required: ["version"],
          },
        },
        required: ["title", "tags"],
      });

      expect(
        passes(schema, {
          title: "Hello",
          tags: ["a", "b"],
          meta: { version: 2 },
        })
      ).toBe(true);

      // missing required array
      expect(fails(schema, { title: "Hello" })).toBe(true);

      // array too short
      expect(fails(schema, { title: "Hello", tags: [] })).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Error case
  // ---------------------------------------------------------------------------

  describe("error handling", () => {
    it("throws on unsupported type", () => {
      expect(() =>
        jsonSchemaToZod({ type: "banana" as never })
      ).toThrow(/unsupported JSON Schema type "banana"/);
    });

    it("throws on unresolvable $ref", () => {
      expect(() =>
        jsonSchemaToZod({ $ref: "#/definitions/Missing" })
      ).toThrow(/could not be resolved/);
    });
  });
});
