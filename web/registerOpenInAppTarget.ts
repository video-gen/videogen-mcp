/** The host helper can arrive after the widget's MCP initialization reply. */
export function registerOpenInAppTarget(href: string): () => void {
  const surface = window;
  const update = (): void => {
    surface.openai?.setOpenInAppUrl?.({ href });
  };
  update();
  surface.addEventListener("openai:set_globals", update);
  return () => surface.removeEventListener("openai:set_globals", update);
}
