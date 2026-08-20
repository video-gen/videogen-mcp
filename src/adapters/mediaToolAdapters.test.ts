import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  toGenerateAvatarRequest,
  toGenerateImageRequest,
  toGenerateMotionGraphicRequest,
  toGenerateMusicRequest,
  toGenerateSoundEffectRequest,
  toGenerateVideoClipRequest,
  toImage3dEffectRequest,
  toRemoveImageBackgroundRequest,
  toRemoveVideoBackgroundRequest,
  toTextToSpeechRequest,
  toUpscaleImageRequest,
  toUpscaleVideoRequest,
  toVectorizeImageRequest,
} from "./mediaToolAdapters";

const persistentSingleResult = {
  numResults: 1,
  isOutputTemporary: false,
  hideFromUi: false,
};

describe("media MCP adapters", () => {
  it("maps generative image and video inputs", () => {
    assert.deepEqual(
      toGenerateImageRequest({
        prompt: "A premium product photo.",
        aspectRatio: { width: 9, height: 16 },
        entityIds: ["vg_enti_actor"],
      }),
      {
        prompt: "A premium product photo.",
        aspectRatio: { width: 9, height: 16 },
        entityIds: ["vg_enti_actor"],
        ...persistentSingleResult,
      },
    );

    assert.deepEqual(
      toGenerateVideoClipRequest({
        prompt: "A slow product push-in.",
        generateAudio: true,
        suppressBackgroundMusic: true,
        durationSeconds: 6,
      }),
      {
        prompt: "A slow product push-in.",
        generateAudio: true,
        suppressBackgroundMusic: true,
        durationSeconds: 6,
        ...persistentSingleResult,
      },
    );

    assert.deepEqual(
      toGenerateVideoClipRequest({
        imageFileIds: ["vg_file_image"],
        durationSeconds: null,
      }),
      {
        imageFileIds: ["vg_file_image"],
        generateAudio: false,
        ...persistentSingleResult,
      },
    );

    assert.deepEqual(
      toGenerateVideoClipRequest({
        startFrameFileId: "vg_file_start",
      }),
      {
        startFrameFileId: "vg_file_start",
        generateAudio: false,
        ...persistentSingleResult,
      },
    );

    assert.deepEqual(
      toGenerateVideoClipRequest({
        spokenDialogue: "Meet your new everyday lip tint.",
        voiceDescription: "A warm, confident young woman's voice",
        audioFileIds: ["vg_file_audio"],
      }),
      {
        spokenDialogue: "Meet your new everyday lip tint.",
        voiceDescription: "A warm, confident young woman's voice",
        audioFileIds: ["vg_file_audio"],
        generateAudio: false,
        ...persistentSingleResult,
      },
    );
  });

  it("maps audio and motion inputs", () => {
    assert.deepEqual(
      toTextToSpeechRequest({
        text: "Hello.",
        voiceId: "vg_voice_1",
        language: "en",
        speed: 1.1,
      }),
      {
        ttsText: "Hello.",
        voiceId: "vg_voice_1",
        speechLanguageCode: "en",
        voiceSpeed: 1.1,
        ...persistentSingleResult,
      },
    );
    assert.deepEqual(toGenerateSoundEffectRequest({ prompt: "Camera shutter." }), {
      prompt: "Camera shutter.",
      ...persistentSingleResult,
    });
    assert.deepEqual(toGenerateMusicRequest({ prompt: "Upbeat beauty ad music." }), {
      prompt: "Upbeat beauty ad music.",
      ...persistentSingleResult,
    });
    assert.deepEqual(
      toGenerateMotionGraphicRequest({
        prompt: "Animate the product name.",
        aspectRatio: { width: 1, height: 1 },
      }),
      {
        prompt: "Animate the product name.",
        aspectRatio: { width: 1, height: 1 },
        transparentBackground: true,
        ...persistentSingleResult,
      },
    );
    assert.deepEqual(
      toGenerateMotionGraphicRequest({
        prompt: "Animate a full-frame title card.",
        transparentBackground: false,
        subToolModes: { generateImages: "DISABLED" },
        entityIds: ["vg_enti_actor"],
      }),
      {
        prompt: "Animate a full-frame title card.",
        transparentBackground: false,
        subToolModes: { generateImages: "DISABLED" },
        entityIds: ["vg_enti_actor"],
        ...persistentSingleResult,
      },
    );
    assert.deepEqual(
      toGenerateAvatarRequest({
        actorEntityId: "vg_enti_actor",
        avatarQuality: "LOW",
        audioFileId: "vg_file_audio",
      }),
      {
        actorEntityId: "vg_enti_actor",
        avatarQuality: "LOW",
        audioFileId: "vg_file_audio",
        ...persistentSingleResult,
      },
    );
  });

  it("maps file transforms without exposing operational fields", () => {
    assert.deepEqual(toVectorizeImageRequest({ imageFileId: "vg_file_image" }), {
      imageFileId: "vg_file_image",
      ...persistentSingleResult,
    });
    assert.deepEqual(toRemoveImageBackgroundRequest({ imageFileId: "vg_file_image" }), {
      imageFileId: "vg_file_image",
      ...persistentSingleResult,
    });
    assert.deepEqual(toRemoveVideoBackgroundRequest({ videoFileId: "vg_file_video" }), {
      videoFileId: "vg_file_video",
      ...persistentSingleResult,
    });
    assert.deepEqual(toUpscaleImageRequest({ imageFileId: "vg_file_image" }), {
      imageFileId: "vg_file_image",
      ...persistentSingleResult,
    });
    assert.deepEqual(toUpscaleVideoRequest({ videoFileId: "vg_file_video" }), {
      videoFileId: "vg_file_video",
      ...persistentSingleResult,
    });
    assert.deepEqual(toImage3dEffectRequest({ imageFileId: "vg_file_image" }), {
      imageFileId: "vg_file_image",
      ...persistentSingleResult,
    });
  });
});
