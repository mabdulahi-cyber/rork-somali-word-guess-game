import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/backend/trpc/create-context";
import { roomStore } from "@/backend/trpc/routes/game/room-store";

const playerIdentitySchema = z.object({
  roomCode: z.string().min(3),
  playerId: z.string().min(1),
});

export const gameRouter = createTRPCRouter({
  createRoom: publicProcedure
    .input(
      z.object({
        playerId: z.string().min(1),
        playerName: z.string().min(1),
      })
    )
    .mutation(({ input }) => roomStore.createRoom(input)),
  joinRoom: publicProcedure
    .input(
      z.object({
        roomCode: z.string().min(3),
        playerId: z.string().min(1),
        playerName: z.string().min(1),
      })
    )
    .mutation(({ input }) => roomStore.joinRoom(input)),
  selectTeam: publicProcedure
    .input(
      playerIdentitySchema.extend({
        team: z.union([z.literal("red"), z.literal("blue")]),
      })
    )
    .mutation(({ input }) => roomStore.selectTeam(input)),
  setRole: publicProcedure
    .input(
      playerIdentitySchema.extend({
        role: z.union([z.literal("spymaster"), z.literal("guesser")]),
      })
    )
    .mutation(({ input }) => roomStore.setRole(input)),
  revealCard: publicProcedure
    .input(
      playerIdentitySchema.extend({
        cardId: z.string().min(1),
      })
    )
    .mutation(({ input }) => roomStore.revealCard(input)),
  sendHint: publicProcedure
    .input(
      playerIdentitySchema.extend({
        word: z.string().min(1),
        number: z.number().min(1).max(5),
      })
    )
    .mutation(({ input }) => roomStore.sendHint(input)),
  endTurn: publicProcedure
    .input(playerIdentitySchema)
    .mutation(({ input }) => roomStore.endTurn(input)),
  resetGame: publicProcedure
    .input(playerIdentitySchema)
    .mutation(({ input }) => roomStore.resetGame(input)),
  toggleMic: publicProcedure
    .input(playerIdentitySchema)
    .mutation(({ input }) => roomStore.toggleMic(input)),
  getRoomState: publicProcedure
    .input(z.object({ roomCode: z.string().min(3) }))
    .query(({ input }) => roomStore.getRoomState(input.roomCode)),
});

export default gameRouter;
