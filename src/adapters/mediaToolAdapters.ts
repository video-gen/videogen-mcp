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

export function toGenerateImageRequest(input: GenerateImageInput): GenerateImageRequest {
  return {
    prompt: input.prompt,
    numResults: 1,
    isOutputTemporary: false,
    ...(input.imageFileIds != null && { imageFileIds: input.imageFileIds }),
    ...(input.aspectRatio != null && { aspectRatio: input.aspectRatio }),
    ...(input.quality != null && { quality: input.quality }),
  };
}

export function toGenerateVideoClipRequest(
  input: GenerateVideoClipInput,
): GenerateVideoClipRequest {
  return {
    numResults: 1,
    isOutputTemporary: false,
    ...(input.prompt != null && { prompt: input.prompt }),
    ...(input.imageFileIds != null && { imageFileIds: input.imageFileIds }),
    ...(input.videoFileIds != null && { videoFileIds: input.videoFileIds }),
    ...(input.audioFileIds != null && { audioFileIds: input.audioFileIds }),
    ...(input.generateAudio != null && { generateAudio: input.generateAudio }),
    ...(input.durationSeconds != null && { durationSeconds: input.durationSeconds }),
    ...(input.aspectRatio != null && { aspectRatio: input.aspectRatio }),
    ...(input.quality != null && { quality: input.quality }),
  };
}

export function toTextToSpeechRequest(input: TextToSpeechInput): TextToSpeechRequest {
  return {
    ttsText: input.text,
    voiceId: input.voiceId,
    numResults: 1,
    isOutputTemporary: false,
    ...(input.language != null && { speechLanguageCode: input.language }),
    ...(input.speed != null && { voiceSpeed: input.speed }),
  };
}

export function toGenerateSoundEffectRequest(
  input: GenerateSoundEffectInput,
): GenerateSoundEffectRequest {
  return {
    prompt: input.prompt,
    numResults: 1,
    isOutputTemporary: false,
    ...(input.durationSeconds != null && { durationSeconds: input.durationSeconds }),
  };
}

export function toGenerateMusicRequest(input: GenerateMusicInput): GenerateMusicRequest {
  return {
    prompt: input.prompt,
    numResults: 1,
    isOutputTemporary: false,
  };
}

export function toGenerateMotionGraphicRequest(
  input: GenerateMotionGraphicInput,
): GenerateMotionGraphicRequest {
  return {
    prompt: input.prompt,
    numResults: 1,
    isOutputTemporary: false,
    ...(input.fileIds != null && { fileIds: input.fileIds }),
    ...(input.durationSeconds != null && { durationSeconds: input.durationSeconds }),
    ...(input.aspectRatio != null && { aspectRatio: input.aspectRatio }),
    transparentBackground: input.transparentBackground ?? true,
  };
}

export function toGenerateAvatarRequest(input: GenerateAvatarInput): GenerateAvatarRequest {
  return {
    actorEntityId: input.actorEntityId,
    audioFileId: input.audioFileId,
    numResults: 1,
    isOutputTemporary: false,
    ...(input.avatarQuality != null && { avatarQuality: input.avatarQuality }),
  };
}

export function toVectorizeImageRequest(input: VectorizeImageInput): ImageAssetRequest {
  return { imageFileId: input.imageFileId, numResults: 1, isOutputTemporary: false };
}

export function toRemoveImageBackgroundRequest(
  input: RemoveImageBackgroundInput,
): ImageAssetRequest {
  return { imageFileId: input.imageFileId, numResults: 1, isOutputTemporary: false };
}

export function toRemoveVideoBackgroundRequest(
  input: RemoveVideoBackgroundInput,
): VideoAssetRequest {
  return { videoFileId: input.videoFileId, numResults: 1, isOutputTemporary: false };
}

export function toUpscaleImageRequest(input: UpscaleImageInput): ImageAssetRequest {
  return { imageFileId: input.imageFileId, numResults: 1, isOutputTemporary: false };
}

export function toUpscaleVideoRequest(input: UpscaleVideoInput): VideoAssetRequest {
  return { videoFileId: input.videoFileId, numResults: 1, isOutputTemporary: false };
}

export function toImage3dEffectRequest(input: Image3dEffectInput): ImageAssetRequest {
  return { imageFileId: input.imageFileId, numResults: 1, isOutputTemporary: false };
}
