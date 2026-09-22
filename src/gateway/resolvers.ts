import { GatewayContext } from "./context";
import {
  fetchAllNotes,
  fetchAllUsers,
  fetchNoteById,
  fetchUserById,
  NoteDTO,
  UserDTO,
} from "./rest-clients";

interface IdArgs {
  id: string;
}

export const resolvers = {
  Query: {
    users: (): Promise<UserDTO[]> => fetchAllUsers(),
    notes: (): Promise<NoteDTO[]> => fetchAllNotes(),
    user: (_parent: unknown, args: IdArgs): Promise<UserDTO | null> => fetchUserById(args.id),
    note: (_parent: unknown, args: IdArgs): Promise<NoteDTO | null> => fetchNoteById(args.id),
  },
  User: {
    notes: (parent: UserDTO, _args: unknown, context: GatewayContext): Promise<NoteDTO[]> =>
      context.notesByAuthorLoader.load(parent.id),
  },
  Note: {
    // The whole point of the project: this resolver runs once per Note in
    // the result set, but `userLoader.load` batches all of those calls
    // issued within the same tick into a single HTTP request.
    author: (
      parent: NoteDTO,
      _args: unknown,
      context: GatewayContext
    ): Promise<UserDTO | null> => context.userLoader.load(parent.authorId),
  },
};
