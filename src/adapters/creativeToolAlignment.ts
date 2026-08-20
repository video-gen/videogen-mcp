import type {
  ExportProjectRequest,
  GenerateAvatarRequest,
  GenerateImageRequest,
  GenerateMotionGraphicRequest,
  GenerateMusicRequest,
  GenerateSoundEffectRequest,
  GenerateVideoClipRequest,
  ImageAssetRequest,
  PromptToVideoClipRequest,
  RemixProjectRequest,
  ScriptToVideoRequest,
  SlideshowToVideoRequest,
  StoryboardToVideoRequest,
  TextToSpeechRequest,
  VideoAssetRequest,
  VoiceoverToVideoRequest,
} from "@videogen/sdk";
import type { z } from "zod";
import {
  exportProjectInputSchema,
  generateAvatarInputSchema,
  generateImageInputSchema,
  generateMotionGraphicInputSchema,
  generateMusicInputSchema,
  generateSoundEffectInputSchema,
  generateVideoClipInputSchema,
  image3dEffectInputSchema,
  promptToVideoClipInputSchema,
  remixProjectInputSchema,
  removeImageBackgroundInputSchema,
  removeVideoBackgroundInputSchema,
  scriptToVideoInputSchema,
  slideshowToVideoInputSchema,
  storyboardToVideoInputSchema,
  textToSpeechInputSchema,
  upscaleImageInputSchema,
  upscaleVideoInputSchema,
  vectorizeImageInputSchema,
  voiceoverToVideoInputSchema,
  type RemixEdit,
} from "./creativeToolContracts";

/**
 * Compile-time check: every key the MCP schema accepts must exist on the SDK
 * request type (or on an explicit alias overlay). Path ids that live on the URL
 * rather than the body are added via `& { projectId: string }`. Invented MCP
 * field names fail typecheck here instead of shipping a ChatGPT schema ChatGPT
 * cannot round-trip against the live API.
 */
type AssertMcpKeysSubsetOfSdk<TMcp, TSdk> =
  Exclude<keyof TMcp, keyof TSdk> extends never ? true : Exclude<keyof TMcp, keyof TSdk>;

const assertTrue = <T extends true>(_value: T): void => {
  // Type-only assertion; referenced so the checks are not tree-shaken as unused.
};

type ScriptToVideoMcpSdkView = Omit<ScriptToVideoRequest, "visualStyle"> & {
  style?: string;
};

type VoiceoverToVideoMcpSdkView = Omit<VoiceoverToVideoRequest, "visualStyle"> & {
  style?: string;
};

type StoryboardToVideoMcpSdkView = Omit<StoryboardToVideoRequest, "defaultGeneration"> & {
  style?: string;
};

type TextToSpeechMcpSdkView = Omit<
  TextToSpeechRequest,
  "ttsText" | "speechLanguageCode" | "voiceSpeed"
> & {
  text: string;
  language?: string | null;
  speed?: number;
};

type ExportProjectMcpSdkView = ExportProjectRequest & { projectId: string };

type RemixProjectMcpSdkView = Omit<RemixProjectRequest, "remixActions"> & {
  projectId: string;
  edits: RemixEdit[];
};

assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof scriptToVideoInputSchema>, ScriptToVideoMcpSdkView>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<
    z.output<typeof voiceoverToVideoInputSchema>,
    VoiceoverToVideoMcpSdkView
  >
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof slideshowToVideoInputSchema>, SlideshowToVideoRequest>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<
    z.output<typeof storyboardToVideoInputSchema>,
    StoryboardToVideoMcpSdkView
  >
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof promptToVideoClipInputSchema>, PromptToVideoClipRequest>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof generateImageInputSchema>, GenerateImageRequest>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof generateVideoClipInputSchema>, GenerateVideoClipRequest>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof textToSpeechInputSchema>, TextToSpeechMcpSdkView>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<
    z.output<typeof generateSoundEffectInputSchema>,
    GenerateSoundEffectRequest
  >
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof generateMusicInputSchema>, GenerateMusicRequest>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<
    z.output<typeof generateMotionGraphicInputSchema>,
    GenerateMotionGraphicRequest
  >
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof generateAvatarInputSchema>, GenerateAvatarRequest>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof vectorizeImageInputSchema>, ImageAssetRequest>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof removeImageBackgroundInputSchema>, ImageAssetRequest>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof removeVideoBackgroundInputSchema>, VideoAssetRequest>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof upscaleImageInputSchema>, ImageAssetRequest>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof upscaleVideoInputSchema>, VideoAssetRequest>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof image3dEffectInputSchema>, ImageAssetRequest>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof exportProjectInputSchema>, ExportProjectMcpSdkView>
>(true);
assertTrue<
  AssertMcpKeysSubsetOfSdk<z.output<typeof remixProjectInputSchema>, RemixProjectMcpSdkView>
