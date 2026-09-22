import { startNotesService } from "./notes";

startNotesService(Number(process.env.PORT) || 4002);
