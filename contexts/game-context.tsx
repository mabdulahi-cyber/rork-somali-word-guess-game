import { useCallback, useMemo, useState } from "react";
import createContextHook from "@nkzw/create-context-hook";
import { trpc } from "@/lib/trpc";
import type { Player, Role, RoomState, Team } from "@/types/game";

interface GameContextValue {
  playerId: string;
  playerName: string;
  roomCode: string | null;
  roomState: RoomState | null;
  currentPlayer: Player | null;
  isRoomLoading: boolean;
  createRoom: (name: string) => Promise<void>;
  joinRoom: (name: string, code: string) => Promise<void>;
  selectTeam: (team: Team) => Promise<void>;
  setRole: (role: Role) => Promise<void>;
  revealCard: (cardId: string) => Promise<void>;
  sendHint: (word: string, number: number) => Promise<void>;
  endTurn: () => Promise<void>;
  resetGame: () => Promise<void>;
  toggleMic: () => Promise<void>;
  leaveRoom: () => void;
}

const generatePlayerId = () => `player-${Math.random().toString(36).slice(2, 10)}`;

export const [GameProvider, useGame] = createContextHook<GameContextValue>(() => {
  const [playerId] = useState<string>(() => generatePlayerId());
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>("");

  const roomQuery = trpc.game.getRoomState.useQuery(
    { roomCode: roomCode ?? "" },
    {
      enabled: !!roomCode,
      refetchInterval: 2000,
      refetchIntervalInBackground: true,
    }
  );

  const roomState = roomQuery.data ?? null;

  const createRoomMutation = trpc.game.createRoom.useMutation();
  const joinRoomMutation = trpc.game.joinRoom.useMutation();
  const selectTeamMutation = trpc.game.selectTeam.useMutation();
  const setRoleMutation = trpc.game.setRole.useMutation();
  const revealCardMutation = trpc.game.revealCard.useMutation();
  const sendHintMutation = trpc.game.sendHint.useMutation();
  const endTurnMutation = trpc.game.endTurn.useMutation();
  const resetGameMutation = trpc.game.resetGame.useMutation();
  const toggleMicMutation = trpc.game.toggleMic.useMutation();

  const currentPlayer = useMemo(() => {
    if (!roomState) return null;
    return roomState.players.find((p) => p.id === playerId) ?? null;
  }, [playerId, roomState]);

  const createRoom = useCallback(
    async (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Name is required");

      const result = await createRoomMutation.mutateAsync({
        playerId,
        playerName: trimmedName,
      });

      console.log("[GameContext] createRoom", { roomCode: result.room.roomCode, playerId });
      setRoomCode(result.room.roomCode);
      setPlayerName(trimmedName);
    },
    [playerId, createRoomMutation]
  );

  const joinRoom = useCallback(
    async (name: string, code: string) => {
      const trimmedName = name.trim();
      const trimmedCode = code.trim().toUpperCase();
      if (!trimmedName || !trimmedCode) throw new Error("Name and room code are required");

      await joinRoomMutation.mutateAsync({
        roomCode: trimmedCode,
        playerId,
        playerName: trimmedName,
      });

      console.log("[GameContext] joinRoom", { roomCode: trimmedCode, playerId });
      setRoomCode(trimmedCode);
      setPlayerName(trimmedName);
    },
    [playerId, joinRoomMutation]
  );

  const selectTeam = useCallback(
    async (team: Team) => {
      if (!roomCode) throw new Error("Join a room first");
      console.log("[GameContext] selectTeam", { roomCode, playerId, team });

      await selectTeamMutation.mutateAsync({
        roomCode,
        playerId,
        team,
      });
      await roomQuery.refetch();
    },
    [playerId, roomCode, selectTeamMutation, roomQuery]
  );

  const setRole = useCallback(
    async (role: Role) => {
      if (!roomCode) throw new Error("Join a room first");
      console.log("[GameContext] setRole", { roomCode, playerId, role });

      await setRoleMutation.mutateAsync({
        roomCode,
        playerId,
        role,
      });
      await roomQuery.refetch();
    },
    [playerId, roomCode, setRoleMutation, roomQuery]
  );

  const revealCard = useCallback(
    async (cardId: string) => {
      if (!roomCode) throw new Error("Join a room first");
      console.log("[GameContext] revealCard", { roomCode, playerId, cardId });

      await revealCardMutation.mutateAsync({
        roomCode,
        playerId,
        cardId,
      });
      await roomQuery.refetch();
    },
    [playerId, roomCode, revealCardMutation, roomQuery]
  );

  const sendHint = useCallback(
    async (word: string, number: number) => {
      if (!roomCode) throw new Error("Join a room first");
      const trimmed = word.trim();
      if (!trimmed) throw new Error("Hint word is required");

      console.log("[GameContext] sendHint", { roomCode, playerId, trimmed, number });

      await sendHintMutation.mutateAsync({
        roomCode,
        playerId,
        word: trimmed,
        number,
      });
      await roomQuery.refetch();
    },
    [playerId, roomCode, sendHintMutation, roomQuery]
  );

  const endTurn = useCallback(async () => {
    if (!roomCode) throw new Error("Join a room first");
    console.log("[GameContext] endTurn", { roomCode, playerId });

    await endTurnMutation.mutateAsync({
      roomCode,
      playerId,
    });
    await roomQuery.refetch();
  }, [playerId, roomCode, endTurnMutation, roomQuery]);

  const resetGame = useCallback(async () => {
    if (!roomCode) throw new Error("Join a room first");
    console.log("[GameContext] resetGame", { roomCode, playerId });

    await resetGameMutation.mutateAsync({
      roomCode,
      playerId,
    });
    await roomQuery.refetch();
  }, [playerId, roomCode, resetGameMutation, roomQuery]);

  const toggleMic = useCallback(async () => {
    if (!roomCode) throw new Error("Join a room first");
    console.log("[GameContext] toggleMic", { roomCode, playerId });

    await toggleMicMutation.mutateAsync({
      roomCode,
      playerId,
    });
    await roomQuery.refetch();
  }, [playerId, roomCode, toggleMicMutation, roomQuery]);

  const leaveRoom = useCallback(() => {
    console.log("[GameContext] leaveRoom", { roomCode, playerId });
    setRoomCode(null);
    setPlayerName("");
  }, [playerId, roomCode]);

  return {
    playerId,
    playerName,
    roomCode,
    roomState,
    currentPlayer,
    isRoomLoading: roomQuery.isLoading,
    createRoom,
    joinRoom,
    selectTeam,
    setRole,
    revealCard,
    sendHint,
    endTurn,
    resetGame,
    toggleMic,
    leaveRoom,
  };
});
