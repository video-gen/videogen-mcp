import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { remixProjectInputSchema } from "./creativeToolContracts";
import {
  toExportProjectRequest,
  toRemixProjectRequest,
} from "./projectAdapters";

describe("project MCP adapters", () => {
  it("maps export quality without API operational options", () => {
    assert.deepEqual(
      toExportProjectRequest({
        projectId: "vg_project_1",
        quality: "FULL_HIGH",
      }),
      { quality: "FULL_HIGH" },
    );
  });

  it("maps curated edits to concrete remix actions", () => {
    assert.deepEqual(
      toRemixProjectRequest({
        projectId: "vg_project_1",
        edits: ["CAPTIONS", "TRANSITIONS", "ZOOM", "CONVERT_IMAGES_TO_VIDEOS"],
      }),
      {
        remixActions: [
          { type: "ENABLE_CAPTIONS" },
          {
            type: "ADD_TRANSITIONS",
            sectionTransition: "DYNAMIC",
            assetTransition: "DYNAMIC",
          },
          { type: "ADD_ZOOM" },
          { type: "CONVERT_IMAGES_TO_VIDEOS" },
        ],
      },
    );
  });

  it("accepts the retired ANIMATE_IMAGES token as convert-images-to-videos", () => {
    const parsed = remixProjectInputSchema.parse({
      projectId: "vg_project_1",
      edits: ["ANIMATE_IMAGES"],
    });

    assert.deepEqual(parsed.edits, ["CONVERT_IMAGES_TO_VIDEOS"]);
    assert.deepEqual(toRemixProjectRequest(parsed), {
      remixActions: [{ type: "CONVERT_IMAGES_TO_VIDEOS" }],
    });
  });
});
