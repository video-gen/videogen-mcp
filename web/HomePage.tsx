import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  createHomeBridge,
  getSafeHomeLink,
  readHomeProjects,
} from "./homeBridge";
import { homeCatalog } from "./homeCatalog";
import { homeStyles } from "./homeStyles";

type HomeBridge = ReturnType<typeof createHomeBridge>;
type Project = NonNullable<ReturnType<typeof readHomeProjects>>[number];
type Example = (typeof homeCatalog.examples)[number];

function HomeLink({
  href,
  appUrl,
  children,
  className,
}: {
  href: string;
  appUrl: string;
  children: ReactNode;
  className?: string;
}): ReactElement {
  const safeHref = getSafeHomeLink(href, appUrl) ?? appUrl;
  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={(event) => {
        if (window.openai?.openExternal == null) return;
        event.preventDefault();
        window.openai.openExternal({ href: safeHref, redirectUrl: false });
      }}
    >
      {children}
    </a>
  );
}

function Shelf({
  title,
  description,
  href,
  appUrl,
  children,
}: {
  title: string;
  description?: string;
  href: string;
  appUrl: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="home-section" aria-label={title}>
      <div className="home-section-header">
        <div>
          <h2>{title}</h2>
          {description != null && (
            <p className="home-section-description">{description}</p>
          )}
        </div>
        <HomeLink href={href} appUrl={appUrl} className="home-view-all">
          View all →
        </HomeLink>
      </div>
      <div className="home-shelf">{children}</div>
    </section>
  );
}

