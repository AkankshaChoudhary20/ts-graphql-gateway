import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestGateway, startTestServices, TestGateway, TestServices } from "./test-utils";

describe("gateway resolver correctness", () => {
  let services: TestServices;
  let gateway: TestGateway;

  beforeAll(async () => {
    services = await startTestServices(4111, 4112);
    gateway = await startTestGateway(4110);
  });

  afterAll(async () => {
    await gateway.close();
    await services.close();
  });

  it("Query.users returns all 10 seeded users", async () => {
    const result = await gateway.query(/* GraphQL */ `
      query {
        users {
          id
          name
          email
        }
      }
    `);

    expect(result.errors).toBeUndefined();
    const users = result.data.users;
    expect(users).toHaveLength(10);
    expect(users[0]).toMatchObject({ id: "1", name: "User 1", email: "user1@example.com" });
  });

  it("Query.notes returns all 30 seeded notes", async () => {
    const result = await gateway.query(/* GraphQL */ `
      query {
        notes {
          id
          title
          body
        }
      }
    `);

    expect(result.errors).toBeUndefined();
    expect(result.data.notes).toHaveLength(30);
  });

  it("Query.note(id) resolves the correct note and its author", async () => {
    const result = await gateway.query(/* GraphQL */ `
      query {
        note(id: "1") {
          id
          title
          author {
            id
            name
          }
        }
      }
    `);

    expect(result.errors).toBeUndefined();
    expect(result.data.note).toMatchObject({
      id: "1",
      title: "Note 1",
      author: { id: "1", name: "User 1" },
    });
  });

  it("Query.user(id) returns null for a nonexistent id", async () => {
    const result = await gateway.query(/* GraphQL */ `
      query {
        user(id: "does-not-exist") {
          id
        }
      }
    `);

    expect(result.errors).toBeUndefined();
    expect(result.data.user).toBeNull();
  });

  it("User.notes resolves only the notes belonging to that user", async () => {
    const result = await gateway.query(/* GraphQL */ `
      query {
        user(id: "1") {
          id
          notes {
            id
          }
        }
      }
    `);

    expect(result.errors).toBeUndefined();
    const user = result.data.user;
    // Users 1..10, notes 1..30 -> user 1 authored notes 1, 11, 21.
    expect(user.notes.map((n: { id: string }) => n.id).sort()).toEqual(["1", "11", "21"]);
  });
});
