import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import { gameRouter } from "./routes/game/router";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  game: gameRouter,
});

export type AppRouter = typeof appRouter;
