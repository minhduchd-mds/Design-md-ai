/**
 * jsonSchemaToZod — Runtime JSON Schema → Zod schema converter
 *
 * Converts a JSON Schema object to a Zod v4 schema at runtime.
 * Inspired by n8n's @n8n/json-schema-to-zod package.
 *
 * Supports:
 *   - Primitive types: string, number, integer, boolean, null
 *   - Compound types: array, object
 *   - Composition: enum, oneOf, anyOf, allOf
 *   - References: $ref (local #/definitions/Name and #/$defs/Name)
 *   - Modifiers: default, description, nullable type arrays
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface JSONSchema {
  $schema?: string;
  $ref?: string;
  $defs?: Record<string, JSONSchema>;
  definitions?: Record<string, JSONSchema>;

  type?: string | string[];
  enum?: unknown[];
  const?: unknown;

  // String
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;

  // Number
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;

  // Array
  items?: JSONSchema | JSONSchema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // Object
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: JSONSchema | boolean;

  // Composition
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];

  // Meta
  description?: string;
  default?: unknown;
  nullable?: boolean;

  // Allow extra vendor-specific keys
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ConversionContext {
  definitions: Record<string, JSONSchema>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveRef(ref: string, ctx: ConversionContext): z.ZodType {
  if (!ref.startsWith("#")) {
    throw new Error(
      `jsonSchemaToZod: only local $ref values are supported (got "${ref}")`
    );
  }

  // Support both "#/definitions/Name" and "#/$defs/Name"
  const defsMatch = ref.match(/^#\/(?:definitions|\$defs)\/(.+)$/);
  if (!defsMatch) {
    throw new Error(
      `jsonSchemaToZod: unsupported $ref format "${ref}". Expected "#/definitions/Name" or "#/$defs/Name"`
    );
  }

  const name = defsMatch[1];
  const def = ctx.definitions[name];
  if (!def) {
    throw new Error(
      `jsonSchemaToZod: $ref "${ref}" could not be resolved — definition "${name}" not found`
    );
  }

  return convertSchema(def, ctx);
}

function applyMeta(schema: z.ZodType, jsonSchema: JSONSchema): z.ZodType {
  let result: z.ZodType = schema;

  if (typeof jsonSchema.description === "string") {
    result = result.describe(jsonSchema.description);
  }

  if (jsonSchema.default !== undefined) {
    // z.ZodDefault wraps the schema — cast is safe here
    result = (result as z.ZodType).default(
      jsonSchema.default as never
    ) as unknown as z.ZodType;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Type converters
// ---------------------------------------------------------------------------

function convertString(schema: JSONSchema): z.ZodType {
  let result: z.ZodString = z.string();

  if (typeof schema.minLength === "number") {
    result = result.min(schema.minLength);
  }
  if (typeof schema.maxLength === "number") {
    result = result.max(schema.maxLength);
  }
  if (typeof schema.pattern === "string") {
    result = result.regex(new RegExp(schema.pattern));
  }

  // format shortcuts — use deprecated chaining API (still valid in Zod v4)
  if (typeof schema.format === "string") {
    switch (schema.format) {
      case "email":
        result = result.email();
        break;
      case "uri":
      case "url":
        result = result.url();
        break;
      case "uuid":
        result = result.uuid();
        break;
      // other formats fall through without constraint
    }
  }

  // enum on a string type → z.enum
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const values = schema.enum as [string, ...string[]];
    return z.enum(values);
  }

  return result;
}

function convertNumber(schema: JSONSchema, isInteger = false): z.ZodType {
  let result: z.ZodNumber = z.number();

  if (isInteger) {
    // .int() is available on ZodNumber (legacy API, but stable in v4)
    result = result.int();
  }

  if (typeof schema.minimum === "number") {
    result = result.min(schema.minimum);
  }
  if (typeof schema.maximum === "number") {
    result = result.max(schema.maximum);
  }
  if (typeof schema.exclusiveMinimum === "number") {
    result = result.gt(schema.exclusiveMinimum);
  }
  if (typeof schema.exclusiveMaximum === "number") {
    result = result.lt(schema.exclusiveMaximum);
  }
  if (typeof schema.multipleOf === "number") {
    result = result.multipleOf(schema.multipleOf);
  }

  return result;
}

function convertArray(schema: JSONSchema, ctx: ConversionContext): z.ZodType {
  // items may be a schema or an array of schemas (tuple mode)
  let itemSchema: z.ZodType;
  if (schema.items && !Array.isArray(schema.items)) {
    itemSchema = convertSchema(schema.items, ctx);
  } else {
    // No items or tuple items: fall back to unknown
    itemSchema = z.unknown();
  }

  let result: z.ZodArray<z.ZodType> = z.array(itemSchema);

  if (typeof schema.minItems === "number") {
    result = result.min(schema.minItems);
  }
  if (typeof schema.maxItems === "number") {
    result = result.max(schema.maxItems);
  }

  if (schema.uniqueItems === true) {
    return result.refine(
      (arr) => new Set(arr.map((v) => JSON.stringify(v))).size === arr.length,
      { message: "Array items must be unique" }
    );
  }

  return result;
}

function convertObject(schema: JSONSchema, ctx: ConversionContext): z.ZodType {
  const shape: Record<string, z.ZodType> = {};
  const required = new Set(schema.required ?? []);

  for (const [key, propSchema] of Object.entries(schema.properties ?? {})) {
    let fieldSchema = convertSchema(propSchema, ctx);
    if (!required.has(key)) {
      fieldSchema = fieldSchema.optional();
    }
    shape[key] = fieldSchema;
  }

  return z.object(shape);
}

function convertEnum(values: unknown[]): z.ZodType {
  if (values.length === 0) {
    return z.never();
  }
  if (values.length === 1) {
    return z.literal(values[0] as string | number | boolean);
  }

  // Check if all values are strings — use z.enum for string enums
  const allStrings = values.every((v) => typeof v === "string");
  if (allStrings) {
    return z.enum(values as [string, ...string[]]);
  }

  // Mixed types → z.union of literals
  const [first, ...rest] = values;
  const firstSchema = z.literal(first as string | number | boolean);
  if (rest.length === 0) return firstSchema;

  const restSchemas = rest.map((v) =>
    z.literal(v as string | number | boolean)
  );
  const allSchemas = [firstSchema, ...restSchemas] as unknown as [
    z.ZodType,
    z.ZodType,
    ...z.ZodType[],
  ];
  return z.union(allSchemas);
}

function convertUnion(schemas: JSONSchema[], ctx: ConversionContext): z.ZodType {
  if (schemas.length === 0) {
    return z.never();
  }
  if (schemas.length === 1) {
    return convertSchema(schemas[0], ctx);
  }

  const [first, second, ...rest] = schemas.map((s) => convertSchema(s, ctx));
  return z.union([first, second, ...rest] as [
    z.ZodType,
    z.ZodType,
    ...z.ZodType[],
  ]);
}

function convertIntersection(
  schemas: JSONSchema[],
  ctx: ConversionContext
): z.ZodType {
  if (schemas.length === 0) {
    return z.unknown();
  }
  if (schemas.length === 1) {
    return convertSchema(schemas[0], ctx);
  }

  // Chain intersections: A & B & C = (A & B) & C
  const [first, ...rest] = schemas.map((s) => convertSchema(s, ctx));
  return rest.reduce(
    (acc, next) => acc.and(next),
    first
  );
}

// ---------------------------------------------------------------------------
// Nullable type-array helper
// ---------------------------------------------------------------------------

/**
 * When `type` is `["string", "null"]` or similar, strip "null" from the list
 * and make the result nullable.
 */
