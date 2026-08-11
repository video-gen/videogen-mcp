import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MEDIA_STORAGE_FILE_ID_SEARCH_PARAM,
  buildMediaPageUrlForApiFileId,
  buildMediaPageUrlForStorageFileId,
  getIsMediaRouteFileIdParamValue,
} from "./mediaPageUrl";

const STORAGE_FILE_UUID = "f7ea856b-2781-4130-8107-29bae614b72d";
const API_FILE_ID = "vg_file_7XoHR4wyGOlFKNmQeINtl7";

void test("buildMediaPageUrlForApiFileId keeps vg_file_ in the query param", () => {
  assert.equal(
    buildMediaPageUrlForApiFileId({ fileId: API_FILE_ID, environment: "PROD" }),
    `https://app.videogen.io/media?${MEDIA_STORAGE_FILE_ID_SEARCH_PARAM}=${API_FILE_ID}`,
  );
});

void test("buildMediaPageUrlForStorageFileId accepts raw UUIDs", () => {
  assert.equal(
    buildMediaPageUrlForStorageFileId({
      storageFileId: STORAGE_FILE_UUID,
      environment: "DEV",
    }),
    `https://dev.app.videogen.io/media?${MEDIA_STORAGE_FILE_ID_SEARCH_PARAM}=${STORAGE_FILE_UUID}`,
  );
});

void test("getIsMediaRouteFileIdParamValue accepts UUID and vg_file_", () => {
  assert.equal(getIsMediaRouteFileIdParamValue(STORAGE_FILE_UUID), true);
  assert.equal(getIsMediaRouteFileIdParamValue(API_FILE_ID), true);
  assert.equal(getIsMediaRouteFileIdParamValue("vg_proj_abc"), false);
  assert.equal(getIsMediaRouteFileIdParamValue("vg_file_nope"), false);
});

void test("buildMediaPageUrlForApiFileId returns null for garbage ids", () => {
  assert.equal(buildMediaPageUrlForApiFileId({ fileId: "vg_file_nope", environment: "DEV" }), null);
});
