import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPersistedMediaWidgetState,
  extractMediaItems,
  getMediaItemsNeedingRehydrate,
  mergeMediaItemsWithPersistedState,
  readPersistedMediaItems,
  rehydrateMediaItems,
  type MediaItem,
} from "./mediaPreviewExtract";

const FILE_ID = "vg_file_7XoHR4wyGOlFKNmQeINtl7";
const DOWNLOAD_URL = "https://storage.googleapis.com/x/horn.mp3";
const APP_MEDIA_URL = `http://localhost:3000/media?storageFileId=${FILE_ID}`;

void test("extractMediaItems keeps fileId rows when downloadUrl is missing", () => {
  const items = extractMediaItems({
    status: "succeeded",
    results: [
      {
        type: "AUDIO",
        fileId: FILE_ID,
        appMediaUrl: APP_MEDIA_URL,
      },
    ],
  });

  assert.deepEqual(items, [
    {
      kind: "audio",
      previewUrl: null,
      appMediaUrl: APP_MEDIA_URL,
      fileId: FILE_ID,
      label: null,
    },
  ]);
});

void test("mergeMediaItemsWithPersistedState restores preview URLs from widgetState", () => {
  const fromToolOutput: MediaItem[] = [
    {
      kind: "audio",
      previewUrl: null,
      appMediaUrl: APP_MEDIA_URL,
      fileId: FILE_ID,
      label: null,
    },
  ];
  const fromWidgetState: MediaItem[] = [
    {
      kind: "audio",
      previewUrl: DOWNLOAD_URL,
      appMediaUrl: APP_MEDIA_URL,
      fileId: FILE_ID,
      label: "horn.mp3",
    },
  ];

  assert.deepEqual(
    mergeMediaItemsWithPersistedState({ fromToolOutput, fromWidgetState }),
    [
      {
        kind: "audio",
        previewUrl: DOWNLOAD_URL,
        appMediaUrl: APP_MEDIA_URL,
        fileId: FILE_ID,
        label: "horn.mp3",
      },
    ],
  );
});

void test("mergeMediaItemsWithPersistedState falls back to widgetState when toolOutput is empty", () => {
  const fromWidgetState: MediaItem[] = [
    {
      kind: "audio",
      previewUrl: DOWNLOAD_URL,
      appMediaUrl: APP_MEDIA_URL,
      fileId: FILE_ID,
      label: null,
    },
  ];

  assert.deepEqual(
    mergeMediaItemsWithPersistedState({ fromToolOutput: [], fromWidgetState }),
    fromWidgetState,
  );
});

void test("readPersistedMediaItems / buildPersistedMediaWidgetState round-trip", () => {
  const items: MediaItem[] = [
    {
      kind: "image",
      previewUrl: "https://example.com/a.png",
      appMediaUrl: APP_MEDIA_URL,
      fileId: FILE_ID,
      label: "shot",
    },
  ];

  const state = buildPersistedMediaWidgetState(items);
  assert.deepEqual(readPersistedMediaItems(state), items);
  assert.deepEqual(readPersistedMediaItems({ v: 2, items }), []);
});

void test("rehydrateMediaItems calls get_file for missing preview URLs", async () => {
  const items: MediaItem[] = [
    {
      kind: "audio",
      previewUrl: null,
      appMediaUrl: APP_MEDIA_URL,
      fileId: FILE_ID,
      label: null,
    },
  ];

  let calledWith: unknown = null;
  const hydrated = await rehydrateMediaItems({
    items,
    callTool: async (name, args) => {
      calledWith = { name, args };
      return {
        structuredContent: {
          fileId: FILE_ID,
          type: "AUDIO",
          downloadUrl: DOWNLOAD_URL,
          appMediaUrl: APP_MEDIA_URL,
          displayName: "horn.mp3",
        },
      };
    },
  });

  assert.deepEqual(calledWith, { name: "get_file", args: { fileId: FILE_ID } });
  assert.equal(getMediaItemsNeedingRehydrate(hydrated).length, 0);
  assert.deepEqual(hydrated, [
    {
      kind: "audio",
      previewUrl: DOWNLOAD_URL,
      appMediaUrl: APP_MEDIA_URL,
      fileId: FILE_ID,
      label: "horn.mp3",
    },
  ]);
});
