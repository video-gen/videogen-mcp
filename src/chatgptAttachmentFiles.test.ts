import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAllowedChatgptAttachmentDownloadUrl,
  readChatgptAttachments,
  readFreshDownloadUrl,
  uploadBytesToVideoGen,
} from "./chatgptAttachmentFiles";

const ALLOWED_URL = "https://files.oaiusercontent.com/attachment";

void test("accepts ChatGPT attachment download hosts and rejects everything else", () => {
  assert.equal(isAllowedChatgptAttachmentDownloadUrl(ALLOWED_URL), true);
  assert.equal(isAllowedChatgptAttachmentDownloadUrl("https://oaiusercontent.com/attachment"), true);
  assert.equal(isAllowedChatgptAttachmentDownloadUrl("https://cdn.files.oaiusercontent.com/attachment"), true);
  assert.equal(isAllowedChatgptAttachmentDownloadUrl("http://files.oaiusercontent.com/attachment"), false);
  assert.equal(isAllowedChatgptAttachmentDownloadUrl("https://files.oaiusercontent.com.evil.com/attachment"), false);
  assert.equal(isAllowedChatgptAttachmentDownloadUrl("https://evil.com/attachment"), false);
  assert.equal(isAllowedChatgptAttachmentDownloadUrl("not a url"), false);
});

void test("reads ChatGPT file params and drops a download URL on a disallowed host", () => {
  const attachments = readChatgptAttachments({
    files: [
      {
        download_url: ALLOWED_URL,
        file_id: "file_photo",
        file_name: "IMG_1320.jpeg",
        mime_type: "image/jpeg",
      },
      {
        download_url: "https://evil.com/photo.jpg",
        file_id: "file_other",
      },
      { download_url: ALLOWED_URL },
    ],
  });

  assert.deepEqual(attachments, [
    {
      fileId: "file_photo",
      downloadUrl: ALLOWED_URL,
      fileName: "IMG_1320.jpeg",
      mimeType: "image/jpeg",
    },
    {
      fileId: "file_other",
      downloadUrl: null,
      fileName: null,
      mimeType: null,
    },
  ]);
  assert.deepEqual(readChatgptAttachments({ files: "nope" }), []);
  assert.equal(readFreshDownloadUrl({ downloadUrl: ALLOWED_URL }), ALLOWED_URL);
  assert.equal(readFreshDownloadUrl({ downloadUrl: "https://evil.com/x" }), null);
});

void test("puts file bytes with no Content-Type and only after they exist", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let putInit: { method: string; body: ArrayBuffer; headers?: unknown } | undefined;

  const result = await uploadBytesToVideoGen({
    bytes,
    displayName: "IMG_1320.jpeg",
    callTool: (name, args) => {
      calls.push({ name, args });

      if (name === "create_file_upload") {
        return Promise.resolve({
          structuredContent: {
            fileId: "vg_file_test",
            uploadUrl: "https://bucket.r2.cloudflarestorage.com/put",
          },
        });
      }

      return Promise.resolve({ structuredContent: { fileId: "vg_file_test" } });
    },
    putBytes: (_uploadUrl, init) => {
      putInit = init;

      return Promise.resolve({ ok: true, status: 200 });
    },
  });

  assert.deepEqual(result, { ok: true, fileId: "vg_file_test" });
  assert.deepEqual(calls, [
    { name: "create_file_upload", args: { displayName: "IMG_1320.jpeg" } },
    { name: "get_file", args: { fileId: "vg_file_test", wait: true } },
  ]);
  assert.equal(putInit?.method, "PUT");
  assert.equal(putInit?.body, bytes);
  assert.equal(putInit?.headers, undefined);
});

void test("does not reserve an upload when the file has no bytes", async () => {
  let called = false;

  const result = await uploadBytesToVideoGen({
    bytes: new ArrayBuffer(0),
    displayName: "empty.jpg",
    callTool: () => {
      called = true;

      return Promise.resolve({});
    },
    putBytes: () => {
      called = true;

      return Promise.resolve({ ok: true, status: 200 });
    },
  });

  assert.equal(result.ok, false);
  assert.equal(called, false);
});

void test("does not poll get_file when the storage PUT fails", async () => {
  const calls: string[] = [];

  const result = await uploadBytesToVideoGen({
    bytes: new Uint8Array([9]).buffer,
    displayName: "photo.jpg",
    callTool: (name) => {
      calls.push(name);

      return Promise.resolve({
        structuredContent: {
          fileId: "vg_file_test",
          uploadUrl: "https://bucket.r2.cloudflarestorage.com/put",
        },
      });
    },
    putBytes: () => Promise.resolve({ ok: false, status: 403 }),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(calls, ["create_file_upload"]);
});
