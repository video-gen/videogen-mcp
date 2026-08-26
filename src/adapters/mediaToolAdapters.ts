import type {
  GenerateAvatarRequest,
  GenerateImageRequest,
  GenerateMotionGraphicRequest,
  GenerateMusicRequest,
  GenerateSoundEffectRequest,
  GenerateVideoClipRequest,
  ImageAssetRequest,
  TextToSpeechRequest,
  VideoAssetRequest,
} from "@videogen/sdk";
import { z } from "zod";
import {
  generateAvatarInputSchema,
  generateImageInputSchema,
  generateMotionGraphicInputSchema,
  generateMusicInputSchema,
  generateSoundEffectInputSchema,
  generateVideoClipInputSchema,
  image3dEffectInputSchema,
  removeImageBackgroundInputSchema,
  removeVideoBackgroundInputSchema,
  textToSpeechInputSchema,
  upscaleImageInputSchema,
  upscaleVideoInputSchema,
  vectorizeImageInputSchema,
} from "./creativeToolContracts";

type GenerateImageInput = z.infer<typeof generateImageInputSchema>;
type GenerateVideoClipInput = z.infer<typeof generateVideoClipInputSchema>;
type TextToSpeechInput = z.infer<typeof textToSpeechInputSchema>;
type GenerateSoundEffectInput = z.infer<typeof generateSoundEffectInputSchema>;
type GenerateMusicInput = z.infer<typeof generateMusicInputSchema>;
type GenerateMotionGraphicInput = z.input<typeof generateMotionGraphicInputSchema>;
type GenerateAvatarInput = z.infer<typeof generateAvatarInputSchema>;
type VectorizeImageInput = z.infer<typeof vectorizeImageInputSchema>;
type RemoveImageBackgroundInput = z.infer<typeof removeImageBackgroundInputSchema>;
type RemoveVideoBackgroundInput = z.infer<typeof removeVideoBackgroundInputSchema>;
type UpscaleImageInput = z.infer<typeof upscaleImageInputSchema>;
type UpscaleVideoInput = z.infer<typeof upscaleVideoInputSchema>;
type Image3dEffectInput = z.infer<typeof image3dEffectInputSchema>;

const mcpMediaDefaults = {
  numResults: 1 as const,
  isOutputTemporary: false as const,
  hideFromUi: false as const,
};

// MCP does not expose watermarkMode. Send AUTO explicitly so branding cannot
// depend on omit/default at a later adapter, and so a hallucinated NONE cannot
// ride through if a caller starts spreading extra fields. The API already
// defaults omitted watermarkMode to AUTO (`watermarkMode ?? "AUTO"`).
const mcpAutoWatermark = {
  watermarkMode: "AUTO" as const,
};

export function toGenerateImageRequest(input: GenerateImageInput): GenerateImageRequest {
  return {
    prompt: input.prompt,
    ...mcpMediaDefaults,
    ...mcpAutoWatermark,
    ...(input.imageFileIds != null && { imageFileIds: input.imageFileIds }),
    ...(input.entityIds != null && { entityIds: input.entityIds }),
    ...(input.aspectRatio != null && { aspectRatio: input.aspectRatio }),
    ...(input.quality != null && { quality: input.quality }),
  };
}

export function toGenerateVideoClipRequest(
  input: GenerateVideoClipInput,
): GenerateVideoClipRequest {
  return {
    ...mcpMediaDefaults,
    ...mcpAutoWatermark,
    generateAudio: input.generateAudio ?? false,
    ...(input.suppressBackgroundMusic != null && {
      suppressBackgroundMusic: input.suppressBackgroundMusic,
    }),
    ...(input.prompt != null && { prompt: input.prompt }),
    ...(input.startFrameFileId != null && { startFrameFileId: input.startFrameFileId }),
    ...(input.imageFileIds != null && { imageFileIds: input.imageFileIds }),
    ...(input.videoFileIds != null && { videoFileIds: input.videoFileIds }),
    ...(input.audioFileIds != null && { audioFileIds: input.audioFileIds }),
    ...(input.spokenDialogue != null && { spokenDialogue: input.spokenDialogue }),
    ...(input.voiceDescription != null && { voiceDescription: input.voiceDescription }),
    ...(input.durationSeconds != null && { durationSeconds: input.durationSeconds }),
    ...(input.aspectRatio != null && { aspectRatio: input.aspectRatio }),
    ...(input.quality != null && { quality: input.quality }),
  };
}

