import { createYoga } from "graphql-yoga";
import { createServer, Server } from "node:http";
import { createContext } from "./context";
import { schema } from "./schema";

export function createGatewayYoga() {
  return createYoga({
    schema,
    context: () => createContext(),
    graphiql: true,
  });
}

export function startGateway(port = 4000): Server {
  const yoga = createGatewayYoga();
  const server = createServer(yoga);
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[gateway] GraphQL endpoint at http://localhost:${port}/graphql`);
  });
  return server;
}
