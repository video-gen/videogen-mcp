import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  toPromptToVideoClipRequest,
  toScriptToVideoRequest,
  toSlideshowToVideoRequest,
  toStoryboardToVideoRequest,
  toVoiceoverToVideoRequest,
} from "./workflowAdapters";

describe("workflow MCP adapters", () => {
  it("maps minimal script and voiceover inputs to persistent AI-image workflows", () => {
    assert.deepEqual(toScriptToVideoRequest({ script: "Hello world." }), {
      script: "Hello world.",
      visualStyle: { type: "AI_IMAGE", aiStyle: "cinematic photo-real footage" },
      isOutputTemporary: false,
    });

    assert.deepEqual(toVoiceoverToVideoRequest({ fileId: "vg_file_audio" }), {
      fileId: "vg_file_audio",
      visualStyle: { type: "AI_IMAGE", aiStyle: "cinematic photo-real footage" },
      isOutputTemporary: false,
    });
  });

  it("maps slideshow and prompt-video creative options", () => {
    assert.deepEqual(
      toSlideshowToVideoRequest({
        fileId: "vg_file_slides",
        aspectRatio: { width: 9, height: 16 },
        voiceId: "vg_voice_1",
      }),
      {
        fileId: "vg_file_slides",
        aspectRatio: { width: 9, height: 16 },
        voiceId: "vg_voice_1",
        isOutputTemporary: false,
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
        isOutputTemporary: false,
      },
    );
    assert.deepEqual(
      toScriptToVideoRequest({
        script: "Hello world.",
        aspectRatio: { width: 4, height: 5 },
      }),
      {
        script: "Hello world.",
        visualStyle: { type: "AI_IMAGE", aiStyle: "cinematic photo-real footage" },
        aspectRatio: { width: 4, height: 5 },
        isOutputTemporary: false,
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
        isOutputTemporary: false,
      },
    );
  });
});
