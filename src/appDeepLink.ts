import {
  getVideogenEnvironmentForBaseUrl,
  readBaseUrl,
  type VideogenEnvironment,
} from "./env";

/**
 * MCP-side mirror of `@videogen/base` `assistantDeepLink` URL building.
 * Kept local so the published MCP package does not depend on `@videogen/base`
 * (Docker/npm closure is mcp + sdk only). Keep query keys and path maps in sync
 * with `base/src/logic/assistant/assistantDeepLink.ts`.
 */

const ACTION_PARAM = "vg_action";
const FEEDBACK_CATEGORY_PARAM = "vg_feedback_category";
const FEEDBACK_TEXT_PARAM = "vg_feedback_text";
const PROVIDER_PARAM = "vg_provider";
const CAPABILITY_PARAM = "vg_capability";
const LOCALE_PARAM = "vg_locale";

const MAX_FEEDBACK_TEXT_LENGTH = 500;

// Kept local because the published MCP package cannot depend on internal workspace packages.
// Must stay identical to `APP_LOCALES` in `static/src/app/locales.ts`.
const ACTIVE_APP_DEEP_LINK_LOCALES = [
  "cs",
  "de",
  "el",
  "en",
  "es",
  "fr",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "ko",
  "pl",
  "pt",
  "ro",
  "th",
  "tr",
  "uk",
  "vi",
  "zh",
] as const;

const ACTIVE_APP_DEEP_LINK_LOCALE_SET = new Set<string>(ACTIVE_APP_DEEP_LINK_LOCALES);

const getSupportedSuggestedLocaleOrNull = ({
  suggestedLocale,
}: {
  suggestedLocale: string | null | undefined;
}): string | null => {
  if (suggestedLocale == null || suggestedLocale.length === 0) {
    return null;
  }

  if (!ACTIVE_APP_DEEP_LINK_LOCALE_SET.has(suggestedLocale)) {
    return null;
  }

  return suggestedLocale;
};

const RATE_CARD_URL = "https://videogen.io/rate-card";
const HELP_DOCS_BASE_URL = "https://help.videogen.io";
const API_DOCS_URL = "https://docs.videogen.io";

const NAVIGATION_DESTINATION_TO_PATH: Record<string, string> = {
  DASHBOARD: "/",
  NEW_PROJECT: "/new",
  PROJECTS: "/projects",
  TEMPLATES: "/collection/templates",
  PRESETS: "/presets",
  MEDIA: "/media",
  BILLING_SETTINGS: "/settings/billing",
  TEAM: "/team",
  TEAM_SETTINGS: "/settings/team",
  ACCOUNT_SETTINGS: "/settings/account",
  SUPPORT: "/support",
  USAGE: "/usage",
  DEVELOPERS: "/api",
  ENTITIES: "/entities",
  AUTOMATIONS: "/integrations",
  INTEGRATIONS: "/integrations",
  DONE_FOR_YOU: "/creative-services",
};

const EXTERNAL_NAVIGATION_DESTINATION_TO_URL: Record<string, string> = {
  HELP_CENTER: `${HELP_DOCS_BASE_URL}/`,
  API_DOCS: `${API_DOCS_URL}/`,
};

export type AppDeepLinkAction =
  | { type: "OPEN_UPGRADE" }
  | { type: "OPEN_ENABLE_TOP_UPS" }
  | { type: "OPEN_INVITE_TEAMMATES" }
  | { type: "OPEN_PURCHASE_CREDITS" }
  | { type: "OPEN_SUBMIT_FEEDBACK"; category?: string | null; text?: string | null }
  | { type: "OPEN_RATE_CARD" }
  | { type: "OPEN_HELP_ARTICLE"; articleSlug: string }
  | { type: "OPEN_MANAGE_INTEGRATION"; provider: string }
  | { type: "OPEN_INTEGRATIONS_PICKER"; capability?: string | null }
  | { type: "OPEN_LANGUAGE_SELECTOR"; suggestedLocale?: string | null }
  | { type: "NAVIGATE"; destination: string };

