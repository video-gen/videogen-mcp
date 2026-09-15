import type {
  PromptToVideoClipRequest,
  ScriptToVideoRequest,
  SlideshowToVideoRequest,
  StoryboardToVideoRequest,
  VoiceoverToVideoRequest,
} from "@videogen/sdk";
import { z } from "zod";
import {
  DEFAULT_MCP_AI_STYLE,
  promptToVideoClipInputSchema,
  scriptToVideoInputSchema,
  slideshowToVideoInputSchema,
  storyboardToVideoInputSchema,
  voiceoverToVideoInputSchema,
} from "./creativeToolContracts";
import { styleToVisualStyle } from "./creativeToolMappings";

type ScriptToVideoInput = z.infer<typeof scriptToVideoInputSchema>;
type VoiceoverToVideoInput = z.infer<typeof voiceoverToVideoInputSchema>;
type SlideshowToVideoInput = z.infer<typeof slideshowToVideoInputSchema>;
type StoryboardToVideoInput = z.infer<typeof storyboardToVideoInputSchema>;
type PromptToVideoClipInput = z.infer<typeof promptToVideoClipInputSchema>;

const mcpWorkflowDefaults = {
  isOutputTemporary: false as const,
  // Keep generated files on the dashboard. MCP users make one-off projects and
  // expect them to appear in the app. Hiding from the UI is opt-in on the API.
  hideFromUi: false as const,
};

const mcpAutoExportFields = ({
  autoExport,
}: {
  autoExport: boolean | undefined;
}): {
  autoExport: boolean;
  exportOptions?: { watermarkMode: "AUTO"; endScreenMode: "AUTO" };
} => {
  const shouldAutoExport = autoExport ?? true;

  if (!shouldAutoExport) {
    return { autoExport: false };
  }

  return {
    autoExport: true,
    exportOptions: {
      watermarkMode: "AUTO",
      endScreenMode: "AUTO",
    },
  };
};

export function toScriptToVideoRequest(input: ScriptToVideoInput): ScriptToVideoRequest {
  return {
    script: input.script,
    visualStyle: styleToVisualStyle({ style: input.style }),
    ...mcpWorkflowDefaults,
    ...mcpAutoExportFields({ autoExport: input.autoExport }),
    ...(input.aspectRatio != null && { aspectRatio: input.aspectRatio }),
    ...(input.quality != null && { quality: input.quality }),
    ...(input.language != null && { language: input.language }),
    ...(input.voiceId != null && { voiceId: input.voiceId }),
    ...(input.actorEntityId != null && { actorEntityId: input.actorEntityId }),
    ...(input.avatarQuality != null && { avatarQuality: input.avatarQuality }),
  };
}

export function toVoiceoverToVideoRequest(
  input: VoiceoverToVideoInput,
): VoiceoverToVideoRequest {
  return {
    fileId: input.fileId,
    visualStyle: styleToVisualStyle({ style: input.style }),
    ...mcpWorkflowDefaults,
    ...mcpAutoExportFields({ autoExport: input.autoExport }),
    ...(input.aspectRatio != null && { aspectRatio: input.aspectRatio }),
    ...(input.quality != null && { quality: input.quality }),
    ...(input.language != null && { language: input.language }),
  };
}

export function toSlideshowToVideoRequest(
  input: SlideshowToVideoInput,
): SlideshowToVideoRequest {
  return {
    fileId: input.fileId,
    ...mcpWorkflowDefaults,
    ...mcpAutoExportFields({ autoExport: input.autoExport }),
    ...(input.slideScripts != null && { slideScripts: input.slideScripts }),
    ...(input.aspectRatio != null && { aspectRatio: input.aspectRatio }),
    ...(input.language != null && { language: input.language }),
    ...(input.voiceId != null && { voiceId: input.voiceId }),
    ...(input.actorEntityId != null && { actorEntityId: input.actorEntityId }),
    ...(input.avatarQuality != null && { avatarQuality: input.avatarQuality }),
    ...(input.slideshowThemeEntityId != null && {
      slideshowThemeEntityId: input.slideshowThemeEntityId,
    }),
  };
}

export function toStoryboardToVideoRequest(
  input: StoryboardToVideoInput,
): StoryboardToVideoRequest {
  return {
    scenes: input.scenes.map((scene) => ({
      prompt: scene.prompt,
      ...(scene.voiceoverScript != null && { voiceoverScript: scene.voiceoverScript }),
      ...(scene.title != null && { title: scene.title }),
      ...(scene.durationSeconds != null && { durationSeconds: scene.durationSeconds }),
    })),
    defaultGeneration: { aiStyle: input.style ?? DEFAULT_MCP_AI_STYLE },
    ...mcpWorkflowDefaults,
    ...mcpAutoExportFields({ autoExport: input.autoExport }),
    ...(input.aspectRatio != null && { aspectRatio: input.aspectRatio }),
    ...(input.quality != null && { quality: input.quality }),
  };
}

export function toPromptToVideoClipRequest(
  input: PromptToVideoClipInput,
): PromptToVideoClipRequest {
  return {
    prompt: input.prompt,
    ...mcpWorkflowDefaults,
    ...mcpAutoExportFields({ autoExport: input.autoExport }),
    ...(input.imageFileIds != null && { imageFileIds: input.imageFileIds }),
    ...(input.durationSeconds != null && { durationSeconds: input.durationSeconds }),
    ...(input.aspectRatio != null && { aspectRatio: input.aspectRatio }),
    ...(input.quality != null && { quality: input.quality }),
  };
}