export function toTextToSpeechRequest(input: TextToSpeechInput): TextToSpeechRequest {
  return {
    ttsText: input.text,
    voiceId: input.voiceId,
    ...mcpMediaDefaults,
    ...(input.language != null && { speechLanguageCode: input.language }),
    ...(input.speed != null && { voiceSpeed: input.speed }),
  };
}

export function toGenerateSoundEffectRequest(
  input: GenerateSoundEffectInput,
): GenerateSoundEffectRequest {
  return {
    prompt: input.prompt,
    ...mcpMediaDefaults,
    ...(input.durationSeconds != null && { durationSeconds: input.durationSeconds }),
  };
}

export function toGenerateMusicRequest(input: GenerateMusicInput): GenerateMusicRequest {
  return {
    prompt: input.prompt,
    ...mcpMediaDefaults,
  };
}

export function toGenerateMotionGraphicRequest(
  input: GenerateMotionGraphicInput,
): GenerateMotionGraphicRequest {
  return {
    prompt: input.prompt,
    ...mcpMediaDefaults,
    ...(input.fileIds != null && { fileIds: input.fileIds }),
    ...(input.entityIds != null && { entityIds: input.entityIds }),
    ...(input.durationSeconds != null && { durationSeconds: input.durationSeconds }),
    ...(input.aspectRatio != null && { aspectRatio: input.aspectRatio }),
    transparentBackground: input.transparentBackground ?? true,
    ...(input.subToolModes != null && {
      subToolModes: {
        ...(input.subToolModes.generateImages != null && {
          generateImages: input.subToolModes.generateImages,
        }),
        ...(input.subToolModes.generateVideoClips != null && {
          generateVideoClips: input.subToolModes.generateVideoClips,
        }),
        ...(input.subToolModes.generateVoiceover != null && {
          generateVoiceover: input.subToolModes.generateVoiceover,
        }),
        ...(input.subToolModes.searchStockMedia != null && {
          searchStockMedia: input.subToolModes.searchStockMedia,
        }),
      },
    }),
  };
}

export function toGenerateAvatarRequest(input: GenerateAvatarInput): GenerateAvatarRequest {
  return {
    actorEntityId: input.actorEntityId,
    audioFileId: input.audioFileId,
    ...mcpMediaDefaults,
    ...mcpAutoWatermark,
    ...(input.avatarQuality != null && { avatarQuality: input.avatarQuality }),
  };
}

export function toVectorizeImageRequest(input: VectorizeImageInput): ImageAssetRequest {
  return { imageFileId: input.imageFileId, ...mcpMediaDefaults, ...mcpAutoWatermark };
}

export function toRemoveImageBackgroundRequest(
  input: RemoveImageBackgroundInput,
): ImageAssetRequest {
  return { imageFileId: input.imageFileId, ...mcpMediaDefaults, ...mcpAutoWatermark };
}

export function toRemoveVideoBackgroundRequest(
  input: RemoveVideoBackgroundInput,
): VideoAssetRequest {
  return { videoFileId: input.videoFileId, ...mcpMediaDefaults, ...mcpAutoWatermark };
}

export function toUpscaleImageRequest(input: UpscaleImageInput): ImageAssetRequest {
  return { imageFileId: input.imageFileId, ...mcpMediaDefaults, ...mcpAutoWatermark };
}

export function toUpscaleVideoRequest(input: UpscaleVideoInput): VideoAssetRequest {
  return { videoFileId: input.videoFileId, ...mcpMediaDefaults, ...mcpAutoWatermark };
}

export function toImage3dEffectRequest(input: Image3dEffectInput): ImageAssetRequest {
  return { imageFileId: input.imageFileId, ...mcpMediaDefaults, ...mcpAutoWatermark };
}