>(true);

export type CreativeToolOpenApiContract = {
  toolName: string;
  openApiSchemaName: string;
  /** MCP field name → OpenAPI body field name when MCP uses a simplified alias. */
  fieldAliases: Record<string, string>;
  /**
   * MCP fields that are not OpenAPI request-body properties (path ids, or
   * adapter-only names already listed in `fieldAliases`).
   */
  mcpOnlyFields: readonly string[];
};

/**
 * Every creative MCP tool that wraps a developer-API request body. Advertised
 * `tools/list` properties must resolve to an OpenAPI body field, a declared
 * alias, or an explicit MCP-only path param.
 */
export const CREATIVE_TOOL_OPENAPI_CONTRACTS: readonly CreativeToolOpenApiContract[] = [
  {
    toolName: "script_to_video",
    openApiSchemaName: "ScriptToVideoRequest",
    fieldAliases: { style: "visualStyle" },
    mcpOnlyFields: [],
  },
  {
    toolName: "voiceover_to_video",
    openApiSchemaName: "VoiceoverToVideoRequest",
    fieldAliases: { style: "visualStyle" },
    mcpOnlyFields: [],
  },
  {
    toolName: "slideshow_to_video",
    openApiSchemaName: "SlideshowToVideoRequest",
    fieldAliases: {},
    mcpOnlyFields: [],
  },
  {
    toolName: "storyboard_to_video",
    openApiSchemaName: "StoryboardToVideoRequest",
    fieldAliases: { style: "defaultGeneration" },
    mcpOnlyFields: [],
  },
  {
    toolName: "prompt_to_video_clip",
    openApiSchemaName: "PromptToVideoClipRequest",
    fieldAliases: {},
    mcpOnlyFields: [],
  },
  {
    toolName: "generate_image",
    openApiSchemaName: "GenerateImageRequest",
    fieldAliases: {},
    mcpOnlyFields: [],
  },
  {
    toolName: "generate_video_clip",
    openApiSchemaName: "GenerateVideoClipRequest",
    fieldAliases: {},
    mcpOnlyFields: [],
  },
  {
    toolName: "text_to_speech",
    openApiSchemaName: "TextToSpeechRequest",
    fieldAliases: {
      text: "ttsText",
      language: "speechLanguageCode",
      speed: "voiceSpeed",
    },
    mcpOnlyFields: [],
  },
  {
    toolName: "generate_sound_effect",
    openApiSchemaName: "GenerateSoundEffectRequest",
    fieldAliases: {},
    mcpOnlyFields: [],
  },
  {
    toolName: "generate_music",
    openApiSchemaName: "GenerateMusicRequest",
    fieldAliases: {},
    mcpOnlyFields: [],
  },
  {
    toolName: "generate_motion_graphic",
    openApiSchemaName: "GenerateMotionGraphicRequest",
    fieldAliases: {},
    mcpOnlyFields: [],
  },
  {
    toolName: "generate_avatar",
    openApiSchemaName: "GenerateAvatarRequest",
    fieldAliases: {},
    mcpOnlyFields: [],
  },
  {
    toolName: "vectorize_image",
    openApiSchemaName: "ImageAssetRequest",
    fieldAliases: {},
    mcpOnlyFields: [],
  },
  {
    toolName: "remove_image_background",
    openApiSchemaName: "ImageAssetRequest",
    fieldAliases: {},
    mcpOnlyFields: [],
  },
  {
    toolName: "remove_video_background",
    openApiSchemaName: "VideoAssetRequest",
    fieldAliases: {},
    mcpOnlyFields: [],
  },
  {
    toolName: "upscale_image",
    openApiSchemaName: "ImageAssetRequest",
    fieldAliases: {},
    mcpOnlyFields: [],
  },
  {
    toolName: "upscale_video",
    openApiSchemaName: "VideoAssetRequest",
    fieldAliases: {},
    mcpOnlyFields: [],
  },
  {
    toolName: "image_3d_effect",
    openApiSchemaName: "ImageAssetRequest",
    fieldAliases: {},
    mcpOnlyFields: [],
  },
  {
    toolName: "export_project",
    openApiSchemaName: "ExportProjectRequest",
    fieldAliases: {},
    mcpOnlyFields: ["projectId"],
  },
  {
    toolName: "remix_project",
    openApiSchemaName: "RemixProjectRequest",
    fieldAliases: { edits: "remixActions" },
    mcpOnlyFields: ["projectId"],
  },
];

const getIsRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === "object" && !Array.isArray(value);
};

const readSchemaProperties = (schema: unknown): Record<string, unknown> => {
  if (!getIsRecord(schema)) {
    return {};
  }

  const properties = schema.properties;
  if (!getIsRecord(properties)) {
    return {};
  }

  return properties;
};

const readItemsSchema = (schema: unknown): unknown => {
  if (!getIsRecord(schema)) {
    return null;
  }

  return schema.items ?? null;
};

const collectUnknownFields = ({
  advertisedProperties,
  openApiProperties,
  fieldAliases,
  mcpOnlyFields,
  path,
}: {
  advertisedProperties: Record<string, unknown>;
  openApiProperties: Record<string, unknown>;
  fieldAliases: Record<string, string>;
  mcpOnlyFields: ReadonlySet<string>;
  path: string;
}): string[] => {
  const issues: string[] = [];

  for (const [mcpField, advertisedSchema] of Object.entries(advertisedProperties)) {
    if (mcpOnlyFields.has(mcpField) || fieldAliases[mcpField] != null) {
      continue;
    }

    const openApiSchema = openApiProperties[mcpField];
    if (openApiSchema == null) {
      issues.push(`${path}.${mcpField} is advertised on MCP but missing from the OpenAPI request`);
      continue;
    }

    const nestedAdvertised = readSchemaProperties(advertisedSchema);
    const nestedOpenApi = readSchemaProperties(openApiSchema);
    if (Object.keys(nestedAdvertised).length > 0 && Object.keys(nestedOpenApi).length > 0) {
      issues.push(
        ...collectUnknownFields({
          advertisedProperties: nestedAdvertised,
          openApiProperties: nestedOpenApi,
          fieldAliases: {},
          mcpOnlyFields: new Set(),
          path: `${path}.${mcpField}`,
        }),
      );
    }

    const advertisedItems = readItemsSchema(advertisedSchema);
    const openApiItems = readItemsSchema(openApiSchema);
    const nestedAdvertisedItems = readSchemaProperties(advertisedItems);
    const nestedOpenApiItems = readSchemaProperties(openApiItems);
    if (
      Object.keys(nestedAdvertisedItems).length > 0 &&
      Object.keys(nestedOpenApiItems).length > 0
    ) {
      issues.push(
        ...collectUnknownFields({
          advertisedProperties: nestedAdvertisedItems,
          openApiProperties: nestedOpenApiItems,
          fieldAliases: {},
          mcpOnlyFields: new Set(),
          path: `${path}.${mcpField}[]`,
        }),
      );
    }
  }

  return issues;
};

/**
 * Returns human-readable issues when an MCP `tools/list` input schema advertises
 * a field that is not on the matching OpenAPI request (and is not a declared
 * alias or MCP-only path param).
 */
export function collectCreativeToolOpenApiAlignmentIssues({
  tools,
  openApiComponentSchemas,
}: {
  tools: ReadonlyArray<{ name: string; inputSchema?: unknown }>;
  openApiComponentSchemas: unknown;
}): string[] {
  if (!getIsRecord(openApiComponentSchemas)) {
    return ["OpenAPI component schemas payload is not an object"];
  }
  const issues: string[] = [];
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));

  for (const contract of CREATIVE_TOOL_OPENAPI_CONTRACTS) {
    const tool = toolsByName.get(contract.toolName);
    if (tool == null) {
      issues.push(`MCP tool ${contract.toolName} is missing from tools/list`);
      continue;
    }

    const openApiSchema = openApiComponentSchemas[contract.openApiSchemaName];
    if (openApiSchema == null) {
      issues.push(
        `OpenAPI schema ${contract.openApiSchemaName} is missing for ${contract.toolName}`,
      );
      continue;
    }

    const advertisedProperties = readSchemaProperties(tool.inputSchema);
    const openApiProperties = readSchemaProperties(openApiSchema);
    const mcpOnlyFields = new Set(contract.mcpOnlyFields);

    for (const [mcpField, openApiField] of Object.entries(contract.fieldAliases)) {
      if (advertisedProperties[mcpField] == null) {
        issues.push(
          `${contract.toolName} alias ${mcpField} → ${openApiField} is not advertised on MCP`,
        );
        continue;
      }

      if (openApiProperties[openApiField] == null) {
        issues.push(
          `${contract.toolName} alias ${mcpField} → ${openApiField} is missing from OpenAPI`,
        );
      }
    }

    issues.push(
      ...collectUnknownFields({
        advertisedProperties,
        openApiProperties,
        fieldAliases: contract.fieldAliases,
        mcpOnlyFields,
        path: contract.toolName,
      }),
    );
  }

  return issues;
}
