import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_MCP_AI_STYLE,
  MCP_AI_STYLE_COMPOSITION_LOCK,
  MCP_AI_STYLE_FIELD_DESCRIPTION,
  MCP_AI_STYLE_PRESET_EXAMPLES,
} from "./aiStylePresetExamples";

describe("MCP AI style preset examples", () => {
  it("lists every app default style with its full prompt", () => {
    assert.equal(MCP_AI_STYLE_PRESET_EXAMPLES.length, 15);
    assert.equal(DEFAULT_MCP_AI_STYLE, "Photorealistic photograph, natural lighting");
    assert.match(MCP_AI_STYLE_FIELD_DESCRIPTION, /full, strict paragraph/);
    assert.match(MCP_AI_STYLE_FIELD_DESCRIPTION, /charts, diagrams, tables/);
    assert.match(MCP_AI_STYLE_FIELD_DESCRIPTION, /keep the picture simple/);
    assert.match(
      MCP_AI_STYLE_FIELD_DESCRIPTION,
      /occupying only the middle half of the image/,
    );
    assert.ok(MCP_AI_STYLE_FIELD_DESCRIPTION.includes(MCP_AI_STYLE_COMPOSITION_LOCK));
  });
});
