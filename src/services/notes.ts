import express, { Express, Request, Response } from "express";
import type { Server } from "node:http";
import { users } from "./users";

export interface Note {
  id: string;
  title: string;
  body: string;
  authorId: string;
}

// ~30 in-memory notes, spread across the ~10 users above.
export const notes: Note[] = Array.from({ length: 30 }, (_, i) => {
  const id = String(i + 1);
  const author = users[i % users.length]!;
  return {
    id,
    title: `Note ${id}`,
    body: `This is the body of note ${id}, written by ${author.name}.`,
    authorId: author.id,
  };
});

const ARTIFICIAL_LATENCY_MS = 30;

function delay<T>(value: T, ms = ARTIFICIAL_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function createNotesApp(): Express {
  const app = express();

  let listRequestCount = 0;
  let getByIdRequestCount = 0;

  app.get("/notes", async (req: Request, res: Response) => {
    listRequestCount++;
    const idsParam = req.query.ids;
    const result = await delay(
      typeof idsParam === "string" && idsParam.length > 0
        ? notes.filter((n) => idsParam.split(",").includes(n.id))
        : notes
    );
    res.json(result);
  });

  app.get("/notes/:id", async (req: Request, res: Response) => {
    getByIdRequestCount++;
    const note = await delay(notes.find((n) => n.id === req.params.id));
    if (!note) {
      res.status(404).json({ error: `Note ${req.params.id} not found` });
      return;
    }
    res.json(note);
  });

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

export function startNotesService(port = 4002): Server {
  const app = createNotesApp();
  return app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[notesService] listening on http://localhost:${port}`);
  });
}
