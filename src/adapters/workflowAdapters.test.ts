import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  toPromptToVideoClipRequest,
  toScriptToVideoRequest,
  toSlideshowToVideoRequest,
  toStoryboardToVideoRequest,
  toVoiceoverToVideoRequest,
} from "./workflowAdapters";

const mcpVisualStyle = {
  type: "AI_IMAGE" as const,
  aiStyle: "Photorealistic photograph, natural lighting",
  restyleFeaturedBRollWithAiStyle: true,
};

const mcpWorkflowDefaults = {
  isOutputTemporary: false,
  hideFromUi: false,
  autoExport: true,
  exportOptions: {
    watermarkMode: "AUTO",
    endScreenMode: "AUTO",
  },
};

describe("workflow MCP adapters", () => {
  it("maps minimal script and voiceover inputs to persistent AI-image workflows", () => {
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

  it("maps slideshow and prompt-video creative options", () => {
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

  it("maps simplified storyboard scenes to the exact API scene contract", () => {
    assert.deepEqual(
      toStoryboardToVideoRequest({
        scenes: [
          {
            durationSeconds: null,
            prompt: "Product reveal on a marble vanity.",
            voiceoverScript: "Meet your new everyday lip tint.",
          },
        ],
        style: "premium beauty campaign",
        quality: "HIGH",
      }),
      {
        scenes: [
          {
            prompt: "Product reveal on a marble vanity.",
            voiceoverScript: "Meet your new everyday lip tint.",
          },
        ],
        defaultGeneration: { aiStyle: "premium beauty campaign" },
        quality: "HIGH",
        ...mcpWorkflowDefaults,
      },
    );
  });
});
