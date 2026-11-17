import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  toPromptToVideoClipRequest,
  toScriptToVideoRequest,
  toSlideshowToVideoRequest,
  toStoryboardToVideoRequest,
  toTranslateVideoRequest,
  toVideoToVideoRequest,
  toVoiceoverToVideoRequest,
} from "./workflowAdapters";
import { videoToVideoInputSchema } from "./creativeToolContracts";

const mcpVisualStyle = {
  type: "AI_IMAGE" as const,
  aiStyle: "Photorealistic photograph, natural lighting",
  restyleFeaturedBRollWithAiStyle: true,
};

const mcpWorkflowDefaults = {
  isOutputTemporary: false,
  autoExport: true,
  exportOptions: {
    watermarkMode: "AUTO",
    endScreenMode: "AUTO",
  },
};

void describe("workflow MCP adapters", () => {
  void it("maps minimal script and voiceover inputs to persistent AI-image workflows", () => {
    assert.deepEqual(toScriptToVideoRequest({ script: "Hello world." }), {
      script: "Hello world.",
      visualStyle: mcpVisualStyle,
      ...mcpWorkflowDefaults,
    });

    assert.deepEqual(toVoiceoverToVideoRequest({ fileId: "vg_file_audio" }), {
      fileId: "vg_file_audio",
      visualStyle: mcpVisualStyle,
      ...mcpWorkflowDefaults,
    });
  });

  void it("maps slideshow and prompt-video creative options", () => {
    assert.deepEqual(
      toSlideshowToVideoRequest({
        fileId: "vg_file_slides",
        aspectRatio: { width: 9, height: 16 },
        voiceId: "vg_voice_1",
        slideshowThemeEntityId: "vg_enti_theme",
      }),
      {
        fileId: "vg_file_slides",
        aspectRatio: { width: 9, height: 16 },
        voiceId: "vg_voice_1",
        slideshowThemeEntityId: "vg_enti_theme",
        ...mcpWorkflowDefaults,
      },
    );

    assert.deepEqual(
      toSlideshowToVideoRequest({
        fileId: "vg_file_slides",
      }),
      {
        fileId: "vg_file_slides",
        ...mcpWorkflowDefaults,
      },
    );

    assert.deepEqual(
      toPromptToVideoClipRequest({
        prompt: "Lip tint rotating on a pedestal.",
        aspectRatio: { width: 1, height: 1 },
        durationSeconds: 5,
      }),
      {
        prompt: "Lip tint rotating on a pedestal.",
        aspectRatio: { width: 1, height: 1 },
        durationSeconds: 5,
        ...mcpWorkflowDefaults,
      },
    );
    assert.deepEqual(
      toScriptToVideoRequest({
        script: "Hello world.",
        aspectRatio: { width: 4, height: 5 },
      }),
      {
        script: "Hello world.",
        visualStyle: mcpVisualStyle,
        aspectRatio: { width: 4, height: 5 },
        ...mcpWorkflowDefaults,
      },
    );
  });

  void it("maps simplified storyboard scenes to the exact API scene contract", () => {
    assert.deepEqual(
      toStoryboardToVideoRequest({
        scenes: [
          {
            durationSeconds: null,
            prompt: "Product reveal on a marble vanity.",
            voiceoverScript: "Meet your new everyday lip tint.",
            productEntityIds: ["vg_enti_product"],
            actorEntityIds: ["vg_enti_actor"],
            visualStyleEntityId: "vg_enti_style",
          },
        ],
        productEntityIds: ["vg_enti_product"],
        actorEntityIds: ["vg_enti_actor"],
        style: "premium beauty campaign",
        quality: "HIGH",
      }),
      {
        scenes: [
          {
            prompt: "Product reveal on a marble vanity.",
            voiceoverScript: "Meet your new everyday lip tint.",
            productEntityIds: ["vg_enti_product"],
            actorEntityIds: ["vg_enti_actor"],
            visualStyleEntityId: "vg_enti_style",
          },
        ],
        productEntityIds: ["vg_enti_product"],
        actorEntityIds: ["vg_enti_actor"],
        defaultGeneration: { aiStyle: "premium beauty campaign" },
        quality: "HIGH",
        ...mcpWorkflowDefaults,
      },
    );
  });

  void it("maps a linked or uploaded source video to the video-to-video request", () => {
    assert.deepEqual(
      toVideoToVideoRequest(
        videoToVideoInputSchema.parse({
          videoUrl: "https://example.com/watch/clip",
          prompt: "Hand-made claymation with soft studio lighting.",
          trimStartSeconds: 4,
          trimEndSeconds: 34,
          quality: "MAX",
          audio: "GENERATE",
        }),
      ),
      {
        prompt: "Hand-made claymation with soft studio lighting.",
        videoUrl: "https://example.com/watch/clip",
        trimStartSeconds: 4,
        trimEndSeconds: 34,
        quality: "MAX",
        audio: "GENERATE",
        ...mcpWorkflowDefaults,
      },
    );

    assert.deepEqual(
      toVideoToVideoRequest(
        videoToVideoInputSchema.parse({
          videoFileId: "vg_file_source",
          prompt: "Watercolor painting.",
          imageFileIds: ["vg_file_reference"],
        }),
      ),
      {
        prompt: "Watercolor painting.",
        videoFileId: "vg_file_source",
        imageFileIds: ["vg_file_reference"],
        ...mcpWorkflowDefaults,
      },
    );
  });

  void it("requires exactly one video-to-video source", () => {
    assert.equal(
      videoToVideoInputSchema.safeParse({ prompt: "Watercolor painting." })
        .success,
      false,
    );
    assert.equal(
      videoToVideoInputSchema.safeParse({
        videoFileId: "vg_file_source",
        videoUrl: "https://example.com/clip.mp4",
        prompt: "Watercolor painting.",
      }).success,
      false,
    );
  });
});

void it("video-to-video does not expose an aspect ratio option", () => {
  assert.equal("aspectRatio" in videoToVideoInputSchema.shape, false);

  void it("maps translate inputs and omits an absent source language", () => {
    assert.deepEqual(
      toTranslateVideoRequest({ videoFileId: "vg_file_video", outputLanguages: ["es", "fr"] }),
      {
        videoFileId: "vg_file_video",
        outputLanguages: ["es", "fr"],
        ...mcpWorkflowDefaults,
      },
    );

    assert.deepEqual(
      toTranslateVideoRequest({
        videoFileId: "vg_file_video",
        outputLanguages: ["de"],
        sourceLanguage: "en",
        autoExport: false,
      }),
      {
        videoFileId: "vg_file_video",
        outputLanguages: ["de"],
        sourceLanguage: "en",
        isOutputTemporary: false,
        autoExport: false,
      },
    );
  });
});
