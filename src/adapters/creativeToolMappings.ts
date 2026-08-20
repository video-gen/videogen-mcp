import type { Schemas } from "@videogen/sdk";
import { DEFAULT_MCP_AI_STYLE } from "./creativeToolContracts";

export function styleToVisualStyle({
  style,
}: {
  style: string | undefined;
}): Schemas["WorkflowVisualStyle"] {
  return {
    type: "AI_IMAGE",
    aiStyle: style ?? DEFAULT_MCP_AI_STYLE,
    restyleFeaturedBRollWithAiStyle: true,
  };
}
