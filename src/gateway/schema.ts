import { createSchema } from "graphql-yoga";
import { resolvers } from "./resolvers";

export const typeDefs = /* GraphQL */ `
  type User {
    id: ID!
    name: String!
    email: String!
    notes: [Note!]!
  }

  type Note {
    id: ID!
    title: String!
    body: String!
    author: User!
  }

  type Query {
    users: [User!]!
    notes: [Note!]!
    user(id: ID!): User
    note(id: ID!): Note
  }
`;

/**
 * A standard executable GraphQLSchema (graphql-js compatible), usable both
 * by the Yoga HTTP server and directly in tests via graphql-js `execute`.
 */
export const schema = createSchema({
  typeDefs,
  resolvers,
});