function convertTypeArray(
  types: string[],
  schema: JSONSchema,
  ctx: ConversionContext
): z.ZodType {
  const nonNullTypes = types.filter((t) => t !== "null");
  const hasNull = types.includes("null");

  let base: z.ZodType;
  if (nonNullTypes.length === 0) {
    base = z.null();
  } else if (nonNullTypes.length === 1) {
    base = convertSingleType(nonNullTypes[0], schema, ctx);
  } else {
    // Multiple non-null types → union
    const [first, second, ...rest] = nonNullTypes.map((t) =>
      convertSingleType(t, schema, ctx)
    );
    base = z.union([first, second, ...rest] as [
      z.ZodType,
      z.ZodType,
      ...z.ZodType[],
    ]);
  }

  return hasNull ? base.nullable() : base;
}

function convertSingleType(
  type: string,
  schema: JSONSchema,
  ctx: ConversionContext
): z.ZodType {
  switch (type) {
    case "string":
      return convertString(schema);
    case "number":
      return convertNumber(schema, false);
    case "integer":
      return convertNumber(schema, true);
    case "boolean":
      return z.boolean();
    case "null":
      return z.null();
    case "array":
      return convertArray(schema, ctx);
    case "object":
      return convertObject(schema, ctx);
    default:
      throw new Error(
        `jsonSchemaToZod: unsupported JSON Schema type "${type}"`
      );
  }
}

