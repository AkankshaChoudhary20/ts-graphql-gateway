# ts-graphql-gateway

A small GraphQL gateway (TypeScript, strict mode) that federates two
independent REST microservices — `usersService` and `notesService` — into a
single GraphQL schema, and demonstrates the classic **N+1 query problem**
plus the fix for it using [`dataloader`](https://github.com/graphql/dataloader).

## Architecture

```
                         GraphQL clients (GraphiQL, curl, apps)
                                      │
                                      │  POST /graphql
                                      ▼
                     ┌───────────────────────────────┐
                     │   gateway  (graphql-yoga)      │
                     │   http://localhost:4000        │
                     │                                │
                     │   Query.users / Query.notes    │
                     │   Note.author  -> DataLoader    │
                     │   User.notes   -> DataLoader    │
                     └───────────────┬────────────────┘
                     real HTTP calls │
              ┌───────────────────────────────────────┐
              │                                        │
              ▼                                        ▼
  ┌────────────────────────┐             ┌──────────────────────────┐
  │   usersService (REST)   │             │   notesService (REST)     │
  │   http://localhost:4001 │             │   http://localhost:4002   │
  │                          │             │                          │
  │  GET /users              │             │  GET /notes               │
  │  GET /users?ids=1,2,3    │◄─batched────│  (notes reference         │
  │  GET /users/:id          │   by the    │   authorId -> users)      │
  │                          │   gateway   │                          │
  │  ~10 in-memory users     │             │  ~30 in-memory notes      │
  └────────────────────────┘             └──────────────────────────┘
```

The gateway never touches a database directly — every field is resolved by
making a real HTTP request to one of the two REST services. Both services
add a small artificial latency (30ms) to every handler so the cost of extra
round-trips is observable.

## The N+1 problem, and the fix

A query like this asks for 30 notes, each with its author:

```graphql
{
  notes {
    id
    title
    author { id name }
  }
}
```

GraphQL resolves `Note.author` **once per note**. A naive resolver would do:

```ts
author: (note) => fetchUserById(note.authorId)
```

...which fires **30 separate `GET /users/:id` requests** against
`usersService` for a single GraphQL query — the N+1 problem (1 query for
notes, N queries for their authors).

### The fix

`src/gateway/loaders.ts` creates a per-request `DataLoader<string, User>`
(`userLoader`). `Note.author` calls `context.userLoader.load(note.authorId)`.
DataLoader collects every `.load()` call made within the same tick and
batches them into **one** call to the loader's batch function, which issues
a single `GET /users?ids=1,2,3,...` request to `usersService`. The results
are then mapped back to each individual `.load()` caller — same field-level
API, one HTTP request instead of N.

```ts
// src/gateway/loaders.ts
export function createUserLoader() {
  return new DataLoader<string, UserDTO | null>(async (ids) => {
    const found = await fetchUsersByIds(ids);           // ONE GET /users?ids=...
    const byId = new Map(found.map((u) => [u.id, u]));
    return ids.map((id) => byId.get(id) ?? null);        // mapped back in order
  });
}
```

The same technique is applied to `User.notes` via `notesByAuthorLoader`.

### Proof: `tests/n-plus-one.test.ts`

This test starts real instances of `usersService` and `notesService`, resets
their internal request counters, runs the gateway query above over real HTTP
against the actual gateway server, and then asserts on `usersService`'s
`/_debug/stats` counters:

```ts
expect(stats.listRequestCount).toBe(1);     // ONE batched GET /users?ids=...
expect(stats.getByIdRequestCount).toBe(0);  // ZERO per-note GET /users/:id calls
```

A second test in the same file deliberately bypasses the DataLoader and
calls `fetchUserById` directly for all 30 notes' authors, and asserts the
naive path really does fire `getByIdRequestCount === 30` — i.e. it
demonstrates the N+1 problem exists and would be hit without the loader.

Actual output from `npm test`:

```
 ✓ tests/n-plus-one.test.ts (2 tests) 177ms
   ✓ issues exactly ONE batched request to usersService when resolving author for 30 notes
   ✓ contrast: resolving the same 30 authors WITHOUT the loader fires 30 individual requests
 ✓ tests/resolvers.test.ts (5 tests) 269ms

 Test Files  2 passed (2)
      Tests  7 passed (7)
```

## Project layout

```
src/
  services/
    users.ts        in-memory users + createUsersApp() (Express)
    users.main.ts    entrypoint: starts usersService on PORT (default 4001)
    notes.ts         in-memory notes + createNotesApp() (Express)
    notes.main.ts    entrypoint: starts notesService on PORT (default 4002)
  gateway/
    rest-clients.ts  fetch-based HTTP clients for both REST services
    loaders.ts       DataLoader factories (userLoader, notesByAuthorLoader)
    context.ts       per-request GraphQL context (fresh loaders each request)
    resolvers.ts     Query/User/Note resolvers
    schema.ts        SDL type defs + executable schema (graphql-yoga)
    server.ts        graphql-yoga HTTP server factory
    index.ts         entrypoint: starts the gateway on PORT (default 4000)
tests/
  test-utils.ts        spins up real test instances of both services + gateway
  n-plus-one.test.ts   the critical DataLoader batching proof
  resolvers.test.ts    basic resolver correctness tests
```

## Setup & running

Requires Node >= 18 (built with Node v22.11, npm 10.9). No database, no
external services — everything is in-memory.

```bash
npm install
npm run build   # tsc, strict mode, must compile clean
npm test        # vitest — all tests must pass
npm run dev     # starts usersService (4001), notesService (4002) and the
                 # gateway (4000) together, with file-watching (tsx)
```

`npm run dev` uses `concurrently` to run all three processes (each is its
own independent Node process/module) side by side with labeled, colored
output. `npm start` does the same against the compiled `dist/` output
(run `npm run build` first).

Once running, open **http://localhost:4000/graphql** for the GraphiQL
playground, or query it with curl:

```bash
curl -s http://localhost:4000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ notes { id title author { name email } } }"}'
```

### Example queries

All notes with their authors (the N+1 / DataLoader showcase query):

```graphql
{
  notes {
    id
    title
    author { id name email }
  }
}
```

A single user and the notes they authored:

```graphql
{
  user(id: "3") {
    id
    name
    notes { id title }
  }
}
```

A single note:

```graphql
{
  note(id: "7") {
    id
    title
    body
    author { name }
  }
}
```

All users:

```graphql
{
  users { id name email }
}
```

## REST services (for reference / direct testing)

```
GET http://localhost:4001/users            -> all users
GET http://localhost:4001/users?ids=1,2,3  -> batched lookup (used by DataLoader)
GET http://localhost:4001/users/:id        -> single user

GET http://localhost:4002/notes            -> all notes
GET http://localhost:4002/notes/:id        -> single note
```

Each service also exposes `/_debug/stats` and `/_debug/reset` (request
counters), used only by the test suite to prove request-batching behavior.
