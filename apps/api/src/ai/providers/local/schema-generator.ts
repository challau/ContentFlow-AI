import type { Brief } from './brief';
import { writeString } from './phrases';
import { Rng } from './rng';

/**
 * The subset of JSON Schema the agent contracts actually emit. Typed narrowly
 * rather than as `any` so a typo in a keyword is a compile error.
 */
interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  maxLength?: number;
  pattern?: string;
}

interface WalkOptions {
  brief: Brief;
  rng: Rng;
  /** Property name owning this node, used to pick a phrase writer. */
  key: string;
  index: number;
  depth: number;
}

const MAX_DEPTH = 12;

/** Arrays that carry at most one entry per platform. */
const ONE_PER_PLATFORM = new Set([
  'recommendedPlatforms',
  'engagementForecast',
  'hashtagsByPlatform',
]);

/**
 * Produces a value that satisfies `schema`, using the brief to keep strings
 * on-topic. Every constraint the agent contracts rely on is honoured:
 * enums, minItems, numeric bounds, integer-ness, maxLength and patterns.
 */
export function generateFromSchema(schema: JsonSchema, opts: WalkOptions): unknown {
  if (opts.depth > MAX_DEPTH) return null;
  if (!schema || typeof schema !== 'object') return null;

  const enumValues = schema.enum;
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    // Platform choices must reflect what the brief asked for, and cycle by
    // index so a list of platforms comes out varied instead of repeating.
    if (opts.key === 'platform' && opts.brief.platforms.length > 0) {
      const allowed = opts.brief.platforms.filter((p) => enumValues.includes(p));
      if (allowed.length > 0) {
        return allowed[opts.index % allowed.length];
      }
    }
    return opts.rng.pick(enumValues);
  }
  if (schema.const !== undefined) return schema.const;

  // Zod emits optionals and unions as anyOf; take the first concrete branch.
  const branches = schema.anyOf ?? schema.oneOf;
  if (Array.isArray(branches) && branches.length > 0) {
    const concrete = branches.find((b: JsonSchema) => b && b.type !== 'null') ?? branches[0];
    return generateFromSchema(concrete, opts);
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return schema.allOf.reduce<Record<string, unknown>>((acc, part: JsonSchema) => {
      const value = generateFromSchema(part, opts);
      return value && typeof value === 'object' ? { ...acc, ...(value as object) } : acc;
    }, {});
  }

  const type = Array.isArray(schema.type) ? schema.type.find((t: string) => t !== 'null') : schema.type;

  switch (type) {
    case 'object':
      return generateObject(schema, opts);
    case 'array':
      return generateArray(schema, opts);
    case 'string':
      return writeString(
        { brief: opts.brief, rng: opts.rng, key: opts.key, index: opts.index },
        { maxLength: schema.maxLength, pattern: schema.pattern },
      );
    case 'integer':
      return generateNumber(schema, opts, true);
    case 'number':
      return generateNumber(schema, opts, false);
    case 'boolean':
      return opts.rng.bool(0.7);
    case 'null':
      return null;
    default:
      // Untyped node: infer from presence of `properties`/`items`.
      if (schema.properties) return generateObject(schema, opts);
      if (schema.items) return generateArray(schema, opts);
      return writeString(
        { brief: opts.brief, rng: opts.rng, key: opts.key, index: opts.index },
        {},
      );
  }
}

function generateObject(schema: JsonSchema, opts: WalkOptions): Record<string, unknown> {
  const properties: Record<string, JsonSchema> = schema.properties ?? {};
  const required: string[] = Array.isArray(schema.required) ? schema.required : [];
  const out: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(properties)) {
    // Optional fields are included most of the time so output looks complete,
    // but not always, which keeps consumers honest about optionality.
    const isRequired = required.includes(key);
    if (!isRequired && !opts.rng.bool(0.85)) continue;

    out[key] = generateFromSchema(child, {
      ...opts,
      key,
      depth: opts.depth + 1,
    });
  }
  return out;
}

