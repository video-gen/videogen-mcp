/**
 * English copies of the app's built-in AI style prompts from
 * `base/src/logic/ai-style/aiStylePresets.ts`. MCP cannot import `@videogen/base`;
 * keep these strings identical to the English `t(...)` sources there.
 */
export const MCP_AI_STYLE_PRESET_EXAMPLES = [
  {
    name: "Watercolor",
    prompt:
      "Loose watercolor illustration, visible brushstrokes, soft color bleeds, paper texture, muted palette. A clear uncluttered subject centered in the frame, occupying only the middle half of the image, with generous empty margins on all four sides, no background clutter.",
  },
  {
    name: "Realistic",
    prompt: "Photorealistic photograph, natural lighting",
  },
  {
    name: "Whiteboard",
    prompt:
      "Minimalist whiteboard explainer style, simple line drawings, marker sketch aesthetic, clean white background, subtle accent colors. A clear uncluttered subject centered in the frame, occupying only the middle half of the image, with generous empty margins on all four sides, no background clutter.",
  },
  {
    name: "3D cartoon",
    prompt:
      "3D cartoon render, rounded forms, soft lighting, vibrant colors, clean matte materials, smooth stylized characters",
  },
  {
    name: "Flat art",
    prompt:
      "Corporate memphis flat art illustration, simple geometric shapes, bold colors, clean composition, white background with sparse subtle geometric accents such as small dots, lines, or shapes scattered in the margins. A clear uncluttered subject centered in the frame, occupying only the middle half of the image, with generous empty margins on all four sides, no busy background patterns.",
  },
  {
    name: "Paper",
    prompt:
      "Paper collage illustration, torn edges, layered cut paper shapes, mixed media texture, handmade craft aesthetic, matte paper finish. A clear uncluttered subject centered in the frame, occupying only the middle half of the image, with generous empty margins on all four sides, no background clutter.",
  },
  {
    name: "Ink paint",
    prompt:
      "Traditional Japanese sumi-e ink wash painting, expressive black ink brushstrokes, varied tonal gradations from deep black to soft gray, rice-paper texture, minimalist composition. No text, letters, calligraphy, kanji, signatures, or red seal stamps unless explicitly required by the subject. A clear uncluttered subject centered in the frame, occupying only the middle half of the image, with generous empty margins on all four sides, no background clutter.",
  },
  {
    name: "Anime",
    prompt:
      "Anime illustration, cel-shaded style, vibrant colors, clean linework, soft gradient backgrounds",
  },
  {
    name: "Editorial",
    prompt:
      "Editorial illustration, conceptual art, bold geometric shapes, sophisticated color palette, negative space, minimalist composition, strong silhouette",
  },
  {
    name: "Isometric",
    prompt:
      "Isometric 3D illustration, clean vector style, soft gradient background, matte pastel colors, simple geometric objects, no characters. A clear uncluttered subject centered in the frame, occupying only the middle half of the image, with generous empty margins on all four sides, no background clutter.",
  },
  {
    name: "Claymation",
    prompt:
      "Claymation style, soft clay figurines, plasticine texture, handmade stop-motion aesthetic, warm studio lighting, shallow depth of field",
  },
  {
    name: "Education",
    prompt:
      "Educational infographic style, simple icons, pastel colors, white background. A clear uncluttered subject centered in the frame, occupying only the middle half of the image, with generous empty margins on all four sides, no background clutter.",
  },
  {
    name: "Chalkboard",
    prompt:
      "Simple, minimalist, white chalk line drawings on dark green chalkboard, hand-drawn sketch style, chalk dust texture. A clear uncluttered subject centered in the frame, occupying only the middle half of the image, with generous empty margins on all four sides, no background clutter.",
  },
  {
    name: "Boho",
    prompt:
      "Simple graphic with only a few elements. Boho linocut poster. Textured organic strokes with crisp lines and a white textured background. A clear uncluttered subject centered in the frame, occupying only the middle half of the image, with generous empty margins on all four sides, no background clutter.",
  },
  {
    name: "Poster",
    prompt:
      "Risograph print aesthetic, halftone texture, limited duotone palette, paper grain, high contrast, bold flat colors",
  },
] as const;

export const DEFAULT_MCP_AI_STYLE = "Photorealistic photograph, natural lighting";

/** Required composition lock. Image models pack frames unless the style forbids it. */
export const MCP_AI_STYLE_COMPOSITION_LOCK =
  "A clear uncluttered subject centered in the frame, occupying only the middle half of the image, with generous empty margins on all four sides, no background clutter. No on-image text, letters, labels, captions, charts, diagrams, tables, legends, or infographic layout unless the user explicitly asked for one specific word or number on screen.";

export const MCP_AI_STYLE_FIELD_DESCRIPTION = [
  "Visual style for generated images. Write a full, strict paragraph in the same form as the app defaults below: name the medium, texture, and palette, then lock composition. Do not pass a short label such as \"watercolor\", \"flat art\", or \"cinematic\".",
  `Image models fill the frame with extra objects, readable text, charts, diagrams, tables, and labels unless the style forbids that. The still then looks crowded and hard to use. Every style must keep the picture simple. Include this composition lock verbatim: ${MCP_AI_STYLE_COMPOSITION_LOCK}`,
  "Copy an app default in full (those already include the uncluttered-subject lock), then add the no-text / no-diagram sentence if it is missing. A custom style is allowed only when it is equally long and strict, and includes the same composition lock. Omit this field for the Realistic default.",
  ...MCP_AI_STYLE_PRESET_EXAMPLES.map((example) => `${example.name}: ${example.prompt}`),
].join("\n");
