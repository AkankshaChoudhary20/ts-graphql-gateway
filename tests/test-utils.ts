import { createServer, Server } from "node:http";
import { createUsersApp } from "../src/services/users";
import { createNotesApp } from "../src/services/notes";
import { createGatewayYoga } from "../src/gateway/server";

export interface TestServices {
  usersServer: Server;
  notesServer: Server;
  usersUrl: string;
  notesUrl: string;
  usersStats: () => Promise<{ listRequestCount: number; getByIdRequestCount: number }>;
  notesStats: () => Promise<{ listRequestCount: number; getByIdRequestCount: number }>;
  resetStats: () => Promise<void>;
  close: () => Promise<void>;
}

function listen(app: ReturnType<typeof createUsersApp>, port: number): Promise<Server> {
  return new Promise((resolve) => {
    const server = app.listen(port, () => resolve(server));
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Spins up real, isolated instances of usersService and notesService on
 * ephemeral test ports, and points the gateway's REST clients at them via
 * env vars. This lets tests exercise the *actual* HTTP path (gateway ->
 * fetch -> Express handler) rather than mocking it away.
 */
export async function startTestServices(usersPort: number, notesPort: number): Promise<TestServices> {
  const usersServer = await listen(createUsersApp(), usersPort);
  const notesServer = await listen(createNotesApp(), notesPort);

  const usersUrl = `http://localhost:${usersPort}`;
  const notesUrl = `http://localhost:${notesPort}`;

  process.env.USERS_SERVICE_URL = usersUrl;
  process.env.NOTES_SERVICE_URL = notesUrl;

  return {
    usersServer,
    notesServer,
    usersUrl,
    notesUrl,
    usersStats: async () => (await fetch(`${usersUrl}/_debug/stats`)).json(),
    notesStats: async () => (await fetch(`${notesUrl}/_debug/stats`)).json(),
    resetStats: async () => {
      await fetch(`${usersUrl}/_debug/reset`);
      await fetch(`${notesUrl}/_debug/reset`);
    },
    close: async () => {
      await close(usersServer);
      await close(notesServer);
    },
  };
}

export interface TestGateway {
  url: string;
  query: (source: string, variables?: Record<string, unknown>) => Promise<any>;
  close: () => Promise<void>;
}

/**
 * Starts the real gateway (graphql-yoga over node:http) on a test port.
 * Tests talk to it over actual HTTP, exactly like a real client would,
 * rather than reaching into graphql-js internals directly — this sidesteps
 * dual-package-instance issues between the top-level `graphql` module and
 * the one graphql-yoga bundles, and is a more faithful integration test.
 */
export async function startTestGateway(port: number): Promise<TestGateway> {
  const yoga = createGatewayYoga();
  const server = createServer(yoga);
  await new Promise<void>((resolve) => server.listen(port, () => resolve()));
  const url = `http://localhost:${port}/graphql`;

  return {
    url,
    query: async (source: string, variables?: Record<string, unknown>) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: source, variables }),
      });
      return res.json();
    },
    close: () => close(server),
  };
}
