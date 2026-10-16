import { afterEach, expect, it, vi } from "vitest";
import { createNotesByAuthorLoader } from "../src/gateway/loaders";

afterEach(() => vi.unstubAllGlobals());
it("shares one notes snapshot across separate batches within a request", async () => {
  const notes = [
    { id: "n1", authorId: "a", title: "First", body: "one" },
    { id: "n2", authorId: "b", title: "Second", body: "two" }
  ];
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => notes });
  vi.stubGlobal("fetch", fetch);
  const loader = createNotesByAuthorLoader();
  expect(await loader.load("a")).toEqual([notes[0]]);
  // Awaiting above forces the next key into a later DataLoader batch.
  expect(await loader.load("b")).toEqual([notes[1]]);
  expect(await loader.load("missing")).toEqual([]);
  expect(fetch).toHaveBeenCalledTimes(1);
  const anotherRequest = createNotesByAuthorLoader();
  await anotherRequest.load("a");
  expect(fetch).toHaveBeenCalledTimes(2);
});
