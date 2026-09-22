import DataLoader from "dataloader";
import { fetchUsersByIds, UserDTO, NoteDTO, fetchAllNotes } from "./rest-clients";

/**
 * Batches many `userLoader.load(id)` calls issued within the same tick into
 * a single `GET /users?ids=...` request against usersService. This is the
 * fix for the classic GraphQL N+1 problem: without it, resolving `author`
 * for N notes would issue N separate HTTP requests.
 */
export function createUserLoader(): DataLoader<string, UserDTO | null> {
  return new DataLoader<string, UserDTO | null>(async (ids) => {
    const found = await fetchUsersByIds(ids);
    const byId = new Map(found.map((u) => [u.id, u]));
    // DataLoader requires the resolved array to be the same length/order as `ids`.
    return ids.map((id) => byId.get(id) ?? null);
  });
}

/**
 * Caches/batches the "all notes" fetch within a single request so that
 * resolving `User.notes` for many users doesn't repeatedly re-fetch the
 * full notes list. All keys are mapped to the same underlying fetch.
 */
export function createNotesByAuthorLoader(): DataLoader<string, NoteDTO[]> {
  return new DataLoader<string, NoteDTO[]>(async (authorIds) => {
    const allNotes = await fetchAllNotes();
    return authorIds.map((authorId) => allNotes.filter((n) => n.authorId === authorId));
  });
}
