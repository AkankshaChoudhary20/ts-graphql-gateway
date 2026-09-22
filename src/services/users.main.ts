import { startUsersService } from "./users";

startUsersService(Number(process.env.PORT) || 4001);
