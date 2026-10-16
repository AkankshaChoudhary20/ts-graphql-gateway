/**
 * Thin HTTP clients for the two REST microservices. Base URLs are read from
 * environment variables *at call time* (not at module load time) so tests
 * can point the gateway at ephemeral test-service ports without worrying
 * about import ordering.
 */

export interface UserDTO {
  id: string;
  name: string;
  email: string;
}

export interface NoteDTO {
  id: string;
  title: string;
  body: string;
  authorId: string;
}

function usersBaseUrl(): string {
  return process.env.USERS_SERVICE_URL ?? "http://localhost:4001";
}

function notesBaseUrl(): string {
  return process.env.NOTES_SERVICE_URL ?? "http://localhost:4002";
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed with status ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchAllUsers(): Promise<UserDTO[]> {
  return getJson<UserDTO[]>(`${usersBaseUrl()}/users`);
}

export async function fetchUserById(id: string): Promise<UserDTO | null> {
  const res = await fetch(`${usersBaseUrl()}/users/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Request to fetch user ${id} failed with status ${res.status}`);
  }
  return (await res.json()) as UserDTO;
}

/**
 * Batched user lookup by id — this is the single HTTP call that the
 * gateway's DataLoader collapses many per-note author lookups into.
 */
export async function fetchUsersByIds(ids: readonly string[]): Promise<UserDTO[]> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return [];
  return getJson<UserDTO[]>(`${usersBaseUrl()}/users?ids=${encodeURIComponent(unique.join(","))}`);
}

export async function fetchAllNotes(): Promise<NoteDTO[]> {
  return getJson<NoteDTO[]>(`${notesBaseUrl()}/notes`);
}

export async function fetchNoteById(id: string): Promise<NoteDTO | null> {
  const res = await fetch(`${notesBaseUrl()}/notes/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Request to fetch note ${id} failed with status ${res.status}`);
  }
  return (await res.json()) as NoteDTO;
}
