import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MCP_COMMERCE_DEEP_LINK_ACTIONS } from "./hostSurface";
import {
  CHATGPT_APP_DEEP_LINK_ACTIONS,
  STANDARD_APP_DEEP_LINK_ACTIONS,
  generateVideoClipInputSchema,
  storyboardToVideoInputSchema,
} from "./inputSchemas";

describe("storyboard_to_video input schema", () => {
  const schema = storyboardToVideoInputSchema;

  it("requires the API's prompt field on every scene", () => {
    const result = schema.safeParse({
      scenes: [
        {
          narration: "Introducing a premium lip tint.",
          visual: "A polished product reveal.",
        },
      ],
    });

    assert.equal(result.success, false);
  });

  it("accepts the documented storyboard scene fields", () => {
    const result = schema.safeParse({
      scenes: [
        {
          prompt: "A polished product reveal on a marble vanity.",
          title: "Product reveal",
          durationSeconds: 5,
          voiceoverScript: "Meet your new everyday lip tint.",
        },
        {
          prompt: "A model applies the lip tint and smiles at camera.",
        },
      ],
      style: "premium beauty campaign",
      quality: "HIGH",
    });

    assert.equal(result.success, true);
  });

  it("rejects removed raw API fields", () => {
    const result = schema.safeParse({
      scenes: [{ prompt: "A polished product reveal." }],
      isOutputTemporary: true,
      remixActions: [{ type: "ENABLE_CAPTIONS" }],
    });

    assert.equal(result.success, false);
  });

  it("rejects unsupported nested scene fields", () => {
    const result = schema.safeParse({
      scenes: [{ prompt: "A polished product reveal.", unsupportedControl: true }],
    });

    assert.equal(result.success, false);
  });
});

describe("generate_video_clip input schema", () => {
  it("accepts reference-only generation and explicit nullable duration", () => {
    assert.equal(
      generateVideoClipInputSchema.safeParse({
        imageFileIds: ["vg_file_image"],
        durationSeconds: null,
      }).success,
      true,
    );
  });

  it("rejects requests without a prompt or reference media", () => {
    assert.equal(generateVideoClipInputSchema.safeParse({}).success, false);
  });
});

describe("app deep-link action surfaces", () => {
  const commerceActions: ReadonlySet<string> = new Set(MCP_COMMERCE_DEEP_LINK_ACTIONS);

  it("exposes ChatGPT exactly as STANDARD minus commerce actions", () => {
    // ChatGPT Apps must not surface commerce deep links (Plugins digital-goods
    // policy). Locking this invariant means a new STANDARD action is either
    // classified as commerce (in MCP_COMMERCE_DEEP_LINK_ACTIONS) or must also be
    // added to CHATGPT_APP_DEEP_LINK_ACTIONS — the lists cannot silently drift.
    const expectedChatGptActions = STANDARD_APP_DEEP_LINK_ACTIONS.filter(
      (action) => !commerceActions.has(action),
    );

    assert.deepEqual([...CHATGPT_APP_DEEP_LINK_ACTIONS], expectedChatGptActions);
  });

  it("never lists a commerce action on the ChatGPT surface", () => {
    for (const action of CHATGPT_APP_DEEP_LINK_ACTIONS) {
      assert.equal(commerceActions.has(action), false);
    }
  });

  it("keeps every commerce action available on the STANDARD surface", () => {
    for (const action of MCP_COMMERCE_DEEP_LINK_ACTIONS) {
      assert.equal(STANDARD_APP_DEEP_LINK_ACTIONS.includes(action), true);
    }
  });
});
