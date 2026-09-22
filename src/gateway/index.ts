import { startGateway } from "./server";

startGateway(Number(process.env.PORT) || 4000);
