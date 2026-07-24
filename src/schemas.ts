import type { JsonObject } from "@videogen/sdk";
import { z } from "zod";

/**
 * Pins a permissive, JSON-Schema-representable runtime schema to type `T`.
 * Complex request fields (remix actions, caption styles, storyboard scenes,
 * pronunciation replacements) are large unions we do not re-model field-by-field
 * in zod. `z.custom` would infer `T` but cannot be represented in JSON Schema
 * (which MCP requires), so we keep a loose object/array schema for the wire
 * format. The API still validates these fields.
 */
export function sdkFieldSchema<T>(runtimeSchema: z.ZodTypeAny, description: string): z.ZodType<T> {
  // We intentionally use an unsafe `as` assertion here because the loose runtime
  // schema exists only to produce a JSON Schema for MCP; the actual field is
  // validated by the API, and its true type is the SDK's `T`.
  return runtimeSchema.describe(description) as unknown as z.ZodType<T>;
}

const looseObject = z.record(z.string(), z.unknown());

/** Control fields shared by composite (start + poll) tools. Stripped from the request before forwarding. */
export const pollControlShape = {
  wait: z
    .boolean()
    .optional()
    .describe(
      "Whether to block until the operation reaches a terminal state (succeeded/failed/cancelled). Defaults to true. Set false to return immediately with the run/execution id.",
    ),
  pollIntervalMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("How often to poll while waiting, in milliseconds."),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum time to wait for a terminal state before giving up, in milliseconds."),
};

export const cursorField = z
  .string()
  .optional()
  .describe("Pagination cursor from a previous response's `nextCursor`.");

export const limitField = z
  .number()
  .int()
  .positive()
  .max(100)
  .optional()
  .describe("Maximum number of items to return.");

export const selfOnlyField = z
  .boolean()
  .optional()
  .describe(
    "When true, restrict results to items created by the API key owner rather than the whole team.",
  );

export const aspectRatioSchema = z
  .object({
    width: z.number().positive().describe("Aspect-ratio width (e.g. 16 for 16:9)."),
    height: z.number().positive().describe("Aspect-ratio height (e.g. 9 for 16:9)."),
  })
  .describe("Output aspect ratio as a width:height pair (e.g. { width: 16, height: 9 }).");

export const visualStyleSchema = z
  .object({
    type: z
      .enum(["STOCK", "AI_IMAGE", "ENTITY"])
      .describe(
        "STOCK pulls stock footage/images; AI_IMAGE generates a styled image per section; ENTITY matches a visual-style entity's reference images.",
      ),
    aiStyle: z
      .string()
      .optional()
      .describe(
        "Required when type is AI_IMAGE: free-form description of the look for every image.",
      ),
    entityId: z
      .string()
      .optional()
      .describe("Required when type is ENTITY: id of a VISUAL_STYLE entity (vg_enti_...)."),
    restyleFeaturedBRollWithAiStyle: z
      .boolean()
      .optional()
      .describe("When true (AI_IMAGE only), re-render featured b-roll images in the chosen style."),
  })
  .describe("Visual treatment for the generated b-roll.");

export const visualPacingSchema = z
  .enum(["FAST", "MEDIUM", "SLOW"])
  .describe("How quickly visuals change. Defaults to MEDIUM.");

export const imageQualitySchema = z
  .enum(["LOW", "STANDARD", "HIGH"])
  .describe("AI image generation quality tier. LOW is fastest/cheapest; HIGH is highest quality.");

export const watermarkModeSchema = z
  .enum(["NONE", "VIDEO_GEN", "AUTO"])
  .describe("Whether to apply a VideoGen watermark to the output.");

export const remixActionsSchema = sdkFieldSchema<unknown[]>(
  z.array(looseObject),
  "Edits applied to the project, each an object with a `type`: SET_BACKGROUND_MUSIC, SET_LOGO, ENABLE_CAPTIONS, DISABLE_CAPTIONS, ADD_TRANSITIONS, RESIZE_PROJECT, CLEAN_UP_TRANSCRIPT, or CONVERT_IMAGES_TO_VIDEOS (plus that action's own fields). Provide at least two for a polished result, e.g. [{ type: 'ENABLE_CAPTIONS' }, { type: 'SET_BACKGROUND_MUSIC' }].",
);

export const captionStyleSchema = sdkFieldSchema<JsonObject | null>(
  looseObject.nullable(),
  "Caption style overrides object, or null to hide captions. Omit for the default caption style.",
);
