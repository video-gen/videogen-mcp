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

export function toScriptToVideoRequest(input: ScriptToVideoInput): ScriptToVideoRequest {
  return {
    script: input.script,
    visualStyle: styleToVisualStyle({ style: input.style }),
    isOutputTemporary: false,
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
    isOutputTemporary: false,
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
    isOutputTemporary: false,
    ...(input.slideScripts != null && { slideScripts: input.slideScripts }),
    ...(input.aspectRatio != null && { aspectRatio: input.aspectRatio }),
    ...(input.language != null && { language: input.language }),
    ...(input.voiceId != null && { voiceId: input.voiceId }),
    ...(input.actorEntityId != null && { actorEntityId: input.actorEntityId }),
    ...(input.avatarQuality != null && { avatarQuality: input.avatarQuality }),
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
    isOutputTemporary: false,
    ...(input.aspectRatio != null && { aspectRatio: input.aspectRatio }),
    ...(input.quality != null && { quality: input.quality }),
  };
}

export function toPromptToVideoClipRequest(
  input: PromptToVideoClipInput,
): PromptToVideoClipRequest {
  return {
    prompt: input.prompt,
    isOutputTemporary: false,
    ...(input.imageFileIds != null && { imageFileIds: input.imageFileIds }),
    ...(input.durationSeconds != null && { durationSeconds: input.durationSeconds }),
    ...(input.aspectRatio != null && { aspectRatio: input.aspectRatio }),
    ...(input.quality != null && { quality: input.quality }),
  };
}