function generateArray(schema: JsonSchema, opts: WalkOptions): unknown[] {
  const items: JsonSchema = schema.items ?? {};
  const declaredMin = typeof schema.minItems === 'number' ? schema.minItems : 0;
  // A contract minimum of 1 usually means "at least one", not "one is enough",
  // so generate a realistic set rather than the bare minimum.
  const floor = Math.max(declaredMin, opts.key === 'items' ? 8 : 3);
  const ceiling =
    typeof schema.maxItems === 'number' ? Math.max(declaredMin, schema.maxItems) : floor + 3;
  let count = Math.max(declaredMin, opts.rng.int(Math.min(floor, ceiling), ceiling));

  // One-entry-per-platform lists must not repeat a platform.
  if (ONE_PER_PLATFORM.has(opts.key) && opts.brief.platforms.length > 0) {
    count = Math.max(declaredMin, Math.min(count, opts.brief.platforms.length));
  }

  const out: unknown[] = [];
  for (let i = 0; i < count; i++) {
    out.push(
      generateFromSchema(items, {
        ...opts,
        index: i,
        depth: opts.depth + 1,
      }),
    );
  }

  return normalizePercentages(out);
}

/**
 * Contracts express "these must sum to 100" in prose rather than in the schema,
 * so rescale any sibling set carrying a `percentage` field.
 */
function normalizePercentages(items: unknown[]): unknown[] {
  const records = items.filter(
    (i): i is Record<string, unknown> =>
      typeof i === 'object' &&
      i !== null &&
      typeof (i as Record<string, unknown>).percentage === 'number',
  );
  if (records.length === 0 || records.length !== items.length) return items;

  const total = records.reduce((n, r) => n + (r.percentage as number), 0);
  if (total <= 0) return items;

  let running = 0;
  records.forEach((record, idx) => {
    if (idx === records.length - 1) {
      record.percentage = Number((100 - running).toFixed(2));
    } else {
      const share = Number((((record.percentage as number) / total) * 100).toFixed(2));
      record.percentage = share;
      running += share;
    }
  });
  return items;
}

function generateNumber(schema: JsonSchema, opts: WalkOptions, integer: boolean): number {
  const explicitMin = schema.minimum ?? schema.exclusiveMinimum;
  const explicitMax = schema.maximum ?? schema.exclusiveMaximum;

  // Sensible defaults per field so generated numbers read plausibly.
  const key = opts.key.toLowerCase();
  let min = typeof explicitMin === 'number' ? explicitMin : 1;
  let max = typeof explicitMax === 'number' ? explicitMax : 12;

  if (key.includes('score')) {
    min = Math.max(min, 72);
    max = Math.min(max, 96);
  } else if (key.includes('percentage')) {
    min = Math.max(min, 15);
    max = Math.min(max, 35);
  } else if (key.includes('duration') && key.includes('second')) {
    min = Math.max(min, 20);
    max = Math.min(Math.max(max, min + 10), 180);
  } else if (key.includes('charactercount')) {
    min = Math.max(min, 180);
    max = Math.max(min + 50, Math.min(max, 900));
  } else if (key === 'dayoffset') {
    min = Math.max(min, 0);
    max = Math.min(Math.max(max, 1), 21);
  } else if (key.includes('day')) {
    min = Math.max(min, 14);
    max = Math.min(Math.max(max, min + 1), 45);
  } else if (key === 'index' || key === 'scene') {
    return Math.max(min, opts.index + 1);
  }

  if (max < min) max = min;
  const value = min + opts.rng.float() * (max - min);
  return integer ? Math.round(value) : Number(value.toFixed(2));
}

export function generateForSchema(schema: JsonSchema, brief: Brief, seed: string): unknown {
  return generateFromSchema(schema, {
    brief,
    rng: new Rng(seed),
    key: 'root',
    index: 0,
    depth: 0,
  });
}
