import { getVideogenEnvironment, type VideogenEnvironment } from "./env";

/**
 * ChatGPT / MCP Apps must not open signed R2/GCS URLs via `openExternal` —
 * hosts append query params (e.g. `redirectUrl`) and break the signature.
 * Link to the in-app Media page with the file modal open instead.
 * See `.cursor/rules/no-signed-storage-urls-in-external-widgets.mdc`.
 *
 * The `/media?storageFileId=` query value may be a `vg_file_…` API id or an
 * internal UUID — the app converts either to the storage-file UUID.
 */

export const MEDIA_STORAGE_FILE_ID_SEARCH_PARAM = "storageFileId";

const APP_BASE_URL_BY_ENV: Record<VideogenEnvironment, string> = {
  PROD: "https://app.videogen.io",
  PRERELEASE: "https://prerelease.app.videogen.io",
  DEV: "https://dev.app.videogen.io",
  STAGING: "https://staging.app.videogen.io",
  LOCAL: "http://localhost:3000",
};

/**
 * Local mirror of the `vg_file_` base62-UUID codec. The canonical encoder /
 * decoder is `core/src/helpers/CoreApiIdH.ts` (STORAGE_FILE), also mirrored in
 * `base/src/logic/storage/resolveStorageFileIdFromMediaRouteParam.ts`. `@videogen/mcp`
 * is published as a standalone package and cannot import from `core` / `base`,
 * so the alphabet + length are duplicated here. Keep them identical, and keep
 * the shared round-trip test vector in sync across `mediaPageUrl.test.ts`,
 * `resolveStorageFileIdFromMediaRouteParam.test.ts`, and the CoreApiIdH tests so
 * any drift fails a test.
 */
const VG_FILE_PREFIX = "vg_file_";
const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE62_UUID_LENGTH = 22;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const base62ToBigInt = (encoded: string): bigint | null => {
  let value = 0n;

  for (const char of encoded) {
    const index = BASE62_ALPHABET.indexOf(char);
    if (index < 0) {
      return null;
    }

    value = value * 62n + BigInt(index);
  }

  return value;
};

const decodeUuidCompact = (encoded: string): string | null => {
  if (encoded.length !== BASE62_UUID_LENGTH) {
    return null;
  }

  const value = base62ToBigInt(encoded);
  if (value == null || value >= 1n << 128n) {
    return null;
  }

  const bytes = Buffer.alloc(16);
  let remaining = value;

  for (let i = 15; i >= 0; i--) {
    bytes[i] = Number(remaining & 0xffn);
    remaining = remaining >> 8n;
  }

  const hex = bytes.toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

/**
 * True when `fileId` is a storage UUID or a decodable `vg_file_…` API id.
 * Used only to avoid minting dead Media links for garbage ids.
 */
export const getIsMediaRouteFileIdParamValue = (fileId: string): boolean => {
  if (UUID_RE.test(fileId)) {
    return true;
  }

  if (!fileId.startsWith(VG_FILE_PREFIX)) {
    return false;
  }

  const decoded = decodeUuidCompact(fileId.slice(VG_FILE_PREFIX.length));
  return decoded != null && UUID_RE.test(decoded);
};

/**
 * Absolute `/media?storageFileId=…` URL. Prefers leaving `vg_file_…` in the
 * query (API/MCP native form); the app converts it to the UUID on open.
 */
export const buildMediaPageUrlForApiFileId = ({
  fileId,
  environment = getVideogenEnvironment(),
}: {
  fileId: string;
  environment?: VideogenEnvironment;
}): string | null => {
  if (!getIsMediaRouteFileIdParamValue(fileId)) {
    return null;
  }

  const baseUrl = APP_BASE_URL_BY_ENV[environment].replace(/\/+$/, "");
  const searchParams = new URLSearchParams();
  searchParams.set(MEDIA_STORAGE_FILE_ID_SEARCH_PARAM, fileId);

  return `${baseUrl}/media?${searchParams.toString()}`;
};

/** Absolute Media URL when you already have the internal storage-file UUID. */
export const buildMediaPageUrlForStorageFileId = ({
  storageFileId,
  environment = getVideogenEnvironment(),
}: {
  storageFileId: string;
  environment?: VideogenEnvironment;
}): string | null => buildMediaPageUrlForApiFileId({ fileId: storageFileId, environment });