// ---------------------------------------------------------------------------
// Core conversion
// ---------------------------------------------------------------------------

function convertSchema(schema: JSONSchema, ctx: ConversionContext): z.ZodType {
  // ── $ref ──────────────────────────────────────────────────────────────────
  if (schema.$ref) {
    return resolveRef(schema.$ref, ctx);
  }

  // ── enum (top-level) ──────────────────────────────────────────────────────
  if (Array.isArray(schema.enum)) {
    return applyMeta(convertEnum(schema.enum), schema);
  }

  // ── const ─────────────────────────────────────────────────────────────────
  if (schema.const !== undefined) {
    return applyMeta(
      z.literal(schema.const as string | number | boolean),
      schema
    );
  }

  // ── Composition keywords ──────────────────────────────────────────────────
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return applyMeta(convertUnion(schema.oneOf, ctx), schema);
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return applyMeta(convertUnion(schema.anyOf, ctx), schema);
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return applyMeta(convertIntersection(schema.allOf, ctx), schema);
  }

  // ── type ──────────────────────────────────────────────────────────────────
  if (schema.type === undefined) {
    // No type info at all → unknown
    return applyMeta(z.unknown(), schema);
  }

  let base: z.ZodType;

  if (Array.isArray(schema.type)) {
    base = convertTypeArray(schema.type, schema, ctx);
  } else {
    base = convertSingleType(schema.type, schema, ctx);
  }

  // OpenAPI-style `nullable: true`
  if (schema.nullable === true && schema.type !== "null") {
    base = base.nullable();
  }

  return applyMeta(base, schema);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a JSON Schema object to a Zod v4 schema at runtime.
 *
 * @param schema      The root JSON Schema to convert.
 * @param definitions Optional map of reusable definitions (merged with any
 *                    `definitions` / `$defs` embedded in the schema itself).
 *
 * @example
 * ```ts
 * const schema = jsonSchemaToZod({
 *   type: "object",
 *   properties: { name: { type: "string", minLength: 1 } },
 *   required: ["name"],
 * });
 * schema.parse({ name: "Alice" }); // OK
 * ```
 */
export function jsonSchemaToZod(
  schema: JSONSchema,
  definitions?: Record<string, JSONSchema>
): z.ZodType {
  // Merge caller-supplied definitions with embedded $defs / definitions
  const ctx: ConversionContext = {
    definitions: {
      ...schema.definitions,
      ...schema.$defs,
      ...definitions,
    },
  };

  return convertSchema(schema, ctx);
}