const getAppBaseUrl = (environment: VideogenEnvironment): string => {
  switch (environment) {
    case "PROD":
      return "https://app.videogen.io";
    case "PRERELEASE":
      return "https://prerelease.app.videogen.io";
    case "DEV":
      return "https://dev.app.videogen.io";
    case "LOCAL":
      return "http://localhost:3000";
  }
};

const joinAppUrl = ({ baseUrl, path }: { baseUrl: string; path: string }): string => {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  if (path === "/" || path === "") {
    return normalizedBase;
  }

  return `${normalizedBase}${path.startsWith("/") ? path : `/${path}`}`;
};

const appendSearchParams = ({
  baseUrl,
  searchParams,
}: {
  baseUrl: string;
  searchParams: URLSearchParams;
}): string => {
  const query = searchParams.toString();
  if (query.length === 0) {
    return baseUrl;
  }

  return `${baseUrl}?${query}`;
};

const truncateFeedbackText = (text: string): string => {
  if (text.length <= MAX_FEEDBACK_TEXT_LENGTH) {
    return text;
  }

  return text.slice(0, MAX_FEEDBACK_TEXT_LENGTH);
};

/**
 * Builds an absolute VideoGen app (or public docs) URL for an assistant COMMON
 * deep-link action on the app stack corresponding to this MCP server's resolved
 * API base URL.
 */
export function buildAppDeepLinkUrl(action: AppDeepLinkAction): string {
  const environment = getVideogenEnvironmentForBaseUrl({ baseUrl: readBaseUrl() });
  const appBase = getAppBaseUrl(environment);

  switch (action.type) {
    case "OPEN_UPGRADE": {
      const searchParams = new URLSearchParams();
      searchParams.set(ACTION_PARAM, action.type);
      return appendSearchParams({
        baseUrl: joinAppUrl({ baseUrl: appBase, path: "/" }),
        searchParams,
      });
    }
    case "OPEN_ENABLE_TOP_UPS": {
      return joinAppUrl({ baseUrl: appBase, path: "/enable-top-ups" });
    }
    case "OPEN_INVITE_TEAMMATES": {
      const searchParams = new URLSearchParams();
      searchParams.set(ACTION_PARAM, action.type);
      return appendSearchParams({
        baseUrl: joinAppUrl({ baseUrl: appBase, path: "/" }),
        searchParams,
      });
    }
    case "OPEN_PURCHASE_CREDITS": {
      const searchParams = new URLSearchParams();
      searchParams.set(ACTION_PARAM, action.type);
      return appendSearchParams({
        baseUrl: joinAppUrl({ baseUrl: appBase, path: "/" }),
        searchParams,
      });
    }
    case "OPEN_SUBMIT_FEEDBACK": {
      const searchParams = new URLSearchParams();
      searchParams.set(ACTION_PARAM, action.type);
      if (action.category != null && action.category.length > 0) {
        searchParams.set(FEEDBACK_CATEGORY_PARAM, action.category);
      }
      if (action.text != null && action.text.length > 0) {
        searchParams.set(FEEDBACK_TEXT_PARAM, truncateFeedbackText(action.text));
      }
      return appendSearchParams({
        baseUrl: joinAppUrl({ baseUrl: appBase, path: "/support" }),
        searchParams,
      });
    }
    case "OPEN_RATE_CARD": {
      return RATE_CARD_URL;
    }
    case "OPEN_HELP_ARTICLE": {
      return `${HELP_DOCS_BASE_URL}/?q=${encodeURIComponent(action.articleSlug)}`;
    }
    case "OPEN_MANAGE_INTEGRATION": {
      const searchParams = new URLSearchParams();
      searchParams.set(ACTION_PARAM, action.type);
      searchParams.set(PROVIDER_PARAM, action.provider);
      return appendSearchParams({
        baseUrl: joinAppUrl({ baseUrl: appBase, path: "/" }),
        searchParams,
      });
    }
    case "OPEN_INTEGRATIONS_PICKER": {
      const searchParams = new URLSearchParams();
      searchParams.set(ACTION_PARAM, action.type);
      if (action.capability != null && action.capability.length > 0) {
        searchParams.set(CAPABILITY_PARAM, action.capability);
      }
      return appendSearchParams({
        baseUrl: joinAppUrl({ baseUrl: appBase, path: "/" }),
        searchParams,
      });
    }
    case "OPEN_LANGUAGE_SELECTOR": {
      const searchParams = new URLSearchParams();
      searchParams.set(ACTION_PARAM, action.type);
      const suggestedLocale = getSupportedSuggestedLocaleOrNull({
        suggestedLocale: action.suggestedLocale,
      });
      if (suggestedLocale != null && suggestedLocale.length > 0) {
        searchParams.set(LOCALE_PARAM, suggestedLocale);
      }
      return appendSearchParams({
        baseUrl: joinAppUrl({ baseUrl: appBase, path: "/settings/account" }),
        searchParams,
      });
    }
    case "NAVIGATE": {
      const externalUrl = EXTERNAL_NAVIGATION_DESTINATION_TO_URL[action.destination];
      if (externalUrl != null) {
        return externalUrl;
      }

      const path = NAVIGATION_DESTINATION_TO_PATH[action.destination];
      if (path == null) {
        return joinAppUrl({ baseUrl: appBase, path: "/" });
      }

      return joinAppUrl({ baseUrl: appBase, path });
    }
  }
}

