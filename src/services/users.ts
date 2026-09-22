import express, { Express, Request, Response } from "express";
import type { Server } from "node:http";

export interface User {
  id: string;
  name: string;
  email: string;
}

// ~10 in-memory users
export const users: User[] = Array.from({ length: 10 }, (_, i) => {
  const id = String(i + 1);
  return {
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
  };
});

const ARTIFICIAL_LATENCY_MS = 30;

function delay<T>(value: T, ms = ARTIFICIAL_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * Builds the usersService Express app. Exposed as a factory (rather than a
 * side-effecting module) so tests can spin up isolated instances on
 * ephemeral ports and inspect request counts.
 */
export function createUsersApp(): Express {
  const app = express();

  // Simple in-memory counters so tests can prove how many HTTP requests
  // actually hit this service (the crux of the N+1 vs. DataLoader story).
  let listRequestCount = 0;
  let getByIdRequestCount = 0;

  // GET /users            -> all users
  // GET /users?ids=1,2,3  -> batched lookup, used by the gateway's DataLoader
  app.get("/users", async (req: Request, res: Response) => {
    listRequestCount++;
    const idsParam = req.query.ids;
    const result = await delay(
      typeof idsParam === "string" && idsParam.length > 0
        ? users.filter((u) => idsParam.split(",").includes(u.id))
        : users
    );
    res.json(result);
  });

  app.get("/users/:id", async (req: Request, res: Response) => {
    getByIdRequestCount++;
    const user = await delay(users.find((u) => u.id === req.params.id));
    if (!user) {
      res.status(404).json({ error: `User ${req.params.id} not found` });
      return;
    }
    res.json(user);
  });

  // Test-only introspection endpoints, not part of the "public" API.
  app.get("/_debug/stats", (_req: Request, res: Response) => {
    res.json({ listRequestCount, getByIdRequestCount });
  });
  app.get("/_debug/reset", (_req: Request, res: Response) => {
    listRequestCount = 0;
    getByIdRequestCount = 0;
    res.json({ ok: true });
  });

  return app;
}

export function startUsersService(port = 4001): Server {
  const app = createUsersApp();
  return app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[usersService] listening on http://localhost:${port}`);
  });
}
