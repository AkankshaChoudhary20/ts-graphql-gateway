import DataLoader from "dataloader";
import { createNotesByAuthorLoader, createUserLoader } from "./loaders";
import { NoteDTO, UserDTO } from "./rest-clients";

export interface GatewayContext {
  userLoader: DataLoader<string, UserDTO | null>;
  notesByAuthorLoader: DataLoader<string, NoteDTO[]>;
}

/**
 * A fresh set of loaders per GraphQL request/execution — DataLoader caches
 * are request-scoped so data can't leak or go stale across requests.
 */
export function createContext(): GatewayContext {
  return {
    userLoader: createUserLoader(),
    notesByAuthorLoader: createNotesByAuthorLoader(),
  };
}