/** Maps MCP tool args into {@link AppDeepLinkAction}. Returns null when invalid. */
export function appDeepLinkActionFromToolArgs(args: {
  action: string;
  destination?: string | undefined;
  articleSlug?: string | undefined;
  provider?: string | undefined;
  capability?: string | null | undefined;
  category?: string | null | undefined;
  text?: string | null | undefined;
  suggestedLocale?: string | null | undefined;
}): AppDeepLinkAction | null {
  switch (args.action) {
    case "OPEN_UPGRADE":
    case "OPEN_ENABLE_TOP_UPS":
    case "OPEN_INVITE_TEAMMATES":
    case "OPEN_PURCHASE_CREDITS":
    case "OPEN_RATE_CARD": {
      return { type: args.action };
    }
    case "OPEN_SUBMIT_FEEDBACK": {
      return {
        type: "OPEN_SUBMIT_FEEDBACK",
        category: args.category ?? null,
        text: args.text ?? null,
      };
    }
    case "OPEN_HELP_ARTICLE": {
      if (args.articleSlug == null || args.articleSlug.length === 0) {
        return null;
      }
      return { type: "OPEN_HELP_ARTICLE", articleSlug: args.articleSlug };
    }
    case "OPEN_MANAGE_INTEGRATION": {
      if (args.provider == null || args.provider.length === 0) {
        return null;
      }
      return { type: "OPEN_MANAGE_INTEGRATION", provider: args.provider };
    }
    case "OPEN_INTEGRATIONS_PICKER": {
      return {
        type: "OPEN_INTEGRATIONS_PICKER",
        capability: args.capability ?? null,
      };
    }
    case "OPEN_LANGUAGE_SELECTOR": {
      const suggestedLocale = getSupportedSuggestedLocaleOrNull({
        suggestedLocale: args.suggestedLocale,
      });

      return {
        type: "OPEN_LANGUAGE_SELECTOR",
        suggestedLocale,
      };
    }
    case "NAVIGATE": {
      if (args.destination == null || args.destination.length === 0) {
        return null;
      }
      return { type: "NAVIGATE", destination: args.destination };
    }
    default: {
      return null;
    }
  }
}
