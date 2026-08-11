import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { generateMotionGraphicInputSchema, scriptToVideoInputSchema } from "./adapters/creativeToolContracts";
import { SERVER_VERSION, buildMcpServer } from "./buildServer";
import { createVideoGenClientFromToken } from "./client";

const CREATIVE_TOOL_NAMES = new Set([
  "script_to_video",
  "voiceover_to_video",
  "slideshow_to_video",
  "storyboard_to_video",
  "prompt_to_video_clip",
  "generate_image",
  "generate_video_clip",
  "text_to_speech",
  "generate_sound_effect",
  "generate_music",
  "generate_motion_graphic",
  "generate_avatar",
  "vectorize_image",
  "remove_image_background",
  "remove_video_background",
  "upscale_image",
  "upscale_video",
  "image_3d_effect",
  "export_project",
  "remix_project",
]);

const FORBIDDEN_FIELDS = [
  "isOutputTemporary",
  "watermarkMode",
  "numResults",
  "wait",
  "pollIntervalMs",
  "timeoutMs",
  "remixActions",
  "captionStyle",
  "pronunciationReplacements",
  "autoExpandPronunciationReplacements",
  "visualStyle",
  "format",
  "workflowAgentContext",
  "defaultGeneration",
  "defaultDurationSeconds",
  "generation",
  "actorEntityIds",
  "productEntityIds",
  "visualStyleEntityId",
];

describe("creative tools/list contracts", () => {
  it("defaults motion graphic backgrounds to transparent", () => {
    assert.deepEqual(
      generateMotionGraphicInputSchema.parse({
        prompt: "Animate a product callout.",
      }),
      {
        prompt: "Animate a product callout.",
        transparentBackground: true,
      },
    );
  });

  it("accepts aspectRatio width/height objects", () => {
    assert.deepEqual(
      scriptToVideoInputSchema.parse({
        script: "Hello.",
        aspectRatio: { width: 16, height: 9 },
      }).aspectRatio,
      { width: 16, height: 9 },
    );
    assert.deepEqual(
      scriptToVideoInputSchema.parse({
        script: "Hello.",
        aspectRatio: { width: 4, height: 5 },
      }).aspectRatio,
      { width: 4, height: 5 },
    );
    assert.throws(() =>
      scriptToVideoInputSchema.parse({
        script: "Hello.",
        aspectRatio: { width: 0, height: 9 },
      }),
    );
    assert.throws(() =>
      scriptToVideoInputSchema.parse({
        script: "Hello.",
        format: "16:9",
      }),
    );
  });

  it("does not advertise operational or raw API fields", async () => {
    const server = buildMcpServer(
      () =>
        createVideoGenClientFromToken({
          bearerToken: "test-token",
          baseUrl: "https://example.com",
        }),
      "HOSTED",
      null,
      null,
      true,
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "creative-contract-test", version: SERVER_VERSION });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    try {
      const { tools } = await client.listTools();
      const creativeTools = tools.filter((tool) => CREATIVE_TOOL_NAMES.has(tool.name));

      assert.equal(creativeTools.length, CREATIVE_TOOL_NAMES.size);

      for (const tool of creativeTools) {
        const serializedSchema = JSON.stringify(tool.inputSchema);

        for (const forbiddenField of FORBIDDEN_FIELDS) {
          assert.equal(
            serializedSchema.includes(`"${forbiddenField}"`),
            false,
            `${tool.name} advertises forbidden field ${forbiddenField}`,
          );
        }
      }

      const motionGraphicTool = creativeTools.find(
        (tool) => tool.name === "generate_motion_graphic",
      );
      assert.notEqual(motionGraphicTool, undefined);
      const transparentBackgroundSchema = z
        .object({
          default: z.boolean().optional(),
          description: z.string().optional(),
        })
        .parse(motionGraphicTool?.inputSchema.properties?.transparentBackground ?? {});
      assert.equal(transparentBackgroundSchema.default, true);
      assert.match(transparentBackgroundSchema.description ?? "", /transparent WebM/);
      assert.match(transparentBackgroundSchema.description ?? "", /overlay/);
      assert.match(transparentBackgroundSchema.description ?? "", /opaque MP4/);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
