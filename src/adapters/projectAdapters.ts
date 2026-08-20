import type { ExportProjectRequest, RemixProjectRequest, Schemas } from "@videogen/sdk";
import { z } from "zod";
import {
  exportProjectInputSchema,
  remixProjectInputSchema,
  type RemixEdit,
} from "./creativeToolContracts";

type ExportProjectInput = z.infer<typeof exportProjectInputSchema>;
type RemixProjectInput = z.infer<typeof remixProjectInputSchema>;

function remixEditToAction(edit: RemixEdit): Schemas["RemixAction"] {
  switch (edit) {
    case "CAPTIONS":
      return { type: "ENABLE_CAPTIONS" };
    case "TRANSITIONS":
      return {
        type: "ADD_TRANSITIONS",
        sectionTransition: "DYNAMIC",
        assetTransition: "DYNAMIC",
      };
    case "ANIMATE_IMAGES":
      return { type: "CONVERT_IMAGES_TO_VIDEOS" };
    case "ZOOM":
      return { type: "ADD_ZOOM" };
  }
}

export function toExportProjectRequest(input: ExportProjectInput): ExportProjectRequest {
  return {
    ...(input.quality != null && { quality: input.quality }),
  };
}

export function toRemixProjectRequest(input: RemixProjectInput): RemixProjectRequest {
  return {
    remixActions: input.edits.map(remixEditToAction),
    ...(input.saveAsNewProject != null && { saveAsNewProject: input.saveAsNewProject }),
  };
}