export function HomePage({ appUrl }: { appUrl: string }): ReactElement {
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [category, setCategory] = useState(
    homeCatalog.categories[0]?.value ?? "ADVERTISING",
  );
  const [example, setExample] = useState<Example | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const bridge = useRef<HomeBridge | null>(null);
  const sendingRef = useRef(false);

  async function loadProjects(client: HomeBridge): Promise<void> {
    setLoadingProjects(true);
    try {
      setProjects(
        readHomeProjects(
          await client.callTool("list_projects", { limit: 8, selfOnly: true }),
        ),
      );
    } catch {
      setProjects(null);
    } finally {
      setLoadingProjects(false);
    }
  }

  useEffect(() => {
    const client = createHomeBridge();
    bridge.current = client;
    void loadProjects(client);
    return () => {
      bridge.current = null;
      client.dispose();
    };
  }, []);

  function fillPrompt(value: string): void {
    setPrompt(value);
    input.current?.focus();
    input.current?.scrollIntoView({ behavior: "auto", block: "center" });
  }

  async function submit(): Promise<void> {
    if (sendingRef.current || prompt.trim().length === 0) return;
    const client = bridge.current;
    if (client == null) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      const sent = await client.sendMessage(
        `Use VideoGen to help with this request:\n\n${prompt}`,
      );
      if (!sent)
        setError("Could not start the conversation. Please try again.");
    } catch {
      setError("Could not start the conversation. Please try again.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <div className="home-layout" data-testid="videogen-plugin-home">
      <style>{homeStyles}</style>
      <aside className="home-sidebar">
        <div className="home-logo">
          <img src="https://videogen.io/logos/logo-red.svg" alt="" />
          VideoGen
        </div>
        <nav className="home-nav" aria-label="VideoGen">
          <a href="#home" aria-current="page">
            Home
          </a>
          {[
            { title: "Projects", href: "/projects" },
            { title: "Media", href: "/media" },
            { title: "Entities", href: "/entities" },
            { title: "Team", href: "/team" },
            { title: "Presets", href: "/presets" },
            { title: "Integrations", href: "/integrations" },
            { title: "AI playground", href: "/ai-playground" },
          ].map((link) => (
            <HomeLink key={link.href} href={link.href} appUrl={appUrl}>
              {link.title}
            </HomeLink>
          ))}
        </nav>
      </aside>
      <main id="home" className="home-main">
        <div className="home-hero-band">
          <h1>What do you want to create?</h1>
          <form
            className="home-prompt"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <textarea
              ref={input}
              value={prompt}
              rows={1}
              placeholder="What are you creating?"
              aria-label="What are you creating?"
              disabled={sending}
              onChange={(event) => setPrompt(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
            <div className="home-prompt-toolbar">
              <HomeLink href="/media" appUrl={appUrl} className="home-view-all">
                Media
              </HomeLink>
              <button
                className="home-primary"
                type="submit"
                disabled={sending || prompt.trim().length === 0}
                data-testid="videogen-home-start"
              >
                {sending ? "Starting…" : "Start"}
              </button>
            </div>
          </form>
        </div>
        <div className="home-suggestions">
          {homeCatalog.suggestions.map((suggestion) => (
            <button
              type="button"
              className="home-chip"
              key={suggestion.id}
              disabled={sending}
              onClick={() => fillPrompt(suggestion.text)}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
        {error != null && (
          <p className="home-error home-notice" role="alert">
            {error}
          </p>
        )}
        <div className="home-content">
          <Shelf title="Recent projects" href="/projects" appUrl={appUrl}>
            {loadingProjects ? (
              <p role="status" className="home-empty">
                Loading recent projects…
              </p>
            ) : projects == null ? (
              <div className="home-empty">
                Could not load recent projects.
                <button
                  type="button"
                  onClick={() => {
                    if (bridge.current != null)
                      void loadProjects(bridge.current);
                  }}
                >
                  Try again
                </button>
              </div>
            ) : projects.length === 0 ? (
              <p className="home-empty">Your projects will appear here.</p>
            ) : (
              projects.map((project) => (
                <HomeLink
                  className="home-card"
                  key={project.projectId}
                  href={project.projectUrl}
                  appUrl={appUrl}
                >
                  <span
                    className="home-card-image home-project-cover"
                    aria-hidden="true"
                  >
                    ▷
                  </span>
                  <span className="home-card-title">{project.title}</span>
                </HomeLink>
              ))
            )}
          </Shelf>
          <section className="home-section" aria-label="Learn from examples">
            <div className="home-section-header">
              <h2>Learn from examples</h2>
              <HomeLink
                href="/collection/examples"
                appUrl={appUrl}
                className="home-view-all"
              >
                View all →
              </HomeLink>
            </div>
            <div
              className="home-tabs"
              role="tablist"
              aria-label="Example categories"
            >
              {homeCatalog.categories.map((tab) => (
                <button
                  className="home-tab"
                  role="tab"
                  type="button"
                  id={`category-${tab.value}`}
                  aria-controls="home-examples"
                  aria-selected={category === tab.value}
                  key={tab.value}
                  onClick={() => setCategory(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div
              className="home-shelf"
              id="home-examples"
              role="tabpanel"
              aria-labelledby={`category-${category}`}
            >
              {homeCatalog.examples
                .filter((item) => item.category === category)
                .map((item) => (
                  <button
                    type="button"
                    className="home-card"
                    key={item.id}
                    onClick={() => {
                      setExample(item);
                      dialog.current?.showModal();
                    }}
                  >
                    <img
                      className="home-card-image"
                      src={item.thumbnailUrl}
                      alt=""
                      loading="lazy"
                    />
                    <span className="home-card-title">{item.title}</span>
                  </button>
                ))}
            </div>
          </section>
          <Shelf
            title="Featured workflows"
            description="Popular starting points to get going fast."
            href="/collection/featured"
            appUrl={appUrl}
          >
            {homeCatalog.workflows.map((workflow) => (
              <button
                type="button"
                className="home-card"
                key={workflow.title}
                disabled={sending}
                onClick={() =>
                  fillPrompt(`Help me create a video using ${workflow.title}. `)
                }
              >
                <img
                  className="home-card-image"
                  src={workflow.thumbnailUrl}
                  alt=""
                  loading="lazy"
                />
                <span className="home-card-title">{workflow.title}</span>
                <span
                  className="home-card-description"
                  title={workflow.description}
                >
                  {workflow.description}
                </span>
              </button>
            ))}
          </Shelf>
          <HomeLink
            href="/integrations"
            appUrl={appUrl}
            className="home-banner"
          >
            <strong>Connect your tools</strong>
            <span>Browse →</span>
          </HomeLink>
          {homeCatalog.collections.map((collection) => (
            <Shelf
              key={collection.slug}
              title={collection.title}
              description={collection.description}
              href={`/collection/${collection.slug}`}
              appUrl={appUrl}
            >
              {collection.cards.map((card) => (
                <HomeLink
                  key={card.title}
                  className="home-card home-card-square"
                  href={`/collection/${collection.slug}`}
                  appUrl={appUrl}
                >
                  {card.thumbnailUrl != null && (
                    <img
                      className="home-card-image"
                      src={card.thumbnailUrl}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  <span className="home-card-title">{card.title}</span>
                </HomeLink>
              ))}
              <HomeLink
                className="home-card home-card-square"
                href={`/collection/${collection.slug}`}
                appUrl={appUrl}
              >
                <span
                  className="home-card-image home-project-cover"
                  aria-hidden="true"
                >
                  +
                </span>
                <span className="home-card-title">Create new</span>
              </HomeLink>
            </Shelf>
          ))}
          <Shelf
            title="Video templates"
            description="Start from an editable video template and customize it in the editor."
            href="/collection/templates"
            appUrl={appUrl}
          >
            {homeCatalog.templates.map((template) => (
              <HomeLink
                key={template.title}
                className="home-card"
                href="/collection/templates"
                appUrl={appUrl}
              >
                <img
                  className="home-card-image"
                  src={template.thumbnailUrl}
                  alt=""
                  loading="lazy"
                />
                <span className="home-card-title">{template.title}</span>
                <span className="home-card-description">
                  {template.description}
                </span>
              </HomeLink>
            ))}
          </Shelf>
          <section className="home-section">
            <div className="home-section-header">
              <div>
                <h2>Quick AI tools</h2>
                <p className="home-section-description">
                  Generate a single image, clip, or voiceover without starting a
                  project.
                </p>
              </div>
              <HomeLink
                href="/ai-playground"
                appUrl={appUrl}
                className="home-view-all"
              >
                View all →
              </HomeLink>
            </div>
            <div className="home-tools">
              {[
                { title: "AI image", value: "GENERATE_IMAGE" },
                { title: "AI voiceover", value: "TEXT_TO_SPEECH" },
                { title: "AI avatar", value: "GENERATE_AVATAR" },
                { title: "AI sound effect", value: "GENERATE_SOUND_EFFECT" },
                { title: "AI music", value: "GENERATE_MUSIC" },
                { title: "Convert to SVG", value: "VECTORIZE_IMAGE" },
                { title: "Remove background", value: "REMOVE_BACKGROUND" },
                { title: "Upscale", value: "UPSCALE" },
                { title: "Add 3D motion", value: "IMAGE_3D_EFFECT" },
                { title: "Motion graphic", value: "GENERATE_MOTION_GRAPHIC" },
                { title: "AI video clip", value: "GENERATE_VIDEO_CLIP" },
              ].map((tool) => (
                <HomeLink
                  key={tool.value}
                  className="home-chip"
                  href={`/ai-playground?tool=${tool.value}`}
                  appUrl={appUrl}
                >
                  {tool.title}
                </HomeLink>
              ))}
            </div>
          </section>
          <section className="home-bottom">
            <h2>What do you want to create?</h2>
            <button
              className="home-primary"
              type="button"
              onClick={() => fillPrompt(prompt)}
            >
              Start creating
            </button>
          </section>
        </div>
        <dialog
          ref={dialog}
          className="home-dialog"
          aria-label={example?.title ?? "Example video"}
          onClose={() => setExample(null)}
        >
          {example != null && (
            <>
              <h2>{example.title}</h2>
              <video
                key={example.id}
                src={example.videoUrl}
                poster={example.thumbnailUrl}
                controls
                playsInline
              />
              <p>{example.prompt}</p>
              <div className="home-dialog-actions">
                <button type="button" onClick={() => dialog.current?.close()}>
                  Close
                </button>
                <button
                  type="button"
                  className="home-primary"
                  onClick={() => {
                    dialog.current?.close();
                    fillPrompt(example.prompt);
                  }}
                >
                  Use this example
                </button>
              </div>
            </>
          )}
        </dialog>
      </main>
    </div>
  );
}
