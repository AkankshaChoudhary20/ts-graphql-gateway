import { afterEach, expect, it, vi } from "vitest";
import { fetchUserById, fetchNoteById, fetchUsersByIds } from "../src/gateway/rest-clients";

afterEach(() => vi.unstubAllGlobals());

it("encodes IDs as individual path segments", async () => {
  const mock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "test" }) });
  vi.stubGlobal("fetch", mock);
  const id = "a/b?admin=true#fragment";
  await fetchUserById(id);
  expect(mock.mock.calls[0][0]).toContain(`/users/${encodeURIComponent(id)}`);
  await fetchNoteById(id);
  expect(mock.mock.calls[1][0]).toContain(`/notes/${encodeURIComponent(id)}`);
});

it("keeps special batch IDs inside the ids query parameter", async () => {
  const mock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
  vi.stubGlobal("fetch", mock);
  await fetchUsersByIds(["a&admin=true", "b#fragment", "a&admin=true"]);
  const url = new URL(mock.mock.calls[0][0]);
  expect(url.searchParams.get("ids")).toBe("a&admin=true,b#fragment");
  expect([...url.searchParams.keys()]).toEqual(["ids"]);
  expect(url.hash).toBe("");
});
