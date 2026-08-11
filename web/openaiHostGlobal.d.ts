export type OpenAiToolResultContent = { type?: string; text?: string };

export type OpenAiToolResult = {
  content?: OpenAiToolResultContent[];
  structuredContent?: unknown;
  isError?: boolean;
};

/**
 * The `window.openai` bridge injected by ChatGPT when a widget runs inside its
 * sandboxed iframe. Declared once here (rather than per widget) so multiple
 * widgets can augment the same global `Window.openai` without conflicting.
 * Every field is feature-detected at the call site because non-ChatGPT hosts do
 * not provide this object.
 */
export type OpenAiHost = {
  callTool: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<OpenAiToolResult>;
  /** Message-scoped UI snapshot; survives reopen/refresh of the same widget. */
  widgetState?: unknown;
  setWidgetState?: (state: Record<string, unknown>) => Promise<void> | void;
  sendFollowUpMessage?: (args: { prompt: string }) => Promise<void> | void;
  toolOutput?: unknown;
  openExternal?: (args: { href: string }) => void;
};

declare global {
  interface Window {
    openai?: OpenAiHost;
  }
}
