import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetVideoGenClient } from "../client";
import {
  addEntityReferenceInputSchema,
  archiveEntityInputSchema,
  createEntityInputSchema,
  getEntityInputSchema,
  listEntitiesInputSchema,
  removeEntityReferenceInputSchema,
  updateEntityInputSchema,
} from "../inputSchemas";
import { type McpOperations, dropUndefined } from "../operations";
import {
  entityArchiveOutputSchema,
  entityOutputSchema,
  listEntitiesOutputSchema,
} from "../outputSchemas";
import {
  DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
  IDEMPOTENT_DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
  READ_ONLY_TOOL_ANNOTATIONS,
  WRITE_PRIVATE_TOOL_ANNOTATIONS,
} from "../toolAnnotations";

/**
 * Entity CRUD for consistent ACTOR / PRODUCT / VISUAL_STYLE / SLIDESHOW_THEME /
 * BRAND / LOCATION / PROP references used by workflows and `generate_avatar`.
 * Typical create flow:
 *   1. Upload an image (`upload_file` / `create_file_upload` / `open_uploader`)
 *   2. `create_entity` with entityType + name
 *   3. `add_entity_reference` with the uploaded fileId (isDefault: true)
 *   4. Pass the returned entityId as actorEntityId / product refs in workflows
 */
export function registerEntityTools(
  server: McpServer,
  getClient: GetVideoGenClient,
  { respondSdk }: McpOperations,
): void {
  server.registerTool(
    "list_entities",
    {
      title: "List entities",
      description:
        "List built-in actors, products, visual styles, and slideshow themes plus team entities (including brands, locations, and props). Built-in rows have isBuiltIn true and cannot be updated or archived. Filter with entityType when you only need one kind.",
      inputSchema: listEntitiesInputSchema,
      outputSchema: listEntitiesOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => await respondSdk(() => getClient().entities.listEntities(dropUndefined(args))),
  );

  server.registerTool(
    "create_entity",
    {
      title: "Create entity",
      description:
        "Create an ACTOR (character), PRODUCT (something the user sells or promotes), VISUAL_STYLE, SLIDESHOW_THEME, BRAND, LOCATION (place or set), or PROP (background object that is not for sale) entity. Anything the user sells is a PRODUCT, never a PROP. A BRAND accepts brandConfig with fonts, colors, and writingStyle. Returns the new entity record with entityId and references. After create, attach references with add_entity_reference (upload the file first). Slideshow themes may attach an image or a PDF / PowerPoint. Use the returned entityId as actorEntityId on generate_avatar / script_to_video / slideshow_to_video, as productEntityIds or actorEntityIds on storyboard_to_video (request and each scene that should show it), as visualStyleEntityId on each storyboard scene, or as slideshowThemeEntityId on slideshow_to_video.",
      inputSchema: createEntityInputSchema,
      outputSchema: entityOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) => await respondSdk(() => getClient().entities.createEntity(dropUndefined(args))),
  );

  server.registerTool(
    "get_entity",
    {
      title: "Get entity",
      description:
        "Fetch one entity by id, including its reference images. Built-in catalog entities are included and have isBuiltIn true.",
      inputSchema: getEntityInputSchema,
      outputSchema: entityOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (args) => await respondSdk(() => getClient().entities.getEntity(args)),
  );

  server.registerTool(
    "update_entity",
    {
      title: "Update entity",
      description:
        "Overwrite supplied display name, description, or complete brandConfig fields on an existing team entity. Omitted fields stay unchanged. Returns the updated entity. Built-in entities cannot be updated.",
      inputSchema: updateEntityInputSchema,
      outputSchema: entityOutputSchema,
      annotations: DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) => await respondSdk(() => getClient().entities.updateEntity(dropUndefined(args))),
  );

  server.registerTool(
    "archive_entity",
    {
      title: "Archive entity",
      description:
        "Soft-archive a team entity so it no longer appears in lists or pickers. Returns entityId and archived. This tool has no restore operation; retrying an archived entity can fail because it is no longer active. Built-in entities cannot be archived.",
      inputSchema: archiveEntityInputSchema,
      outputSchema: entityArchiveOutputSchema,
      annotations: IDEMPOTENT_DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) => await respondSdk(() => getClient().entities.archiveEntity(args)),
  );

  server.registerTool(
    "add_entity_reference",
    {
      title: "Add entity reference",
      description:
        "Attach an uploaded file (vg_file_...) as a reference on an entity. Images work for every entity type. Slideshow themes may also attach a PDF or PowerPoint. For a BRAND, set role BRAND_LOGO for its overlay logo or BRAND_STYLE_GUIDE for its visual generation reference. Built-in entities cannot have references added. For new PRODUCT/ACTOR entities, call this right after create_entity with isDefault: true so the entity has a usable thumbnail and generation reference.",
      inputSchema: addEntityReferenceInputSchema,
      outputSchema: entityOutputSchema,
      annotations: WRITE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) =>
      await respondSdk(() => getClient().entities.addEntityReference(dropUndefined(args))),
  );

  server.registerTool(
    "remove_entity_reference",
    {
      title: "Remove entity reference",
      description:
        "Soft-archive a reference attachment on a team entity without deleting the source file. If it was the default reference, another reference is promoted when available. Returns the entity with its remaining references. Retrying a removed attachment can fail because it is no longer active. Built-in entities cannot have references removed.",
      inputSchema: removeEntityReferenceInputSchema,
      outputSchema: entityOutputSchema,
      annotations: IDEMPOTENT_DESTRUCTIVE_PRIVATE_TOOL_ANNOTATIONS,
    },
    async (args) => await respondSdk(() => getClient().entities.removeEntityReference(args)),
  );
}
