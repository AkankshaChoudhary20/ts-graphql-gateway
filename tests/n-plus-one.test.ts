import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchUserById } from "../src/gateway/rest-clients";
import { startTestGateway, startTestServices, TestGateway, TestServices } from "./test-utils";

describe("N+1 fix: DataLoader batches Note.author lookups", () => {
  let services: TestServices;
  let gateway: TestGateway;

  beforeAll(async () => {
    services = await startTestServices(4101, 4102);
    gateway = await startTestGateway(4100);
  });

  afterAll(async () => {
    await gateway.close();
    await services.close();
  });

  it("issues exactly ONE batched request to usersService when resolving author for 30 notes", async () => {
    await services.resetStats();

    const query = /* GraphQL */ `
      query {
        notes {
          id
          title
          author {
            id
            name
          }
        }
      }
    `;

    const result = await gateway.query(query);

    expect(result.errors).toBeUndefined();
    const notes = result.data.notes as Array<{ author: { id: string; name: string } }>;

    // Sanity: we actually resolved all 30 notes with a real author attached.
    expect(notes).toHaveLength(30);
    for (const note of notes) {
      expect(note.author).toBeTruthy();
      expect(typeof note.author.name).toBe("string");
    }

    const stats = await services.usersStats();

    // This is the crux of the project: without DataLoader batching, resolving
    // `author` for 30 notes would fire 30 separate GET /users/:id requests
    // (the classic N+1 problem). With batching, all 30 `userLoader.load()`
    // calls collapse into a single GET /users?ids=... request.
    expect(stats.listRequestCount).toBe(1);
    expect(stats.getByIdRequestCount).toBe(0);
  });

  it("contrast: resolving the same 30 authors WITHOUT the loader fires 30 individual requests", async () => {
    await services.resetStats();

    const notesRes = await fetch(`${services.notesUrl}/notes`);
    const notes = (await notesRes.json()) as Array<{ authorId: string }>;
    await services.resetStats();

    // Deliberately bypass the DataLoader to demonstrate the naive N+1 path.
    await Promise.all(notes.map((n) => fetchUserById(n.authorId)));

    const stats = await services.usersStats();
    expect(stats.getByIdRequestCount).toBe(30);
    expect(stats.listRequestCount).toBe(0);
  });
});
